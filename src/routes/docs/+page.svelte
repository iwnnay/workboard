<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { TreeNode } from '../api/docs/tree/+server';
	import type { ParsedFile, FunctionInfo, ClassInfo, InterfaceInfo, TypeAliasInfo, ImportInfo } from '$lib/server/code-parser';

	interface FileInfo {
		path: string;
		language: string;
		lineCount: number;
		byteSize: number;
		highlighted: string;
		parsed: ParsedFile;
	}

	type Project = { id: string; name: string; path: string };

	let { data }: { data: PageData } = $props();

	// untrack: intentionally read initial server value; list is managed locally afterward
	let projects: Project[] = $state(untrack(() => data.projects));
	let projectId = $state(untrack(() => data.projects[0]?.id ?? ''));
	let tree: TreeNode[] = $state([]);
	let expanded = new SvelteSet<string>();
	let selectedPath = $state<string | null>(null);
	let fileInfo = $state<FileInfo | null>(null);
	let viewMode = $state<'summary' | 'raw'>('summary');
	let loadingFile = $state(false);
	let loadingTree = $state(false);
	let showProjectMenu = $state(false);
	let addingProject = $state(false);
	let newName = $state('');
	let newPath = $state('');

	$effect(() => {
		void loadTree(projectId);
	});

	async function loadTree(pid: string) {
		loadingTree = true;
		selectedPath = null;
		fileInfo = null;
		try {
			const res = await fetch(`/api/docs/tree?projectId=${encodeURIComponent(pid)}`);
			tree = res.ok ? await res.json() : [];
		} finally {
			loadingTree = false;
		}
	}

	async function selectFile(path: string) {
		if (selectedPath === path && fileInfo) return;
		selectedPath = path;
		viewMode = 'summary';
		fileInfo = null;
		loadingFile = true;
		try {
			const res = await fetch(
				`/api/docs/file?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`
			);
			if (res.ok) fileInfo = await res.json();
		} finally {
			loadingFile = false;
		}
	}

	function toggleDir(path: string) {
		if (expanded.has(path)) expanded.delete(path);
		else expanded.add(path);
	}

	async function addProject() {
		if (!newName.trim() || !newPath.trim()) return;
		const res = await fetch('/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newName.trim(), path: newPath.trim() })
		});
		if (res.ok) {
			const p = await res.json();
			projects = [...projects, p];
			projectId = p.id;
			addingProject = false;
			newName = '';
			newPath = '';
		}
	}

	async function removeProject(id: string) {
		await fetch(`/api/projects/${id}`, { method: 'DELETE' });
		projects = projects.filter((p) => p.id !== id);
		if (projectId === id) projectId = projects[0]?.id ?? '';
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	function extColor(ext: string | undefined): string {
		switch (ext) {
			case '.ts': case '.tsx': return '#60a5fa';
			case '.js': case '.jsx': return '#fbbf24';
			case '.svelte': return '#f97316';
			case '.css': case '.scss': case '.less': return '#c084fc';
			case '.json': case '.toml': case '.yaml': case '.yml': return '#a3e635';
			case '.md': return '#94a3b8';
			case '.py': return '#4ade80';
			case '.go': return '#67e8f9';
			case '.rs': return '#fb923c';
			case '.sql': return '#f9a8d4';
			case '.html': return '#f87171';
			default: return 'var(--text-ghost)';
		}
	}

	function groupImports(imports: ImportInfo[]) {
		const external = imports.filter((i) => !i.module.startsWith('.') && !i.module.startsWith('$'));
		const internal = imports.filter((i) => i.module.startsWith('$'));
		const relative = imports.filter((i) => i.module.startsWith('.'));
		return { external, internal, relative };
	}

	let lineNumbers = $derived(
		fileInfo ? Array.from({ length: fileInfo.lineCount }, (_, i) => i + 1) : []
	);

	let currentProject = $derived(projects.find((p) => p.id === projectId));
	let fileName = $derived(selectedPath ? selectedPath.split('/').pop() ?? selectedPath : '');

	let hasParsedContent = $derived(
		!!fileInfo &&
			(fileInfo.parsed.functions.length > 0 ||
				fileInfo.parsed.classes.length > 0 ||
				fileInfo.parsed.interfaces.length > 0 ||
				fileInfo.parsed.types.length > 0 ||
				fileInfo.parsed.imports.length > 0)
	);
</script>

<div class="docs-page" role="presentation" onclick={() => { showProjectMenu = false; }}>
	<!-- Top bar -->
	<header class="topbar">
		<span class="page-title">Docs</span>
		<div class="project-selector" role="presentation" onclick={(e) => e.stopPropagation()}>
			<button class="project-btn" onclick={() => (showProjectMenu = !showProjectMenu)}>
				<span class="project-name">{currentProject?.name ?? 'Select project'}</span>
				<span class="chevron">▾</span>
			</button>
			{#if showProjectMenu}
				<div class="project-menu">
					{#each projects as p (p.id)}
						<div class="project-row">
							<button
								class="project-option"
								class:active={p.id === projectId}
								onclick={() => { projectId = p.id; showProjectMenu = false; }}
							>
								{p.name}
								<span class="project-path">{p.path}</span>
							</button>
							<button class="remove-btn" title="Remove" onclick={() => removeProject(p.id)}>✕</button>
						</div>
					{/each}
					{#if addingProject}
						<div class="add-form">
							<input bind:value={newName} placeholder="Project name" class="add-input" />
							<input bind:value={newPath} placeholder="/absolute/path" class="add-input" />
							<div class="add-actions">
								<button class="btn-confirm" onclick={addProject}>Add</button>
								<button class="btn-cancel" onclick={() => { addingProject = false; newName = ''; newPath = ''; }}>Cancel</button>
							</div>
						</div>
					{:else}
						<button class="add-project-btn" onclick={() => (addingProject = true)}>+ Add project</button>
					{/if}
				</div>
			{/if}
		</div>
		{#if selectedPath && fileInfo}
			<div class="file-breadcrumb">
				<span class="breadcrumb-path">{selectedPath}</span>
			</div>
			<div class="view-toggle">
				<button class="toggle-btn" class:active={viewMode === 'summary'} onclick={() => (viewMode = 'summary')}>
					Summary
				</button>
				<button class="toggle-btn" class:active={viewMode === 'raw'} onclick={() => (viewMode = 'raw')}>
					Raw
				</button>
			</div>
		{/if}
	</header>

	<div class="body">
		<!-- File tree panel -->
		<aside class="tree-panel">
			{#if loadingTree}
				<div class="tree-loading">Loading…</div>
			{:else if tree.length === 0}
				<div class="tree-empty">No project selected or empty directory.</div>
			{:else}
				<div class="tree-scroll">
					{@render treeNodes(tree, 0)}
				</div>
			{/if}
		</aside>

		<!-- Content panel -->
		<main class="content-panel">
			{#if loadingFile}
				<div class="panel-loading">Loading file…</div>
			{:else if !selectedPath}
				<div class="empty-state">
					<div class="empty-icon">⌥</div>
					<p>Select a file from the tree to explore its contents.</p>
				</div>
			{:else if !fileInfo}
				<div class="empty-state"><p>Could not load file.</p></div>
			{:else if viewMode === 'raw'}
				<!-- Raw view -->
				<div class="raw-view">
					<div class="raw-header">
						<span class="raw-filename">{fileName}</span>
						<span class="lang-badge">{fileInfo.language}</span>
						<span class="meta-pill">{fileInfo.lineCount} lines</span>
						<span class="meta-pill">{formatSize(fileInfo.byteSize)}</span>
					</div>
					<div class="code-block">
						<div class="line-nums" aria-hidden="true">{lineNumbers.join('\n')}</div>
						<pre class="code-pre"><code class="hljs">{@html fileInfo.highlighted}</code></pre>
					</div>
				</div>
			{:else}
				<!-- Summary view -->
				<div class="summary-view">
					<div class="summary-header">
						<div class="summary-title">
							<span class="summary-filename">{fileName}</span>
							<span class="lang-badge">{fileInfo.language}</span>
						</div>
						<div class="summary-meta">
							<span class="meta-pill">{fileInfo.lineCount} lines</span>
							<span class="meta-pill">{formatSize(fileInfo.byteSize)}</span>
						</div>
					</div>

					{#if !hasParsedContent}
						<div class="no-parse-notice">
							No symbols found — view <button class="inline-link" onclick={() => (viewMode = 'raw')}>raw code</button> instead.
						</div>
					{:else}
						{@const groups = groupImports(fileInfo.parsed.imports)}

						{#if fileInfo.parsed.imports.length > 0}
							<section class="doc-section">
								<h3 class="section-title">Imports</h3>
								{#if groups.external.length > 0}
									<div class="import-group">
										<span class="import-group-label">packages</span>
										{#each groups.external as imp (imp.line)}
											{@render importRow(imp)}
										{/each}
									</div>
								{/if}
								{#if groups.internal.length > 0}
									<div class="import-group">
										<span class="import-group-label">aliases</span>
										{#each groups.internal as imp (imp.line)}
											{@render importRow(imp)}
										{/each}
									</div>
								{/if}
								{#if groups.relative.length > 0}
									<div class="import-group">
										<span class="import-group-label">relative</span>
										{#each groups.relative as imp (imp.line)}
											{@render importRow(imp)}
										{/each}
									</div>
								{/if}
							</section>
						{/if}

						{#if fileInfo.parsed.functions.length > 0}
							<section class="doc-section">
								<h3 class="section-title">Functions</h3>
								{#each fileInfo.parsed.functions as fn (fn.line)}
									{@render functionRow(fn)}
								{/each}
							</section>
						{/if}

						{#if fileInfo.parsed.classes.length > 0}
							<section class="doc-section">
								<h3 class="section-title">Classes</h3>
								{#each fileInfo.parsed.classes as cls (cls.line)}
									{@render classRow(cls)}
								{/each}
							</section>
						{/if}

						{#if fileInfo.parsed.interfaces.length > 0 || fileInfo.parsed.types.length > 0}
							<section class="doc-section">
								<h3 class="section-title">Types &amp; Interfaces</h3>
								{#each fileInfo.parsed.interfaces as iface (iface.line)}
									{@render interfaceRow(iface)}
								{/each}
								{#each fileInfo.parsed.types as t (t.line)}
									{@render typeRow(t)}
								{/each}
							</section>
						{/if}
					{/if}
				</div>
			{/if}
		</main>
	</div>
</div>

{#snippet treeNodes(nodes: TreeNode[], depth: number)}
	{#each nodes as node (node.path)}
		{#if node.type === 'dir'}
			<div class="tree-dir" style="padding-left: {depth * 12}px">
				<button class="dir-btn" class:open={expanded.has(node.path)} onclick={() => toggleDir(node.path)}>
					<span class="dir-arrow" class:open={expanded.has(node.path)}>▶</span>
					<span class="dir-name">{node.name}</span>
				</button>
			</div>
			{#if expanded.has(node.path) && node.children}
				{@render treeNodes(node.children, depth + 1)}
			{/if}
		{:else}
			<button
				class="tree-file"
				class:selected={selectedPath === node.path}
				style="padding-left: {depth * 12 + 16}px"
				onclick={() => selectFile(node.path)}
			>
				<span class="file-dot" style="color: {extColor(node.ext)}">●</span>
				<span class="file-name">{node.name}</span>
			</button>
		{/if}
	{/each}
{/snippet}

{#snippet importRow(imp: ImportInfo)}
	<div class="import-row">
		<span class="import-module">{imp.module}</span>
		{#if imp.defaultImport}
			<span class="import-item default-import">{imp.defaultImport}</span>
		{/if}
		{#each imp.named as name (name)}
			<span class="import-item">{name}</span>
		{/each}
		<span class="line-ref">:{imp.line}</span>
	</div>
{/snippet}

{#snippet functionRow(fn: FunctionInfo)}
	<div class="symbol-row">
		<div class="symbol-sig">
			{#if fn.isExport}<span class="kw-export">export</span>{/if}
			{#if fn.isAsync}<span class="kw-async">async</span>{/if}
			<span class="kw-fn">fn</span>
			<span class="symbol-name fn-name">{fn.name}</span>
			<span class="line-ref">:{fn.line}</span>
		</div>
		{#if fn.doc}
			<div class="symbol-doc">{fn.doc.replace(/^\/\*\*|\*\/$/g, '').replace(/^\s*\* ?/gm, '').trim()}</div>
		{/if}
	</div>
{/snippet}

{#snippet classRow(cls: ClassInfo)}
	<div class="symbol-row class-row">
		<div class="symbol-sig">
			{#if cls.isExport}<span class="kw-export">export</span>{/if}
			<span class="kw-class">class</span>
			<span class="symbol-name class-name">{cls.name}</span>
			<span class="line-ref">:{cls.line}</span>
		</div>
		{#if cls.doc}
			<div class="symbol-doc">{cls.doc.replace(/^\/\*\*|\*\/$/g, '').replace(/^\s*\* ?/gm, '').trim()}</div>
		{/if}
		{#if cls.methods.length > 0}
			<div class="method-list">
				{#each cls.methods as method (method.line)}
					<div class="method-row">
						{#if method.isAsync}<span class="kw-async">async</span>{/if}
						<span class="method-name">{method.name}</span>
						<span class="line-ref">:{method.line}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet interfaceRow(iface: InterfaceInfo)}
	<div class="symbol-row">
		<div class="symbol-sig">
			{#if iface.isExport}<span class="kw-export">export</span>{/if}
			<span class="kw-iface">interface</span>
			<span class="symbol-name type-name">{iface.name}</span>
			<span class="line-ref">:{iface.line}</span>
		</div>
		{#if iface.doc}
			<div class="symbol-doc">{iface.doc.replace(/^\/\*\*|\*\/$/g, '').replace(/^\s*\* ?/gm, '').trim()}</div>
		{/if}
	</div>
{/snippet}

{#snippet typeRow(t: TypeAliasInfo)}
	<div class="symbol-row">
		<div class="symbol-sig">
			{#if t.isExport}<span class="kw-export">export</span>{/if}
			<span class="kw-type">type</span>
			<span class="symbol-name type-name">{t.name}</span>
			<span class="line-ref">:{t.line}</span>
		</div>
	</div>
{/snippet}

<style>
	/* Layout */
	.docs-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
		background: var(--bg);
		color: var(--text);
	}

	.topbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
		flex-shrink: 0;
		min-height: 48px;
		flex-wrap: wrap;
	}

	.page-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-muted);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.file-breadcrumb {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.breadcrumb-path {
		font-family: monospace;
		font-size: 0.8rem;
		color: var(--text-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	.view-toggle {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		flex-shrink: 0;
	}

	.toggle-btn {
		padding: 0.2rem 0.5rem;
		font-size: 0.8rem;
		color: var(--text-ghost);
		transition: color 0.1s;
		border-bottom: 1px solid transparent;
	}

	.toggle-btn.active {
		color: var(--text-dim);
		border-bottom-color: var(--accent-muted);
	}

	.toggle-btn:hover:not(.active) {
		color: var(--text-muted);
	}

	.body {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	/* Tree panel */
	.tree-panel {
		width: 260px;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
		background: var(--surface);
		overflow-y: auto;
		overflow-x: hidden;
	}

	.tree-scroll {
		padding: 0.5rem 0;
	}

	.tree-loading,
	.tree-empty {
		padding: 1rem;
		color: var(--text-dim);
		font-size: 0.8125rem;
	}

	.tree-dir {
		display: flex;
		flex-direction: column;
	}

	.dir-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		padding: 0.2rem 0.75rem;
		color: var(--text-ghost);
		font-size: 0.8125rem;
		text-align: left;
		transition: background 0.1s, color 0.1s;
		white-space: nowrap;
		overflow: hidden;
	}

	.dir-btn.open {
		color: var(--text-dim);
	}

	.dir-btn:hover {
		background: var(--accent-bg);
		color: var(--text-2);
	}

	.dir-arrow {
		font-size: 0.55rem;
		transition: transform 0.15s;
		flex-shrink: 0;
		color: var(--text-ghost);
	}

	.dir-arrow.open {
		transform: rotate(90deg);
	}

	.dir-name {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tree-file {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		padding: 0.2rem 0.75rem;
		color: var(--text-dim);
		font-size: 0.8125rem;
		text-align: left;
		transition: background 0.1s, color 0.1s;
		white-space: nowrap;
		overflow: hidden;
	}

	.tree-file:hover {
		background: var(--accent-bg);
		color: var(--text-2);
	}

	.tree-file.selected {
		background: var(--accent-bg);
		color: var(--text);
	}

	.tree-file.selected .file-dot {
		filter: brightness(1.3);
	}

	.file-dot {
		font-size: 0.5rem;
		flex-shrink: 0;
		line-height: 1;
	}

	.file-name {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Content panel */
	.content-panel {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.panel-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-dim);
		font-size: 0.875rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.75rem;
		color: var(--text-ghost);
	}

	.empty-icon {
		font-size: 2rem;
		opacity: 0.4;
	}

	.empty-state p {
		font-size: 0.875rem;
	}

	/* Summary view */
	.summary-view {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
	}

	.summary-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.summary-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.summary-filename {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		font-family: monospace;
	}

	.summary-meta {
		display: flex;
		gap: 0.375rem;
	}

	.lang-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.15rem 0.5rem;
		background: var(--accent-bg);
		color: var(--accent);
		border-radius: 4px;
		border: 1px solid var(--accent-muted);
		text-transform: lowercase;
		letter-spacing: 0.03em;
	}

	.meta-pill {
		font-size: 0.75rem;
		color: var(--text-dim);
		padding: 0.15rem 0.5rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
	}

	.no-parse-notice {
		color: var(--text-dim);
		font-size: 0.875rem;
		padding: 1rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.inline-link {
		color: var(--accent);
		text-decoration: underline;
		cursor: pointer;
	}

	.doc-section {
		margin-bottom: 1.5rem;
	}

	.section-title {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-ghost);
		margin-bottom: 0.5rem;
		padding-bottom: 0.375rem;
		border-bottom: 1px solid var(--border-2);
	}

	/* Imports */
	.import-group {
		margin-bottom: 0.625rem;
	}

	.import-group-label {
		font-size: 0.7rem;
		color: var(--text-ghost);
		display: block;
		margin-bottom: 0.25rem;
		padding-left: 0.25rem;
	}

	.import-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.25rem;
		padding: 0.3rem 0.625rem;
		background: var(--surface-2);
		border-radius: 4px;
		margin-bottom: 2px;
		font-size: 0.8125rem;
		font-family: monospace;
	}

	.import-module {
		color: var(--text-2);
		flex-shrink: 0;
	}

	.import-item {
		font-size: 0.75rem;
		padding: 0.1rem 0.375rem;
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--text-muted);
	}

	.default-import {
		color: var(--text);
		border-color: var(--accent-muted);
	}

	/* Symbol rows */
	.symbol-row {
		padding: 0.5rem 0.625rem;
		background: var(--surface-2);
		border-radius: 5px;
		margin-bottom: 4px;
		border: 1px solid transparent;
		transition: border-color 0.1s;
	}

	.symbol-row:hover {
		border-color: var(--border);
	}

	.class-row {
		padding-bottom: 0.375rem;
	}

	.symbol-sig {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-family: monospace;
		font-size: 0.8125rem;
	}

	.symbol-name {
		font-weight: 600;
	}

	.fn-name { color: #fbbf24; }
	.class-name { color: #f472b6; }
	.type-name { color: #c084fc; }
	.method-name { color: #93c5fd; font-family: monospace; font-size: 0.8rem; }

	.kw-export { color: var(--text-ghost); font-size: 0.75rem; }
	.kw-async  { color: #f472b6; font-size: 0.75rem; }
	.kw-fn     { color: var(--text-dim); font-size: 0.75rem; }
	.kw-class  { color: #f472b6; font-size: 0.75rem; }
	.kw-iface  { color: #c084fc; font-size: 0.75rem; }
	.kw-type   { color: #c084fc; font-size: 0.75rem; }

	.line-ref {
		color: var(--text-ghost);
		font-size: 0.7rem;
		font-family: monospace;
		margin-left: auto;
		flex-shrink: 0;
	}

	.symbol-doc {
		margin-top: 0.375rem;
		font-size: 0.75rem;
		color: var(--text-dim);
		line-height: 1.5;
		padding-left: 0.5rem;
		border-left: 2px solid var(--border);
		white-space: pre-wrap;
		font-family: sans-serif;
	}

	.method-list {
		margin-top: 0.375rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.method-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.175rem 0.5rem;
		font-size: 0.775rem;
		font-family: monospace;
		background: var(--bg-2);
		border-radius: 3px;
	}

	/* Raw view */
	.raw-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.raw-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.raw-filename {
		font-family: monospace;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}

	.code-block {
		flex: 1;
		display: flex;
		overflow: auto;
		background: var(--bg-2);
	}

	.line-nums {
		flex-shrink: 0;
		padding: 1rem 0.75rem;
		text-align: right;
		font-family: 'Consolas', 'Fira Code', monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		color: var(--text-ghost);
		background: var(--surface);
		border-right: 1px solid var(--border);
		user-select: none;
		white-space: pre;
		min-width: 3rem;
	}

	.code-pre {
		flex: 1;
		margin: 0;
		padding: 1rem;
		overflow: visible;
		background: transparent;
		font-family: 'Consolas', 'Fira Code', monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		white-space: pre;
		tab-size: 2;
	}

	/* Project selector */
	.project-selector {
		position: relative;
	}

	.project-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3rem 0.625rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-2);
		font-size: 0.8125rem;
		transition: border-color 0.15s, background 0.15s;
	}

	.project-btn:hover {
		border-color: var(--accent-muted);
		background: var(--accent-bg);
	}

	.project-name {
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chevron {
		color: var(--text-ghost);
		font-size: 0.75rem;
	}

	.project-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 7px;
		padding: 0.375rem;
		min-width: 280px;
		z-index: 50;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
	}

	.project-row {
		display: flex;
		align-items: stretch;
		gap: 2px;
		margin-bottom: 2px;
	}

	.project-option {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1px;
		padding: 0.375rem 0.5rem;
		border-radius: 4px;
		font-size: 0.8125rem;
		color: var(--text-muted);
		text-align: left;
		transition: background 0.1s, color 0.1s;
	}

	.project-option:hover {
		background: var(--accent-bg);
		color: var(--text-2);
	}

	.project-option.active {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.project-path {
		font-family: monospace;
		font-size: 0.7rem;
		color: var(--text-ghost);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 220px;
	}

	.remove-btn {
		padding: 0.375rem 0.5rem;
		border-radius: 4px;
		color: var(--text-ghost);
		font-size: 0.7rem;
		transition: background 0.1s, color 0.1s;
	}

	.remove-btn:hover {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.add-project-btn {
		width: 100%;
		padding: 0.375rem 0.5rem;
		border-radius: 4px;
		color: var(--text-ghost);
		font-size: 0.8rem;
		text-align: left;
		margin-top: 2px;
		transition: background 0.1s, color 0.1s;
	}

	.add-project-btn:hover {
		background: var(--accent-bg);
		color: var(--text-2);
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;
		border-top: 1px solid var(--border);
		margin-top: 0.25rem;
	}

	.add-input {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text);
		font-size: 0.8rem;
		padding: 0.3rem 0.5rem;
		width: 100%;
		outline: none;
	}

	.add-input:focus {
		border-color: var(--accent-muted);
	}

	.add-actions {
		display: flex;
		gap: 0.375rem;
	}

	.btn-confirm {
		flex: 1;
		padding: 0.3rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 4px;
		color: var(--accent);
		font-size: 0.8rem;
		transition: opacity 0.1s;
	}

	.btn-confirm:hover { opacity: 0.85; }

	.btn-cancel {
		flex: 1;
		padding: 0.3rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.btn-cancel:hover {
		background: var(--bg);
	}

	/* highlight.js theme — dark red palette */
	:global(.hljs) { color: var(--text); background: transparent; }
	:global(.hljs-keyword, .hljs-selector-tag, .hljs-deletion) { color: #f472b6; }
	:global(.hljs-built_in, .hljs-name) { color: #fb923c; }
	:global(.hljs-string, .hljs-template-string, .hljs-addition) { color: #86efac; }
	:global(.hljs-comment, .hljs-quote) { color: var(--text-dim); font-style: italic; }
	:global(.hljs-number, .hljs-literal, .hljs-regexp) { color: #67e8f9; }
	:global(.hljs-title, .hljs-title.class_, .hljs-title.function_) { color: #fbbf24; }
	:global(.hljs-type, .hljs-class .hljs-title) { color: #c084fc; }
	:global(.hljs-attr, .hljs-attribute, .hljs-selector-id, .hljs-selector-class) { color: #93c5fd; }
	:global(.hljs-variable, .hljs-template-variable) { color: var(--text-2); }
	:global(.hljs-tag) { color: #f97316; }
	:global(.hljs-meta) { color: var(--text-muted); }
	:global(.hljs-operator, .hljs-punctuation) { color: var(--text-2); }
	:global(.hljs-section) { color: var(--accent); font-weight: bold; }
	:global(.hljs-symbol) { color: #a3e635; }
	:global(.hljs-params) { color: var(--text); }
</style>
