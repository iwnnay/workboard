<script lang="ts">
	/**
	 * Commit modal: shows `git status` for the selected project and takes a
	 * commit message. Commits whatever is STAGED (the Stage / Stage all buttons
	 * put it there) — this dialog never stages anything itself.
	 */
	import { onMount } from 'svelte';

	let {
		projectId,
		onClose,
		onCommitted
	}: {
		projectId: string;
		onClose: () => void;
		onCommitted: () => void;
	} = $props();

	let statusText = $state('');
	let statusError = $state('');
	let statusLoading = $state(true);

	let message = $state('');
	let committing = $state(false);
	let commitError = $state('');
	let pushAfterCommit = $state(false);

	// Set when the commit landed but the push didn't, so the dialog stops offering
	// to commit again — the message is already in a commit.
	let committed = $state(false);
	let pushError = $state('');

	let messageBox = $state<HTMLTextAreaElement | null>(null);

	async function loadStatus() {
		statusLoading = true;
		statusError = '';
		try {
			const response = await fetch(`/api/diff/status?projectId=${encodeURIComponent(projectId)}`);
			const payload = await response.json();
			if (!response.ok) {
				throw new Error(
					payload.error ?? `reading git status: request failed with status ${response.status}`
				);
			}
			statusText = payload.status;
		} catch (caught) {
			statusError = (caught as Error).message;
		} finally {
			statusLoading = false;
		}
	}

	onMount(() => {
		void loadStatus();
		messageBox?.focus();
	});

	const pushErrorText = $derived(
		pushError ? `The commit succeeded. The push did not:\n${pushError}` : ''
	);

	const commitLabel = $derived.by(() => {
		if (committing) return pushAfterCommit ? 'Committing & pushing…' : 'Committing…';
		return pushAfterCommit ? 'Commit & push' : 'Commit';
	});

	async function commit() {
		if (committing || committed || !message.trim()) return;
		committing = true;
		commitError = '';
		pushError = '';
		try {
			const response = await fetch('/api/diff/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId, message, push: pushAfterCommit })
			});
			const payload = await response.json();
			if (!response.ok) {
				throw new Error(
					payload.error ?? `committing changes: request failed with status ${response.status}`
				);
			}

			// The commit is in either way, so the diff view is refreshed either way.
			onCommitted();

			if (payload.pushError) {
				committed = true;
				pushError = payload.pushError;
				return;
			}
			onClose();
		} catch (caught) {
			commitError = (caught as Error).message;
		} finally {
			committing = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !committing) {
			onClose();
			return;
		}
		// Ctrl/Cmd+Enter commits from anywhere in the dialog, including the textarea.
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			void commit();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="overlay"
	role="presentation"
	onclick={(event) => {
		if (event.target === event.currentTarget && !committing) onClose();
	}}
>
	<div
		class="modal"
		role="dialog"
		aria-modal="true"
		aria-label="Commit staged changes"
		tabindex="-1"
	>
		<header class="modal-head">
			<h2 class="modal-title">Commit</h2>
			<span class="spacer"></span>
			<button class="close-btn" aria-label="Close" disabled={committing} onclick={onClose}>✕</button
			>
		</header>

		<div class="status-body">
			{#if statusLoading}
				<div class="msg">Reading git status…</div>
			{:else if statusError}
				<div class="msg error">{statusError}</div>
			{:else}
				<pre class="status-out">{statusText}</pre>
			{/if}
		</div>

		<div class="message-wrap">
			<label class="message-label" for="commit-message">Commit message</label>
			<textarea
				id="commit-message"
				class="message-input"
				bind:this={messageBox}
				bind:value={message}
				placeholder="What changed and why…"
				rows="4"
				spellcheck="true"
				disabled={committing || committed}
			></textarea>
		</div>

		{#if commitError}
			<div class="commit-error">{commitError}</div>
		{/if}

		{#if pushErrorText}
			<div class="commit-error">{pushErrorText}</div>
		{/if}

		<footer class="modal-foot">
			<label class="push-flag">
				<input type="checkbox" bind:checked={pushAfterCommit} disabled={committing || committed} />
				<span>Push after commit</span>
			</label>
			<span class="hint">Commits staged changes · Ctrl+Enter</span>
			<button class="cancel-btn" disabled={committing} onclick={onClose}>
				{committed ? 'Close' : 'Cancel'}
			</button>
			<button
				class="commit-btn"
				disabled={committing || committed || !message.trim()}
				onclick={commit}
			>
				{commitLabel}
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
		padding: 1.5rem;
	}

	.modal {
		width: 100%;
		max-width: 760px;
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
		transition:
			background 0.1s,
			color 0.1s;
	}

	.close-btn:hover:not(:disabled) {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.close-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.status-body {
		flex: 1;
		min-height: 120px;
		overflow: auto;
		padding: 0.75rem 1rem;
		background: var(--bg-2);
		border-bottom: 1px solid var(--border);
	}

	.status-out {
		margin: 0;
		font-family: 'Consolas', 'Fira Code', monospace;
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--text-2);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.msg {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100px;
		color: var(--text-dim);
		font-size: 0.875rem;
		text-align: center;
	}

	.msg.error {
		color: var(--accent);
		font-family: monospace;
		font-size: 0.8125rem;
		white-space: pre-wrap;
	}

	.message-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.75rem 1rem;
		flex-shrink: 0;
	}

	.message-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-ghost);
	}

	.message-input {
		width: 100%;
		resize: vertical;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		font-family: 'Consolas', 'Fira Code', monospace;
		font-size: 0.8125rem;
		line-height: 1.5;
		padding: 0.5rem 0.625rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.message-input:focus {
		border-color: var(--accent);
	}

	.message-input::placeholder {
		color: var(--text-ghost);
	}

	.message-input:disabled {
		opacity: 0.6;
	}

	.commit-error {
		margin: 0 1rem 0.75rem;
		padding: 0.5rem 0.625rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		font-family: monospace;
		font-size: 0.75rem;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 140px;
		overflow-y: auto;
	}

	.modal-foot {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}

	.push-flag {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: var(--text-dim);
		cursor: pointer;
		flex-shrink: 0;
	}

	.push-flag:has(input:disabled) {
		opacity: 0.5;
		cursor: default;
	}

	.hint {
		flex: 1;
		font-size: 0.7rem;
		color: var(--text-ghost);
	}

	.cancel-btn {
		padding: 0.3rem 0.75rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-dim);
		font-size: 0.8125rem;
		transition:
			border-color 0.15s,
			color 0.15s;
	}

	.cancel-btn:hover:not(:disabled) {
		border-color: var(--accent-muted);
		color: var(--text-2);
	}

	.commit-btn {
		padding: 0.3rem 0.875rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		font-size: 0.8125rem;
		transition: opacity 0.1s;
	}

	.commit-btn:hover:not(:disabled) {
		opacity: 0.85;
	}

	.cancel-btn:disabled,
	.commit-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
