<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { diffApi } from '$lib/diff-api';

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

	/** The commit landed but its push did not, so there is nothing left to commit. */
	let committed = $state(false);
	let pushError = $state('');

	let messageBox = $state<HTMLTextAreaElement | null>(null);

	const pushErrorText = $derived(
		pushError ? `The commit succeeded. The push did not:\n${pushError}` : ''
	);

	const commitLabel = $derived.by(() => {
		if (committing) {
			return pushAfterCommit ? 'Committing & pushing…' : 'Committing…';
		}
		return pushAfterCommit ? 'Commit & push' : 'Commit';
	});

	async function loadStatus() {
		statusLoading = true;
		statusError = '';
		try {
			statusText = (await diffApi.status(projectId)).status;
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

	async function commit() {
		if (committing || committed || !message.trim()) {
			return;
		}
		committing = true;
		commitError = '';
		pushError = '';
		try {
			const result = await diffApi.commit(projectId, message, pushAfterCommit);
			onCommitted();

			if (result.pushError) {
				committed = true;
				pushError = result.pushError;
				return;
			}
			onClose();
		} catch (caught) {
			commitError = (caught as Error).message;
		} finally {
			committing = false;
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			void commit();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<Modal title="Commit" label="Commit staged changes" maxWidth="760px" locked={committing} {onClose}>
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

	{#snippet footer()}
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
	{/snippet}
</Modal>

<style>
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
