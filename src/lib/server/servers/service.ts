import { resolve } from 'node:path';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { managedServer } from '$lib/server/db/schema';
import type {
	ManagedServer,
	ManagedServerDraft,
	ManagedServerWithStatus,
	ServerStatus,
	ServerType
} from '$lib/types';
import {
	buildStartCommand,
	buildStartEnvironment,
	deriveDockerStopCommand,
	isServerType,
	parsePort,
	DEFAULT_DOCKER_COMMAND
} from '$lib/start-command';
import { aliasFromDirectory, detectServer } from './detect';
import {
	findPortOwnerPid,
	isProcessAlive,
	logPathFor,
	runShellCommand,
	spawnBackgroundCommand,
	stopProcessTree
} from './process';
import { isPortListening, probeServerStatus } from './status';

type ManagedServerRow = typeof managedServer.$inferSelect;

/** Raised when an id doesn't match a row, so routes can answer 404. */
export class ManagedServerNotFoundError extends Error {}

function toManagedServer(row: ManagedServerRow): ManagedServer {
	if (!isServerType(row.serverType)) {
		throw new Error(
			`reading managed server ${row.id} ("${row.alias}"): stored server_type ` +
				`${JSON.stringify(row.serverType)} is not one of "python" | "node"`
		);
	}
	return { ...row, serverType: row.serverType };
}

/**
 * Normalise whatever the form submitted into a row we are willing to store: the
 * type must be known and the port must be a real port.
 */
export async function normaliseDraft(input: unknown): Promise<ManagedServerDraft> {
	const draft = (input ?? {}) as Record<string, unknown>;

	const rawDirectory = typeof draft.directory === 'string' ? draft.directory.trim() : '';
	if (!rawDirectory) {
		throw new Error('saving managed server: a project directory is required, but none was given');
	}
	const directory = resolve(rawDirectory);

	let serverType: ServerType;
	if (isServerType(draft.serverType)) {
		serverType = draft.serverType;
	} else {
		// Fall back to detection rather than rejecting — the picker sends the
		// directory first and the type only once the user has confirmed it.
		const detected = await detectServer(directory);
		if (!detected.serverType) {
			throw new Error(
				`saving managed server for "${directory}": server type ${JSON.stringify(draft.serverType)} ` +
					`is not "python" or "node", and no pyproject.toml or package.json was found to infer it`
			);
		}
		serverType = detected.serverType;
	}

	const alias =
		typeof draft.alias === 'string' && draft.alias.trim()
			? draft.alias.trim()
			: aliasFromDirectory(directory);

	const docker = Boolean(draft.docker);
	const dockerCommandInput =
		typeof draft.dockerCommand === 'string' ? draft.dockerCommand.trim() : '';

	return {
		alias,
		directory,
		serverType,
		port: parsePort(draft.port),
		docker,
		dockerCommand: docker ? dockerCommandInput || DEFAULT_DOCKER_COMMAND : dockerCommandInput
	};
}

export async function listServers(): Promise<ManagedServer[]> {
	const rows = await db.select().from(managedServer).orderBy(asc(managedServer.alias));
	return rows.map(toManagedServer);
}

export async function getServer(id: string): Promise<ManagedServer> {
	const rows = await db.select().from(managedServer).where(eq(managedServer.id, id));
	if (!rows[0]) {
		throw new ManagedServerNotFoundError(
			`loading managed server ${id}: no such row in the managed_server table`
		);
	}
	return toManagedServer(rows[0]);
}

export async function createServer(draft: ManagedServerDraft): Promise<ManagedServer> {
	const [created] = await db.insert(managedServer).values(draft).returning();
	return toManagedServer(created);
}

export async function updateServer(id: string, draft: ManagedServerDraft): Promise<ManagedServer> {
	await getServer(id);
	const [updated] = await db
		.update(managedServer)
		.set(draft)
		.where(eq(managedServer.id, id))
		.returning();
	return toManagedServer(updated);
}

export async function deleteServer(id: string): Promise<ServerStatus> {
	const stopped = await stopServer(id);

	if (stopped.process.state === 'running') {
		throw new Error(
			`deleting managed server ${id}: its process (pid ${stopped.process.pid}) is still running ` +
				`after the stop command, so the record was kept`
		);
	}
	if (stopped.docker.enabled && stopped.docker.state !== 'stopped') {
		throw new Error(
			`deleting managed server ${id}: its Docker resources are still "${stopped.docker.state}" ` +
				`after the stop command, so the record was kept`
		);
	}

	await db.delete(managedServer).where(eq(managedServer.id, id));
	return stopped;
}

async function clearProcessRecord(id: string): Promise<void> {
	await db
		.update(managedServer)
		.set({ pid: null, startedAt: null })
		.where(eq(managedServer.id, id));
}

async function adoptProcessRecord(id: string, pid: number, startedAt: string): Promise<void> {
	await db.update(managedServer).set({ pid, startedAt }).where(eq(managedServer.id, id));
}

async function reconcileProcessRecord(
	server: ManagedServer,
	status: ServerStatus
): Promise<{ server: ManagedServer; status: ServerStatus }> {
	if (status.process.state === 'running') return { server, status };
	if (server.pid === null) return { server, status };

	if (status.port.listening) {
		if (server.docker) return { server, status };

		const ownerPid = await findPortOwnerPid(server.port);
		if (ownerPid === null) {
			return { server, status };
		}

		const startedAt = server.startedAt ?? new Date().toISOString();
		await adoptProcessRecord(server.id, ownerPid, startedAt);
		return {
			server: { ...server, pid: ownerPid, startedAt },
			status: { ...status, process: { state: 'running', pid: ownerPid, startedAt } }
		};
	}

	await clearProcessRecord(server.id);
	return { server: { ...server, pid: null, startedAt: null }, status };
}

export async function checkServer(id: string): Promise<ServerStatus> {
	const server = await getServer(id);
	const probed = await probeServerStatus(server);
	return (await reconcileProcessRecord(server, probed)).status;
}

export async function startServer(id: string): Promise<ServerStatus> {
	const server = await getServer(id);

	if (isProcessAlive(server.pid)) {
		throw new Error(
			`starting managed server "${server.alias}" (${id}): it is already running as pid ${server.pid}; ` +
				`stop or restart it instead`
		);
	}

	if (await isPortListening(server.port)) {
		const ownerPid = await findPortOwnerPid(server.port);
		throw new Error(
			`starting managed server "${server.alias}" (${id}): port ${server.port} is already ` +
				`listening${ownerPid === null ? '' : ` (pid ${ownerPid})`}, so no second instance was ` +
				`started; stop or restart it instead`
		);
	}

	if (server.docker) {
		const dockerCommand = server.dockerCommand || DEFAULT_DOCKER_COMMAND;
		await runShellCommand(dockerCommand, server.directory);
	}

	const logPath = logPathFor(id);
	const command = buildStartCommand(server.serverType);
	const environment = buildStartEnvironment(server.port);
	const pid = await spawnBackgroundCommand(command, server.directory, logPath, environment);
	const startedAt = new Date().toISOString();

	await db.update(managedServer).set({ pid, startedAt, logPath }).where(eq(managedServer.id, id));

	return probeServerStatus({ ...server, pid, startedAt, logPath });
}

export async function stopServer(id: string): Promise<ServerStatus> {
	const server = await getServer(id);

	if (server.pid !== null) {
		await stopProcessTree(server.pid);
	}

	if (server.docker) {
		await runShellCommand(deriveDockerStopCommand(server.dockerCommand || ''), server.directory);
	}

	if (server.pid !== null && (await isPortListening(server.port))) {
		const ownerPid = await findPortOwnerPid(server.port);
		if (ownerPid !== null && ownerPid !== server.pid) await stopProcessTree(ownerPid);
	}

	await clearProcessRecord(id);

	return probeServerStatus({ ...server, pid: null, startedAt: null });
}

export async function restartServer(id: string): Promise<ServerStatus> {
	await stopServer(id);
	return startServer(id);
}

export async function listServersWithStatus(): Promise<ManagedServerWithStatus[]> {
	const servers = await listServers();

	return Promise.all(
		servers.map(async (server) => {
			const probed = await probeServerStatus(server);
			const reconciled = await reconcileProcessRecord(server, probed);
			return { ...reconciled.server, status: reconciled.status };
		})
	);
}
