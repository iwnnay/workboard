<script lang="ts">
	import { untrack } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { foldersApi } from '$lib/folders-api';
	import { isWithinRoot, pathSegments, relativeToRoot } from '$lib/folder-paths';
	import type { DirectoryEntry, FolderListing } from '$lib/types';

	let {
		title = 'Choose folder',
		initialPath = null,
		root = null,
		onPick,
		onClose
	}: {
		title?: string;
		initialPath?: string | null;
		root?: string | null;
		onPick: (directory: string) => void;
		onClose: () => void;
	} = $props();

	let listing = $state<FolderListing | null>(null);
	let loading = $state(false);
	let errorMessage = $state('');
	let filterText = $state('');
	let pathInput = $state('');
	let highlightedPath = $state<string | null>(null);
	let filterInput = $state<HTMLInputElement | null>(null);

	const visibleEntries = $derived.by(() => {
		const entries = listing?.entries ?? [];
		const needle = filterText.trim().toLowerCase();
		return needle ? entries.filter((entry) => entry.name.toLowerCase().includes(needle)) : entries;
	});
	const highlightedEntry = $derived(
		visibleEntries.find((entry) => entry.path === highlightedPath) ?? null
	);
	const crumbs = $derived.by(() => {
		const segments = listing ? pathSegments(listing.path) : [];
		return root ? segments.filter((segment) => isWithinRoot(segment.path, root)) : segments;
	});
	const canGoUp = $derived(
		!!listing?.parent && !loading && (!root || isWithinRoot(listing.parent, root))
	);
	const pickTarget = $derived(highlightedEntry?.path ?? listing?.path ?? null);
	const pickLabel = $derived.by(() => {
		if (!pickTarget) {
			return '';
		}
		if (root) {
			return relativeToRoot(pickTarget, root) ?? pickTarget;
		}
		return pickTarget;
	});

	const load = async (path: string | null) => {
		if (root && path && !isWithinRoot(path, root)) {
			errorMessage = `opening folder "${path}": it is outside the project root "${root}"`;
			return;
		}
		loading = true;
		errorMessage = '';
		try {
			listing = await foldersApi.list(path);
			pathInput = listing.path;
			filterText = '';
			highlightedPath = null;
		} catch (caught) {
			errorMessage = caught instanceof Error ? caught.message : String(caught);
		} finally {
			loading = false;
			filterInput?.focus();
		}
	};

	const pick = () => {
		if (!pickTarget) {
			return;
		}
		if (root) {
			const relative = relativeToRoot(pickTarget, root);
			if (relative === null) {
				errorMessage = `choosing folder "${pickTarget}": it is outside the project root "${root}"`;
				return;
			}
			onPick(relative);
			return;
		}
		onPick(pickTarget);
	};

	const moveHighlight = (step: number) => {
		const currentIndex = visibleEntries.findIndex((entry) => entry.path === highlightedPath);
		const nextIndex = Math.min(visibleEntries.length - 1, Math.max(0, currentIndex + step));
		highlightedPath = visibleEntries[nextIndex]?.path ?? null;
		document
			.querySelector(`[data-folder-index="${nextIndex}"]`)
			?.scrollIntoView({ block: 'nearest' });
	};

	const onFilterKeydown = (event: KeyboardEvent) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			moveHighlight(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			moveHighlight(-1);
		} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			pick();
		} else if (event.key === 'Enter' && highlightedEntry) {
			event.preventDefault();
			void load(highlightedEntry.path);
		} else if (event.key === 'Backspace' && !filterText && canGoUp && listing?.parent) {
			event.preventDefault();
			void load(listing.parent);
		}
	};

	const onPathKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			void load(pathInput.trim() || null);
		}
	};

	const openEntry = (entry: DirectoryEntry) => void load(entry.path);

	void load(untrack(() => initialPath || root || null));
</script>

<Modal {title} label={title} maxWidth="640px" {onClose}>
	{#if !root && listing?.shortcuts.length}
		<div class="shortcut-bar">
			{#each listing.shortcuts as shortcut (shortcut.path)}
				<button class="shortcut" onclick={() => load(shortcut.path)} title={shortcut.path}
					>{shortcut.label}</button
				>
			{/each}
		</div>
	{/if}

	<div class="crumb-bar">
		<button
			class="up-btn"
			disabled={!canGoUp}
			onclick={() => listing?.parent && load(listing.parent)}
			aria-label="Up one folder">↑</button
		>
		<nav class="crumbs" aria-label="Current folder">
			{#each crumbs as crumb, crumbIndex (crumb.path)}
				{#if crumbIndex > 0}<span class="crumb-sep">›</span>{/if}
				<button
					class="crumb"
					class:current={crumbIndex === crumbs.length - 1}
					onclick={() => load(crumb.path)}>{crumb.name}</button
				>
			{/each}
		</nav>
	</div>

	{#if !root}
		<div class="path-row">
			<input
				class="path-input mono"
				bind:value={pathInput}
				onkeydown={onPathKeydown}
				spellcheck="false"
				aria-label="Folder path"
				placeholder="Paste a path and press Enter"
			/>
		</div>
	{/if}

	<div class="filter-row">
		<input
			class="filter-input"
			bind:this={filterInput}
			bind:value={filterText}
			onkeydown={onFilterKeydown}
			spellcheck="false"
			placeholder="Filter folders…  ↑↓ move · Enter open · Backspace up · Ctrl+Enter select"
			aria-label="Filter folders"
		/>
	</div>

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	<div class="entries" role="listbox" aria-label="Folders">
		{#if loading && !listing}
			<div class="placeholder">Reading folder…</div>
		{:else if listing && visibleEntries.length === 0}
			<div class="placeholder">
				{filterText ? `No folders match “${filterText}”.` : 'No sub-folders here.'}
			</div>
		{:else}
			{#each visibleEntries as entry, entryIndex (entry.path)}
				<div
					class="entry-row"
					class:highlighted={entry.path === highlightedPath}
					role="option"
					tabindex="-1"
					aria-selected={entry.path === highlightedPath}
					data-folder-index={entryIndex}
					onclick={() => (highlightedPath = entry.path)}
					ondblclick={() => openEntry(entry)}
					onkeydown={(event) => event.key === 'Enter' && openEntry(entry)}
				>
					<span class="entry-icon">📁&#xFE0E;</span>
					<span class="entry-name">{entry.name}</span>
					{#if entry.isProject}<span class="project-tag">project</span>{/if}
					<button
						class="entry-open"
						onclick={(event) => {
							event.stopPropagation();
							openEntry(entry);
						}}
						aria-label="Open {entry.name}">›</button
					>
				</div>
			{/each}
		{/if}
	</div>

	{#snippet footer()}
		<span class="footer-target mono" title={pickLabel}>{pickLabel}</span>
		<button class="cancel-btn" onclick={onClose}>Cancel</button>
		<button class="pick-btn" disabled={!pickTarget || loading} onclick={pick}>
			{highlightedEntry ? `Select ${highlightedEntry.name}` : 'Select this folder'}
		</button>
	{/snippet}
</Modal>

<style>
	.mono {
		font-family: 'Courier New', monospace;
	}

	.shortcut-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0.625rem 1rem 0;
	}

	.shortcut {
		padding: 0.2rem 0.625rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.shortcut:hover {
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.crumb-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem 0.375rem;
	}

	.up-btn {
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-muted);
	}

	.up-btn:hover:not(:disabled) {
		color: var(--accent);
		border-color: var(--accent-muted);
	}

	.up-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.125rem;
		min-width: 0;
		font-size: 0.8rem;
	}

	.crumb {
		padding: 0.125rem 0.3rem;
		border-radius: 4px;
		color: var(--text-dim);
	}

	.crumb:hover {
		background: var(--accent-bg);
		color: var(--text-2);
	}

	.crumb.current {
		color: var(--text);
		font-weight: 600;
	}

	.crumb-sep {
		color: var(--text-ghost);
	}

	.path-row,
	.filter-row {
		padding: 0.25rem 1rem;
	}

	.path-input,
	.filter-input {
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		font-size: 0.8rem;
		padding: 0.375rem 0.625rem;
	}

	.path-input:focus,
	.filter-input:focus {
		outline: none;
		border-color: var(--accent-muted);
	}

	.filter-input::placeholder,
	.path-input::placeholder {
		color: var(--text-ghost);
	}

	.error {
		margin: 0.375rem 1rem 0;
		color: var(--accent);
		font-size: 0.8rem;
		white-space: pre-wrap;
	}

	.entries {
		flex: 1;
		min-height: 14rem;
		max-height: 46vh;
		overflow-y: auto;
		margin: 0.5rem 1rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-2);
	}

	.placeholder {
		padding: 1rem;
		color: var(--text-dim);
		font-size: 0.8rem;
	}

	.entry-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0.5rem 0.3rem 0.75rem;
		cursor: default;
		user-select: none;
		font-size: 0.85rem;
		color: var(--text-2);
		border-left: 2px solid transparent;
	}

	.entry-row:hover {
		background: var(--accent-soft);
	}

	.entry-row.highlighted {
		background: var(--accent-bg);
		border-left-color: var(--accent);
		color: var(--text);
	}

	.entry-icon {
		color: var(--text-dim);
		font-size: 0.8rem;
	}

	.entry-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.project-tag {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--accent);
		border: 1px solid var(--accent-muted);
		border-radius: 3px;
		padding: 0 0.3rem;
	}

	.entry-open {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 4px;
		color: var(--text-ghost);
	}

	.entry-open:hover {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.footer-target {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-dim);
		font-size: 0.75rem;
	}

	.cancel-btn,
	.pick-btn {
		padding: 0.375rem 0.875rem;
		border-radius: 5px;
		font-size: 0.8rem;
		border: 1px solid var(--border);
		color: var(--text-muted);
	}

	.pick-btn {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.pick-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.cancel-btn:hover {
		color: var(--text-2);
	}
</style>
