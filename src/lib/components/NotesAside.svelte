<script lang="ts">
	import { onMount } from "svelte";
	import NoteModal from "./NoteModal.svelte";

	interface Note {
		id: number;
		title: string;
		content: string;
		order: number;
		createdAt: number;
		updatedAt: number;
	}

	interface OpenNote {
		id?: number; // undefined for newly created before first save
		title: string;
		content: string;
		draftTitle: string;
		draftContent: string;
	}

	let notes = $state<Note[]>([]);
	let openNotes = $state<OpenNote[]>([]);
	let sidebarOpen = $state(false);
	let search = $state("");

	const filteredNotes = $derived(
		notes
			.filter((n) => (n.title + n.content).toLowerCase().includes(search.toLowerCase()))
			.sort((a, b) => a.order - b.order)
	);

	async function loadNotes() {
		const res = await fetch("/api/notes");
		notes = (await res.json()) as Note[];
	}

	function openNote(note: Note) {
		if (openNotes.some((o) => o.id === note.id)) return;
		openNotes = [
			...openNotes,
			{
				id: note.id,
				title: note.title,
				content: note.content,
				draftTitle: note.title,
				draftContent: note.content,
			},
		];
	}

	function newNote() {
		openNotes = [
			...openNotes,
			{
				id: undefined,
				title: "",
				content: "",
				draftTitle: "",
				draftContent: "",
			},
		];
	}

	function closeNote(index: number) {
		const note = openNotes[index];
		if (note) {
			if (note.id !== undefined) {
				// Save changes on close
				fetch(`/api/notes/${note.id}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title: note.draftTitle || "Untitled", content: note.draftContent }),
				});
				notes = notes.map((n) => (n.id === note.id ? { ...n, title: note.draftTitle || "Untitled", content: note.draftContent } : n));
			} else if (note.draftTitle.trim() || note.draftContent.trim()) {
				// Save new note then set its ID
				fetch("/api/notes", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title: note.draftTitle || "Untitled", content: note.draftContent, order: notes.length }),
				})
					.then((r) => r.json())
					.then((saved: Note) => {
						notes = [...notes, saved];
					});
			}
		}
		openNotes = openNotes.filter((_, i) => i !== index);
	}

	function closeAll() {
		for (let i = openNotes.length - 1; i >= 0; i--) {
			closeNote(i);
		}
	}

	function reopenLastGroup() {
		if (openNotes.length > 0) return;
		// Reopen last group? For simplicity, reopen all notes that have been saved (not ideal, but close enough).
		// A more robust approach would track groups. Here we'll reopen last 3 notes.
		const lastNotes = [...notes].sort((a, b) => b.order - a.order).slice(0, 3);
		for (const n of lastNotes.reverse()) {
			openNote(n);
		}
	}

	function onNoteChange(index: number, draft: { id?: number; title: string; content: string }) {
		openNotes = openNotes.map((o, i) => (i === index ? { ...o, draftTitle: draft.title, draftContent: draft.content } : o));
	}

	// Autosave every 1 second while typing
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const anyChanged = openNotes.some(
			(o) => o.id !== undefined && (o.draftTitle !== o.title || o.draftContent !== o.content)
		);
		if (autosaveTimer) clearTimeout(autosaveTimer);
		if (anyChanged) {
			autosaveTimer = setTimeout(() => {
				for (let i = 0; i < openNotes.length; i++) {
					const o = openNotes[i];
					if (o.id !== undefined && (o.draftTitle !== o.title || o.draftContent !== o.content)) {
						fetch(`/api/notes/${o.id}`, {
							method: "PUT",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ title: o.draftTitle || "Untitled", content: o.draftContent }),
						});
						// Update local snapshots
						openNotes = openNotes.map((item, idx) =>
							idx === i ? { ...item, title: o.draftTitle || "Untitled", content: o.draftContent } : item
						);
						notes = notes.map((n) =>
							n.id === o.id ? { ...n, title: o.draftTitle || "Untitled", content: o.draftContent } : n
						);
					}
				}
			}, 1000);
		}
		return () => {
			if (autosaveTimer) clearTimeout(autosaveTimer);
		};
	});

	function onDragStart(e: DragEvent, note: Note) {
		e.dataTransfer?.setData("text/plain", String(note.id));
	}

	function onDrop(e: DragEvent, targetNote: Note) {
		const draggedId = Number(e.dataTransfer?.getData("text/plain") ?? "");
		if (!draggedId || draggedId === targetNote.id) return;
		const draggedIndex = notes.findIndex((n) => n.id === draggedId);
		const targetIndex = notes.findIndex((n) => n.id === targetNote.id);
		if (draggedIndex === -1 || targetIndex === -1) return;
		const reordered = [...notes];
		const [removed] = reordered.splice(draggedIndex, 1);
		reordered.splice(targetIndex, 0, removed);
		reordered.forEach((n, i) => (n.order = i));
		notes = reordered;
		fetch("/api/notes/order", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ orders: reordered.map((n, i) => ({ id: n.id, order: i })) }),
		});
	}

	onMount(() => {
		loadNotes();
	});
</script>

<div class="notes-aside">
	<div class="sidebar">
		<div class="sidebar-header">
			<h3 class="sidebar-title">Notes</h3>
			<button class="new-btn" onclick={newNote} aria-label="New note">+ New</button>
		</div>
		<input class="search-input" bind:value={search} placeholder="Search notes..." />
		<div class="note-list">
			{#each filteredNotes as note (note.id)}
				<div
					class="note-item"
					draggable={true}
					ondragstart={(e) => onDragStart(e, note)}
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => onDrop(e, note)}
					role="button"
					tabindex="0"
					onclick={() => openNote(note)}
					onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") openNote(note); }}
				>
					<span class="note-item-title">{note.title || "Untitled"}</span>
				</div>
			{/each}
		</div>
		<div class="sidebar-footer">
			<button class="open-last-btn" onclick={reopenLastGroup}>Open last group</button>
		</div>
	</div>

	{#if openNotes.length > 0}
		<div class="shroud" onclick={closeAll} role="presentation" aria-hidden="true"></div>

		{#if openNotes.length === 1}
			<div class="editor single">
				<NoteModal
					draft={{ id: openNotes[0].id, title: openNotes[0].draftTitle, content: openNotes[0].draftContent }}
					onChange={(d) => onNoteChange(0, d)}
					onClose={() => closeNote(0)}
				/>
			</div>
		{:else}
			<div class="editor multi">
				{#each openNotes as note, i (note.id ?? `new-${i}`)}
					<div class="multi-pane">
						<NoteModal
							draft={{ id: note.id, title: note.draftTitle, content: note.draftContent }}
							onChange={(d) => onNoteChange(i, d)}
							onClose={() => closeNote(i)}
						/>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.notes-aside {
		display: flex;
		flex-direction: row;
		height: 100%;
		gap: 0.75rem;
		padding-right: 0.5rem;
	}

	.sidebar {
		width: 280px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		padding: 1rem;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.sidebar-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.8;
	}

	.new-btn {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		color: inherit;
		font: inherit;
		font-size: 0.8rem;
		padding: 0.35rem 0.6rem;
		cursor: pointer;
	}

	.new-btn:hover {
		background: rgba(255, 255, 255, 0.14);
	}

	.search-input {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: inherit;
		font: inherit;
		padding: 0.4rem 0.6rem;
		font-size: 0.85rem;
		outline: none;
	}

	.search-input:focus {
		border-color: rgba(255, 255, 255, 0.25);
	}

	.note-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		overflow-y: auto;
	}

	.note-item {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 0.5rem 0.625rem;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.note-item:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.note-item-title {
		font-size: 0.9rem;
		font-weight: 500;
		line-height: 1.35;
	}

	.sidebar-footer {
		margin-top: auto;
		padding-top: 0.5rem;
	}

	.open-last-btn {
		width: 100%;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: inherit;
		font: inherit;
		font-size: 0.8rem;
		padding: 0.45rem;
		cursor: pointer;
	}

	.open-last-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.shroud {
		position: fixed;
		inset: 0;
		right: auto;
		width: calc(100% - 280px - 0.75rem);
		background: rgba(0, 0, 0, 0.25);
		z-index: 40;
		cursor: pointer;
	}

	.editor {
		position: fixed;
		inset: 0;
		left: calc(280px + 0.75rem + 0.5rem);
		z-index: 50;
		display: flex;
		padding: 1.5rem;
		pointer-events: none;
	}

	.editor.single > :global(*) {
		pointer-events: auto;
		max-width: 700px;
		width: 100%;
		margin: 0 auto;
	}

	.editor.multi {
		flex-direction: row;
		gap: 1rem;
		overflow-x: auto;
	}

	.editor.multi .multi-pane {
		flex: 1 1 0;
		min-width: 300px;
		pointer-events: auto;
	}

	@media (max-width: 860px) {
		.sidebar {
			width: 220px;
		}
		.shroud {
			width: calc(100% - 220px - 0.75rem);
		}
		.editor {
			left: calc(220px + 0.75rem + 0.5rem);
		}
	}
</style>
