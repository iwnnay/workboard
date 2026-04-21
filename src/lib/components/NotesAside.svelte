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
	let showModal = $state(false);
	let selectedNote = $state<Note | null>(null);
	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	function openNote(note: Note) {
		selectedNote = note;
		showModal = true;
	}

	function createNote() {
		selectedNote = null;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		selectedNote = null;
	}

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
</aside>

{#if showModal}
	<NoteModal note={selectedNote} onclose={closeModal} />
{/if}

<style>
	.notes-aside {
		background: white;
		border-radius: 8px;
		padding: 1rem;
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
</style>
