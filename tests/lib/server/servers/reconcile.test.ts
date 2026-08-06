import { describe, it, expect } from 'vitest';
import { decideProcessRecord, needsPortOwnerLookup } from '$lib/server/servers/reconcile';
import type { ManagedServer, ServerStatus } from '$lib/types';

const NOW = '2026-08-06T12:00:00.000Z';
const STARTED = '2026-08-06T09:30:00.000Z';

function server(overrides: Partial<ManagedServer> = {}): ManagedServer {
	return {
		id: 'server-1',
		alias: 'knowledge',
		directory: 'C:\\projects\\knowledge',
		serverType: 'node',
		port: 9150,
		docker: false,
		dockerCommand: '',
		pid: 4242,
		startedAt: STARTED,
		logPath: 'logs/servers/server-1.log',
		createdAt: STARTED,
		...overrides
	};
}

function status(overrides: {
	processState?: 'running' | 'stopped';
	pid?: number | null;
	listening?: boolean;
}): ServerStatus {
	const processState = overrides.processState ?? 'stopped';
	return {
		id: 'server-1',
		checkedAt: NOW,
		process: {
			state: processState,
			pid: overrides.pid ?? (processState === 'running' ? 4242 : null),
			startedAt: processState === 'running' ? STARTED : null
		},
		port: { configured: 9150, listening: overrides.listening ?? false },
		docker: { enabled: false, state: 'stopped', services: [], error: null }
	};
}

describe('needsPortOwnerLookup', () => {
	it('asks for a lookup when a recorded pid is dead but the port answers', () => {
		expect(needsPortOwnerLookup(server(), status({ listening: true }))).toBe(true);
	});

	it('skips the lookup while the recorded pid is alive', () => {
		expect(
			needsPortOwnerLookup(server(), status({ processState: 'running', listening: true }))
		).toBe(false);
	});

	it('skips the lookup when the port is closed', () => {
		expect(needsPortOwnerLookup(server(), status({ listening: false }))).toBe(false);
	});

	it('asks for a lookup even when no pid was ever recorded', () => {
		expect(needsPortOwnerLookup(server({ pid: null }), status({ listening: true }))).toBe(true);
	});

	it('skips the lookup for a Docker-backed row', () => {
		expect(needsPortOwnerLookup(server({ docker: true }), status({ listening: true }))).toBe(false);
	});
});

describe('decideProcessRecord', () => {
	it('keeps a record whose process is still alive', () => {
		expect(decideProcessRecord(server(), status({ processState: 'running' }), null, NOW)).toEqual({
			action: 'keep'
		});
	});

	it('leaves a pidless record alone when its port is closed too', () => {
		expect(decideProcessRecord(server({ pid: null }), status({}), null, NOW)).toEqual({
			action: 'keep'
		});
	});

	it('adopts the port owner when the recorded pid died but the port answers', () => {
		expect(decideProcessRecord(server(), status({ listening: true }), 8888, NOW)).toEqual({
			action: 'adopt',
			pid: 8888,
			startedAt: STARTED
		});
	});

	it('reclaims a pid that was forgotten, so a cleared record recovers', () => {
		expect(
			decideProcessRecord(
				server({ pid: null, startedAt: null }),
				status({ listening: true }),
				8888,
				NOW
			)
		).toEqual({ action: 'adopt', pid: 8888, startedAt: NOW });
	});

	it('adopts a pid that differs from the one on file', () => {
		expect(
			decideProcessRecord(server({ pid: 4242 }), status({ listening: true }), 9999, NOW)
		).toEqual({ action: 'adopt', pid: 9999, startedAt: STARTED });
	});

	it('stamps now as the start time when the record has none', () => {
		expect(
			decideProcessRecord(server({ startedAt: null }), status({ listening: true }), 8888, NOW)
		).toEqual({ action: 'adopt', pid: 8888, startedAt: NOW });
	});

	it('keeps the recorded pid when the port owner cannot be named', () => {
		expect(decideProcessRecord(server(), status({ listening: true }), null, NOW)).toEqual({
			action: 'keep'
		});
	});

	it('never adopts for a Docker-backed row, whose port belongs to Docker', () => {
		expect(
			decideProcessRecord(server({ docker: true }), status({ listening: true }), 8888, NOW)
		).toEqual({ action: 'keep' });
	});

	it('clears a record whose process is gone and whose port is closed', () => {
		expect(decideProcessRecord(server(), status({ listening: false }), null, NOW)).toEqual({
			action: 'clear'
		});
	});

	it('never adopts for a Docker-backed row even with no pid on file', () => {
		expect(
			decideProcessRecord(
				server({ docker: true, pid: null }),
				status({ listening: true }),
				8888,
				NOW
			)
		).toEqual({ action: 'keep' });
	});
});
