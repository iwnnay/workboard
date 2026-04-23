<script lang="ts">
	import { tick } from "svelte";

	interface Props {
		draft: { id?: number; title: string; content: string };
		onChange: (draft: { id?: number; title: string; content: string }) => void;
		onClose: () => void;
	}

	let { draft, onChange, onClose }: Props = $props();

	let titleInputEl: HTMLInputElement | null = $state(null);
	let title = $state("");
	let content = $state("");

	$effect(() => {
		title = draft.title;
		content = draft.content;
	});

	$effect(() => {
		title = draft.title;
		content = draft.content;
	});

	$effect(() => {
		onChange({ id: draft.id, title, content });
	});

	function handleClose() {
		onClose();
	}

	function onTitleKey(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			tick().then(() => {
				const el = document.getElementById(`note-content-${draft.id ?? "new"}`) as HTMLTextAreaElement | null;
				el?.focus();
			});
		}
	}
</script>

<div class="note-modal">
	<div class="header">
		<input
			class="title-input"
			bind:value={title}
			placeholder="Note title..."
			onkeydown={onTitleKey}
			bind:this={titleInputEl}
		/>
		<button class="close-btn" onclick={handleClose} aria-label="Close note">×</button>
	</div>
	<textarea
		id={`note-content-${draft.id ?? "new"}`}
		class="content-textarea"
		bind:value={content}
		placeholder="Start typing..."
	></textarea>
</div>

<style>
	.note-modal {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 14px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: 0.75rem;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.title-input {
		flex: 1;
		background: transparent;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
		color: inherit;
		font: inherit;
		font-size: 1.15rem;
		font-weight: 700;
		padding: 0.25rem 0.125rem;
		outline: none;
		border-radius: 0;
	}

	.title-input:focus {
		border-bottom-color: rgba(255, 255, 255, 0.35);
	}

	.close-btn {
		background: none;
		border: none;
		color: inherit;
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0.15rem 0.4rem;
		opacity: 0.5;
		line-height: 1;
	}

	.close-btn:hover {
		opacity: 1;
	}

	.content-textarea {
		flex: 1;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		color: inherit;
		font: inherit;
		padding: 0.75rem;
		resize: none;
		outline: none;
		line-height: 1.5;
	}

	.content-textarea:focus {
		border-color: rgba(255, 255, 255, 0.2);
	}
</style>
