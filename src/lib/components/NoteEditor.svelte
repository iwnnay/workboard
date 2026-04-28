<script lang="ts">
	import type { Note } from '$lib/types';
	import { onMount, onDestroy, untrack } from 'svelte';

	let {
		note,
		onchange
	}: {
		note: Note;
		onchange: (id: string, draft: { title: string; content: string }) => void;
	} = $props();

	let title = $state(untrack(() => note.title));
	let content = $state(untrack(() => note.content));
	let localSaveTimer: ReturnType<typeof setTimeout>;

	onMount(() => {
		try {
			const stored = localStorage.getItem(`draft_${note.id}`);
			if (stored) {
				const draft = JSON.parse(stored);
				title = draft.title ?? title;
				content = draft.content ?? content;
				onchange(note.id, { title, content });
			}
		} catch {}
	});

	onDestroy(() => {
		clearTimeout(localSaveTimer);
		localStorage.setItem(`draft_${note.id}`, JSON.stringify({ title, content }));
	});

	function handleChange() {
		const draft = { title, content };
		onchange(note.id, draft);
		clearTimeout(localSaveTimer);
		localSaveTimer = setTimeout(() => {
			localStorage.setItem(`draft_${note.id}`, JSON.stringify(draft));
		}, 2000);
	}
</script>

<div class="editor">
	<input
		class="title-input"
		bind:value={title}
		oninput={handleChange}
		placeholder="Note title..."
	/>
	<textarea
		class="content-input"
		bind:value={content}
		oninput={handleChange}
		placeholder="Start writing..."
	></textarea>
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 1.25rem 1.5rem;
		gap: 0.75rem;
	}

	.title-input {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		font-size: 1rem;
		font-weight: 600;
		padding: 0.25rem 0 0.5rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.title-input::placeholder {
		color: var(--text-faint);
	}

	.title-input:focus {
		border-bottom-color: var(--accent);
	}

	.content-input {
		background: transparent;
		border: none;
		color: var(--text-2);
		flex: 1;
		line-height: 1.7;
		outline: none;
		padding: 0;
		resize: none;
	}

	.content-input::placeholder {
		color: var(--text-faint);
	}
</style>
