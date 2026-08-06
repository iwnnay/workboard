<script lang="ts">
	import {
		SERVER_TYPE_TAGS,
		dockerLabel,
		isServerRunning,
		portLabel,
		processLabel,
		serverLink
	} from '$lib/servers-view';
	import type { ManagedServer, ServerStatus } from '$lib/types';

	let {
		server,
		status,
		busy = false,
		error = '',
		onRefresh,
		onToggle,
		onRestart,
		onEdit
	}: {
		server: ManagedServer;
		status: ServerStatus | undefined;
		busy?: boolean;
		error?: string;
		onRefresh: () => void;
		onToggle: () => void;
		onRestart: () => void;
		onEdit: () => void;
	} = $props();

	const running = $derived(isServerRunning(status));
	const link = $derived(serverLink(server));
</script>

<article class="server-card" class:running data-testid="server-card">
	<div class="card-main">
		<div class="identity">
			<span class="dot" class:on={running} data-testid="server-dot"></span>
			<span class="alias">{server.alias}</span>
			<span class="type-tag">{SERVER_TYPE_TAGS[server.serverType]}</span>
			<span class="port-tag mono">:{server.port}</span>
		</div>
		<div class="directory mono">{server.directory}</div>
	</div>

	<div class="status-row">
		{#if !status}
			<span class="pill">status pending…</span>
		{:else}
			<span class="pill" class:on={status.process.state === 'running'}>
				{processLabel(status)}
			</span>
			<span class="pill" class:on={status.port.listening}>{portLabel(status)}</span>
			{#if status.docker.enabled}
				<span
					class="pill"
					class:on={status.docker.state === 'running'}
					class:warn={status.docker.state === 'partial' || status.docker.state === 'unknown'}
					title={status.docker.error ?? ''}
				>
					{dockerLabel(status)}
				</span>
			{/if}
		{/if}
	</div>

	<div class="actions">
		<button class="action" disabled={busy} onclick={onRefresh} title="Poll this server now">
			⟳
		</button>
		<button class="action primary" disabled={busy} onclick={onToggle}>
			{busy ? '…' : running ? 'Stop' : 'Start'}
		</button>
		<button class="action" disabled={busy} onclick={onRestart}>Restart</button>
		<a
			class="action link"
			href={link}
			target="_blank"
			rel="external noreferrer"
			title="Open {link} in a new tab"
		>
			Open ↗
		</a>
		<button class="action" disabled={busy} onclick={onEdit}>Edit</button>
	</div>

	{#if error}
		<pre class="row-error">{error}</pre>
	{/if}
</article>

<style>
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
