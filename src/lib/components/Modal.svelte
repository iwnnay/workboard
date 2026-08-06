<script module lang="ts">
	/** Open modals, innermost last, so only the top one answers Escape. */
	const openModals: symbol[] = [];
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	let {
		title,
		label = title,
		maxWidth = '520px',
		locked = false,
		onClose,
		children,
		footer
	}: {
		title: string;
		label?: string;
		maxWidth?: string;
		/** Blocks Escape, the backdrop and the ✕ while an action is in flight. */
		locked?: boolean;
		onClose: () => void;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	const id = Symbol('modal');

	/** A drag that starts inside the dialog must not dismiss it. */
	let pressedOnBackdrop = false;

	onMount(() => {
		openModals.push(id);
		return () => {
			const index = openModals.indexOf(id);
			if (index !== -1) {
				openModals.splice(index, 1);
			}
		};
	});

	function onBackdropMouseDown(event: MouseEvent) {
		pressedOnBackdrop = event.target === event.currentTarget;
	}

	function onBackdropClick(event: MouseEvent) {
		const dismiss = pressedOnBackdrop && event.target === event.currentTarget && !locked;
		pressedOnBackdrop = false;
		if (dismiss) {
			onClose();
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || locked) {
			return;
		}
		if (openModals.at(-1) !== id) {
			return;
		}
		onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="overlay"
	role="presentation"
	onmousedown={onBackdropMouseDown}
	onclick={onBackdropClick}
>
	<div class="modal" style:max-width={maxWidth} role="dialog" aria-modal="true" aria-label={label}>
		<header class="modal-head">
			<h2 class="modal-title">{title}</h2>
			<span class="spacer"></span>
			<button class="close-btn" aria-label="Close" disabled={locked} onclick={onClose}>✕</button>
		</header>

		{@render children()}

		{#if footer}
			<footer class="modal-foot">{@render footer()}</footer>
		{/if}
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
		max-height: 88vh;
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
		flex-shrink: 0;
	}

	.modal-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}

	.spacer {
		flex: 1;
	}

	.close-btn {
		color: var(--text-ghost);
		font-size: 0.85rem;
		padding: 0.25rem 0.4rem;
		border-radius: 4px;
	}

	.close-btn:hover:not(:disabled) {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.close-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.modal-foot {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}
</style>
