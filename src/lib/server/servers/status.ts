import { createConnection } from 'node:net';
import type { DockerServiceStatus, ManagedServer, ServerStatus } from '$lib/types';
import { isProcessAlive, runShellCommand } from './process';

/** A local port either answers fast or it isn't listening. */
const PORT_PROBE_TIMEOUT_MS = 900;

/** `docker compose ps` is quick, but the daemon can be slow to wake. */
const DOCKER_PROBE_TIMEOUT_MS = 20_000;

/** Compose states that mean the container is actually up. */
const RUNNING_STATES = new Set(['running', 'restarting']);

/**
 * True when something accepts a TCP connection on `port` locally. This is the
 * signal that survives a workboard restart: the recorded pid may be stale, but
 * a listening port means the server is genuinely up.
 */
export function isPortListening(port: number, host = '127.0.0.1'): Promise<boolean> {
	return new Promise((resolvePromise) => {
		const socket = createConnection({ port, host });
		let settled = false;

		const finish = (listening: boolean) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolvePromise(listening);
		};

		socket.setTimeout(PORT_PROBE_TIMEOUT_MS);
		socket.once('connect', () => finish(true));
		socket.once('timeout', () => finish(false));
		socket.once('error', () => finish(false));
	});
}

type ComposePsRow = {
	Name?: string;
	Service?: string;
	State?: string;
	Status?: string;
};

/**
 * `docker compose ps --format json` emits a JSON array on newer Compose and
 * one JSON object per line on older builds. Accept both.
 */
export function parseComposePs(stdout: string): DockerServiceStatus[] {
	const trimmed = stdout.trim();
	if (!trimmed) return [];

	const rows: ComposePsRow[] = [];
	if (trimmed.startsWith('[')) {
		const parsed = JSON.parse(trimmed);
		if (Array.isArray(parsed)) rows.push(...parsed);
	} else {
		for (const line of trimmed.split(/\r?\n/)) {
			const candidate = line.trim();
			if (!candidate.startsWith('{')) continue;
			rows.push(JSON.parse(candidate));
		}
	}

	return rows.map((row) => ({
		name: row.Service || row.Name || 'unknown',
		state: (row.State || row.Status || 'unknown').toLowerCase()
	}));
}

export function summariseDockerState(
	services: DockerServiceStatus[]
): 'running' | 'partial' | 'stopped' {
	if (services.length === 0) return 'stopped';
	const running = services.filter((service) => RUNNING_STATES.has(service.state)).length;
	if (running === 0) return 'stopped';
	return running === services.length ? 'running' : 'partial';
}

async function probeDocker(server: ManagedServer): Promise<ServerStatus['docker']> {
	if (!server.docker) {
		return { enabled: false, state: 'stopped', services: [], error: null };
	}

	try {
		const { stdout } = await runShellCommand(
			'docker compose ps --format json',
			server.directory,
			DOCKER_PROBE_TIMEOUT_MS
		);
		const services = parseComposePs(stdout);
		return { enabled: true, state: summariseDockerState(services), services, error: null };
	} catch (caught) {
		return {
			enabled: true,
			state: 'unknown',
			services: [],
			error: caught instanceof Error ? caught.message : String(caught)
		};
	}
}

/** Probe every signal we have for one server. Independent checks run together. */
export async function probeServerStatus(server: ManagedServer): Promise<ServerStatus> {
	const [listening, docker] = await Promise.all([
		server.port === null ? Promise.resolve(null) : isPortListening(server.port),
		probeDocker(server)
	]);

	const alive = isProcessAlive(server.pid);

	return {
		id: server.id,
		checkedAt: new Date().toISOString(),
		process: {
			state: alive ? 'running' : 'stopped',
			pid: alive ? server.pid : null,
			startedAt: alive ? server.startedAt : null
		},
		port: { configured: server.port, listening },
		docker
	};
}
