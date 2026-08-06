import type { ManagedServer, ServerStatus, ServerType } from './types';

export const SERVER_TYPE_TAGS: Record<ServerType, string> = {
	python: 'python',
	node: 'npm'
};

/** A live port counts as running even when the recorded pid does not answer. */
export function isServerRunning(status: ServerStatus | undefined): boolean {
	if (!status) {
		return false;
	}
	return status.process.state === 'running' || status.port.listening;
}

export function serverLink(server: Pick<ManagedServer, 'port'>): string {
	return `http://localhost:${server.port}`;
}

export function processLabel(status: ServerStatus): string {
	const pid = status.process.pid === null ? '' : ` · pid ${status.process.pid}`;
	return `process ${status.process.state}${pid}`;
}

export function portLabel(status: ServerStatus): string {
	return `port ${status.port.configured} ${status.port.listening ? 'listening' : 'closed'}`;
}

export function dockerLabel(status: ServerStatus): string {
	if (status.docker.state === 'unknown') {
		return 'docker unknown';
	}

	const services = status.docker.services;
	if (services.length === 0) {
		return `docker ${status.docker.state}`;
	}

	const running = services.filter((service) => service.state.startsWith('running')).length;
	return `docker ${status.docker.state} ${running}/${services.length}`;
}

export function formatClockTime(timestamp: number | null): string {
	return timestamp === null ? 'never' : new Date(timestamp).toLocaleTimeString();
}

export function messageFrom(caught: unknown): string {
	return caught instanceof Error ? caught.message : String(caught);
}
