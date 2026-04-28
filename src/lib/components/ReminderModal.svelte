<script lang="ts">
	let { open = $bindable(false) }: { open: boolean } = $props();

	let content = $state('');
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	$effect(() => {
		if (open) {
			content = localStorage.getItem('reminder') ?? '';
			setTimeout(() => textareaEl?.focus(), 0);
		}
	});

	$effect(() => {
		localStorage.setItem('reminder', content);
	});

	function close() {
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
				placeholder="Write a quick note..."
			></textarea>
			<div class="modal-footer">
				<button
					class="clear-btn"
					onclick={() => {
						content = '';
						localStorage.removeItem('reminder');
					}}
				>
					Clear
				</button>
				<button class="close-action" onclick={close}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: #1e293b;
		border: 1px solid #334155;
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
		border-bottom: 1px solid #2d3748;
	}

	.title {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.close-btn {
		background: none;
		border: none;
		color: #475569;
		font-size: 1.25rem;
		line-height: 1;
		padding: 0.125rem 0.25rem;
		transition: color 0.15s;
	}

	.close-btn:hover {
		color: #e2e8f0;
	}

	textarea {
		background: transparent;
		border: none;
		color: #cbd5e1;
		padding: 1rem;
		resize: none;
		height: 220px;
		outline: none;
		line-height: 1.65;
	}

	textarea::placeholder {
		color: #334155;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.7rem 1rem;
		border-top: 1px solid #2d3748;
	}

	.clear-btn {
		background: none;
		border: 1px solid #2d3748;
		border-radius: 5px;
		color: #475569;
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.clear-btn:hover {
		color: #ef4444;
		border-color: #ef4444;
	}

	.close-action {
		background: #334155;
		border: 1px solid #475569;
		border-radius: 5px;
		color: #e2e8f0;
		padding: 0.35rem 0.875rem;
		font-size: 0.8125rem;
		transition: background 0.15s;
	}

	.close-action:hover {
		background: #3d4f68;
	}
</style>
