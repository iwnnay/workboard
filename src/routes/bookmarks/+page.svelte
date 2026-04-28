<script lang="ts">
	import type { PageData } from './$types';
	import type { Bookmark, BookmarkFolder } from '$lib/types';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let { data }: { data: PageData } = $props();

	let folders = $state<BookmarkFolder[]>(untrack(() => data.folders));
	let bookmarks = $state<Bookmark[]>(untrack(() => data.bookmarks));

	let collapsed = new SvelteSet<string>();
	let editingBookmarkId = $state<string | null>(null);
	let editDraft = $state({ name: '', url: '', description: '' });
	let editingFolderId = $state<string | null>(null);
	let folderNameDraft = $state('');
	let addingToFolderId = $state<string | null>(null); // folder id or '' for uncategorized
	let newBookmarkDraft = $state({ name: '', url: '', description: '' });
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

	function toggleCollapse(id: string) {
		if (collapsed.has(id)) collapsed.delete(id);
		else collapsed.add(id);
	}

	function startEditBookmark(b: Bookmark) {
		editingBookmarkId = b.id;
		editDraft = { name: b.name, url: b.url, description: b.description };
	}

	async function saveBookmark(id: string) {
		const res = await fetch(`/api/bookmarks/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(editDraft)
		});
		const updated: Bookmark = await res.json();
		bookmarks = bookmarks.map((b) => (b.id === id ? updated : b));
		editingBookmarkId = null;
	}

	async function deleteBookmark(id: string) {
		await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
		bookmarks = bookmarks.filter((b) => b.id !== id);
	}

	async function createBookmark(folderId: string | null) {
		const { name, url, description } = newBookmarkDraft;
		if (!name.trim() || !url.trim()) return;
		const res = await fetch('/api/bookmarks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ folderId, name: name.trim(), url: url.trim(), description: description.trim() })
		});
		const created: Bookmark = await res.json();
		bookmarks = [...bookmarks, created];
		newBookmarkDraft = { name: '', url: '', description: '' };
		addingToFolderId = null;
	}

	function startEditFolder(f: BookmarkFolder) {
		editingFolderId = f.id;
		folderNameDraft = f.name;
	}

	async function saveFolderName(id: string) {
		const name = folderNameDraft.trim();
		if (!name) {
			editingFolderId = null;
			return;
		}
		const res = await fetch(`/api/bookmark-folders/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name })
		});
		const updated: BookmarkFolder = await res.json();
		folders = folders.map((f) => (f.id === id ? updated : f));
		editingFolderId = null;
	}

	async function deleteFolder(id: string) {
		await fetch(`/api/bookmark-folders/${id}`, { method: 'DELETE' });
		folders = folders.filter((f) => f.id !== id);
		bookmarks = bookmarks.map((b) => (b.folderId === id ? { ...b, folderId: null } : b));
	}

	async function createFolder() {
		const name = newFolderName.trim();
		if (!name) return;
		const res = await fetch('/api/bookmark-folders', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name })
		});
		const created: BookmarkFolder = await res.json();
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
					if (e.key === 'Escape') {
						showAddFolder = false;
						newFolderName = '';
					}
				}}
			/>
			<button class="btn-confirm" onclick={createFolder}>Add</button>
			<button
				class="btn-cancel"
				onclick={() => {
					showAddFolder = false;
					newFolderName = '';
				}}>Cancel</button
			>
		</div>
	{/if}

	<div class="tree">
		{#each folders as folder (folder.id)}
			<div class="folder">
				<div
					class="folder-header"
					role="button"
					tabindex="0"
					onclick={() => toggleCollapse(folder.id)}
					onkeydown={(e) => e.key === 'Enter' && toggleCollapse(folder.id)}
				>
					<span class="chevron" class:collapsed={collapsed.has(folder.id)}>▼</span>

					{#if editingFolderId === folder.id}
						<input
							class="folder-name-input inline"
							bind:value={folderNameDraft}
							onclick={(e) => e.stopPropagation()}
							onkeydown={(e) => {
								e.stopPropagation();
								if (e.key === 'Enter') saveFolderName(folder.id);
								if (e.key === 'Escape') editingFolderId = null;
							}}
						/>
						<button
							class="icon-btn"
							onclick={(e) => {
								e.stopPropagation();
								saveFolderName(folder.id);
							}}>✓</button
						>
						<button
							class="icon-btn"
							onclick={(e) => {
								e.stopPropagation();
								editingFolderId = null;
							}}>✗</button
						>
					{:else}
						<span class="folder-name">{folder.name}</span>
						<div class="folder-actions">
							<button
								class="icon-btn"
								onclick={(e) => {
									e.stopPropagation();
									startEditFolder(folder);
								}}
								aria-label="Rename folder"
							>✎</button>
							<button
								class="icon-btn del"
								onclick={(e) => {
									e.stopPropagation();
									deleteFolder(folder.id);
								}}
								aria-label="Delete folder"
							>×</button>
						</div>
					{/if}
				</div>

				{#if !collapsed.has(folder.id)}
					<div class="folder-content">
						{#each bookmarksByFolder[folder.id] ?? [] as bm (bm.id)}
							{#if editingBookmarkId === bm.id}
								<div class="bookmark-edit">
									<div class="edit-row">
										<input class="edit-input" bind:value={editDraft.name} placeholder="Name" />
										<input class="edit-input url" bind:value={editDraft.url} placeholder="URL" />
										<button class="icon-btn" onclick={() => saveBookmark(bm.id)}>✓</button>
										<button class="icon-btn" onclick={() => (editingBookmarkId = null)}>✗</button>
									</div>
									<textarea
										class="edit-desc"
										bind:value={editDraft.description}
										maxlength="180"
										placeholder="Description (optional, max 180 chars)"
									></textarea>
								</div>
							{:else}
								<div class="bookmark-row">
									<div class="bookmark-info">
										<a href={bm.url} target="_blank" rel="noopener noreferrer" class="bookmark-name"
											>{bm.name}</a
										>
										{#if bm.description}
											<p class="bookmark-desc">{bm.description}</p>
										{/if}
									</div>
									<div class="bookmark-actions">
										<button
											class="icon-btn edit"
											onclick={() => startEditBookmark(bm)}
											aria-label="Edit bookmark"
										>✎</button>
										<button
											class="icon-btn del"
											onclick={() => deleteBookmark(bm.id)}
											aria-label="Delete bookmark"
										>×</button>
									</div>
								</div>
							{/if}
						{/each}

						{#if addingToFolderId === folder.id}
							<div class="bookmark-edit adding">
								<div class="edit-row">
									<input
										class="edit-input"
										bind:value={newBookmarkDraft.name}
										placeholder="Name"
										onkeydown={(e) => e.key === 'Escape' && (addingToFolderId = null)}
									/>
									<input
										class="edit-input url"
										bind:value={newBookmarkDraft.url}
										placeholder="URL"
										onkeydown={(e) => {
											if (e.key === 'Enter') createBookmark(folder.id);
											if (e.key === 'Escape') addingToFolderId = null;
										}}
									/>
									<button class="icon-btn" onclick={() => createBookmark(folder.id)}>✓</button>
									<button class="icon-btn" onclick={() => (addingToFolderId = null)}>✗</button>
								</div>
								<textarea
									class="edit-desc"
									bind:value={newBookmarkDraft.description}
									maxlength="180"
									placeholder="Description (optional, max 180 chars)"
								></textarea>
							</div>
						{:else}
							<button
								class="add-bookmark-btn"
								onclick={() => {
									newBookmarkDraft = { name: '', url: '', description: '' };
									addingToFolderId = folder.id;
								}}
							>
								+ Add bookmark
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}

		{#if uncategorized.length > 0 || addingToFolderId === ''}
			<div class="folder">
				<div class="folder-header ungrouped">
					<span class="folder-name muted">Ungrouped</span>
				</div>
				<div class="folder-content">
					{#each uncategorized as bm (bm.id)}
						{#if editingBookmarkId === bm.id}
							<div class="bookmark-edit">
								<div class="edit-row">
									<input class="edit-input" bind:value={editDraft.name} placeholder="Name" />
									<input class="edit-input url" bind:value={editDraft.url} placeholder="URL" />
									<button class="icon-btn" onclick={() => saveBookmark(bm.id)}>✓</button>
									<button class="icon-btn" onclick={() => (editingBookmarkId = null)}>✗</button>
								</div>
								<textarea
									class="edit-desc"
									bind:value={editDraft.description}
									maxlength="180"
									placeholder="Description (optional, max 180 chars)"
								></textarea>
							</div>
						{:else}
							<div class="bookmark-row">
								<div class="bookmark-info">
									<a href={bm.url} target="_blank" rel="noopener noreferrer" class="bookmark-name"
										>{bm.name}</a
									>
									{#if bm.description}
										<p class="bookmark-desc">{bm.description}</p>
									{/if}
								</div>
								<div class="bookmark-actions">
									<button
										class="icon-btn edit"
										onclick={() => startEditBookmark(bm)}
										aria-label="Edit bookmark"
									>✎</button>
									<button
										class="icon-btn del"
										onclick={() => deleteBookmark(bm.id)}
										aria-label="Delete bookmark"
									>×</button>
								</div>
							</div>
						{/if}
					{/each}

					{#if addingToFolderId === ''}
						<div class="bookmark-edit adding">
							<div class="edit-row">
								<input
									class="edit-input"
									bind:value={newBookmarkDraft.name}
									placeholder="Name"
									onkeydown={(e) => e.key === 'Escape' && (addingToFolderId = null)}
								/>
								<input
									class="edit-input url"
									bind:value={newBookmarkDraft.url}
									placeholder="URL"
									onkeydown={(e) => {
										if (e.key === 'Enter') createBookmark(null);
										if (e.key === 'Escape') addingToFolderId = null;
									}}
								/>
								<button class="icon-btn" onclick={() => createBookmark(null)}>✓</button>
								<button class="icon-btn" onclick={() => (addingToFolderId = null)}>✗</button>
							</div>
							<textarea
								class="edit-desc"
								bind:value={newBookmarkDraft.description}
								maxlength="180"
								placeholder="Description (optional, max 180 chars)"
							></textarea>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<button
		class="add-ungrouped-btn"
		onclick={() => {
			newBookmarkDraft = { name: '', url: '', description: '' };
			addingToFolderId = '';
		}}
	>
		+ Add ungrouped bookmark
	</button>
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
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
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

	.folder-name-input:focus {
		border-color: var(--accent);
	}

	.folder-name-input.inline {
		flex: 1;
		font-size: 0.875rem;
		font-weight: 500;
		padding: 0.2rem 0.5rem;
	}

	/* ── Tree ───────────────────────────────────────────────── */
	.tree {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.folder {
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
	}

	.folder-header {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.625rem 0.875rem;
		background: var(--surface);
		cursor: pointer;
		user-select: none;
		transition: background 0.1s;
	}

	.folder-header:hover {
		background: var(--surface-2);
	}

	.folder-header.ungrouped {
		cursor: default;
	}

	.folder-header.ungrouped:hover {
		background: var(--surface);
	}

	.chevron {
		color: var(--text-dim);
		font-size: 0.625rem;
		width: 12px;
		text-align: center;
		transition: transform 0.15s;
		flex-shrink: 0;
	}

	.chevron.collapsed {
		transform: rotate(-90deg);
	}

	.folder-name {
		flex: 1;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-2);
	}

	.folder-name.muted {
		color: var(--text-dim);
		font-weight: 400;
	}

	.folder-actions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.1s;
	}

	.folder-header:hover .folder-actions {
		opacity: 1;
	}

	.folder-content {
		border-top: 1px solid var(--border-2);
	}

	/* ── Bookmark rows ──────────────────────────────────────── */
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

	/* ── Edit form ──────────────────────────────────────────── */
	.bookmark-edit {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border-2);
	}

	.bookmark-edit.adding {
		background: var(--bg-2);
	}

	.edit-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.edit-input {
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		padding: 0.375rem 0.625rem;
		outline: none;
		font-size: 0.8125rem;
		transition: border-color 0.15s;
		min-width: 0;
		flex: 1;
	}

	.edit-input.url {
		flex: 2;
	}

	.edit-input:focus {
		border-color: var(--accent);
	}

	.edit-desc {
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-2);
		padding: 0.375rem 0.625rem;
		outline: none;
		font-size: 0.8125rem;
		line-height: 1.5;
		resize: none;
		height: 60px;
		transition: border-color 0.15s;
		width: 100%;
	}

	.edit-desc:focus {
		border-color: var(--accent);
	}

	.edit-desc::placeholder {
		color: var(--text-ghost);
	}

	/* ── Icon buttons ───────────────────────────────────────── */
	.icon-btn {
		background: none;
		border: none;
		color: var(--text-dim);
		font-size: 0.875rem;
		padding: 0.2rem 0.3rem;
		border-radius: 3px;
		line-height: 1;
		flex-shrink: 0;
		transition: color 0.1s, background 0.1s;
	}

	.icon-btn:hover {
		color: var(--text-2);
		background: var(--surface-2);
	}

	.icon-btn.del:hover {
		color: var(--accent);
		background: var(--accent-bg);
	}

	.icon-btn.edit:hover {
		color: var(--text-2);
	}

	/* ── Add bookmark button ────────────────────────────────── */
	.add-bookmark-btn {
		display: block;
		width: 100%;
		padding: 0.5rem 1rem;
		background: none;
		border: none;
		color: var(--text-ghost);
		font-size: 0.8125rem;
		text-align: left;
		transition: color 0.1s, background 0.1s;
	}

	.add-bookmark-btn:hover {
		color: var(--text-muted);
		background: var(--surface);
	}

	/* ── Buttons ────────────────────────────────────────────── */
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

	.btn-confirm:hover {
		background: var(--accent-muted);
		color: var(--text);
	}

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

	.btn-cancel:hover {
		color: var(--text-muted);
		border-color: var(--text-dim);
	}

	/* ── Add ungrouped ──────────────────────────────────────── */
	.add-ungrouped-btn {
		display: block;
		margin-top: 1rem;
		background: none;
		border: 1px dashed var(--border);
		border-radius: 8px;
		color: var(--text-ghost);
		padding: 0.625rem 1rem;
		font-size: 0.8125rem;
		width: 100%;
		text-align: left;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
	}

	.add-ungrouped-btn:hover {
		color: var(--text-muted);
		border-color: var(--text-dim);
		background: var(--surface);
	}
</style>
