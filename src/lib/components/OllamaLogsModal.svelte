<script lang="ts">
	import type { OllamaLogsResponse } from '../../routes/api/ollama/logs/+server';

	let { onClose }: { onClose: () => void } = $props();

	let data = $state<OllamaLogsResponse | null>(null);
	let loading = $state(false);
	let file = $state<string | null>(null);
	let errorsOnly = $state(false);
	let search = $state('');
	let logBody: HTMLDivElement | null = $state(null);

	async function load(scrollToBottom = false) {
		loading = true;
		try {
			const qs = file ? `?file=${encodeURIComponent(file)}` : '';
			const res = await fetch(`/api/ollama/logs${qs}`);
			data = res.ok ? await res.json() : null;
			if (data && !file) file = data.file;
		} finally {
			loading = false;
			if (scrollToBottom) {
				// Wait for the new lines to render before scrolling.
				requestAnimationFrame(() => {
					if (logBody) logBody.scrollTop = logBody.scrollHeight;
				});
			}
		}
	}

	$effect(() => {
		void load(true);
	});

	function isError(line: string): boolean {
		return /\b(error|err|fatal|panic|failed|exception)\b/i.test(line);
	}

	let visibleLines = $derived.by(() => {
		const lines = data?.lines ?? [];
		const q = search.trim().toLowerCase();
		return lines.filter((l) => {
			if (errorsOnly && !isError(l)) return false;
			if (q && !l.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	function selectFile(name: string) {
		if (name === file) return;
		file = name;
		void load(true);
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<div
	class="overlay"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div class="modal" role="dialog" aria-modal="true" aria-label="Ollama logs" tabindex="-1">
		<header class="modal-head">
			<h2 class="modal-title">Ollama logs</h2>
			{#if data?.dir}<span class="dir mono" title={data.dir}>{data.dir}</span>{/if}
			<button class="close-btn" aria-label="Close" onclick={onClose}>✕</button>
		</header>

		<div class="toolbar">
			{#if data && data.available.length > 0}
				<select
					class="file-select"
					value={file ?? ''}
					onchange={(e) => selectFile(e.currentTarget.value)}
				>
					{#each data.available as f (f.name)}
						<option value={f.name}>{f.name} ({formatSize(f.size)})</option>
					{/each}
				</select>
			{/if}

			<input
				class="search-input"
				bind:value={search}
				placeholder="Filter lines…"
				spellcheck="false"
			/>

			<button
				class="toggle-btn"
				class:active={errorsOnly}
				onclick={() => (errorsOnly = !errorsOnly)}
			>
				Errors only
			</button>

			<span class="spacer"></span>

			<span class="line-count">{visibleLines.length} lines</span>
			<button class="refresh-btn" onclick={() => load(true)} disabled={loading}>
				{loading ? 'Loading…' : 'Refresh'}
			</button>
		</div>

		<div class="log-body" bind:this={logBody}>
			{#if loading && !data}
				<div class="msg">Reading logs…</div>
			{:else if data?.error}
				<div class="msg error">{data.error}</div>
			{:else if visibleLines.length === 0}
				<div class="msg">
					{errorsOnly || search ? 'No lines match the filter.' : 'Log file is empty.'}
				</div>
			{:else}
				{#if data?.truncated}
					<div class="truncated-note">Showing the most recent {data.lines.length} lines.</div>
				{/if}
				{#each visibleLines as line, i (i)}
					<div class="log-line" class:err={isError(line)}>{line}</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.modal {
		width: 100%;
		max-width: 1100px;
		height: 85vh;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}

	.modal-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.modal-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}

	.dir {
		flex: 1;
		font-size: 0.7rem;
		color: var(--text-ghost);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.close-btn {
		margin-left: auto;
		color: var(--text-ghost);
		font-size: 0.85rem;
		padding: 0.25rem 0.4rem;
		border-radius: 4px;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.close-btn:hover {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.file-select {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		font-size: 0.8125rem;
		font-family: monospace;
		padding: 0.3rem 0.5rem;
		outline: none;
		max-width: 240px;
	}

	.file-select:focus {
		border-color: var(--accent-muted);
	}

	.search-input {
		flex: 1;
		max-width: 280px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		font-size: 0.8125rem;
		padding: 0.3rem 0.5rem;
		outline: none;
	}

	.search-input:focus {
		border-color: var(--accent-muted);
	}

	.toggle-btn {
		padding: 0.3rem 0.75rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-dim);
		font-size: 0.8125rem;
		transition:
			border-color 0.15s,
			background 0.15s,
			color 0.15s;
	}

	.toggle-btn:hover {
		border-color: var(--accent-muted);
		color: var(--text-2);
	}

	.toggle-btn.active {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.spacer {
		flex: 1;
	}

	.line-count {
		font-size: 0.7rem;
		color: var(--text-ghost);
		font-family: monospace;
	}

	.refresh-btn {
		padding: 0.3rem 0.75rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		font-size: 0.8125rem;
		transition: opacity 0.1s;
	}

	.refresh-btn:hover:not(:disabled) {
		opacity: 0.85;
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.log-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem 1rem;
		background: var(--bg-2);
		font-family: 'Consolas', 'Fira Code', monospace;
		font-size: 0.75rem;
		line-height: 1.5;
	}

	.msg {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-dim);
		font-family: system-ui, sans-serif;
		font-size: 0.875rem;
		text-align: center;
	}

	.msg.error {
		color: var(--accent);
		font-family: monospace;
		font-size: 0.8125rem;
	}

	.truncated-note {
		color: var(--text-ghost);
		font-family: system-ui, sans-serif;
		font-size: 0.7rem;
		padding: 0 0 0.5rem;
		border-bottom: 1px dashed var(--border);
		margin-bottom: 0.5rem;
	}

	.log-line {
		color: var(--text-2);
		white-space: pre-wrap;
		word-break: break-word;
		padding: 0.05rem 0;
	}

	.log-line.err {
		color: #fca5a5;
	}
</style>
