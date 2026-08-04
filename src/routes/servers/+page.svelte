<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import ServerFormModal from '$lib/components/ServerFormModal.svelte';
	import { serversApi } from '$lib/servers-api';
	import type { ManagedServer, ServerStatus } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	/** Background poll cadence while the page is visible. */
	const POLL_INTERVAL_MS = 5 * 60 * 1000;

	/** Refocusing repeatedly shouldn't hammer Docker — throttle focus polls. */
	const FOCUS_POLL_MIN_GAP_MS = 10_000;

	const SERVER_TYPE_LABELS: Record<ManagedServer['serverType'], string> = {
		python: 'python',
		node: 'npm'
	};

	// Seeded from the server-rendered records; every later change comes from a poll.
	let servers = $state<ManagedServer[]>(untrack(() => data.servers));
	let statuses = new SvelteMap<string, ServerStatus>();
	let busyIds = new SvelteSet<string>();
	let rowErrors = new SvelteMap<string, string>();

	let refreshing = $state(false);
	let pageError = $state('');
	let lastCheckedAt = $state<number | null>(null);
	let pageVisible = $state(true);

	let formOpen = $state(false);
	let editingServer = $state<ManagedServer | null>(null);

	async function refreshAll() {
		refreshing = true;
		pageError = '';
		try {
			// Rows carry their status inline; the map below is what the rows render
			// from, so per-server actions can refresh one without a full re-list.
			const rows = await serversApi.list();
			servers = rows;
			statuses.clear();
			for (const row of rows) statuses.set(row.id, row.status);
			lastCheckedAt = Date.now();
		} catch (caught) {
			pageError = caught instanceof Error ? caught.message : String(caught);
		} finally {
			refreshing = false;
		}
	}

	/** Run a per-server action, keeping its spinner and error next to the row. */
	async function runForServer(id: string, action: () => Promise<ServerStatus>) {
		busyIds.add(id);
		rowErrors.delete(id);
		try {
			statuses.set(id, await action());
			lastCheckedAt = Date.now();
		} catch (caught) {
			rowErrors.set(id, caught instanceof Error ? caught.message : String(caught));
		} finally {
			busyIds.delete(id);
		}
	}

	function statusFor(id: string): ServerStatus | undefined {
		return statuses.get(id);
	}

	function isRunning(server: ManagedServer): boolean {
		const status = statusFor(server.id);
		if (!status) return false;
		return status.process.state === 'running' || status.port.listening === true;
	}

	function openAdd() {
		editingServer = null;
		formOpen = true;
	}

	function openEdit(server: ManagedServer) {
		editingServer = server;
		formOpen = true;
	}

	function onFormSaved() {
		formOpen = false;
		editingServer = null;
		void refreshAll();
	}

	function onFormDeleted() {
		const removedId = editingServer?.id;
		formOpen = false;
		editingServer = null;
		if (removedId) {
			servers = servers.filter((row) => row.id !== removedId);
			statuses.delete(removedId);
			rowErrors.delete(removedId);
		}
		void refreshAll();
	}

	function onFocusPoll() {
		if (!pageVisible) return;
		if (lastCheckedAt !== null && Date.now() - lastCheckedAt < FOCUS_POLL_MIN_GAP_MS) return;
		void refreshAll();
	}

	function onVisibilityChange() {
		pageVisible = !document.hidden;
		if (pageVisible) onFocusPoll();
	}

	function linkFor(server: ManagedServer): string | null {
		return server.port === null ? null : `http://localhost:${server.port}`;
	}

	function formatChecked(timestamp: number | null): string {
		return timestamp === null ? 'never' : new Date(timestamp).toLocaleTimeString();
	}

	function dockerLabel(status: ServerStatus): string {
		if (status.docker.state === 'unknown') return 'docker unknown';
		if (status.docker.services.length === 0) return `docker ${status.docker.state}`;
		const running = status.docker.services.filter((service) =>
			service.state.startsWith('running')
		).length;
		return `docker ${status.docker.state} ${running}/${status.docker.services.length}`;
	}

	// First probe happens in the browser only — SSR has no relative-URL fetch.
	$effect(() => {
		void refreshAll();
	});

	// Poll only while the tab is actually being looked at.
	$effect(() => {
		if (!pageVisible) return;
		const interval = setInterval(() => void refreshAll(), POLL_INTERVAL_MS);
		return () => clearInterval(interval);
	});
</script>

<svelte:window onfocus={onFocusPoll} />
<svelte:document onvisibilitychange={onVisibilityChange} />

<div class="servers-page">
	<header class="topbar">
		<span class="page-title">Servers</span>
		<span class="checked">checked {formatChecked(lastCheckedAt)}</span>
		<button class="refresh-btn" onclick={() => refreshAll()} disabled={refreshing}>
			{refreshing ? 'Polling…' : 'Refresh all'}
		</button>
		<button class="add-btn" onclick={openAdd}>+ Add server</button>
	</header>

	{#if pageError}
		<p class="page-error">{pageError}</p>
	{/if}

	<div class="launcher">
		{#if servers.length === 0}
			<div class="empty">
				<p>No servers yet.</p>
				<p class="empty-hint">Add a project directory to launch and monitor it from here.</p>
			</div>
		{:else}
			{#each servers as server (server.id)}
				{@const status = statusFor(server.id)}
				{@const running = isRunning(server)}
				{@const busy = busyIds.has(server.id)}
				<article class="server-card" class:running>
					<div class="card-main">
						<div class="identity">
							<span class="dot" class:on={running}></span>
							<span class="alias">{server.alias}</span>
							<span class="type-tag">{SERVER_TYPE_LABELS[server.serverType]}</span>
							{#if server.port !== null}<span class="port-tag mono">:{server.port}</span>{/if}
						</div>
						<div class="directory mono">{server.directory}</div>
					</div>

					<div class="status-row">
						{#if !status}
							<span class="pill">status pending…</span>
						{:else}
							<span class="pill" class:on={status.process.state === 'running'}>
								process {status.process.state}{status.process.pid
									? ` · pid ${status.process.pid}`
									: ''}
							</span>
							{#if status.port.configured !== null}
								<span class="pill" class:on={status.port.listening === true}>
									port {status.port.configured}
									{status.port.listening ? 'listening' : 'closed'}
								</span>
							{/if}
							{#if status.docker.enabled}
								<span
									class="pill"
									class:on={status.docker.state === 'running'}
									class:warn={status.docker.state === 'partial' ||
										status.docker.state === 'unknown'}
									title={status.docker.error ?? ''}
								>
									{dockerLabel(status)}
								</span>
							{/if}
						{/if}
					</div>

					<div class="actions">
						<button
							class="action"
							disabled={busy}
							onclick={() => runForServer(server.id, () => serversApi.status(server.id))}
							title="Poll this server now"
						>
							⟳
						</button>
						<button
							class="action primary"
							disabled={busy}
							onclick={() =>
								runForServer(server.id, () =>
									running ? serversApi.stop(server.id) : serversApi.start(server.id)
								)}
						>
							{busy ? '…' : running ? 'Stop' : 'Start'}
						</button>
						<button
							class="action"
							disabled={busy}
							onclick={() => runForServer(server.id, () => serversApi.restart(server.id))}
						>
							Restart
						</button>
						{#if linkFor(server)}
							<a
								class="action link"
								href={linkFor(server)}
								target="_blank"
								rel="external noreferrer"
								title="Open {linkFor(server)} in a new tab"
							>
								Open ↗
							</a>
						{:else}
							<span class="action link disabled" title="Set a port in Edit to enable this link">
								Open ↗
							</span>
						{/if}
						<button class="action" disabled={busy} onclick={() => openEdit(server)}>Edit</button>
					</div>

					{#if rowErrors.has(server.id)}
						<pre class="row-error">{rowErrors.get(server.id)}</pre>
					{/if}
				</article>
			{/each}
		{/if}
	</div>
</div>

{#if formOpen}
	<ServerFormModal
		server={editingServer}
		onSaved={onFormSaved}
		onDeleted={onFormDeleted}
		onClose={() => {
			formOpen = false;
			editingServer = null;
		}}
	/>
{/if}

<style>
	.servers-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
		background: var(--bg);
		color: var(--text);
	}

	.topbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
		flex-shrink: 0;
		min-height: 48px;
	}

	.page-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-muted);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.checked {
		margin-right: auto;
		font-size: 0.7rem;
		color: var(--text-ghost);
		font-family: monospace;
	}

	.refresh-btn,
	.add-btn {
		padding: 0.3rem 0.75rem;
		border-radius: 5px;
		font-size: 0.8125rem;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-2);
	}

	.refresh-btn:hover:not(:disabled),
	.add-btn:hover {
		border-color: var(--accent-muted);
		background: var(--accent-bg);
		color: var(--accent);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.add-btn {
		border-color: var(--accent-muted);
		background: var(--accent-bg);
		color: var(--accent);
		font-weight: 600;
	}

	.page-error {
		margin: 0.75rem 1rem 0;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--accent-muted);
		border-radius: 6px;
		background: var(--accent-bg);
		color: var(--accent);
		font-size: 0.75rem;
		font-family: monospace;
	}

	.launcher {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.empty {
		margin: auto;
		text-align: center;
		color: var(--text-dim);
		font-size: 0.875rem;
	}

	.empty-hint {
		margin-top: 0.25rem;
		color: var(--text-ghost);
		font-size: 0.8125rem;
	}

	.server-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas:
			'main actions'
			'status actions'
			'error error';
		align-items: center;
		gap: 0.375rem 1rem;
		padding: 0.75rem 0.875rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.server-card.running {
		border-color: #2f6f4a;
	}

	.card-main {
		grid-area: main;
		min-width: 0;
	}

	.identity {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-faint);
		flex-shrink: 0;
	}

	.dot.on {
		background: #86efac;
	}

	.alias {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.type-tag,
	.port-tag {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-dim);
		border: 1px solid var(--border);
		background: var(--surface-2);
		border-radius: 3px;
		padding: 0 0.35rem;
	}

	.directory {
		margin-top: 0.2rem;
		font-size: 0.7rem;
		color: var(--text-ghost);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mono {
		font-family: monospace;
	}

	.status-row {
		grid-area: status;
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.pill {
		font-size: 0.7rem;
		font-family: monospace;
		color: var(--text-dim);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.05rem 0.45rem;
	}

	.pill.on {
		color: #86efac;
		border-color: #2f6f4a;
		background: #0e2417;
	}

	.pill.warn {
		color: #fbbf24;
		border-color: #78571a;
		background: #241c07;
	}

	.actions {
		grid-area: actions;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.action {
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--surface-2);
		color: var(--text-muted);
		font-size: 0.75rem;
		line-height: 1.4;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}

	.action:hover:not(:disabled) {
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.action:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.action.primary {
		min-width: 4rem;
		justify-content: center;
		border-color: var(--accent-muted);
		background: var(--accent-bg);
		color: var(--accent);
		font-weight: 600;
	}

	/* No port configured — there is nowhere to open, so the link is inert. */
	.action.link.disabled {
		opacity: 0.35;
		cursor: default;
	}

	.row-error {
		grid-area: error;
		margin-top: 0.25rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--accent-muted);
		border-radius: 6px;
		background: var(--accent-bg);
		color: var(--accent);
		font-size: 0.7rem;
		font-family: monospace;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 160px;
		overflow-y: auto;
	}
</style>
