<script lang="ts">
	import { untrack } from 'svelte';

	let {
		open = $bindable(false),
		initialContent = ''
	}: {
		open: boolean;
		initialContent?: string;
	} = $props();

	let content = $state(untrack(() => initialContent));
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let saveTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		if (open) setTimeout(() => textareaEl?.focus(), 0);
	});

	function scheduleSave() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(persist, 1000);
	}

	async function persist() {
		await fetch('/api/reminder', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content })
		});
	}

	async function clear() {
		content = '';
		clearTimeout(saveTimer);
		await persist();
	}

	function close() {
		clearTimeout(saveTimer);
		persist();
		open = false;
	}

	function handleOverlayKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

{#if open}
	<div
		class="overlay"
		onclick={close}
		onkeydown={handleOverlayKeydown}
		role="presentation"
		tabindex="-1"
	>
		<div
			class="modal"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label="Reminder"
			tabindex="-1"
		>
			<div class="modal-header">
				<span class="title">Reminder</span>
				<button class="close-btn" onclick={close} aria-label="Close">×</button>
			</div>
			<textarea
				bind:this={textareaEl}
				bind:value={content}
				oninput={scheduleSave}
				placeholder="Write a quick note..."
			></textarea>
			<div class="modal-footer">
				<button class="clear-btn" onclick={clear}>Clear</button>
				<button class="close-action" onclick={close}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 10px;
		width: 480px;
		max-width: 92vw;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid var(--border-2);
	}

	.title {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-dim);
		font-size: 1.25rem;
		line-height: 1;
		padding: 0.125rem 0.25rem;
		transition: color 0.15s;
	}

	.close-btn:hover {
		color: var(--text);
	}

	textarea {
		background: transparent;
		border: none;
		color: var(--text-2);
		padding: 1rem;
		resize: none;
		height: 220px;
		outline: none;
		line-height: 1.65;
	}

	textarea::placeholder {
		color: var(--text-ghost);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.7rem 1rem;
		border-top: 1px solid var(--border-2);
	}

	.clear-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-dim);
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.clear-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.close-action {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-2);
		padding: 0.35rem 0.875rem;
		font-size: 0.8125rem;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.close-action:hover {
		background: var(--surface-2);
		border-color: var(--text-dim);
	}
</style>
