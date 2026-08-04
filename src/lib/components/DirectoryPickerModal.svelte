<script lang="ts">
	import { untrack } from 'svelte';
	import { serversApi } from '$lib/servers-api';
	import type { DirectoryListing } from '$lib/types';

	let {
		initialPath = null,
		onPick,
		onClose
	}: {
		initialPath?: string | null;
		onPick: (directory: string) => void;
		onClose: () => void;
	} = $props();

	let listing = $state<DirectoryListing | null>(null);
	let loading = $state(false);
	let errorMessage = $state('');

	async function load(path: string | null) {
		loading = true;
		errorMessage = '';
		try {
			listing = await serversApi.browse(path);
		} catch (caught) {
			errorMessage = caught instanceof Error ? caught.message : String(caught);
		} finally {
			loading = false;
		}
	}

	// The modal is mounted fresh each time it opens, so the opening directory is
	// deliberately read once: it starts where the form is already pointing, and
	// falls back to the default projects directory.
	void load(untrack(() => initialPath));

	/**
	 * A backdrop click only counts when the press *and* the release both landed
	 * on the backdrop. Without this, selecting text inside the modal and letting
	 * go outside it would close the modal. Not reactive — nothing renders it.
	 */
	let pressStartedOnBackdrop = false;

	function onBackdropMouseDown(event: MouseEvent) {
		pressStartedOnBackdrop = event.target === event.currentTarget;
	}

	function onBackdropClick(event: MouseEvent) {
		const releasedOnBackdrop = event.target === event.currentTarget;
		const shouldClose = pressStartedOnBackdrop && releasedOnBackdrop;
		pressStartedOnBackdrop = false;
		if (shouldClose) onClose();
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div
	class="overlay"
	role="presentation"
	onmousedown={onBackdropMouseDown}
	onclick={onBackdropClick}
>
	<div class="modal" role="dialog" aria-modal="true" aria-label="Choose a project directory">
		<header class="modal-head">
			<h2 class="modal-title">Choose directory</h2>
			<button class="close-btn" aria-label="Close" onclick={onClose}>✕</button>
		</header>

		<div class="crumb-bar">
			<button
				class="up-btn"
				disabled={!listing?.parent || loading}
				onclick={() => listing?.parent && load(listing.parent)}
			>
				↑ Up
			</button>
			<span class="crumb-path mono">{listing?.path ?? '…'}</span>
		</div>

		{#if errorMessage}
			<p class="error">{errorMessage}</p>
		{/if}

		<div class="entries">
			{#if loading}
				<div class="placeholder">Reading directory…</div>
			{:else if listing && listing.entries.length === 0}
				<div class="placeholder">No sub-directories here.</div>
			{:else if listing}
				{#each listing.entries as entry (entry.path)}
					<div class="entry-row">
						<button class="entry-open" onclick={() => load(entry.path)}>
							<span class="entry-icon">▸</span>
							<span class="entry-name">{entry.name}</span>
							{#if entry.isProject}<span class="project-tag">project</span>{/if}
						</button>
						<button class="entry-pick" onclick={() => onPick(entry.path)}>Select</button>
					</div>
				{/each}
			{/if}
		</div>

		<footer class="modal-foot">
			<span class="footer-hint">Opens at ~/projects; browse anywhere from there.</span>
			<button
				class="pick-current"
				disabled={!listing || loading}
				onclick={() => listing && onPick(listing.path)}
			>
				Use this directory
			</button>
		</footer>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 210;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.modal {
		width: 100%;
		max-width: 560px;
		max-height: 80vh;
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
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.close-btn {
		color: var(--text-ghost);
		font-size: 0.85rem;
		padding: 0.25rem 0.4rem;
		border-radius: 4px;
	}

	.close-btn:hover {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.crumb-bar {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.up-btn {
		flex-shrink: 0;
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--surface-2);
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.up-btn:hover:not(:disabled) {
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.up-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.crumb-path {
		font-size: 0.75rem;
		color: var(--text-dim);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		direction: rtl;
		text-align: left;
	}

	.mono {
		font-family: monospace;
	}

	.error {
		margin: 0.625rem 1rem 0;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--accent-muted);
		border-radius: 6px;
		background: var(--accent-bg);
		color: var(--accent);
		font-size: 0.75rem;
		font-family: monospace;
		word-break: break-word;
	}

	.entries {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-height: 140px;
	}

	.placeholder {
		padding: 1.5rem 0;
		text-align: center;
		color: var(--text-ghost);
		font-size: 0.8125rem;
	}

	.entry-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		border-radius: 5px;
	}

	.entry-row:hover {
		background: var(--accent-bg);
	}

	.entry-open {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.625rem;
		color: var(--text-2);
		font-size: 0.8125rem;
		text-align: left;
		overflow: hidden;
	}

	.entry-icon {
		color: var(--text-ghost);
		font-size: 0.7rem;
	}

	.entry-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.project-tag {
		flex-shrink: 0;
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #86efac;
		border: 1px solid #2f6f4a;
		border-radius: 3px;
		padding: 0 0.3rem;
	}

	.entry-pick {
		flex-shrink: 0;
		margin-right: 0.375rem;
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface-2);
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.entry-pick:hover {
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.modal-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border);
	}

	.footer-hint {
		font-size: 0.7rem;
		color: var(--text-ghost);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pick-current {
		flex-shrink: 0;
		padding: 0.35rem 0.75rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.pick-current:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
