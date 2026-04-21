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
</script>

<aside class="notes-aside">
	<div class="header">
		<h2>Notes</h2>
		<button onclick={createNote}>+</button>
	</div>

	<ul class="note-list">
		{#each notes as note (note.id)}
			<li>
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
</style>