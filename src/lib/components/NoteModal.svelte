<script lang="ts">
	import { enhance } from '$app/forms';

	interface Note {
		id: string;
		title: string;
		content: string;
		updatedAt: Date;
	}

	interface Props {
		note: Note | null;
		onclose: () => void;
		onsave: (data: { title: string; content: string }) => void;
		embedded?: boolean;
	}

	let { note, onclose, onsave, embedded = false }: Props = $props();

	let title = $state(note?.title ?? '');
	let content = $state(note?.content ?? '');

	function handleSave() {
		onsave({ title, content });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	function save() {
		onsave({ title, content });
		onclose();
	}

	function deleteNote() {
		if (note?.id && confirm('Delete this note?')) {
			fetch(`/api/notes/${note.id}`, { method: 'DELETE' }).then(() => {
				onclose();
				window.location.reload();
			});
		} else if (!note?.id) {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if embedded}
	<div class="embedded-modal">
		<div class="modal-header">
			<input
				type="text"
				bind:value={title}
				oninput={() => onsave({ title, content })}
				placeholder="Note title..."
				class="title-input"
			/>
			<button class="close" onclick={onclose}>×</button>
		</div>

		<textarea
			bind:value={content}
			oninput={() => onsave({ title, content })}
			placeholder="Write your note..."
			class="content-input"
		></textarea>

		<div class="modal-footer">
			{#if note?.id}
				<button class="delete" onclick={deleteNote}>Delete</button>
			{/if}
			<button class="save" onclick={save}>Save</button>
		</div>
	</div>
{:else}
	<div class="modal-overlay" onclick={onclose} role="presentation">
		<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
			<div class="modal-header">
				<input
					type="text"
					bind:value={title}
					oninput={() => onsave({ title, content })}
					placeholder="Note title..."
					class="title-input"
				/>
				<button class="close" onclick={onclose}>×</button>
			</div>

			<textarea
				bind:value={content}
				oninput={() => onsave({ title, content })}
				placeholder="Write your note..."
				class="content-input"
			></textarea>

			<div class="modal-footer">
				{#if note?.id}
					<button class="delete" onclick={deleteNote}>Delete</button>
				{/if}
				<button class="save" onclick={save}>Save</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
	}

	.title-input {
		flex: 1;
		font-size: 1.25rem;
		font-weight: 600;
		border: none;
		outline: none;
	}

	.close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #999;
	}

	.content-input {
		flex: 1;
		min-height: 300px;
		padding: 1rem;
		border: none;
		resize: none;
		font-family: inherit;
		font-size: 1rem;
		outline: none;
	}

	.modal-footer {
		display: flex;
		justify-content: space-between;
		padding: 1rem;
		border-top: 1px solid #eee;
	}

	.save {
		background: #333;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.save:hover {
		background: #555;
	}

	.delete {
		background: #fee;
		color: #c00;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.delete:hover {
		background: #fdd;
	}

	.embedded-modal {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.embedded-modal .modal-header {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		gap: 1rem;
		border-bottom: 1px solid #eee;
		flex-shrink: 0;
	}

	.embedded-modal .title-input {
		flex: 1;
		font-size: 1.25rem;
		font-weight: 600;
		border: none;
		outline: none;
	}

	.embedded-modal .close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #999;
	}

	.embedded-modal .content-input {
		flex: 1;
		padding: 1rem;
		border: none;
		resize: none;
		font-family: inherit;
		font-size: 1rem;
		outline: none;
	}

	.embedded-modal .modal-footer {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-top: 1px solid #eee;
		flex-shrink: 0;
	}

	.embedded-modal .save {
		background: #333;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.embedded-modal .save:hover {
		background: #555;
	}

	.embedded-modal .delete {
		background: #fee;
		color: #c00;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.embedded-modal .delete:hover {
		background: #fdd;
	}
</style>