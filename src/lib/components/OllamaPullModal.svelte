<script lang="ts">
	import { pullQueue, type PullItem } from '$lib/ollama-pull.svelte';

	let { host, onClose }: { host: string; onClose: () => void } = $props();

	let input = $state('');

	function queueModels() {
		if (!input.trim()) return;
		pullQueue.add(input, host);
		input = '';
	}

	function formatSize(bytes: number | undefined): string {
		if (!bytes) return '';
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
		if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
		return `${(bytes / 1073741824).toFixed(2)} GB`;
	}

	function pct(item: PullItem): string {
		return item.percent.toFixed(item.percent < 100 ? 1 : 0);
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
	<div class="modal" role="dialog" aria-modal="true" aria-label="Pull models" tabindex="-1">
		<header class="modal-head">
			<h2 class="modal-title">Pull models</h2>
			<button class="close-btn" aria-label="Close" onclick={onClose}>✕</button>
		</header>

		<div class="add-area">
			<textarea
				class="model-input"
				bind:value={input}
				placeholder="Model name(s) — e.g. llama3.2, qwen2.5-coder:7b&#10;One per line or comma-separated"
				rows="2"
				onkeydown={(e) => {
					if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						queueModels();
					}
				}}
			></textarea>
			<button class="add-btn" onclick={queueModels} disabled={!input.trim()}>Queue ↵</button>
		</div>
		<p class="hint">
			Pulls run one at a time and continue even if you close this window.
			<kbd>⌘/Ctrl</kbd>+<kbd>↵</kbd> to queue.
		</p>

		<div class="queue">
			{#if pullQueue.items.length === 0}
				<div class="queue-empty">No models queued yet.</div>
			{:else}
				{#each pullQueue.items as item (item.id)}
					<div
						class="queue-item"
						class:done={item.status === 'done'}
						class:failed={item.status === 'error'}
					>
						<div class="item-head">
							<span class="item-name">{item.model}</span>
							<span class="item-status status-{item.status}">{item.statusText}</span>
							<button
								class="item-action"
								aria-label="Remove"
								onclick={() => pullQueue.remove(item)}
							>
								{item.status === 'downloading' ? 'Cancel' : '✕'}
							</button>
						</div>
						<div class="bar-track">
							<div
								class="bar-fill status-{item.status}"
								style="width: {item.status === 'done' ? 100 : item.percent}%"
							></div>
						</div>
						<div class="item-foot">
							{#if item.status === 'downloading' || item.status === 'done'}
								<span class="pct">{pct(item)}%</span>
								{#if item.total}
									<span class="bytes">{formatSize(item.completed)} / {formatSize(item.total)}</span>
								{/if}
							{/if}
							{#if item.error}<span class="err">{item.error}</span>{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<footer class="modal-foot">
			<span class="summary">
				{pullQueue.activeCount} active · {pullQueue.finishedCount} finished
			</span>
			<button
				class="clear-btn"
				onclick={() => pullQueue.clearFinished()}
				disabled={pullQueue.finishedCount === 0}
			>
				Clear finished
			</button>
		</footer>
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
		padding: 1rem;
	}

	.modal {
		width: 100%;
		max-width: 540px;
		max-height: 85vh;
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
		justify-content: space-between;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.modal-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.close-btn {
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

	.add-area {
		display: flex;
		gap: 0.5rem;
		padding: 1rem 1rem 0.25rem;
		align-items: stretch;
	}

	.model-input {
		flex: 1;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text);
		font-size: 0.8125rem;
		font-family: monospace;
		padding: 0.5rem;
		resize: vertical;
		outline: none;
		line-height: 1.4;
	}

	.model-input:focus {
		border-color: var(--accent-muted);
	}

	.add-btn {
		flex-shrink: 0;
		align-self: stretch;
		padding: 0 1rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 6px;
		color: var(--accent);
		font-size: 0.8125rem;
		font-weight: 600;
		transition: opacity 0.1s;
	}

	.add-btn:hover:not(:disabled) {
		opacity: 0.85;
	}

	.add-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.hint {
		padding: 0 1rem 0.5rem;
		color: var(--text-ghost);
		font-size: 0.7rem;
	}

	kbd {
		font-family: monospace;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 0 0.25rem;
		font-size: 0.65rem;
	}

	.queue {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 80px;
	}

	.queue-empty {
		color: var(--text-ghost);
		font-size: 0.8125rem;
		text-align: center;
		padding: 1.5rem 0;
	}

	.queue-item {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.5rem 0.625rem;
	}

	.queue-item.done {
		border-color: #2f6f4a;
	}

	.queue-item.failed {
		border-color: var(--accent-muted);
	}

	.item-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}

	.item-name {
		font-family: monospace;
		font-size: 0.8125rem;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-status {
		margin-left: auto;
		font-size: 0.7rem;
		color: var(--text-dim);
		text-transform: lowercase;
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-status.status-done {
		color: #86efac;
	}
	.item-status.status-error {
		color: var(--accent);
	}

	.item-action {
		flex-shrink: 0;
		color: var(--text-ghost);
		font-size: 0.7rem;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.item-action:hover {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.bar-track {
		height: 6px;
		background: var(--bg-2);
		border-radius: 3px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 3px;
		transition: width 0.2s ease;
	}

	.bar-fill.status-done {
		background: #86efac;
	}
	.bar-fill.status-error {
		background: var(--accent-muted);
	}
	.bar-fill.status-queued {
		background: var(--border);
	}

	.item-foot {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin-top: 0.3rem;
		font-size: 0.7rem;
		color: var(--text-dim);
		font-family: monospace;
		min-height: 0.9rem;
	}

	.pct {
		color: var(--text-2);
	}

	.err {
		color: var(--accent);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.modal-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border);
	}

	.summary {
		font-size: 0.75rem;
		color: var(--text-dim);
	}

	.clear-btn {
		padding: 0.3rem 0.625rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-muted);
		font-size: 0.75rem;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.clear-btn:hover:not(:disabled) {
		background: var(--accent-bg);
		color: var(--text-2);
	}

	.clear-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
