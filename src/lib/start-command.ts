import type { ServerType } from './types';

export const DEFAULT_DOCKER_COMMAND = 'docker compose up -d';
export const DEFAULT_DOCKER_STOP_COMMAND = 'docker compose down';
export function isServerType(value: unknown): value is ServerType {
	return value === 'python' || value === 'node';
}

export function isValidPort(port: number): boolean {
	return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function parsePort(value: unknown): number {
	if (value === null || value === undefined || value === '') {
		throw new Error('parsing server port: a port is required, but none was given');
	}
	const port = typeof value === 'number' ? value : Number(String(value).trim());
	if (!isValidPort(port)) {
		throw new Error(
			`parsing server port: expected an integer between 1 and 65535, received ${JSON.stringify(value)}`
		);
	}
	return port;
}

export function buildStartCommand(serverType: ServerType): string {
	if (serverType === 'python') {
		return 'uv run start_server';
	}
	if (serverType === 'node') {
		return 'npm run dev';
	}
	throw new Error(
		`building start command: unknown server type ${JSON.stringify(serverType)}; expected "python" or "node"`
	);
}

export function describeStartCommand(serverType: ServerType, port: number): string {
	const prefix = `PORT=${port} `;
	return prefix + buildStartCommand(serverType);
}

export function deriveDockerStopCommand(startCommand: string): string {
	const trimmed = startCommand.trim();
	if (!trimmed) {
		return DEFAULT_DOCKER_STOP_COMMAND;
	}

	const composeUp = /^(.*?(?:docker\s+compose|docker-compose)\b.*?)\s+up\b.*$/i.exec(trimmed);
	if (composeUp) {
		return `${composeUp[1]} down`;
	}

	return DEFAULT_DOCKER_STOP_COMMAND;
}
