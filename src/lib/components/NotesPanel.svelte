<script lang="ts">
	import type { Note } from '$lib/types';
	import { untrack, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import NoteEditor from './NoteEditor.svelte';

	let { initialNotes }: { initialNotes: Note[] } = $props();

	let notes = $state<Note[]>(untrack(() => initialNotes));

	// Compute the restored IDs once as a plain value (not reactive state) so
	// both openNoteIds and drafts can be initialized from it without Svelte
	// warning about reactive references inside $state() initializers.
	const restoredIds: string[] = browser
		? (() => {
				try {
					const saved = localStorage.getItem('openNoteIds');
					if (saved) {
						const ids: string[] = JSON.parse(saved);
						return ids.filter((id) => initialNotes.some((n) => n.id === id));
					}
				} catch {}
				return [];
			})()
		: [];

	let openNoteIds = $state<string[]>(restoredIds);

	// Pre-populate drafts for every restored note so column titles and search
	// work correctly before NoteEditor's own onMount fires.
	let drafts = $state<Record<string, { title: string; content: string }>>(
		restoredIds.reduce(
			(acc, id) => {
				const note = initialNotes.find((n) => n.id === id);
				if (!note) return acc;
				try {
					const stored = browser ? localStorage.getItem(`draft_${id}`) : null;
					acc[id] = stored
						? JSON.parse(stored)
						: { title: note.title, content: note.content };
				} catch {
					acc[id] = { title: note.title, content: note.content };
				}
				return acc;
			},
			{} as Record<string, { title: string; content: string }>
		)
	);

	let showPopup = $state(false);
	let searchQuery = $state('');
	let popupLeft = $state(0);
	let popupTop = $state(0);
	let toggleBtnEl = $state<HTMLButtonElement | null>(null);
	let searchInputEl = $state<HTMLInputElement | null>(null);

	const filteredNotes = $derived(
		searchQuery.trim()
			? notes.filter((n) => {
					const q = searchQuery.toLowerCase();
					const t = (drafts[n.id]?.title ?? n.title).toLowerCase();
					const c = (drafts[n.id]?.content ?? n.content).toLowerCase();
					return t.includes(q) || c.includes(q);
				})
			: notes
	);

	$effect(() => {
		if (showPopup) setTimeout(() => searchInputEl?.focus(), 0);
	});

	// Persist open note IDs on every change (safe: first run re-writes the
	// same value we just loaded, so nothing is lost).
	$effect(() => {
		if (browser) localStorage.setItem('openNoteIds', JSON.stringify(openNoteIds));
	});

	onDestroy(() => {
		saveAll(); // fire-and-forget — fetch outlives the component
	});

	function openPopup() {
		if (toggleBtnEl) {
			const rect = toggleBtnEl.getBoundingClientRect();
			popupLeft = rect.left;
			popupTop = rect.bottom + 6;
		}
		searchQuery = '';
		showPopup = true;
	}

	function openNote(id: string) {
		if (!openNoteIds.includes(id)) {
			const note = notes.find((n) => n.id === id);
			if (!note) return;
			openNoteIds = [...openNoteIds, id];
			try {
				const stored = localStorage.getItem(`draft_${id}`);
				drafts = {
					...drafts,
					[id]: stored ? JSON.parse(stored) : { title: note.title, content: note.content }
				};
			} catch {
				drafts = { ...drafts, [id]: { title: note.title, content: note.content } };
			}
		}
		showPopup = false;
	}

	async function closeNote(id: string) {
		await saveToDb(id);
		openNoteIds = openNoteIds.filter((nid) => nid !== id);
		const { [id]: _, ...rest } = drafts;
		drafts = rest;
	}

	async function saveToDb(id: string) {
		const draft = drafts[id];
		if (!draft) return;
		const res = await fetch(`/api/notes/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(draft)
		});
		if (res.ok) {
			const updated: Note = await res.json();
			notes = notes.map((n) => (n.id === id ? updated : n));
			localStorage.removeItem(`draft_${id}`);
		}
	}

	async function saveAll() {
		await Promise.all(openNoteIds.map((id) => saveToDb(id)));
	}

	async function closeAll() {
		await saveAll();
		openNoteIds = [];
		drafts = {};
	}

	function handleNoteChange(id: string, draft: { title: string; content: string }) {
		drafts = { ...drafts, [id]: draft };
	}

	async function createNote() {
		const res = await fetch('/api/notes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: '', content: '' })
		});
		const created: Note = await res.json();
		notes = [created, ...notes];
		openNote(created.id);
	}

	async function deleteNote(id: string) {
		await fetch(`/api/notes/${id}`, { method: 'DELETE' });
		notes = notes.filter((n) => n.id !== id);
		if (openNoteIds.includes(id)) {
			openNoteIds = openNoteIds.filter((nid) => nid !== id);
			const { [id]: _, ...rest } = drafts;
			drafts = rest;
		}
	}

	function noteTitle(id: string) {
		return drafts[id]?.title || notes.find((n) => n.id === id)?.title || 'Untitled';
	}
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState === 'hidden') saveAll();
	}}
/>

{#if showPopup}
	<div
		class="popup-backdrop"
		role="presentation"
		tabindex="-1"
		onclick={() => (showPopup = false)}
		onkeydown={(e) => {
			if (e.key === 'Escape') showPopup = false;
		}}
	></div>
	<div
		class="popup"
		style="left: {popupLeft}px; top: {popupTop}px"
		role="dialog"
		aria-label="Search notes"
		tabindex="-1"
	>
		<div class="popup-search-wrap">
			<input
				bind:this={searchInputEl}
				bind:value={searchQuery}
				class="popup-search"
				placeholder="Search notes..."
				onkeydown={(e) => {
					if (e.key === 'Escape') showPopup = false;
				}}
			/>
		</div>
		<div class="popup-list">
			{#each filteredNotes as note (note.id)}
				<button
					class="popup-item"
					class:is-open={openNoteIds.includes(note.id)}
					onclick={() => openNote(note.id)}
				>
					<span class="popup-item-title"
						>{drafts[note.id]?.title || note.title || 'Untitled'}</span
					>
					<span
						class="popup-item-del"
						role="button"
						tabindex="0"
						aria-label="Delete note"
						onclick={(e) => {
							e.stopPropagation();
							deleteNote(note.id);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.stopPropagation();
								deleteNote(note.id);
							}
						}}
					>×</span>
				</button>
			{/each}
			{#if filteredNotes.length === 0}
				<p class="popup-empty">{searchQuery ? 'No matches.' : 'No notes yet.'}</p>
			{/if}
		</div>
	</div>
{/if}

<div class="panel">
	<header class="panel-header">
		<button
			bind:this={toggleBtnEl}
			class="index-toggle"
			class:active={showPopup}
			onclick={openPopup}
			aria-label="Browse notes"
			title="Browse notes"
		>
			☰
		</button>
		<span class="panel-label">Notes</span>
		{#if openNoteIds.length > 0}
			<button class="close-all-btn" onclick={closeAll}>Close all</button>
		{/if}
		<button class="new-btn" onclick={createNote}>+ New</button>
	</header>

	<div class="editors-container">
		{#each openNoteIds as id (id)}
			{@const note = notes.find((n) => n.id === id)}
			{#if note}
				<div class="note-col">
					<div class="col-header">
						<span class="col-title">{noteTitle(id)}</span>
						<button class="col-close" onclick={() => closeNote(id)} aria-label="Close note"
							>×</button
						>
					</div>
					<div class="col-editor">
						<NoteEditor {note} onchange={(nid, draft) => handleNoteChange(nid, draft)} />
					</div>
				</div>
			{/if}
		{/each}
		{#if openNoteIds.length === 0}
			<div class="empty-state">
				<p>Open a note or create a new one.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--surface);
		background: var(--bg-2);
		flex-shrink: 0;
	}

	.editors-container {
		flex: 1;
		display: flex;
		flex-direction: row;
		overflow-x: auto;
		overflow-y: hidden;
		min-height: 0;
	}

	.editors-container::-webkit-scrollbar {
		height: 4px;
	}

	.note-col {
		flex: 1;
		min-width: 320px;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--bg-2);
		min-height: 0;
	}

	.note-col:last-child {
		border-right: none;
	}

	.col-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--bg-2);
		flex-shrink: 0;
		background: var(--bg-2);
	}

	.col-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.8125rem;
		color: var(--text-dim);
	}

	.col-close {
		background: none;
		border: none;
		color: var(--border);
		font-size: 1rem;
		line-height: 1;
		padding: 0 0.2rem;
		flex-shrink: 0;
		transition: color 0.1s;
	}

	.col-close:hover {
		color: var(--accent);
	}

	.col-editor {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-faint);
		font-size: 0.875rem;
		width: 100%;
	}

	.index-toggle {
		background: none;
		border: 1px solid transparent;
		border-radius: 5px;
		color: var(--text-dim);
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;
		transition:
			color 0.15s,
			background 0.15s,
			border-color 0.15s;
	}

	.index-toggle:hover {
		color: var(--text-2);
		background: var(--surface-2);
	}

	.index-toggle.active {
		color: var(--accent);
		background: var(--accent-bg);
		border-color: var(--accent-muted);
	}

	.panel-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-ghost);
		flex: 1;
	}

	.close-all-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-ghost);
		padding: 0.25rem 0.625rem;
		font-size: 0.8125rem;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.close-all-btn:hover {
		color: var(--text-muted);
		border-color: var(--text-dim);
	}

	.new-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-muted);
		padding: 0.25rem 0.625rem;
		font-size: 0.8125rem;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}

	.new-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-bg);
	}

	.popup-backdrop {
		position: fixed;
		inset: 0;
		z-index: 49;
	}

	.popup {
		position: fixed;
		z-index: 50;
		width: 300px;
		max-height: min(72vh, 520px);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow:
			0 4px 6px rgba(0, 0, 0, 0.3),
			0 12px 32px rgba(0, 0, 0, 0.5);
	}

	.popup-search-wrap {
		padding: 0.625rem;
		border-bottom: 1px solid var(--border-2);
		flex-shrink: 0;
	}

	.popup-search {
		width: 100%;
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		padding: 0.4rem 0.625rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.popup-search::placeholder {
		color: var(--text-ghost);
	}

	.popup-search:focus {
		border-color: var(--accent);
	}

	.popup-list {
		overflow-y: auto;
		flex: 1;
		padding: 0.375rem 0;
	}

	.popup-item {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0.5rem 0.875rem;
		background: none;
		border: none;
		color: var(--text-ghost);
		text-align: left;
		gap: 0.375rem;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.popup-item:hover {
		background: var(--surface);
		color: var(--text-2);
	}

	.popup-item.is-open {
		color: var(--accent);
	}

	.popup-item-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.8125rem;
	}

	.popup-item-del {
		color: transparent;
		font-size: 1rem;
		line-height: 1;
		padding: 0 0.125rem;
		flex-shrink: 0;
		transition: color 0.1s;
		cursor: pointer;
	}

	.popup-item:hover .popup-item-del {
		color: var(--text-ghost);
	}

	.popup-item:hover .popup-item-del:hover {
		color: var(--accent);
	}

	.popup-empty {
		color: var(--text-faint);
		font-size: 0.8125rem;
		padding: 0.75rem 0.875rem;
		text-align: center;
	}
</style>
