import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServersStore } from '$lib/servers-store.svelte';
import type { ManagedServer, ManagedServerWithStatus, ServerStatus } from '$lib/types';

const list = vi.fn();
vi.mock('$lib/servers-api', () => ({ serversApi: { list: () => list() } }));

function server(overrides: Partial<ManagedServer> = {}): ManagedServer {
	return {
		id: 'server-1',
		alias: 'knowledge',
		directory: 'C:\\projects\\knowledge',
		serverType: 'node',
		port: 9150,
		docker: false,
		dockerCommand: '',
		pid: null,
		startedAt: null,
		logPath: null,
		createdAt: '2026-08-06T09:00:00.000Z',
		...overrides
	};
}

function status(listening = false): ServerStatus {
	return {
		id: 'server-1',
		checkedAt: '2026-08-06T12:00:00.000Z',
		process: { state: 'stopped', pid: null, startedAt: null },
		port: { configured: 9150, listening },
		docker: { enabled: false, state: 'stopped', services: [], error: null }
	};
}

function row(overrides: Partial<ManagedServer> = {}): ManagedServerWithStatus {
	return { ...server(overrides), status: status() };
}

beforeEach(() => {
	list.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('construction', () => {
	it('starts from the server-rendered rows', () => {
		const store = new ServersStore([server(), server({ id: 'server-2', alias: 'transcriber' })]);
		expect(store.servers.map((each) => each.alias)).toEqual(['knowledge', 'transcriber']);
	});

	it('starts empty with no statuses, errors or busy rows', () => {
		const store = new ServersStore();
		expect(store.servers).toEqual([]);
		expect(store.statusFor('server-1')).toBeUndefined();
		expect(store.errorFor('server-1')).toBeUndefined();
		expect(store.isBusy('server-1')).toBe(false);
		expect(store.lastCheckedAt).toBeNull();
	});
});

describe('refreshAll', () => {
	it('replaces the rows and indexes their statuses', async () => {
		list.mockResolvedValue([row(), row({ id: 'server-2' })]);
		const store = new ServersStore();
		await store.refreshAll();

		expect(store.servers).toHaveLength(2);
		expect(store.statusFor('server-2')).toEqual(status());
		expect(store.lastCheckedAt).not.toBeNull();
		expect(store.refreshing).toBe(false);
	});

	it('drops statuses for rows that are gone', async () => {
		list.mockResolvedValue([row()]);
		const store = new ServersStore();
		await store.refreshAll();

		list.mockResolvedValue([row({ id: 'server-2' })]);
		await store.refreshAll();

		expect(store.statusFor('server-1')).toBeUndefined();
		expect(store.statusFor('server-2')).toBeDefined();
	});

	it('keeps the page error when the poll fails and clears it on the next success', async () => {
		list.mockRejectedValue(new Error('GET /api/servers → 500 Server Error'));
		const store = new ServersStore();
		await store.refreshAll();
		expect(store.error).toBe('GET /api/servers → 500 Server Error');

		list.mockResolvedValue([row()]);
		await store.refreshAll();
		expect(store.error).toBe('');
	});

	it('lowers the refreshing flag even when the poll throws', async () => {
		list.mockRejectedValue(new Error('offline'));
		const store = new ServersStore();
		await store.refreshAll();
		expect(store.refreshing).toBe(false);
	});
});

describe('run', () => {
	it('stores the returned status for that row', async () => {
		const store = new ServersStore([server()]);
		await store.run('server-1', async () => status(true));

		expect(store.statusFor('server-1')?.port.listening).toBe(true);
		expect(store.isBusy('server-1')).toBe(false);
	});

	it('marks the row busy while the action runs', async () => {
		const store = new ServersStore([server()]);
		let busyDuringAction = false;

		await store.run('server-1', async () => {
			busyDuringAction = store.isBusy('server-1');
			return status();
		});

		expect(busyDuringAction).toBe(true);
		expect(store.isBusy('server-1')).toBe(false);
	});

	it('keeps a failure beside its own row', async () => {
		const store = new ServersStore([server(), server({ id: 'server-2' })]);
		await store.run('server-1', async () => {
			throw new Error('port 9150 is already listening');
		});

		expect(store.errorFor('server-1')).toBe('port 9150 is already listening');
		expect(store.errorFor('server-2')).toBeUndefined();
		expect(store.error).toBe('');
	});

	it('clears a previous row error on the next attempt', async () => {
		const store = new ServersStore([server()]);
		await store.run('server-1', async () => {
			throw new Error('first failure');
		});
		await store.run('server-1', async () => status());

		expect(store.errorFor('server-1')).toBeUndefined();
	});
});

describe('forget', () => {
	it('removes the row along with its status and error', async () => {
		const store = new ServersStore([server(), server({ id: 'server-2' })]);
		await store.run('server-1', async () => status());
		store.forget('server-1');

		expect(store.servers.map((each) => each.id)).toEqual(['server-2']);
		expect(store.statusFor('server-1')).toBeUndefined();
	});
});

describe('polledWithin', () => {
	it('is false before anything has been polled', () => {
		expect(new ServersStore().polledWithin(10_000)).toBe(false);
	});

	it('is true right after a poll, so a refocus does not re-poll', async () => {
		list.mockResolvedValue([row()]);
		const store = new ServersStore();
		await store.refreshAll();

		expect(store.polledWithin(10_000)).toBe(true);
	});

	it('is false again once the gap has passed', async () => {
		vi.useFakeTimers();
		list.mockResolvedValue([row()]);
		const store = new ServersStore();
		await store.refreshAll();

		vi.advanceTimersByTime(10_001);
		expect(store.polledWithin(10_000)).toBe(false);
	});
});
