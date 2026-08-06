import { describe, it, expect } from 'vitest';
import {
	dockerLabel,
	formatClockTime,
	isServerRunning,
	messageFrom,
	portLabel,
	processLabel,
	serverLink
} from '$lib/servers-view';
import type { ServerStatus } from '$lib/types';

function status(overrides: Partial<ServerStatus> = {}): ServerStatus {
	return {
		id: 'server-1',
		checkedAt: '2026-08-06T12:00:00.000Z',
		process: { state: 'stopped', pid: null, startedAt: null },
		port: { configured: 9150, listening: false },
		docker: { enabled: false, state: 'stopped', services: [], error: null },
		...overrides
	};
}

describe('isServerRunning', () => {
	it('is false without a status yet', () => {
		expect(isServerRunning(undefined)).toBe(false);
	});

	it('is true when the process is alive', () => {
		expect(
			isServerRunning(status({ process: { state: 'running', pid: 42, startedAt: null } }))
		).toBe(true);
	});

	it('is true when only the port answers, which outlives a stale pid', () => {
		expect(isServerRunning(status({ port: { configured: 9150, listening: true } }))).toBe(true);
	});

	it('is false when neither the process nor the port is up', () => {
		expect(isServerRunning(status())).toBe(false);
	});
});

describe('serverLink', () => {
	it('points at the recorded port on localhost', () => {
		expect(serverLink({ port: 9150 })).toBe('http://localhost:9150');
	});
});

describe('processLabel', () => {
	it('adds the pid when there is one', () => {
		expect(
			processLabel(status({ process: { state: 'running', pid: 4242, startedAt: null } }))
		).toBe('process running · pid 4242');
	});

	it('omits the pid when there is none', () => {
		expect(processLabel(status())).toBe('process stopped');
	});
});

describe('portLabel', () => {
	it('reads listening when the port answers', () => {
		expect(portLabel(status({ port: { configured: 7010, listening: true } }))).toBe(
			'port 7010 listening'
		);
	});

	it('reads closed when it does not', () => {
		expect(portLabel(status())).toBe('port 9150 closed');
	});
});

describe('dockerLabel', () => {
	it('reports an unknown probe without inventing a count', () => {
		expect(
			dockerLabel(status({ docker: { enabled: true, state: 'unknown', services: [], error: 'x' } }))
		).toBe('docker unknown');
	});

	it('reports the state alone when there are no services', () => {
		expect(
			dockerLabel(
				status({ docker: { enabled: true, state: 'stopped', services: [], error: null } })
			)
		).toBe('docker stopped');
	});

	it('counts running services against the total', () => {
		expect(
			dockerLabel(
				status({
					docker: {
						enabled: true,
						state: 'partial',
						services: [
							{ name: 'db', state: 'running' },
							{ name: 'web', state: 'exited' }
						],
						error: null
					}
				})
			)
		).toBe('docker partial 1/2');
	});

	it('counts a compose "running (healthy)" service as running', () => {
		expect(
			dockerLabel(
				status({
					docker: {
						enabled: true,
						state: 'running',
						services: [{ name: 'db', state: 'running (healthy)' }],
						error: null
					}
				})
			)
		).toBe('docker running 1/1');
	});
});

describe('formatClockTime', () => {
	it('says never when nothing has been checked', () => {
		expect(formatClockTime(null)).toBe('never');
	});

	it('formats a timestamp as a local time', () => {
		const noon = new Date(2026, 7, 6, 12, 30).getTime();
		expect(formatClockTime(noon)).toBe(new Date(noon).toLocaleTimeString());
	});
});

describe('messageFrom', () => {
	it('takes the message off an error', () => {
		expect(messageFrom(new Error('port 9150 is already listening'))).toBe(
			'port 9150 is already listening'
		);
	});

	it('stringifies anything else', () => {
		expect(messageFrom('plain string')).toBe('plain string');
		expect(messageFrom(404)).toBe('404');
	});
});
