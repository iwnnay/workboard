<script lang="ts">
	import type { Bookmark, BookmarkDraft } from '$lib/types';
	import BookmarkEditForm from './BookmarkEditForm.svelte';

	let {
		bookmark,
		onSave,
		onDelete
	}: {
		bookmark: Bookmark;
		onSave: (id: string, draft: BookmarkDraft) => void | Promise<void>;
		onDelete: (id: string) => void | Promise<void>;
	} = $props();

	let editing = $state(false);
	let draft = $state<BookmarkDraft>({ name: '', url: '', description: '' });

	function startEdit() {
		draft = { name: bookmark.name, url: bookmark.url, description: bookmark.description };
		editing = true;
	}

	async function save() {
		await onSave(bookmark.id, draft);
		editing = false;
	}
</script>

{#if editing}
	<BookmarkEditForm bind:draft onSave={save} onCancel={() => (editing = false)} />
{:else}
	<div class="bookmark-row">
		<div class="bookmark-info">
			<a href={bookmark.url} target="_blank" rel="noopener noreferrer" class="bookmark-name">
				{bookmark.name}
			</a>
			{#if bookmark.description}
				<p class="bookmark-desc">{bookmark.description}</p>
			{/if}
		</div>
		<div class="bookmark-actions">
			<button class="icon-btn edit" onclick={startEdit} aria-label="Edit bookmark">✎</button>
			<button
				class="icon-btn del"
				onclick={() => onDelete(bookmark.id)}
				aria-label="Delete bookmark">×</button
			>
		</div>
	</div>
{/if}

<style>
	.bookmark-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--border-2);
		transition: background 0.1s;
	}
	.bookmark-row:last-child {
		border-bottom: none;
	}
	.bookmark-row:hover {
		background: var(--surface);
	}
	.bookmark-info {
		flex: 1;
		min-width: 0;
	}
	.bookmark-name {
		display: block;
		color: var(--text-2);
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		transition: color 0.1s;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bookmark-name:hover {
		color: var(--accent);
	}
	.bookmark-desc {
		font-size: 0.8125rem;
		color: var(--text-dim);
		margin-top: 0.125rem;
		line-height: 1.5;
	}
	.bookmark-actions {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.1s;
		padding-top: 1px;
	}
	.bookmark-row:hover .bookmark-actions {
		opacity: 1;
	}
	.icon-btn {
		background: none;
		border: none;
		color: var(--text-dim);
		font-size: 0.875rem;
		padding: 0.2rem 0.3rem;
		border-radius: 3px;
		line-height: 1;
		flex-shrink: 0;
		transition:
			color 0.1s,
			background 0.1s;
	}
	.icon-btn:hover {
		color: var(--text-2);
		background: var(--surface-2);
	}
	.icon-btn.del:hover {
		color: var(--accent);
		background: var(--accent-bg);
	}
</style>
