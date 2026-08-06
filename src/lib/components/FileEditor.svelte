<script lang="ts">
	import { onMount } from 'svelte';
	import type { FileEditorHandle } from './file-editor-core';
	import type { Eol } from '$lib/server/text-files';

	let {
		projectId,
		filePath,
		range,
		onClose,
		dirty = $bindable(false)
	}: {
		projectId: string;
		filePath: string;
		range: string;
		/** Called when the editor should leave the page; didSave reports whether any write happened. */
		onClose: (didSave: boolean) => void;
		dirty?: boolean;
	} = $props();

	type Phase = 'loading' | 'error' | 'ready';
	let phase = $state<Phase>('loading');
	let loadError = $state('');
	let statusMessage = $state('');
	let conflict = $state<{ message: string; currentHash: string | null } | null>(null);
	let saving = $state(false);

	let editorHost: HTMLDivElement;
	let editorHandle: FileEditorHandle | null = null;
	let baseHash = '';
	let eol: Eol = 'lf';
	let didSave = false;

	onMount(() => {
		let cancelled = false;

		(async () => {
			try {
				const params = new URLSearchParams({ projectId, path: filePath });
				const response = await fetch(`/api/file?${params}`);
				const payload = await response.json();
				if (!response.ok) {
					throw new Error(
						payload.error ?? `reading file "${filePath}" for the editor: HTTP ${response.status}`
					);
				}
				const core = await import('./file-editor-core');
				if (cancelled) {
					return;
				}
				baseHash = payload.baseHash;
				eol = payload.eol;
				editorHandle = core.createFileEditor({
					parent: editorHost,
					doc: payload.content,
					filePath,
					handlers: {
						save: () => save(),
						requestClose,
						dirtyChanged: (value) => (dirty = value)
					}
				});
				phase = 'ready';
			} catch (caught) {
				if (cancelled) {
					return;
				}
				loadError = (caught as Error).message;
				phase = 'error';
			}
		})();

		return () => {
			cancelled = true;
			editorHandle?.destroy();
			editorHandle = null;
		};
	});

	async function save(options: { force?: boolean } = {}): Promise<boolean> {
		if (saving || phase !== 'ready' || !editorHandle) {
			return false;
		}
		saving = true;
		statusMessage = '';
		try {
			const response = await fetch('/api/file', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId,
					path: filePath,
					range,
					content: editorHandle.view.state.doc.toString(),
					eol,
					baseHash,
					force: options.force ?? false
				})
			});
			const payload = await response.json();
			if (response.status === 409) {
				conflict = { message: payload.error, currentHash: payload.currentHash ?? null };
				return false;
			}
			if (!response.ok) {
				statusMessage = payload.error ?? `saving "${filePath}": HTTP ${response.status}`;
				return false;
			}
			baseHash = payload.baseHash;
			conflict = null;
			didSave = true;
			editorHandle.markSaved();
			statusMessage = `saved ${new Date().toLocaleTimeString()}`;
			return true;
		} catch (caught) {
			statusMessage = `saving "${filePath}": ${(caught as Error).message}`;
			return false;
		} finally {
			saving = false;
		}
	}

	function requestClose(options: { force: boolean }) {
		if (dirty && !options.force) {
			statusMessage = `"${filePath}" has unsaved changes — :w to save, :q! to discard`;
			return;
		}
		onClose(didSave);
	}

	function handleCloseClick() {
		if (dirty && !confirm(`Discard unsaved changes to ${filePath}?`)) {
			return;
		}
		onClose(didSave);
	}
</script>

<svelte:window
	onbeforeunload={(event) => {
		if (dirty) {
			event.preventDefault();
		}
	}}
/>

<div class="file-editor">
	<div class="editor-toolbar">
		<span class="dirty-dot" class:visible={dirty} title="Unsaved changes">●</span>
		<span class="editor-status">{statusMessage}</span>
		<button class="editor-btn" onclick={() => save()} disabled={saving || !dirty}>
			{saving ? 'Saving…' : 'Save'}
		</button>
		<button class="editor-btn" onclick={handleCloseClick}>Close</button>
	</div>

	{#if conflict}
		<div class="conflict-bar">
			<span class="conflict-message">{conflict.message}</span>
			<div class="conflict-actions">
				<button class="editor-btn danger" onclick={() => save({ force: true })}>Overwrite</button>
				<button class="editor-btn" onclick={() => (conflict = null)}>Keep editing</button>
				<button class="editor-btn" onclick={() => onClose(didSave)}>Close without saving</button>
			</div>
		</div>
	{/if}

	{#if phase === 'loading'}
		<div class="editor-note">Loading {filePath}…</div>
	{:else if phase === 'error'}
		<div class="editor-note error">{loadError}</div>
	{/if}

	<div class="editor-host" bind:this={editorHost}></div>
</div>

<style>
	.file-editor {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.editor-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 1rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.dirty-dot {
		color: transparent;
		font-size: 0.75rem;
		transition: color 0.15s;
	}

	.dirty-dot.visible {
		color: var(--accent);
	}

	.editor-status {
		flex: 1;
		font-size: 0.75rem;
		color: var(--text-dim);
		font-family: 'Courier New', monospace;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.editor-btn {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-2);
		font-size: 0.75rem;
		padding: 0.2rem 0.625rem;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}

	.editor-btn:hover:not(:disabled) {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.editor-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.editor-btn.danger {
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.conflict-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 1rem;
		background: var(--accent-bg);
		border-bottom: 1px solid var(--accent-muted);
		flex-shrink: 0;
	}

	.conflict-message {
		font-size: 0.75rem;
		color: var(--text-2);
		font-family: 'Courier New', monospace;
	}

	.conflict-actions {
		display: flex;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	.editor-note {
		padding: 1rem;
		font-size: 0.8125rem;
		color: var(--text-ghost);
	}

	.editor-note.error {
		color: var(--accent);
		font-family: 'Courier New', monospace;
		white-space: pre-wrap;
	}

	.editor-host {
		flex: 1;
		min-height: 0;
	}

	.editor-host :global(.cm-editor) {
		height: 100%;
	}
</style>
