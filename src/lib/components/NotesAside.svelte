<script lang="ts">
	import NoteModal from './NoteModal.svelte';

	interface Note {
		id: string;
		title: string;
		updatedAt: Date;
	}

	interface Props {
		notes: Note[];
	}

	let { notes }: Props = $props();
	let openNotes = $state<Note[]>([]);
	let lastGroup = $state<Note[]>([]);
	let pendingNotes = $state<Record<string, { title: string; content: string; isNew: boolean }>>({});
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	function getStoredNotes(): Note[] {
		if (typeof sessionStorage === 'undefined') return [];
		const stored = sessionStorage.getItem('openNotes');
		if (!stored) return [];
		const ids = JSON.parse(stored) as string[];
		return notes.filter((n) => ids.includes(n.id));
	}

	function getLastGroup(): Note[] {
		if (typeof sessionStorage === 'undefined') return [];
		const stored = sessionStorage.getItem('lastGroup');
		if (!stored) return [];
		const ids = JSON.parse(stored) as string[];
		return notes.filter((n) => ids.includes(n.id));
	}

	function saveLastGroup() {
		if (openNotes.length > 0 && typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem('lastGroup', JSON.stringify(openNotes.map((n) => n.id)));
			lastGroup = getLastGroup();
		}
	}

	function openNote(note: Note) {
		const alreadyOpen = openNotes.find((n) => n.id === note.id);
		if (!alreadyOpen) {
			openNotes = [...openNotes, note];
			if (typeof sessionStorage !== 'undefined') {
				sessionStorage.setItem('openNotes', JSON.stringify(openNotes.map((n) => n.id)));
			}
		}
	}

	function createNote() {
		const newNote: Note = { id: '', title: '', updatedAt: new Date() };
		const allNotes = [...openNotes, newNote];
		openNotes = allNotes;
		if (typeof sessionStorage !== 'undefined') {
			const ids = allNotes.filter((n) => n.id).map((n) => n.id);
			sessionStorage.setItem('openNotes', JSON.stringify(ids));
		}
	}

	async function closeNote(id: string) {
		if (pendingNotes[id]) {
			if (pendingNotes[id].isNew) {
				await fetch('/api/notes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(pendingNotes[id])
				});
			} else {
				await fetch(`/api/notes/${id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(pendingNotes[id])
				});
			}
			delete pendingNotes[id];
		}
		openNotes = openNotes.filter((n) => n.id !== id);
		const ids = openNotes.filter((n) => n.id).map((n) => n.id);
		if (typeof sessionStorage !== 'undefined') {
			if (ids.length > 0) {
				sessionStorage.setItem('openNotes', JSON.stringify(ids));
			} else {
				sessionStorage.removeItem('openNotes');
			}
		}
	}

	function handleNoteChange(noteId: string, isNew: boolean, data: { title: string; content: string }) {
		pendingNotes[noteId] = { ...data, isNew };

		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			savePendingNotes();
		}, 1000);
	}

	async function savePendingNotes() {
		const notesToSave = { ...pendingNotes };
		pendingNotes = {};

		for (const [noteId, noteData] of Object.entries(notesToSave)) {
			try {
				if (noteData.isNew) {
					const res = await fetch('/api/notes', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(noteData)
					});
					const saved = await res.json();
					const newId = saved.id;

					const idx = openNotes.findIndex((n) => !n.id);
					if (idx !== -1) {
						openNotes[idx] = { ...openNotes[idx], id: newId };
					}
				} else {
					await fetch(`/api/notes/${noteId}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(noteData)
					});
				}
			} catch (e) {
				console.error('Failed to save note:', e);
			}
		}
	}

	async function closeAllNotes() {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		if (Object.keys(pendingNotes).length > 0) {
			await savePendingNotes();
		}
		saveLastGroup();
		openNotes = [];
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.removeItem('openNotes');
		}
		lastGroup = getLastGroup();
	}

	function reopenLastGroup() {
		const group = getLastGroup();
		if (group.length > 0) {
			openNotes = group;
			if (typeof sessionStorage !== 'undefined') {
				sessionStorage.setItem('openNotes', JSON.stringify(group.map((n) => n.id)));
			}
		}
	}

	$effect(() => {
		openNotes = getStoredNotes();
		lastGroup = getLastGroup();
	});

	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	function handleDragStart(e: DragEvent, noteId: string) {
		draggedId = noteId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(e: DragEvent, noteId: string) {
		e.preventDefault();
		if (draggedId && draggedId !== noteId) {
			dragOverId = noteId;
		}
	}

	function handleDragLeave() {
		dragOverId = null;
	}

	async function handleDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		if (!draggedId || draggedId === targetId) {
			draggedId = null;
			dragOverId = null;
			return;
		}

		const newOrder = [...notes];
		const draggedIndex = newOrder.findIndex((n) => n.id === draggedId);
		const targetIndex = newOrder.findIndex((n) => n.id === targetId);

		if (draggedIndex !== -1 && targetIndex !== -1) {
			const [draggedItem] = newOrder.splice(draggedIndex, 1);
			newOrder.splice(targetIndex, 0, draggedItem);

			await fetch('/api/notes/order', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids: newOrder.map((n) => n.id) })
			});

			window.location.reload();
		}

		draggedId = null;
		dragOverId = null;
	}

	function handleDragEnd() {
		draggedId = null;
		dragOverId = null;
	}
</script>

<aside class="notes-aside">
	<div class="header">
		<h2>Notes</h2>
		<button onclick={createNote}>+</button>
	</div>

	<ul class="note-list">
		{#each notes as note (note.id)}
			<li
				class:dragging={draggedId === note.id}
				class:drag-over={dragOverId === note.id}
				draggable="true"
				ondragstart={(e) => handleDragStart(e, note.id)}
				ondragover={(e) => handleDragOver(e, note.id)}
				ondragleave={handleDragLeave}
				ondrop={(e) => handleDrop(e, note.id)}
				ondragend={handleDragEnd}
			>
				<button class="note-item" onclick={() => openNote(note)}>
					<span class="title">{note.title}</span>
					<span class="date">
						{note.updatedAt.toLocaleDateString()}
					</span>
				</button>
			</li>
		{/each}
	</ul>

	{#if lastGroup.length > 0}
		<button class="reopen-btn" onclick={reopenLastGroup}>
			Open last group ({lastGroup.length})
		</button>
	{/if}
</aside>

{#if openNotes.length > 0}
	<div class="editor-container" class:split={openNotes.length > 1} onclick={closeAllNotes} role="presentation">
		<div class="editor-header" onclick={(e) => e.stopPropagation()}>
			<span class="note-count">{openNotes.length} note{openNotes.length > 1 ? 's' : ''} open</span>
			<button class="close-all" onclick={closeAllNotes}>Close all</button>
		</div>
		<div class="editors" onclick={(e) => e.stopPropagation()}>
			{#each openNotes as note (note.id || 'new')}
				<div class="editor-pane">
					<NoteModal
						note={note}
						onclose={() => closeNote(note.id)}
						onsave={(data) => handleNoteChange(note.id || 'new', !note.id, data)}
						embedded={true}
					/>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.notes-aside {
		background: white;
		border-radius: 8px;
		padding: 1rem;
		padding-right: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		height: fit-content;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	h2 {
		font-size: 1rem;
		font-weight: 600;
	}

	.header button {
		width: 28px;
		height: 28px;
		border: none;
		background: #333;
		color: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
	}

	.header button:hover {
		background: #555;
	}

	.note-list {
		list-style: none;
	}

	.note-item {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.note-item:hover {
		background: #f5f5f5;
	}

	.note-item .title {
		font-weight: 500;
		font-size: 0.9rem;
	}

	.note-item .date {
		font-size: 0.75rem;
		color: #999;
	}

	.note-list li {
		cursor: grab;
	}

	.note-list li:active {
		cursor: grabbing;
	}

	.note-list li.dragging {
		opacity: 0.5;
	}

	.note-list li.drag-over {
		border-top: 2px solid #333;
	}

	.reopen-btn {
		width: 100%;
		margin-top: 0.5rem;
		background: #333;
		color: white;
		border: none;
		padding: 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.reopen-btn:hover {
		background: #555;
	}

	.editor-container {
		position: fixed;
		top: 0;
		left: 0;
		width: calc(100% - 280px);
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

.editor-container.split {
		top: 0;
		bottom: 0;
	}

	.editor-header {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 40px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 1rem;
		background: #333;
		color: white;
		z-index: 10;
	}

	.editor-container.split .editors {
		gap: 1rem;
		padding: 0 1rem;
	}

	.editor-header {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 1rem;
		background: #333;
		color: white;
	}

	.note-count {
		font-size: 0.9rem;
	}

	.close-all {
		background: white;
		color: #333;
		border: none;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.close-all:hover {
		background: #eee;
	}

	.editors {
		flex: 1;
		width: 100%;
		max-width: 1200px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.editor-container:not(.split) .editors {
		align-items: center;
	}

	.editor-container.split .editors {
		gap: 1rem;
		padding: 0 1rem;
		align-items: stretch;
	}

	.editor-pane {
		flex: 1;
		background: white;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
	}

	.editor-container:not(.split) .editor-pane {
		max-width: 700px;
		width: 100%;
	}

	.editor-container:not(.split) .editor-pane {
		max-width: 700px;
		max-height: 90vh;
	}
</style>