<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import Modal from '$lib/components/Modal.svelte';
	import { codeSearchApi } from '$lib/code-search-api';
	import { projectsManager } from '$lib/projects-manager.svelte';
	import type { CodeSearchMatch } from '$lib/server/code-search';

	let {
		projectId,
		initialQuery,
		onClose
	}: {
		projectId: string;
		initialQuery: string;
		onClose: () => void;
	} = $props();

	const searchDelayMs = 250;
	const includeTestsKey = 'code_search_include_tests';

	let searchText = $state(untrack(() => initialQuery));
	let includeTests = $state(false);
	let matches = $state<CodeSearchMatch[]>([]);
	let searchedFiles = $state(0);
	let sourceNote = $state<string | null>(null);
	let testsExcluded = $state(false);
	let awaitingSettings = $state(false);
	let truncated = $state(false);
	let searching = $state(false);
	let searchError = $state('');
	let selectedIndex = $state(-1);
	let previewLines = $state<string[]>([]);
	let previewLoading = $state(false);
	let previewError = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);
	let previewPane = $state<HTMLElement | null>(null);
	let resultsPane = $state<HTMLElement | null>(null);
	let searchToken = 0;
	let previewToken = 0;
	const fileCache = new SvelteMap<string, string[]>();

	const selectedMatch = $derived(matches[selectedIndex] ?? null);
	const activeQuery = $derived(searchText.trim() ? searchText : '');

	const splitOnQuery = (text: string, needle: string): { text: string; hit: boolean }[] => {
		const parts: { text: string; hit: boolean }[] = [];
		let cursor = 0;
		if (!needle) {
			return [{ text, hit: false }];
		}
		while (cursor <= text.length) {
			const found = text.indexOf(needle, cursor);
			if (found === -1) {
				parts.push({ text: text.slice(cursor), hit: false });
				break;
			}
			if (found > cursor) {
				parts.push({ text: text.slice(cursor, found), hit: false });
			}
			parts.push({ text: needle, hit: true });
			cursor = found + needle.length;
		}
		return parts;
	};

	const scrollPreviewToLine = async (line: number) => {
		await tick();
		const target = previewPane?.querySelector<HTMLElement>(`[data-line="${line}"]`);
		target?.scrollIntoView({ block: 'center' });
	};

	const scrollResultIntoView = async () => {
		await tick();
		resultsPane
			?.querySelector<HTMLElement>(`[data-result="${selectedIndex}"]`)
			?.scrollIntoView({ block: 'nearest' });
	};

	const loadPreview = async (match: CodeSearchMatch) => {
		const token = ++previewToken;
		const cached = fileCache.get(match.path);
		previewError = '';
		if (cached) {
			previewLines = cached;
			previewLoading = false;
			await scrollPreviewToLine(match.line);
			return;
		}
		previewLoading = true;
		try {
			const file = await codeSearchApi.file(projectId, match.path);
			const lines = file.content.split('\n');
			fileCache.set(match.path, lines);
			if (token !== previewToken) {
				return;
			}
			previewLines = lines;
		} catch (caught) {
			if (token === previewToken) {
				previewLines = [];
				previewError = `loading preview of ${match.path}: ${(caught as Error).message}`;
			}
		} finally {
			if (token === previewToken) {
				previewLoading = false;
			}
		}
		if (token === previewToken) {
			await scrollPreviewToLine(match.line);
		}
	};

	const selectMatch = (index: number) => {
		const match = matches[index];
		if (!match) {
			return;
		}
		selectedIndex = index;
		void loadPreview(match);
		void scrollResultIntoView();
	};

	const runSearch = async (text: string, withTests: boolean) => {
		const token = ++searchToken;
		if (!text.trim()) {
			matches = [];
			searchedFiles = 0;
			truncated = false;
			searchError = '';
			searching = false;
			return;
		}
		searching = true;
		searchError = '';
		try {
			const result = await codeSearchApi.search(projectId, text, withTests);
			if (token !== searchToken) {
				return;
			}
			matches = result.matches;
			searchedFiles = result.searchedFiles;
			sourceNote = result.sourceNote;
			testsExcluded = result.testsExcluded;
			truncated = result.truncated;
			selectedIndex = -1;
			previewLines = [];
			previewError = '';
		} catch (caught) {
			if (token === searchToken) {
				matches = [];
				searchError = (caught as Error).message;
			}
		} finally {
			if (token === searchToken) {
				searching = false;
			}
		}
	};

	const toggleIncludeTests = () => {
		try {
			localStorage.setItem(includeTestsKey, includeTests ? '1' : '0');
		} catch {
			return;
		}
	};

	const onSearchKeydown = (event: KeyboardEvent) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectMatch(Math.min(matches.length - 1, selectedIndex + 1));
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectMatch(Math.max(0, selectedIndex - 1));
		} else if (event.key === 'Enter' && selectedIndex === -1 && matches.length > 0) {
			event.preventDefault();
			selectMatch(0);
		}
	};

	const openSettings = () => {
		awaitingSettings = true;
		projectsManager.show(projectId);
	};

	onMount(() => {
		try {
			includeTests = localStorage.getItem(includeTestsKey) === '1';
		} catch {
			includeTests = false;
		}
		searchInput?.focus();
		searchInput?.select();
	});

	$effect(() => {
		if (awaitingSettings && !projectsManager.open) {
			awaitingSettings = false;
			void runSearch(
				untrack(() => searchText),
				untrack(() => includeTests)
			);
		}
	});

	$effect(() => {
		const text = searchText;
		const withTests = includeTests;
		const timer = setTimeout(() => void runSearch(text, withTests), searchDelayMs);
		return () => clearTimeout(timer);
	});
</script>

<Modal title="Find in code" label="Search the codebase" maxWidth="1200px" {onClose}>
	<div class="search-body">
		<div class="search-bar">
			<input
				class="search-input"
				bind:this={searchInput}
				bind:value={searchText}
				onkeydown={onSearchKeydown}
				placeholder="Text to find…"
				spellcheck="false"
			/>
			<label class="tests-toggle">
				<input type="checkbox" bind:checked={includeTests} onchange={toggleIncludeTests} />
				Include tests
			</label>
			<span class="summary">
				{#if searching}
					Searching…
				{:else if searchError}
					&nbsp;
				{:else if activeQuery}
					{matches.length}{truncated ? '+' : ''} match{matches.length === 1 ? '' : 'es'} in {searchedFiles}
					files
				{/if}
			</span>
			{#if projectId}
				<button class="settings-link" onclick={openSettings}>Search settings…</button>
			{/if}
		</div>

		{#if sourceNote}
			<div class="source-note">{sourceNote}</div>
		{/if}

		<div class="results" bind:this={resultsPane}>
			{#if searchError}
				<div class="msg error">{searchError}</div>
			{:else if !searching && activeQuery && matches.length === 0}
				<div class="msg">
					No matches{testsExcluded ? ' outside test files' : ''}.
				</div>
			{:else}
				{#each matches as match, matchIndex (`${match.path}:${match.line}`)}
					<button
						class="result-row"
						class:selected={matchIndex === selectedIndex}
						data-result={matchIndex}
						onclick={() => selectMatch(matchIndex)}
					>
						<span class="result-path"
							>{match.path}<span class="result-line">:{match.line}</span></span
						>
						<span class="result-text"
							>{#each splitOnQuery(match.text, activeQuery) as part, partIndex (partIndex)}{#if part.hit}<mark
										class="hit">{part.text}</mark
									>{:else}{part.text}{/if}{/each}</span
						>
					</button>
				{/each}
				{#if truncated}
					<div class="msg">
						Showing the first {matches.length} matches; refine the search to see more.
					</div>
				{/if}
			{/if}
		</div>

		<div class="preview" bind:this={previewPane}>
			{#if !selectedMatch}
				<div class="msg">Select a result to preview the file.</div>
			{:else if previewError}
				<div class="msg error">{previewError}</div>
			{:else if previewLoading}
				<div class="msg">Loading {selectedMatch.path}…</div>
			{:else}
				<div class="preview-head">{selectedMatch.path}</div>
				<table class="preview-table">
					<tbody>
						{#each previewLines as lineText, lineIndex (lineIndex)}
							<tr
								class="preview-row"
								class:current={lineIndex + 1 === selectedMatch.line}
								data-line={lineIndex + 1}
							>
								<td class="preview-ln">{lineIndex + 1}</td>
								<td class="preview-code"
									>{#each splitOnQuery(lineText, activeQuery) as part, partIndex (partIndex)}{#if part.hit}<mark
												class="hit">{part.text}</mark
											>{:else}{part.text}{/if}{/each}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>
</Modal>

<style>
	.search-body {
		display: flex;
		flex-direction: column;
		height: 80vh;
		min-height: 0;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		min-width: 0;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
		padding: 0.375rem 0.625rem;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-muted);
	}

	.tests-toggle {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		color: var(--text-muted);
		font-size: 0.8rem;
		white-space: nowrap;
		cursor: pointer;
	}

	.summary {
		color: var(--text-dim);
		font-size: 0.75rem;
		white-space: nowrap;
		min-width: 10rem;
		text-align: right;
	}

	.settings-link {
		color: var(--text-dim);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.settings-link:hover {
		color: var(--accent);
	}

	.source-note {
		padding: 0.375rem 1rem;
		border-bottom: 1px solid var(--border);
		color: var(--text-dim);
		font-size: 0.75rem;
		white-space: pre-wrap;
	}

	.results {
		flex: 0 0 34%;
		overflow-y: auto;
		border-bottom: 1px solid var(--border);
	}

	.result-row {
		display: flex;
		align-items: baseline;
		gap: 0.875rem;
		width: 100%;
		text-align: left;
		padding: 0.3rem 1rem;
		font-family: 'Courier New', monospace;
		font-size: 0.78rem;
		border-left: 2px solid transparent;
	}

	.result-row:hover {
		background: var(--accent-soft);
	}

	.result-row.selected {
		background: var(--accent-bg);
		border-left-color: var(--accent);
	}

	.result-path {
		color: var(--text-2);
		flex-shrink: 0;
		max-width: 45%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.result-line {
		color: var(--text-dim);
	}

	.result-text {
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: pre;
		min-width: 0;
	}

	.preview {
		flex: 1;
		min-height: 0;
		overflow: auto;
		background: var(--bg-2);
	}

	.preview-head {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 0.375rem 1rem;
		background: var(--surface-2);
		border-bottom: 1px solid var(--border);
		color: var(--text-2);
		font-family: 'Courier New', monospace;
		font-size: 0.75rem;
	}

	.preview-table {
		border-collapse: collapse;
		font-family: 'Courier New', monospace;
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.preview-row.current {
		background: var(--accent-bg);
	}

	.preview-row.current .preview-ln {
		color: var(--accent);
	}

	.preview-ln {
		padding: 0 0.75rem 0 1rem;
		text-align: right;
		color: var(--text-ghost);
		user-select: none;
		vertical-align: top;
		font-variant-numeric: tabular-nums;
	}

	.preview-code {
		padding-right: 1rem;
		color: var(--diff-context-text, var(--text));
		white-space: pre;
		tab-size: 4;
	}

	.msg {
		padding: 0.875rem 1rem;
		color: var(--text-dim);
		font-size: 0.8rem;
	}

	.msg.error {
		color: var(--accent);
		white-space: pre-wrap;
	}

	mark.hit {
		background: var(--diff-highlight-bg, var(--accent-muted));
		outline: 1px solid var(--diff-highlight-outline, var(--accent));
		color: inherit;
		border-radius: 2px;
	}
</style>
