<script lang="ts">
	import type { PageData } from './$types';
	import type { Bookmark, BookmarkFolder, BookmarkDraft } from '$lib/types';
	import { untrack } from 'svelte';
	import { api } from '$lib/api';
	import BookmarkFolderComponent from '$lib/components/BookmarkFolder.svelte';

	let { data }: { data: PageData } = $props();

	let folders = $state<BookmarkFolder[]>(untrack(() => data.folders));
	let bookmarks = $state<Bookmark[]>(untrack(() => data.bookmarks));
	let showAddFolder = $state(false);
	let newFolderName = $state('');

	const bookmarksByFolder = $derived(
		bookmarks.reduce(
			(acc, b) => {
				const key = b.folderId ?? '';
				if (!acc[key]) acc[key] = [];
				acc[key].push(b);
				return acc;
			},
			{} as Record<string, Bookmark[]>
		)
	);

	const uncategorized = $derived(bookmarksByFolder[''] ?? []);

	// ── Bookmark handlers ─────────────────────────────────────

	async function saveBookmark(id: string, draft: BookmarkDraft) {
		const updated = await api.patch<Bookmark>(`/api/bookmarks/${id}`, draft);
		bookmarks = bookmarks.map((b) => (b.id === id ? updated : b));
	}

	async function deleteBookmark(id: string) {
		await api.del(`/api/bookmarks/${id}`);
		bookmarks = bookmarks.filter((b) => b.id !== id);
	}

	async function createBookmark(folderId: string | null, draft: BookmarkDraft) {
		const created = await api.post<Bookmark>('/api/bookmarks', { ...draft, folderId });
		bookmarks = [...bookmarks, created];
	}

	// ── Folder handlers ───────────────────────────────────────

	async function saveFolderName(id: string, name: string) {
		const updated = await api.patch<BookmarkFolder>(`/api/bookmark-folders/${id}`, { name });
		folders = folders.map((f) => (f.id === id ? updated : f));
	}

	async function deleteFolder(id: string) {
		await api.del(`/api/bookmark-folders/${id}`);
		folders = folders.filter((f) => f.id !== id);
		bookmarks = bookmarks.map((b) => (b.folderId === id ? { ...b, folderId: null } : b));
	}

	async function createFolder() {
		const name = newFolderName.trim();
		if (!name) return;
		const created = await api.post<BookmarkFolder>('/api/bookmark-folders', { name });
		folders = [...folders, created].sort((a, b) => a.name.localeCompare(b.name));
		newFolderName = '';
		showAddFolder = false;
	}
</script>

<div class="page">
	<header class="page-header">
		<h1 class="page-title">Bookmarks</h1>
		<button class="add-folder-btn" onclick={() => (showAddFolder = true)}>+ Folder</button>
	</header>

	{#if showAddFolder}
		<div class="add-folder-form">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="folder-name-input"
				bind:value={newFolderName}
				placeholder="Folder name..."
				autofocus
				onkeydown={(e) => {
					if (e.key === 'Enter') createFolder();
					if (e.key === 'Escape') { showAddFolder = false; newFolderName = ''; }
				}}
			/>
			<button class="btn-confirm" onclick={createFolder}>Add</button>
			<button class="btn-cancel" onclick={() => { showAddFolder = false; newFolderName = ''; }}>Cancel</button>
		</div>
	{/if}

	<div class="tree">
		{#each folders as folder (folder.id)}
			<BookmarkFolderComponent
				{folder}
				bookmarks={bookmarksByFolder[folder.id] ?? []}
				onSaveFolderName={saveFolderName}
				onDeleteFolder={deleteFolder}
				onSaveBookmark={saveBookmark}
				onDeleteBookmark={deleteBookmark}
				onCreateBookmark={createBookmark}
			/>
		{/each}

		{#if uncategorized.length > 0}
			<BookmarkFolderComponent
				folder={null}
				bookmarks={uncategorized}
				onSaveBookmark={saveBookmark}
				onDeleteBookmark={deleteBookmark}
				onCreateBookmark={createBookmark}
			/>
		{/if}
	</div>
</div>

<style>
	.page {
		max-width: 760px;
		margin: 0 auto;
		padding: 2rem 1.5rem 6rem;
		min-height: 100dvh;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	.page-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.add-folder-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-muted);
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
	}
	.add-folder-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-bg);
	}

	.add-folder-form {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.folder-name-input {
		flex: 1;
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		padding: 0.4rem 0.625rem;
		outline: none;
		transition: border-color 0.15s;
	}
	.folder-name-input:focus { border-color: var(--accent); }

	.tree {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.btn-confirm {
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		transition: background 0.15s;
		flex-shrink: 0;
	}
	.btn-confirm:hover { background: var(--accent-muted); color: var(--text); }

	.btn-cancel {
		background: none;
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-dim);
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		transition: color 0.15s, border-color 0.15s;
		flex-shrink: 0;
	}
	.btn-cancel:hover { color: var(--text-muted); border-color: var(--text-dim); }
</style>
