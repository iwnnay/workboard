<script lang="ts">
	import ServerCard from '$lib/components/ServerCard.svelte';
	import ServerFormModal from '$lib/components/ServerFormModal.svelte';
	import { serversApi } from '$lib/servers-api';
	import { ServersStore } from '$lib/servers-store.svelte';
	import { formatClockTime, isServerRunning } from '$lib/servers-view';
	import { findOwningProject } from '$lib/folder-paths';
	import type { ManagedServer, Project } from '$lib/types';

	let { projects }: { projects: Project[] } = $props();

	const pollIntervalMilliseconds = 5 * 60 * 1000;

	/** Refocusing repeatedly shouldn't hammer Docker. */
	const focusPollMinimumGapMilliseconds = 10_000;

	const store = new ServersStore();

	let pageVisible = $state(true);
	let formOpen = $state(false);
	let editingServer = $state<ManagedServer | null>(null);

	const openAdd = () => {
		editingServer = null;
		formOpen = true;
	};

	const openEdit = (server: ManagedServer) => {
		editingServer = server;
		formOpen = true;
	};

	const closeForm = () => {
		formOpen = false;
		editingServer = null;
	};

	const onFormSaved = () => {
		closeForm();
		void store.refreshAll();
	};

	const onFormDeleted = () => {
		const removedId = editingServer?.id;
		closeForm();
		if (removedId) {
			store.forget(removedId);
		}
		void store.refreshAll();
	};

	const toggle = (server: ManagedServer) => {
		const running = isServerRunning(store.statusFor(server.id));
		void store.run(server.id, () =>
			running ? serversApi.stop(server.id) : serversApi.start(server.id)
		);
	};

	const onFocusPoll = () => {
		if (!pageVisible || store.polledWithin(focusPollMinimumGapMilliseconds)) {
			return;
		}
		void store.refreshAll();
	};

	const onVisibilityChange = () => {
		pageVisible = !document.hidden;
		if (pageVisible) {
			onFocusPoll();
		}
	};

	// The first probe happens in the browser only — SSR has no relative-URL fetch.
	$effect(() => {
		void store.refreshAll();
	});

	$effect(() => {
		if (!pageVisible) {
			return;
		}
		const interval = setInterval(() => void store.refreshAll(), pollIntervalMilliseconds);
		return () => clearInterval(interval);
	});
</script>

<svelte:window onfocus={onFocusPoll} />
<svelte:document onvisibilitychange={onVisibilityChange} />

<div class="servers">
	<header class="toolbar">
		<span class="checked">checked {formatClockTime(store.lastCheckedAt)}</span>
		<button class="refresh-btn" onclick={() => store.refreshAll()} disabled={store.refreshing}>
			{store.refreshing ? 'Polling…' : 'Refresh all'}
		</button>
		<button class="add-btn" onclick={openAdd}>+ Add server</button>
	</header>

	{#if store.error}
		<p class="servers-error">{store.error}</p>
	{/if}

	<div class="launcher">
		{#if store.servers.length === 0}
			<div class="empty">
				{#if store.refreshing && store.lastCheckedAt === null}
					<p>Loading servers…</p>
				{:else}
					<p>No servers yet.</p>
					<p class="empty-hint">Add a project directory to launch and monitor it from here.</p>
				{/if}
			</div>
		{:else}
			{#each store.servers as server (server.id)}
				<ServerCard
					{server}
					status={store.statusFor(server.id)}
					busy={store.isBusy(server.id)}
					error={store.errorFor(server.id) ?? ''}
					projectName={findOwningProject(projects, server.directory)?.name ?? null}
					onRefresh={() => store.run(server.id, () => serversApi.status(server.id))}
					onToggle={() => toggle(server)}
					onRestart={() => store.run(server.id, () => serversApi.restart(server.id))}
					onEdit={() => openEdit(server)}
				/>
			{/each}
		{/if}
	</div>
</div>

{#if formOpen}
	<ServerFormModal
		server={editingServer}
		onSaved={onFormSaved}
		onDeleted={onFormDeleted}
		onClose={closeForm}
	/>
{/if}

<style>
	.servers {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
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

	.servers-error {
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
		min-height: 0;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.empty {
		margin: auto;
		padding: 2rem 0;
		text-align: center;
		color: var(--text-dim);
		font-size: 0.875rem;
	}

	.empty-hint {
		margin-top: 0.25rem;
		color: var(--text-ghost);
		font-size: 0.8125rem;
	}
</style>
