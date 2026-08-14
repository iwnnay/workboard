<script lang="ts">
	import type { PageData } from './$types';
	import type { DiffFile, DiffLine } from '$lib/server/git';
	import type { Project } from '$lib/types';
	import { untrack, onMount, tick } from 'svelte';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';
	import { goto, invalidate } from '$app/navigation';
	import FileEditor from '$lib/components/FileEditor.svelte';
	import CommitModal from '$lib/components/CommitModal.svelte';
	import { diffApi } from '$lib/diff-api';

	let { data }: { data: PageData } = $props();

	const FILE_LIST_WIDTH_KEY = 'diff_file_list_width';
	const DEFAULT_FILE_LIST_WIDTH = 240;
	const MIN_FILE_LIST_WIDTH = 150;
	const MAX_FILE_LIST_WIDTH = 720;

	// Mutable local mirrors of server state
	let projects = $state<Project[]>(untrack(() => data.projects));
	let rangeInput = $state(untrack(() => data.range));
	let selectedProjectId = $state(untrack(() => data.projectId));

	// Dropdown UI
	let loading = $state(false);
	let dropdownOpen = $state(false);
	let newProjectPath = $state('');

	// File list UI
	let filterQuery = $state('');
	let _selectedPath = $state<string | null>(null);
	let reviewed = new SvelteSet<string>();
	let stagedPaths = new SvelteSet<string>();
	let fileListWidth = $state(DEFAULT_FILE_LIST_WIDTH);
	let resizeOrigin = $state<{ x: number; width: number } | null>(null);

	// Diff view features
	let sideBySide = $state(false);
	let editing = $state(false);
	let editorDirty = $state(false);
	let highlightWord = $state('');
	let copyRef = $state<{ x: number; y: number; ref: string } | null>(null);
	let expandedGaps = new SvelteMap<string, string[]>();
	let fileLineTotals = new SvelteMap<string, number>();
	let diffTableRoot = $state<HTMLElement | null>(null);

	// ── Derived ──────────────────────────────────────────────

	const selectedProject = $derived(
		selectedProjectId ? (projects.find((p) => p.id === selectedProjectId) ?? null) : null
	);

	const orderedFiles = $derived(
		[...data.files].sort((first, second) => first.path.localeCompare(second.path))
	);

	const selectedPath = $derived(
		_selectedPath && data.files.find((f) => f.path === _selectedPath)
			? _selectedPath
			: (orderedFiles[0]?.path ?? null)
	);

	const filteredFiles = $derived(
		filterQuery.trim()
			? orderedFiles.filter((f) => f.path.toLowerCase().includes(filterQuery.toLowerCase()))
			: orderedFiles
	);

	function isStagedFile(file: DiffFile): boolean {
		return file.isStaged || stagedPaths.has(file.path);
	}

	const unstagedFiles = $derived(filteredFiles.filter((file) => !isStagedFile(file)));
	const stagedFiles = $derived(filteredFiles.filter((file) => isStagedFile(file)));

	const activeFile = $derived<DiffFile | null>(
		data.files.find((f) => f.path === selectedPath) ?? null
	);

	// ── Navigation ───────────────────────────────────────────

	onMount(() => {
		if (!data.projectId) {
			const saved = localStorage.getItem('diff_projectId');
			if (saved && data.projects.find((p) => p.id === saved)) {
				const params = new URLSearchParams({ range: data.range, projectId: saved });
				goto(`/diff?${params.toString()}`, { replaceState: true });
			}
		}
		expandedGaps.clear();

		const savedWidth = parseInt(localStorage.getItem(FILE_LIST_WIDTH_KEY) ?? '');
		if (!isNaN(savedWidth)) {
			fileListWidth = clampFileListWidth(savedWidth);
		}
	});

	// ── File list width ──────────────────────────────────────

	function clampFileListWidth(width: number): number {
		return Math.min(MAX_FILE_LIST_WIDTH, Math.max(MIN_FILE_LIST_WIDTH, Math.round(width)));
	}

	function persistFileListWidth() {
		localStorage.setItem(FILE_LIST_WIDTH_KEY, String(fileListWidth));
	}

	function startResize(event: PointerEvent) {
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		resizeOrigin = { x: event.clientX, width: fileListWidth };
	}

	function trackResize(event: PointerEvent) {
		if (!resizeOrigin) {
			return;
		}
		fileListWidth = clampFileListWidth(resizeOrigin.width + event.clientX - resizeOrigin.x);
	}

	function endResize(event: PointerEvent) {
		if (!resizeOrigin) {
			return;
		}
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		resizeOrigin = null;
		persistFileListWidth();
	}

	function resizeWithKeys(event: KeyboardEvent) {
		const step = event.shiftKey ? 40 : 10;
		if (event.key === 'ArrowLeft') {
			fileListWidth = clampFileListWidth(fileListWidth - step);
		} else if (event.key === 'ArrowRight') {
			fileListWidth = clampFileListWidth(fileListWidth + step);
		} else {
			return;
		}
		event.preventDefault();
		persistFileListWidth();
	}

	// ── Reviewed persistence ─────────────────────────────────

	function reviewedStorageKey(projectId: string) {
		return `diff_reviewed_${projectId || 'default'}`;
	}

	function fileFingerprint(file: DiffFile): string {
		const content = file.hunks
			.map(
				(hunk) => `${hunk.header}\n${hunk.lines.map((line) => line.type + line.content).join('\n')}`
			)
			.join('\n');
		// FNV-1a
		let hash = 0x811c9dc5;
		for (let charIndex = 0; charIndex < content.length; charIndex++) {
			hash ^= content.charCodeAt(charIndex);
			hash = Math.imul(hash, 0x01000193);
		}
		return `${(hash >>> 0).toString(36)}:${file.additions}:${file.deletions}`;
	}

	function readStoredFingerprints(storageKey: string): Record<string, string> {
		try {
			const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
			return parsed && typeof parsed === 'object' ? parsed : {};
		} catch {
			return {};
		}
	}

	function persistReviewed() {
		const storageKey = reviewedStorageKey(data.projectId);
		const storedFingerprints = readStoredFingerprints(storageKey);
		for (const file of data.files) {
			if (reviewed.has(file.path)) {
				storedFingerprints[file.path] = fileFingerprint(file);
			} else {
				delete storedFingerprints[file.path];
			}
		}
		localStorage.setItem(storageKey, JSON.stringify(storedFingerprints));
	}

	function toggleReviewed(path: string) {
		if (reviewed.has(path)) {
			reviewed.delete(path);
		} else {
			reviewed.add(path);
		}
		persistReviewed();
	}

	// Restore checkmarks whenever a diff loads; a file stays checked only if
	// its diff content is unchanged since it was checked.
	$effect(() => {
		const currentFiles = data.files;
		const storageKey = reviewedStorageKey(data.projectId);
		untrack(() => {
			expandedGaps.clear();
			fileLineTotals.clear();
			stagedPaths.clear();
			reviewed.clear();
			const storedFingerprints = readStoredFingerprints(storageKey);
			for (const file of currentFiles) {
				if (storedFingerprints[file.path] === fileFingerprint(file)) {
					reviewed.add(file.path);
				}
			}
		});
	});

	// ── File editing ─────────────────────────────────────────

	function closeEditor() {
		editing = false;
		editorDirty = false;
		void invalidate('diff:data');
	}

	function handleEditorClose() {
		closeEditor();
	}

	function toggleEditing() {
		if (!editing) {
			editing = true;
			return;
		}
		if (editorDirty && !confirm(`Discard unsaved changes to ${activeFile?.path}?`)) {
			return;
		}
		closeEditor();
	}

	function selectFile(path: string) {
		if (editing) {
			if (editorDirty && !confirm(`Discard unsaved changes to ${activeFile?.path}?`)) {
				return;
			}
			closeEditor();
		}
		if (path !== selectedPath) {
			resetStageState();
		}
		_selectedPath = path;
	}

	// ── Navigation (continued) ───────────────────────────────

	function navigate(projectId: string, range: string) {
		localStorage.setItem('diff_projectId', projectId);
		const params = new URLSearchParams({ range });
		if (projectId) {
			params.set('projectId', projectId);
		}
		loading = true;
		window.location.href = `/diff?${params.toString()}`;
	}

	function selectProject(id: string) {
		selectedProjectId = id;
		dropdownOpen = false;
		navigate(id, rangeInput);
	}

	// ── Projects CRUD ────────────────────────────────────────

	async function addProject() {
		const path = newProjectPath.trim();
		if (!path) {
			return;
		}
		const name = deriveName(path);
		const res = await fetch('/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, path })
		});
		const created: Project = await res.json();
		projects = [...projects, created].sort((a, b) => a.name.localeCompare(b.name));
		newProjectPath = '';
		selectProject(created.id);
	}

	async function deleteProject(id: string, e: MouseEvent) {
		e.stopPropagation();
		await fetch(`/api/projects/${id}`, { method: 'DELETE' });
		projects = projects.filter((p) => p.id !== id);
		if (selectedProjectId === id) {
			selectedProjectId = '';
			navigate('', rangeInput);
		}
	}

	// ── Helpers ──────────────────────────────────────────────

	function deriveName(path: string) {
		return (
			path
				.replace(/[/\\]+$/, '')
				.split(/[/\\]/)
				.filter(Boolean)
				.at(-1) ?? path
		);
	}

	function fileLabel(path: string) {
		return path.split('/').at(-1) ?? path;
	}

	function fileDir(path: string) {
		const parts = path.split('/');
		return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
	}

	function statBoxes(additions: number, deletions: number) {
		const total = additions + deletions;
		if (total === 0) {
			return Array(5).fill('empty');
		}
		const green = Math.round((additions / total) * 5);
		return Array.from({ length: 5 }, (_, i) => (i < green ? 'add' : 'del'));
	}

	function projectLabel(cwd: string) {
		return deriveName(cwd);
	}

	// ── Content rendering (word highlight) ───────────────────

	type ContentPart = { text: string; hl: boolean };

	function splitContent(content: string, word: string): ContentPart[] {
		if (!word || word.length < 2) {
			return [{ text: content, hl: false }];
		}
		try {
			const re = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
			return content.split(re).map((text, i) => ({ text, hl: i % 2 === 1 }));
		} catch {
			return [{ text: content, hl: false }];
		}
	}

	// ── Side-by-side ─────────────────────────────────────────

	type SbsRow = { left: DiffLine | null; right: DiffLine | null };

	function computeSideBySide(lines: DiffLine[]): SbsRow[] {
		const rows: SbsRow[] = [];
		let i = 0;
		while (i < lines.length) {
			const line = lines[i];
			if (line.type === 'context') {
				rows.push({ left: line, right: line });
				i++;
			} else {
				const removes: DiffLine[] = [];
				const adds: DiffLine[] = [];
				while (i < lines.length && lines[i].type === 'remove') {
					removes.push(lines[i++]);
				}
				while (i < lines.length && lines[i].type === 'add') {
					adds.push(lines[i++]);
				}
				const len = Math.max(removes.length, adds.length);
				for (let j = 0; j < len; j++) {
					rows.push({ left: removes[j] ?? null, right: adds[j] ?? null });
				}
			}
		}
		return rows;
	}

	// ── Pull-in-lines (expand context gaps) ──────────────────

	type Gap = {
		newStart: number;
		newEnd: number;
		oldStart: number;
		count: number;
		direction: 'up' | 'down' | 'both';
	};

	function lastLineNumber(lines: DiffLine[], side: 'oldNum' | 'newNum'): number | null {
		for (let index = lines.length - 1; index >= 0; index--) {
			const number = lines[index][side];
			if (number !== null) {
				return number;
			}
		}
		return null;
	}

	function getGapBefore(file: DiffFile, hunkIdx: number): Gap | null {
		const curr = file.hunks[hunkIdx];
		const firstNew = curr.lines.find((line) => line.newNum !== null)?.newNum;
		const firstOld = curr.lines.find((line) => line.oldNum !== null)?.oldNum;
		if (firstNew == null) {
			return null;
		}

		if (hunkIdx === 0) {
			if (firstNew <= 1) {
				return null;
			}
			return {
				newStart: 1,
				newEnd: firstNew - 1,
				oldStart: firstOld == null ? 1 : Math.max(1, firstOld - firstNew + 1),
				count: firstNew - 1,
				direction: 'up'
			};
		}

		const prev = file.hunks[hunkIdx - 1];
		const lastNew = lastLineNumber(prev.lines, 'newNum');
		const lastOld = lastLineNumber(prev.lines, 'oldNum');
		if (lastNew == null || firstNew <= lastNew + 1) {
			return null;
		}
		return {
			newStart: lastNew + 1,
			newEnd: firstNew - 1,
			oldStart: (lastOld ?? lastNew) + 1,
			count: firstNew - lastNew - 1,
			direction: 'both'
		};
	}

	function getGapAfter(file: DiffFile, totalLines: number | undefined): Gap | null {
		const lastHunk = file.hunks.at(-1);
		if (!lastHunk || totalLines == null) {
			return null;
		}
		const lastNew = lastLineNumber(lastHunk.lines, 'newNum');
		const lastOld = lastLineNumber(lastHunk.lines, 'oldNum');
		if (lastNew == null || totalLines <= lastNew) {
			return null;
		}
		return {
			newStart: lastNew + 1,
			newEnd: totalLines,
			oldStart: (lastOld ?? lastNew) + 1,
			count: totalLines - lastNew,
			direction: 'down'
		};
	}

	function gapKey(filePath: string, position: number | 'end'): string {
		return `${filePath}:${position}`;
	}

	function gapLabel(gap: Gap): string {
		const lines = `${gap.count} ${gap.count === 1 ? 'line' : 'lines'}`;
		if (gap.direction === 'up') {
			return `↑ ${lines} to start of file`;
		}
		if (gap.direction === 'down') {
			return `↓ ${lines} to end of file`;
		}
		return `↕ ${lines}`;
	}

	async function expandGap(gap: Gap, key: string) {
		if (!activeFile || expandedGaps.has(key)) {
			return;
		}
		try {
			const { lines } = await diffApi.lines(
				data.projectId,
				activeFile.path,
				data.range,
				gap.newStart,
				gap.newEnd
			);
			expandedGaps.set(key, lines);
		} catch {
			// The gap simply stays collapsed.
		}
	}

	$effect(() => {
		const file = activeFile;
		if (!file || file.isBinary || file.isDeleted || file.hunks.length === 0) {
			return;
		}
		if (fileLineTotals.has(file.path)) {
			return;
		}
		const path = file.path;
		const projectId = data.projectId;
		const range = data.range;
		let cancelled = false;
		void (async () => {
			const total = await diffApi
				.lines(projectId, path, range, 1, 0)
				.then((result) => result.total)
				.catch(() => null);
			if (total !== null && !cancelled) {
				fileLineTotals.set(path, total);
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	const trailingGap = $derived(
		activeFile && !activeFile.isBinary
			? getGapAfter(activeFile, fileLineTotals.get(activeFile.path))
			: null
	);

	// ── Copy file:line reference ──────────────────────────────

	function nodeToRow(node: Node | null): Element | null {
		const el = node instanceof Element ? node : (node as ChildNode | null)?.parentElement;
		return el?.closest('tr.diff-row') ?? null;
	}

	function rowLineNum(row: Element): number | null {
		const lnNew = (row.querySelector('.ln-new') as HTMLElement | null)?.textContent?.trim();
		const lnOld = (row.querySelector('.ln-old') as HTMLElement | null)?.textContent?.trim();
		const n = parseInt(lnNew || lnOld || '');
		return isNaN(n) ? null : n;
	}

	function characterOffsetWithin(root: Node, container: Node, offset: number): number | null {
		if (!root.contains(container)) {
			return null;
		}
		const range = document.createRange();
		range.selectNodeContents(root);
		try {
			range.setEnd(container, offset);
		} catch {
			return null;
		}
		return range.toString().length;
	}

	function textBoundaryAt(root: Node, target: number): { node: Text; offset: number } | null {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let consumed = 0;
		let lastNode: Text | null = null;
		while (walker.nextNode()) {
			const textNode = walker.currentNode as Text;
			if (consumed + textNode.data.length >= target) {
				return { node: textNode, offset: target - consumed };
			}
			consumed += textNode.data.length;
			lastNode = textNode;
		}
		return lastNode ? { node: lastNode, offset: lastNode.data.length } : null;
	}

	async function restoreSelection(root: Node, startOffset: number, endOffset: number) {
		await tick();
		const start = textBoundaryAt(root, startOffset);
		const end = textBoundaryAt(root, endOffset);
		const selection = window.getSelection();
		if (!start || !end || !selection) {
			return;
		}
		const range = document.createRange();
		range.setStart(start.node, start.offset);
		range.setEnd(end.node, end.offset);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	function applyHighlight(word: string, selection: Selection) {
		if (word === highlightWord) {
			return;
		}
		const root = diffTableRoot;
		const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
		if (!root || !range) {
			highlightWord = word;
			return;
		}
		const startOffset = characterOffsetWithin(root, range.startContainer, range.startOffset);
		const endOffset = characterOffsetWithin(root, range.endContainer, range.endOffset);
		highlightWord = word;
		if (startOffset !== null && endOffset !== null) {
			void restoreSelection(root, startOffset, endOffset);
		}
	}

	function handleDiffMouseUp(e: MouseEvent) {
		if (editing) {
			return;
		}
		const sel = window.getSelection();
		const text = sel?.toString().trim() ?? '';

		if (!text || !sel) {
			highlightWord = '';
			copyRef = null;
			return;
		}

		if (text.length >= 2 && !text.includes('\n')) {
			applyHighlight(text, sel);
		}

		if (!activeFile || !sel) {
			copyRef = null;
			return;
		}

		const anchorRow = nodeToRow(sel.anchorNode);
		const focusRow = nodeToRow(sel.focusNode);
		if (!anchorRow && !focusRow) {
			copyRef = null;
			return;
		}

		const anchorLn = anchorRow ? rowLineNum(anchorRow) : null;
		const focusLn = focusRow ? rowLineNum(focusRow) : null;
		const a = anchorLn ?? focusLn;
		const b = focusLn ?? anchorLn;

		if (a === null) {
			copyRef = null;
			return;
		}

		const lineRef = a !== b && b !== null ? `${Math.min(a, b)}-${Math.max(a, b)}` : String(a);

		copyRef = { x: e.clientX, y: e.clientY, ref: `${activeFile.path}:${lineRef}` };
	}

	async function doCopyRef() {
		if (!copyRef) {
			return;
		}
		await navigator.clipboard.writeText(copyRef.ref);
		const saved = copyRef;
		copyRef = { ...saved, ref: '✓ copied' };
		setTimeout(() => {
			if (copyRef?.ref === '✓ copied') {
				copyRef = null;
			}
		}, 1200);
	}

	// ── Copy file path ────────────────────────────────────────

	let pathCopied = $state(false);
	let pathCopiedTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyFilePath() {
		if (!activeFile) {
			return;
		}
		await navigator.clipboard.writeText(activeFile.path);
		pathCopied = true;
		clearTimeout(pathCopiedTimer);
		pathCopiedTimer = setTimeout(() => (pathCopied = false), 1200);
	}

	// ── Stage file (git add) ──────────────────────────────────

	let stageState = $state<'idle' | 'pending' | 'staged' | 'error'>('idle');
	let stageError = $state('');
	let stageResetTimer: ReturnType<typeof setTimeout> | undefined;

	function resetStageState() {
		clearTimeout(stageResetTimer);
		stageState = 'idle';
		stageError = '';
	}

	async function stageFile() {
		if (!activeFile || stageState === 'pending') {
			return;
		}
		const stagedPath = activeFile.path;
		clearTimeout(stageResetTimer);
		stageState = 'pending';
		stageError = '';
		try {
			await diffApi.stage(data.projectId, stagedPath);
			stagedPaths.add(stagedPath);
			stageState = 'staged';
			stageResetTimer = setTimeout(resetStageState, 1500);
		} catch (caught) {
			stageState = 'error';
			stageError = (caught as Error).message;
			stageResetTimer = setTimeout(resetStageState, 4000);
		}
	}

	// ── Stage all (git add .) ─────────────────────────────────

	let stageAllState = $state<'idle' | 'pending' | 'staged' | 'error'>('idle');
	let stageAllError = $state('');
	let stageAllResetTimer: ReturnType<typeof setTimeout> | undefined;

	function resetStageAllState() {
		clearTimeout(stageAllResetTimer);
		stageAllState = 'idle';
		stageAllError = '';
	}

	async function stageAllFiles() {
		if (stageAllState === 'pending') {
			return;
		}
		clearTimeout(stageAllResetTimer);
		stageAllState = 'pending';
		stageAllError = '';
		try {
			await diffApi.stageAll(data.projectId);
			for (const file of data.files) {
				stagedPaths.add(file.path);
			}
			stageAllState = 'staged';
			stageAllResetTimer = setTimeout(resetStageAllState, 1500);
		} catch (caught) {
			stageAllState = 'error';
			stageAllError = (caught as Error).message;
			stageAllResetTimer = setTimeout(resetStageAllState, 4000);
		}
	}

	// ── Commit (git commit -m) ────────────────────────────────

	let commitModalOpen = $state(false);

	function handleCommitted() {
		resetStageState();
		resetStageAllState();
		void invalidate('diff:data');
	}
</script>

<!-- Close dropdown on backdrop click -->
{#if dropdownOpen}
	<div
		class="backdrop"
		role="presentation"
		tabindex="-1"
		onclick={() => (dropdownOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (dropdownOpen = false)}
	></div>
{/if}

{#if commitModalOpen}
	<CommitModal
		projectId={data.projectId}
		onClose={() => (commitModalOpen = false)}
		onCommitted={handleCommitted}
	/>
{/if}

<!-- Copy ref floating tooltip -->
{#if copyRef}
	<div class="copy-ref-tooltip" style="left: {copyRef.x}px; top: {copyRef.y - 40}px">
		<button class="copy-ref-btn" onclick={doCopyRef}>{copyRef.ref}</button>
	</div>
{/if}

{#snippet fileRow(file: DiffFile)}
	<div
		class="file-item"
		class:active={selectedPath === file.path}
		class:is-reviewed={reviewed.has(file.path)}
		role="button"
		tabindex="0"
		onclick={() => selectFile(file.path)}
		onkeydown={(e) => e.key === 'Enter' && selectFile(file.path)}
		title={file.path}
	>
		<span class="file-name">
			{#if fileDir(file.path)}
				<span class="file-dir">{fileDir(file.path)}/</span>
			{/if}
			{fileLabel(file.path)}
			{#if file.isUntracked}<span class="badge untracked">U</span>{:else if file.isNew}<span
					class="badge new">N</span
				>{/if}
			{#if file.isDeleted}<span class="badge del">D</span>{/if}
		</span>
		<span class="file-stats">
			{#if file.isBinary}
				<span class="stat-bin">bin</span>
			{:else}
				{#if file.additions > 0}
					<span class="stat-add">+{file.additions}</span>
				{/if}
				{#if file.deletions > 0}
					<span class="stat-del">-{file.deletions}</span>
				{/if}
			{/if}
		</span>
		<button
			class="review-btn"
			class:done={reviewed.has(file.path)}
			onclick={(e) => {
				e.stopPropagation();
				toggleReviewed(file.path);
			}}
			aria-label="Mark as reviewed">✓</button
		>
	</div>
{/snippet}

{#snippet unifiedGapRows(gap: Gap, key: string)}
	{@const expanded = expandedGaps.get(key)}
	{#if expanded}
		{#each expanded as content, index (index)}
			<tr class="diff-row context">
				<td class="ln ln-old">{gap.oldStart + index}</td>
				<td class="ln ln-new">{gap.newStart + index}</td>
				<td class="diff-sign">&nbsp;</td>
				<td class="diff-content"
					>{#each splitContent(content, highlightWord) as part, partIndex (partIndex)}{#if part.hl}<mark
								class="hl">{part.text}</mark
							>{:else}{part.text}{/if}{/each}</td
				>
			</tr>
		{/each}
	{:else}
		<tr class="gap-row" onclick={() => expandGap(gap, key)}>
			<td colspan="4" class="gap-cell">
				<button class="gap-btn">{gapLabel(gap)}</button>
			</td>
		</tr>
	{/if}
{/snippet}

{#snippet sbsGapRows(gap: Gap, key: string)}
	{@const expanded = expandedGaps.get(key)}
	{#if expanded}
		{#each expanded as content, index (index)}
			<tr class="diff-row context">
				<td class="ln ln-old">{gap.oldStart + index}</td>
				<td class="diff-content sbs-old context"
					>{#each splitContent(content, highlightWord) as part, partIndex (partIndex)}{#if part.hl}<mark
								class="hl">{part.text}</mark
							>{:else}{part.text}{/if}{/each}</td
				>
				<td class="ln ln-new">{gap.newStart + index}</td>
				<td class="diff-content sbs-new context"
					>{#each splitContent(content, highlightWord) as part, partIndex (partIndex)}{#if part.hl}<mark
								class="hl">{part.text}</mark
							>{:else}{part.text}{/if}{/each}</td
				>
			</tr>
		{/each}
	{:else}
		<tr class="gap-row" onclick={() => expandGap(gap, key)}>
			<td colspan="4" class="gap-cell">
				<button class="gap-btn">{gapLabel(gap)}</button>
			</td>
		</tr>
	{/if}
{/snippet}

<div class="page">
	<!-- Top bar -->
	<header class="topbar">
		<span class="topbar-label">Diff</span>

		<!-- Project selector -->
		<div class="project-selector">
			<button
				class="project-btn"
				class:open={dropdownOpen}
				onclick={() => (dropdownOpen = !dropdownOpen)}
				title={selectedProject?.path ?? data.cwd}
			>
				<span class="proj-btn-name">{selectedProject?.name ?? projectLabel(data.cwd)}</span>
				<span class="proj-chevron">▾</span>
			</button>

			{#if dropdownOpen}
				<div class="proj-dropdown">
					<!-- This repo (default) -->
					<button
						class="proj-option"
						class:active={!selectedProjectId}
						onclick={() => selectProject('')}
					>
						<span class="proj-option-name">{projectLabel(data.cwd)}</span>
						<span class="proj-option-path">{data.cwd}</span>
					</button>

					{#if projects.length > 0}
						<div class="proj-divider"></div>
						{#each projects as p (p.id)}
							<div class="proj-option-row" class:active={selectedProjectId === p.id}>
								<button class="proj-option" onclick={() => selectProject(p.id)}>
									<span class="proj-option-name">{p.name}</span>
									<span class="proj-option-path">{p.path}</span>
								</button>
								<button
									class="proj-del"
									onclick={(e) => deleteProject(p.id, e)}
									aria-label="Remove project">×</button
								>
							</div>
						{/each}
					{/if}

					<div class="proj-divider"></div>
					<div class="proj-add-row">
						<input
							bind:value={newProjectPath}
							class="proj-add-input"
							placeholder="/path/to/repo"
							spellcheck="false"
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									addProject();
								}
								if (e.key === 'Escape') {
									dropdownOpen = false;
								}
							}}
						/>
						<button class="proj-add-btn" onclick={addProject}>Add</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Range input -->
		<input
			class="range-input"
			bind:value={rangeInput}
			placeholder="HEAD~1..HEAD"
			spellcheck="false"
			autocomplete="off"
			onkeydown={(e) => e.key === 'Enter' && navigate(selectedProjectId, rangeInput)}
		/>
		<button
			class="run-btn"
			class:loading
			disabled={loading}
			onclick={() => navigate(selectedProjectId, rangeInput)}
		>
			{#if loading}
				<span class="spinner"></span>
			{:else}
				Run
			{/if}
		</button>

		<button
			class="stage-btn topbar-stage-btn"
			class:staged={stageAllState === 'staged'}
			class:error={stageAllState === 'error'}
			disabled={stageAllState === 'pending'}
			onclick={stageAllFiles}
			title={stageAllState === 'error' ? stageAllError : 'git add .'}
			>{stageAllState === 'staged'
				? '✓ Staged'
				: stageAllState === 'error'
					? 'Error'
					: stageAllState === 'pending'
						? '…'
						: 'Stage all'}</button
		>

		<button
			class="stage-btn topbar-stage-btn"
			onclick={() => (commitModalOpen = true)}
			title="git commit -m …">Commit</button
		>

		{#if data.error}
			<span class="error-badge" title={data.error}>Error</span>
		{/if}
	</header>

	<div class="body" class:resizing={resizeOrigin !== null}>
		<!-- Left: file list -->
		<aside class="file-list" style="width: {fileListWidth}px">
			<div class="filter-wrap">
				<input
					class="filter-input"
					bind:value={filterQuery}
					placeholder="Filter files…"
					spellcheck="false"
				/>
			</div>

			<div class="files">
				{#if data.error}
					<p class="list-error">{data.error}</p>
				{:else if filteredFiles.length === 0}
					<p class="list-empty">No files.</p>
				{:else}
					{#if unstagedFiles.length > 0}
						{#if stagedFiles.length > 0}
							<div class="group-label">
								Not staged <span class="group-count">{unstagedFiles.length}</span>
							</div>
						{/if}
						{#each unstagedFiles as file (file.path)}
							{@render fileRow(file)}
						{/each}
					{/if}
					{#if stagedFiles.length > 0}
						<div class="group-label">
							Staged <span class="group-count">{stagedFiles.length}</span>
						</div>
						{#each stagedFiles as file (file.path)}
							{@render fileRow(file)}
						{/each}
					{/if}
				{/if}
			</div>
		</aside>

		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="resizer"
			class:dragging={resizeOrigin !== null}
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize file list"
			aria-valuenow={fileListWidth}
			aria-valuemin={MIN_FILE_LIST_WIDTH}
			aria-valuemax={MAX_FILE_LIST_WIDTH}
			tabindex="0"
			onpointerdown={startResize}
			onpointermove={trackResize}
			onpointerup={endResize}
			onpointercancel={endResize}
			onkeydown={resizeWithKeys}
		></div>

		<!-- Right: diff view -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<main class="diff-panel" class:editing onmouseup={handleDiffMouseUp}>
			{#if !activeFile}
				<div class="diff-empty">
					{#if data.error}
						<p class="diff-error-msg">{data.error}</p>
					{:else}
						<p>No changes in <code>{data.range}</code>.</p>
					{/if}
				</div>
			{:else}
				<div class="diff-file">
					<div class="diff-file-header">
						<span class="diff-file-title">
							<span class="diff-file-path">
								{#if fileDir(activeFile.path)}
									<span class="diff-file-dir">{fileDir(activeFile.path)}/</span>
								{/if}
								<span class="diff-file-name">{fileLabel(activeFile.path)}</span>
							</span>
							<button
								class="copy-path-btn"
								class:copied={pathCopied}
								onclick={copyFilePath}
								title="Copy file path"
								aria-label="Copy file path">{pathCopied ? '✓' : '⧉'}</button
							>
						</span>
						<span class="diff-file-meta">
							{#if activeFile.isUntracked}<span class="badge untracked">untracked</span
								>{:else if activeFile.isNew}<span class="badge new">new file</span>{/if}
							{#if activeFile.isDeleted}<span class="badge del">deleted</span>{/if}
							{#if !activeFile.isBinary}
								<span class="stat-add">+{activeFile.additions}</span>
								<span class="stat-del">-{activeFile.deletions}</span>
								<span class="stat-boxes" aria-hidden="true">
									{#each statBoxes(activeFile.additions, activeFile.deletions) as box, i (i)}
										<span class="box {box}"></span>
									{/each}
								</span>
							{/if}
							{#if !activeFile.isBinary && activeFile.hunks.length > 0}
								<button
									class="sbs-toggle"
									class:active={sideBySide}
									onclick={() => (sideBySide = !sideBySide)}
									title="Toggle side-by-side">⇔</button
								>
							{/if}
							{#if !activeFile.isBinary && !activeFile.isDeleted}
								<button
									class="sbs-toggle"
									class:active={editing}
									onclick={toggleEditing}
									title="Edit file (Vim)">✎</button
								>
							{/if}
							<button
								class="stage-btn"
								class:staged={stageState === 'staged'}
								class:error={stageState === 'error'}
								disabled={stageState === 'pending'}
								onclick={stageFile}
								title={stageState === 'error' ? stageError : `git add ${activeFile.path}`}
								>{stageState === 'staged'
									? '✓ Staged'
									: stageState === 'error'
										? 'Error'
										: stageState === 'pending'
											? '…'
											: 'Stage'}</button
							>
						</span>
					</div>

					{#if editing}
						{#key activeFile.path}
							<FileEditor
								projectId={data.projectId}
								filePath={activeFile.path}
								range={data.range}
								bind:dirty={editorDirty}
								onClose={handleEditorClose}
							/>
						{/key}
					{:else if activeFile.isBinary}
						<div class="binary-notice">Binary file changed</div>
					{:else if activeFile.hunks.length === 0}
						<div class="binary-notice">No textual changes</div>
					{:else}
						<div class="diff-table-wrap" bind:this={diffTableRoot}>
							{#if sideBySide}
								<!-- Side-by-side view -->
								<table class="diff-table sbs-table">
									<colgroup>
										<col style="width: 44px" />
										<col style="width: calc(50% - 44px)" />
										<col style="width: 44px" />
										<col style="width: calc(50% - 44px)" />
									</colgroup>
									<tbody>
										{#each activeFile.hunks as hunk, hunkIdx (hunkIdx)}
											{@const gap = getGapBefore(activeFile, hunkIdx)}
											{#if gap}
												{@render sbsGapRows(gap, gapKey(activeFile.path, hunkIdx))}
											{/if}
											<tr class="hunk-row">
												<td class="ln ln-old" colspan="1"></td>
												<td class="hunk-header" colspan="3">
													<span class="hunk-at">@@</span>
													{hunk.header.slice(2).replace(/@@$/, '').trim()}
													{#if hunk.context}
														<span class="hunk-ctx">{hunk.context}</span>
													{/if}
												</td>
											</tr>
											{#each computeSideBySide(hunk.lines) as row, i (i)}
												<tr class="diff-row sbs-row">
													<td class="ln ln-old">{row.left?.oldNum ?? ''}</td>
													<td class="diff-content sbs-old {row.left ? row.left.type : 'empty'}"
														>{#each splitContent(row.left?.content ?? '', highlightWord) as part, j (j)}{#if part.hl}<mark
																	class="hl">{part.text}</mark
																>{:else}{part.text}{/if}{/each}</td
													>
													<td class="ln ln-new">{row.right?.newNum ?? ''}</td>
													<td class="diff-content sbs-new {row.right ? row.right.type : 'empty'}"
														>{#each splitContent(row.right?.content ?? '', highlightWord) as part, j (j)}{#if part.hl}<mark
																	class="hl">{part.text}</mark
																>{:else}{part.text}{/if}{/each}</td
													>
												</tr>
											{/each}
										{/each}
										{#if trailingGap}
											{@render sbsGapRows(trailingGap, gapKey(activeFile.path, 'end'))}
										{/if}
									</tbody>
								</table>
							{:else}
								<!-- Unified view -->
								<table class="diff-table">
									<tbody>
										{#each activeFile.hunks as hunk, hunkIdx (hunkIdx)}
											{@const gap = getGapBefore(activeFile, hunkIdx)}
											{#if gap}
												{@render unifiedGapRows(gap, gapKey(activeFile.path, hunkIdx))}
											{/if}
											<tr class="hunk-row">
												<td class="ln ln-old" colspan="2"></td>
												<td class="hunk-header" colspan="2">
													<span class="hunk-at">@@</span>
													{hunk.header.slice(2).replace(/@@$/, '').trim()}
													{#if hunk.context}
														<span class="hunk-ctx">{hunk.context}</span>
													{/if}
												</td>
											</tr>
											{#each hunk.lines as line, i (i)}
												<tr class="diff-row {line.type}">
													<td class="ln ln-old">{line.oldNum ?? ''}</td>
													<td class="ln ln-new">{line.newNum ?? ''}</td>
													<td class="diff-sign">
														{#if line.type === 'add'}+{:else if line.type === 'remove'}-{:else}&nbsp;{/if}
													</td>
													<td class="diff-content"
														>{#each splitContent(line.content, highlightWord) as part, j (j)}{#if part.hl}<mark
																	class="hl">{part.text}</mark
																>{:else}{part.text}{/if}{/each}</td
													>
												</tr>
											{/each}
										{/each}
										{#if trailingGap}
											{@render unifiedGapRows(trailingGap, gapKey(activeFile.path, 'end'))}
										{/if}
									</tbody>
								</table>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</main>
	</div>
</div>

<style>
	/* ── Layout ─────────────────────────────────────────────── */
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
	}

	.page {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
	}

	.topbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.875rem;
		background: var(--bg-2);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		z-index: 41;
		position: relative;
	}

	.topbar-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-ghost);
		flex-shrink: 0;
	}

	.body {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.body.resizing {
		user-select: none;
		cursor: col-resize;
	}

	/* ── Project selector ───────────────────────────────────── */
	.project-selector {
		position: relative;
		flex-shrink: 0;
	}

	.project-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-2);
		padding: 0.3rem 0.625rem;
		font-size: 0.8125rem;
		white-space: nowrap;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.project-btn:hover,
	.project-btn.open {
		background: var(--surface-2);
		border-color: var(--accent-muted);
	}

	.proj-btn-name {
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.proj-chevron {
		color: var(--text-ghost);
		font-size: 0.6875rem;
	}

	/* ── Dropdown ───────────────────────────────────────────── */
	.proj-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 50;
		width: 300px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}

	.proj-option {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: none;
		border: none;
		text-align: left;
		gap: 1px;
		transition: background 0.1s;
		cursor: pointer;
	}

	.proj-option:hover {
		background: var(--accent-bg);
	}

	.proj-option-row {
		display: flex;
		align-items: stretch;
	}

	.proj-option-row .proj-option {
		flex: 1;
		min-width: 0;
	}

	.proj-option-row.active .proj-option,
	.proj-option-row.active {
		background: var(--accent-bg);
	}

	.proj-option.active {
		background: var(--accent-bg);
	}

	.proj-option-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		width: 100%;
	}

	.proj-option-row.active .proj-option-name,
	.proj-option.active .proj-option-name {
		color: var(--accent);
	}

	.proj-option-path {
		font-size: 0.6875rem;
		color: var(--text-ghost);
		font-family: 'Courier New', monospace;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		width: 100%;
	}

	.proj-del {
		flex-shrink: 0;
		background: none;
		border: none;
		color: transparent;
		font-size: 1rem;
		padding: 0 0.625rem;
		transition: color 0.1s;
		cursor: pointer;
	}

	.proj-option-row:hover .proj-del {
		color: var(--text-ghost);
	}

	.proj-option-row:hover .proj-del:hover {
		color: var(--accent);
	}

	.proj-divider {
		height: 1px;
		background: var(--border-2);
		margin: 0.25rem 0;
	}

	.proj-add-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.625rem;
	}

	.proj-add-input {
		flex: 1;
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		padding: 0.3rem 0.5rem;
		font-size: 0.8rem;
		font-family: 'Courier New', monospace;
		outline: none;
		transition: border-color 0.15s;
	}

	.proj-add-input:focus {
		border-color: var(--accent);
	}

	.proj-add-input::placeholder {
		color: var(--text-ghost);
	}

	.proj-add-btn {
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		padding: 0.3rem 0.625rem;
		font-size: 0.8rem;
		flex-shrink: 0;
		transition: background 0.15s;
	}

	.proj-add-btn:hover {
		background: var(--accent-muted);
		color: var(--text);
	}

	/* ── Range input ────────────────────────────────────────── */
	.range-input {
		flex: 1;
		max-width: 320px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-2);
		padding: 0.3rem 0.625rem;
		font-size: 0.8125rem;
		font-family: 'Courier New', monospace;
		outline: none;
		transition: border-color 0.15s;
	}

	.range-input:focus {
		border-color: var(--accent);
	}

	.run-btn {
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		padding: 0.3rem 0.75rem;
		font-size: 0.8125rem;
		flex-shrink: 0;
		transition: background 0.15s;
	}

	.run-btn:hover:not(:disabled) {
		background: var(--accent-muted);
		color: var(--text);
	}

	.run-btn:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.run-btn.loading {
		min-width: 48px;
	}

	.spinner {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 2px solid var(--accent-muted);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.55s linear infinite;
		vertical-align: middle;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-badge {
		font-size: 0.75rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		color: var(--accent);
		border-radius: 4px;
		padding: 0.15rem 0.5rem;
		flex-shrink: 0;
	}

	/* ── File list ──────────────────────────────────────────── */
	.file-list {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		overflow: hidden;
	}

	.resizer {
		flex-shrink: 0;
		width: 5px;
		background: var(--border);
		cursor: col-resize;
		touch-action: none;
		transition: background 0.1s;
	}

	.resizer:hover,
	.resizer:focus-visible,
	.resizer.dragging {
		background: var(--accent-muted);
		outline: none;
	}

	.group-label {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem 0.25rem;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-ghost);
	}

	.group-count {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0;
		color: var(--text-faint);
	}

	.filter-wrap {
		padding: 0.625rem;
		border-bottom: 1px solid var(--border-2);
		flex-shrink: 0;
	}

	.filter-input {
		width: 100%;
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		padding: 0.35rem 0.625rem;
		font-size: 0.8125rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.filter-input:focus {
		border-color: var(--accent);
	}

	.filter-input::placeholder {
		color: var(--text-ghost);
	}

	.files {
		flex: 1;
		overflow-y: auto;
		padding: 0.375rem 0;
	}

	.file-item {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		width: 100%;
		padding: 0.4rem 0.75rem;
		color: var(--text-muted);
		gap: 0.5rem;
		font-size: 0.8rem;
		cursor: pointer;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.file-item:hover {
		background: var(--surface-2);
		color: var(--text-2);
	}

	.file-item.active {
		background: var(--accent-bg);
		color: var(--text-2);
		border-left: 2px solid var(--accent);
		padding-left: calc(0.75rem - 2px);
	}

	.file-item.is-reviewed {
		opacity: 0.5;
	}

	.review-btn {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--text-ghost);
		font-size: 0.8rem;
		padding: 0.1rem 0.2rem;
		border-radius: 3px;
		opacity: 0;
		transition:
			color 0.1s,
			opacity 0.1s;
		cursor: pointer;
		line-height: 1;
	}

	.file-item:hover .review-btn {
		opacity: 1;
	}

	.review-btn.done {
		color: var(--diff-add-strong);
		opacity: 1;
	}

	.file-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.4;
	}

	.file-dir {
		color: var(--text-ghost);
		font-size: 0.75rem;
	}

	.file-stats {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}

	.list-error,
	.list-empty {
		padding: 0.75rem;
		font-size: 0.8125rem;
		color: var(--text-ghost);
	}

	/* ── Diff panel ─────────────────────────────────────────── */
	.diff-panel {
		flex: 1;
		overflow: auto;
		background: var(--bg-2);
	}

	/* While the file editor is open it owns scrolling, so the panel becomes
	   a fixed-height flex column instead of a scroll container. */
	.diff-panel.editing {
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.diff-panel.editing .diff-file {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.diff-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-ghost);
		font-size: 0.875rem;
	}

	.diff-empty code {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.1rem 0.4rem;
		font-family: 'Courier New', monospace;
		font-size: 0.8125rem;
		color: var(--text-dim);
	}

	.diff-error-msg {
		color: var(--accent);
		font-size: 0.8125rem;
		max-width: 540px;
		text-align: center;
		white-space: pre-wrap;
		font-family: 'Courier New', monospace;
	}

	.diff-file {
		min-width: 0;
	}

	.diff-file-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.625rem 1rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 5;
	}

	.diff-file-title {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
	}

	.copy-path-btn {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--text-ghost);
		font-size: 0.8125rem;
		padding: 0.1rem 0.25rem;
		border-radius: 3px;
		line-height: 1;
		cursor: pointer;
		transition: color 0.1s;
	}

	.copy-path-btn:hover {
		color: var(--accent);
	}

	.copy-path-btn.copied {
		color: var(--diff-add-strong);
	}

	.diff-file-path {
		font-family: 'Courier New', monospace;
		font-size: 0.8125rem;
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.diff-file-dir {
		color: var(--text-dim);
	}

	.diff-file-name {
		color: var(--text);
		font-weight: 600;
	}

	.diff-file-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		font-size: 0.8125rem;
	}

	/* ── Side-by-side toggle ────────────────────────────────── */
	.sbs-toggle {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-ghost);
		font-size: 0.875rem;
		padding: 0.15rem 0.4rem;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
		line-height: 1;
	}

	.sbs-toggle:hover {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--text-2);
	}

	.sbs-toggle.active {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	/* ── Stage buttons ──────────────────────────────────────── */
	.stage-btn {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-ghost);
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
		line-height: 1.4;
		white-space: nowrap;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}

	.stage-btn:hover:not(:disabled) {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--text-2);
	}

	.stage-btn:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.stage-btn.staged {
		border-color: var(--diff-add-gutter-bg);
		background: var(--diff-add-bg);
		color: var(--diff-add-strong);
	}

	.stage-btn.error {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.topbar-stage-btn {
		flex-shrink: 0;
		font-size: 0.8125rem;
		padding: 0.3rem 0.625rem;
		border-radius: 5px;
	}

	/* ── Diff table ─────────────────────────────────────────── */
	.diff-table-wrap {
		overflow-x: auto;
	}

	.diff-table {
		width: 100%;
		min-width: max-content;
		border-collapse: collapse;
		font-family: 'Courier New', monospace;
		font-size: 0.8125rem;
		line-height: 1.5;
	}

	.ln {
		width: 44px;
		min-width: 44px;
		padding: 0 0.5rem;
		text-align: right;
		color: var(--text-ghost);
		user-select: none;
		vertical-align: top;
		white-space: nowrap;
		border-right: 1px solid var(--border-2);
	}

	.ln-old {
		border-right: none;
	}

	.diff-sign {
		width: 20px;
		min-width: 20px;
		padding: 0 0.25rem;
		text-align: center;
		font-weight: 700;
		user-select: none;
		vertical-align: top;
	}

	.diff-content {
		padding: 0 1rem 0 0.25rem;
		white-space: pre;
		width: 100%;
		vertical-align: top;
		color: var(--diff-text);
	}

	.hunk-row td {
		background: var(--diff-hunk-bg);
		padding: 0.25rem 0;
		border-top: 1px solid var(--border-2);
		border-bottom: 1px solid var(--border-2);
	}

	.hunk-header {
		padding: 0.25rem 1rem;
		font-size: 0.75rem;
		color: var(--text-dim);
		white-space: pre;
	}

	.hunk-at {
		color: var(--diff-hunk-text);
		font-weight: 700;
		margin-right: 0.5rem;
	}

	.hunk-ctx {
		color: var(--text-ghost);
		margin-left: 0.5rem;
	}

	.diff-row.add td {
		background: var(--diff-add-bg);
	}

	.diff-row.add .ln,
	.diff-row.add .diff-sign {
		background: var(--diff-add-gutter-bg);
		color: var(--diff-add-gutter-text);
	}

	.diff-row.add .diff-sign {
		color: var(--diff-add-strong);
	}

	.diff-row.add .diff-content {
		color: var(--diff-add-text);
	}

	.diff-row.remove td {
		background: var(--diff-del-bg);
	}

	.diff-row.remove .ln,
	.diff-row.remove .diff-sign {
		background: var(--diff-del-gutter-bg);
		color: var(--diff-del-gutter-text);
	}

	.diff-row.remove .diff-sign {
		color: var(--diff-del-strong);
	}

	.diff-row.remove .diff-content {
		color: var(--diff-del-text);
	}

	.diff-row.context td {
		background: var(--bg-2);
	}

	.diff-row.context .diff-content {
		color: var(--diff-context-text);
	}

	/* ── Side-by-side table ─────────────────────────────────── */
	.sbs-table {
		table-layout: fixed;
		width: 100%;
		min-width: 0;
	}

	.sbs-table .ln {
		width: 44px;
		min-width: 44px;
	}

	.sbs-old,
	.sbs-new {
		white-space: pre;
		padding: 0 0.5rem;
		vertical-align: top;
		overflow: hidden;
	}

	.sbs-old {
		border-right: 1px solid var(--border-2);
	}

	.sbs-row td {
		background: var(--bg-2);
	}

	.sbs-row .ln {
		background: var(--bg-2);
	}

	.sbs-old.remove {
		background: var(--diff-del-bg);
		color: var(--diff-del-text);
	}

	.sbs-old.context,
	.sbs-new.context {
		color: var(--diff-context-text);
	}

	.sbs-new.add {
		background: var(--diff-add-bg);
		color: var(--diff-add-text);
	}

	.sbs-old.empty,
	.sbs-new.empty {
		background: var(--surface);
		opacity: 0.3;
	}

	.sbs-row .ln-old {
		background: var(--bg-2);
	}

	.sbs-row .ln-new {
		border-left: 1px solid var(--border-2);
	}

	/* When left is remove, tint its ln too */
	.sbs-row:has(.sbs-old.remove) .ln-old {
		background: var(--diff-del-gutter-bg);
		color: var(--diff-del-gutter-text);
	}

	/* When right is add, tint its ln too */
	.sbs-row:has(.sbs-new.add) .ln-new {
		background: var(--diff-add-gutter-bg);
		color: var(--diff-add-gutter-text);
	}

	/* ── Gap rows (pull-in-lines) ───────────────────────────── */
	.gap-row {
		cursor: pointer;
	}

	.gap-row:hover .gap-btn {
		background: var(--surface-2);
		color: var(--text-2);
	}

	.gap-cell {
		padding: 0;
		background: var(--surface);
		border-top: 1px solid var(--border-2);
		border-bottom: 1px solid var(--border-2);
	}

	.gap-btn {
		display: block;
		width: 100%;
		background: none;
		border: none;
		color: var(--text-ghost);
		font-family: 'Courier New', monospace;
		font-size: 0.75rem;
		padding: 0.2rem 1rem;
		text-align: left;
		cursor: pointer;
		transition:
			background 0.1s,
			color 0.1s;
	}

	/* ── Word highlight mark ────────────────────────────────── */
	:global(mark.hl) {
		background: var(--diff-highlight-bg);
		color: inherit;
		border-radius: 2px;
		outline: 1px solid var(--diff-highlight-outline);
	}

	/* ── Copy-ref tooltip ───────────────────────────────────── */
	.copy-ref-tooltip {
		position: fixed;
		z-index: 100;
		pointer-events: auto;
		transform: translateX(-50%);
	}

	.copy-ref-btn {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-2);
		font-family: 'Courier New', monospace;
		font-size: 0.75rem;
		padding: 0.25rem 0.625rem;
		white-space: nowrap;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
		transition:
			background 0.1s,
			color 0.1s;
	}

	.copy-ref-btn:hover {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	/* ── Shared ─────────────────────────────────────────────── */
	.stat-add {
		color: var(--diff-add-strong);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.stat-del {
		color: var(--accent);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.stat-bin {
		color: var(--text-ghost);
		font-size: 0.75rem;
	}

	.stat-boxes {
		display: inline-flex;
		gap: 2px;
	}

	.box {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	.box.add {
		background: var(--diff-add-strong);
	}

	.box.del {
		background: var(--diff-del-strong);
	}

	.box.empty {
		background: var(--border);
	}

	.badge {
		font-size: 0.6875rem;
		font-weight: 600;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge.new {
		background: var(--diff-add-bg);
		color: var(--diff-add-strong);
		border: 1px solid var(--diff-add-gutter-bg);
	}

	.badge.untracked {
		background: var(--diff-untracked-bg);
		color: var(--diff-untracked-text);
		border: 1px solid var(--diff-untracked-border);
	}

	.badge.del {
		background: var(--accent-bg);
		color: var(--accent);
		border: 1px solid var(--accent-muted);
	}

	.binary-notice {
		padding: 1.5rem 1rem;
		color: var(--text-ghost);
		font-size: 0.8125rem;
		font-style: italic;
	}
</style>
