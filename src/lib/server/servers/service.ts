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
	isProcessAlive,
	logPathFor,
	runShellCommand,
	spawnBackgroundCommand,
	stopProcessTree
} from './process';
import { probeServerStatus } from './status';

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
		// Absent means "yes" — only an explicit false suppresses the flag, so an
		// older client can't silently stop passing a port it meant to pass.
		passPortToCommand: draft.passPortToCommand !== false,
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

/**
 * Stop the server (and its Docker resources), confirm nothing is left running,
 * then drop the record. Refuses to delete while the process is still alive so
 * we never lose track of a running server.
 */
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

/** Forget a pid we know is gone, so the UI stops reporting a dead process. */
async function clearProcessRecord(id: string): Promise<void> {
	await db
		.update(managedServer)
		.set({ pid: null, startedAt: null })
		.where(eq(managedServer.id, id));
}

export async function startServer(id: string): Promise<ServerStatus> {
	const server = await getServer(id);

	if (isProcessAlive(server.pid)) {
		throw new Error(
			`starting managed server "${server.alias}" (${id}): it is already running as pid ${server.pid}; ` +
				`stop or restart it instead`
		);
	}

	if (server.docker) {
		const dockerCommand = server.dockerCommand || DEFAULT_DOCKER_COMMAND;
		await runShellCommand(dockerCommand, server.directory);
	}

	const logPath = logPathFor(id);
	const command = buildStartCommand(server.serverType, server.port, server.passPortToCommand);
	const environment = buildStartEnvironment(
		server.serverType,
		server.port,
		server.passPortToCommand
	);
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
	await clearProcessRecord(id);

	if (server.docker) {
		await runShellCommand(deriveDockerStopCommand(server.dockerCommand || ''), server.directory);
	}

	return probeServerStatus({ ...server, pid: null, startedAt: null });
}

export async function restartServer(id: string): Promise<ServerStatus> {
	await stopServer(id);
	return startServer(id);
}

/**
 * Every server with a freshly probed status. Stale pids (a server that died on
 * its own, or a workboard restart that outlived its children) are cleared here
 * so the next poll starts from the truth.
 */
export async function listServersWithStatus(): Promise<ManagedServerWithStatus[]> {
	const servers = await listServers();

	return Promise.all(
		servers.map(async (server) => {
			const status = await probeServerStatus(server);
			if (server.pid !== null && status.process.state === 'stopped') {
				await clearProcessRecord(server.id);
				return { ...server, pid: null, startedAt: null, status };
			}
			return { ...server, status };
		})
	);
}
