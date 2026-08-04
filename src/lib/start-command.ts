/**
 * How a managed server is launched. Pure and client-safe on purpose: the edit
 * form previews the exact command the server will run, so there is one source
 * of truth instead of a UI string that can drift from the real launcher.
 */
import type { ServerType } from './types';

/** What we run for a Docker-backed project unless the record overrides it. */
export const DEFAULT_DOCKER_COMMAND = 'docker compose up -d';

/** Fallback teardown when a custom start command can't be rewritten. */
export const DEFAULT_DOCKER_STOP_COMMAND = 'docker compose down';

export const SERVER_TYPE_LABELS: Record<ServerType, string> = {
	python: 'Python (uv)',
	node: 'Svelte (npm)'
};

export function isServerType(value: unknown): value is ServerType {
	return value === 'python' || value === 'node';
}

/** Zero and anything above the 16-bit range can never be listened on. */
export function isValidPort(port: number): boolean {
	return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/** Ports we accept on a server record; anything out of range is rejected. */
export function parsePort(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const port = typeof value === 'number' ? value : Number(String(value).trim());
	if (!isValidPort(port)) {
		throw new Error(
			`parsing server port: expected an integer between 1 and 65535, received ${JSON.stringify(value)}`
		);
	}
	return port;
}

/**
 * True when the launcher should actually apply the recorded port at start time.
 * Turn it off when the project already configures its own port — a `PORT=` in
 * `.env`, `server.port` in a Vite config, a `--port` baked into the dev script.
 * The port stays recorded either way, because status probing and the launcher's
 * open link still need to know where the app listens.
 */
export function shouldApplyPort(port: number | null, passPortToCommand: boolean): boolean {
	return port !== null && passPortToCommand;
}

/**
 * The command used to launch the server itself (Docker resources, if any, are
 * brought up separately before this runs).
 *
 * Node projects take the port as a `--port` argument. Python projects follow
 * the Nacelle convention of a single `uv run start_server` entry point that
 * takes no port argument — for those the port travels in the environment
 * instead, see {@link buildStartEnvironment}.
 */
export function buildStartCommand(
	serverType: ServerType,
	port: number | null,
	passPortToCommand: boolean
): string {
	if (serverType === 'python') return 'uv run start_server';
	if (serverType === 'node') {
		return shouldApplyPort(port, passPortToCommand)
			? `npm run dev -- --port=${port}`
			: 'npm run dev';
	}
	throw new Error(
		`building start command: unknown server type ${JSON.stringify(serverType)}; expected "python" or "node"`
	);
}

/**
 * Environment overlaid on the launched process. A Python entry point reads its
 * port from `PORT`, so that is how the flag applies there; when the project
 * already sets `PORT` in its own `.env`, the flag is off and we add nothing,
 * leaving the app's own configuration untouched.
 */
export function buildStartEnvironment(
	serverType: ServerType,
	port: number | null,
	passPortToCommand: boolean
): Record<string, string> {
	if (serverType === 'python' && shouldApplyPort(port, passPortToCommand)) {
		return { PORT: String(port) };
	}
	return {};
}

/** The full invocation, env prefix included — what the edit form previews. */
export function describeStartCommand(
	serverType: ServerType,
	port: number | null,
	passPortToCommand: boolean
): string {
	const environment = buildStartEnvironment(serverType, port, passPortToCommand);
	const prefix = Object.entries(environment)
		.map(([key, value]) => `${key}=${value} `)
		.join('');
	return prefix + buildStartCommand(serverType, port, passPortToCommand);
}

/**
 * Turn a Compose start command into its teardown counterpart, keeping any
 * flags that sit before the verb (`docker compose -f other.yml up -d` →
 * `docker compose -f other.yml down`). Anything we don't recognise as a
 * Compose invocation falls back to a plain `docker compose down`.
 */
export function deriveDockerStopCommand(startCommand: string): string {
	const trimmed = startCommand.trim();
	if (!trimmed) return DEFAULT_DOCKER_STOP_COMMAND;

	const composeUp = /^(.*?(?:docker\s+compose|docker-compose)\b.*?)\s+up\b.*$/i.exec(trimmed);
	if (composeUp) return `${composeUp[1]} down`;

	return DEFAULT_DOCKER_STOP_COMMAND;
}
