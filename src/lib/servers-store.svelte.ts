import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { serversApi } from './servers-api';
import { messageFrom } from './servers-view';
import type { ManagedServer, ServerStatus } from './types';

/**
 * The launcher's rows and their probe results. Rows arrive with a status inline;
 * per-server actions replace one status without a full re-list.
 */
export class ServersStore {
	servers = $state<ManagedServer[]>([]);
	statuses = new SvelteMap<string, ServerStatus>();
	busyIds = new SvelteSet<string>();
	rowErrors = new SvelteMap<string, string>();

	refreshing = $state(false);
	error = $state('');
	lastCheckedAt = $state<number | null>(null);

	constructor(initial: ManagedServer[] = []) {
		this.servers = initial;
	}

	statusFor(id: string): ServerStatus | undefined {
		return this.statuses.get(id);
	}

	isBusy(id: string): boolean {
		return this.busyIds.has(id);
	}

	errorFor(id: string): string | undefined {
		return this.rowErrors.get(id);
	}

	async refreshAll(): Promise<void> {
		this.refreshing = true;
		this.error = '';
		try {
			const rows = await serversApi.list();
			this.servers = rows;
			this.statuses.clear();
			for (const row of rows) {
				this.statuses.set(row.id, row.status);
			}
			this.lastCheckedAt = Date.now();
		} catch (caught) {
			this.error = messageFrom(caught);
		} finally {
			this.refreshing = false;
		}
	}

	/** Run one row's action, keeping its spinner and failure beside that row. */
	async run(id: string, action: () => Promise<ServerStatus>): Promise<void> {
		this.busyIds.add(id);
		this.rowErrors.delete(id);
		try {
			this.statuses.set(id, await action());
			this.lastCheckedAt = Date.now();
		} catch (caught) {
			this.rowErrors.set(id, messageFrom(caught));
		} finally {
			this.busyIds.delete(id);
		}
	}

	forget(id: string): void {
		this.servers = this.servers.filter((row) => row.id !== id);
		this.statuses.delete(id);
		this.rowErrors.delete(id);
	}

	/** True when a poll would be redundant because one just ran. */
	polledWithin(gapMs: number): boolean {
		return this.lastCheckedAt !== null && Date.now() - this.lastCheckedAt < gapMs;
	}
}
