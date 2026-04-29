<script lang="ts">
	import type { Bookmark, BookmarkFolder, BookmarkDraft } from '$lib/types';
	import BookmarkItem from './BookmarkItem.svelte';
	import BookmarkEditForm from './BookmarkEditForm.svelte';

	let {
		folder,
		bookmarks,
		onSaveFolderName,
		onDeleteFolder,
		onSaveBookmark,
		onDeleteBookmark,
		onCreateBookmark
	}: {
		/** Pass `null` for the "Ungrouped" pseudo-folder (no collapse / rename / delete). */
		folder: BookmarkFolder | null;
		bookmarks: Bookmark[];
		onSaveFolderName?: (id: string, name: string) => void | Promise<void>;
		onDeleteFolder?: (id: string) => void | Promise<void>;
		onSaveBookmark: (id: string, draft: BookmarkDraft) => void | Promise<void>;
		onDeleteBookmark: (id: string) => void | Promise<void>;
		onCreateBookmark: (folderId: string | null, draft: BookmarkDraft) => void | Promise<void>;
	} = $props();

	let collapsed = $state(false);
	let renaming = $state(false);
	let nameDraft = $state('');
	let adding = $state(false);
	let newDraft = $state<BookmarkDraft>({ name: '', url: '', description: '' });

	function toggleCollapse() {
		collapsed = !collapsed;
	}

	function startRename() {
		if (!folder) return;
		nameDraft = folder.name;
		renaming = true;
	}

	async function commitRename() {
		if (!folder || !onSaveFolderName) return;
		const trimmed = nameDraft.trim();
		if (!trimmed) { renaming = false; return; }
		await onSaveFolderName(folder.id, trimmed);
		renaming = false;
	}

	function startAdd() {
		newDraft = { name: '', url: '', description: '' };
		adding = true;
	}

	async function commitAdd() {
		if (!newDraft.name.trim() || !newDraft.url.trim()) return;
		await onCreateBookmark(folder?.id ?? null, newDraft);
		adding = false;
	}
</script>

<div class="folder">
	{#if folder}
		<!-- Real folder: collapsible, renameable, deleteable -->
		<div
			class="folder-header"
			role="button"
			tabindex="0"
			onclick={toggleCollapse}
			onkeydown={(e) => e.key === 'Enter' && toggleCollapse()}
		>
			<span class="chevron" class:collapsed>▼</span>

			{#if renaming}
				<input
					class="folder-name-input"
					bind:value={nameDraft}
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => {
						e.stopPropagation();
						if (e.key === 'Enter') commitRename();
						if (e.key === 'Escape') renaming = false;
					}}
				/>
				<button class="icon-btn" onclick={(e) => { e.stopPropagation(); commitRename(); }} aria-label="Save name">✓</button>
				<button class="icon-btn" onclick={(e) => { e.stopPropagation(); renaming = false; }} aria-label="Cancel rename">✗</button>
			{:else}
				<span class="folder-name">{folder.name}</span>
				<div class="folder-actions">
					<button class="icon-btn" onclick={(e) => { e.stopPropagation(); startRename(); }} aria-label="Rename folder">✎</button>
					<button class="icon-btn del" onclick={(e) => { e.stopPropagation(); onDeleteFolder?.(folder.id); }} aria-label="Delete folder">×</button>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Ungrouped: static header, no collapse or actions -->
		<div class="folder-header ungrouped">
			<span class="folder-name muted">Ungrouped</span>
		</div>
	{/if}

	{#if !folder || !collapsed}
		<div class="folder-content">
			{#each bookmarks as bm (bm.id)}
				<BookmarkItem bookmark={bm} onSave={onSaveBookmark} onDelete={onDeleteBookmark} />
			{/each}

			{#if adding}
				<BookmarkEditForm
					bind:draft={newDraft}
					variant="add"
					onSave={commitAdd}
					onCancel={() => (adding = false)}
				/>
			{:else}
				<button class="add-bookmark-btn" onclick={startAdd}>+ Add bookmark</button>
			{/if}
		</div>
	{/if}
</div>

<style>
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
	.folder-header:hover { background: var(--surface-2); }
	.folder-header.ungrouped { cursor: default; }
	.folder-header.ungrouped:hover { background: var(--surface); }

	.chevron {
		color: var(--text-dim);
		font-size: 0.625rem;
		width: 12px;
		text-align: center;
		transition: transform 0.15s;
		flex-shrink: 0;
	}
	.chevron.collapsed { transform: rotate(-90deg); }

	.folder-name {
		flex: 1;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-2);
	}
	.folder-name.muted { color: var(--text-dim); font-weight: 400; }

	.folder-name-input {
		flex: 1;
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		padding: 0.2rem 0.5rem;
		outline: none;
		font-size: 0.875rem;
		font-weight: 500;
		transition: border-color 0.15s;
	}
	.folder-name-input:focus { border-color: var(--accent); }

	.folder-actions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.1s;
	}
	.folder-header:hover .folder-actions { opacity: 1; }

	.folder-content { border-top: 1px solid var(--border-2); }

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
	.icon-btn:hover { color: var(--text-2); background: var(--surface-2); }
	.icon-btn.del:hover { color: var(--accent); background: var(--accent-bg); }

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
	.add-bookmark-btn:hover { color: var(--text-muted); background: var(--surface); }
</style>
