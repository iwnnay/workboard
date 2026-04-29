<script lang="ts">
	import type { PageData } from './$types';
	import type { DiffFile } from '$lib/server/git';
	import type { Project } from '$lib/types';
	import { untrack } from 'svelte';

	let { data }: { data: PageData } = $props();

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

	// ── Derived ──────────────────────────────────────────────

	const selectedProject = $derived(
		selectedProjectId ? (projects.find((p) => p.id === selectedProjectId) ?? null) : null
	);

	const selectedPath = $derived(
		_selectedPath && data.files.find((f) => f.path === _selectedPath)
			? _selectedPath
			: (data.files[0]?.path ?? null)
	);

	const filteredFiles = $derived(
		filterQuery.trim()
			? data.files.filter((f) => f.path.toLowerCase().includes(filterQuery.toLowerCase()))
			: data.files
	);

	const activeFile = $derived<DiffFile | null>(
		data.files.find((f) => f.path === selectedPath) ?? null
	);

	// ── Navigation ───────────────────────────────────────────

	function navigate(projectId: string, range: string) {
		const params = new URLSearchParams({ range });
		if (projectId) params.set('projectId', projectId);
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
		if (!path) return;
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
		return path.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean).at(-1) ?? path;
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
		if (total === 0) return Array(5).fill('empty');
		const green = Math.round((additions / total) * 5);
		return Array.from({ length: 5 }, (_, i) => (i < green ? 'add' : 'del'));
	}

	function projectLabel(cwd: string) {
		return deriveName(cwd);
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
									aria-label="Remove project"
								>×</button>
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
								if (e.key === 'Enter') addProject();
								if (e.key === 'Escape') dropdownOpen = false;
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
			class:loading={loading}
			disabled={loading}
			onclick={() => navigate(selectedProjectId, rangeInput)}
		>
			{#if loading}
				<span class="spinner"></span>
			{:else}
				Run
			{/if}
		</button>

		{#if data.error}
			<span class="error-badge" title={data.error}>Error</span>
		{/if}
	</header>

	<div class="body">
		<!-- Left: file list -->
		<aside class="file-list">
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
					{#each filteredFiles as file (file.path)}
						<button
							class="file-item"
							class:active={selectedPath === file.path}
							onclick={() => (_selectedPath = file.path)}
							title={file.path}
						>
							<span class="file-name">
								{#if fileDir(file.path)}
									<span class="file-dir">{fileDir(file.path)}/</span>
								{/if}
								{fileLabel(file.path)}
								{#if file.isUntracked}<span class="badge untracked">U</span>{:else if file.isNew}<span class="badge new">N</span>{/if}
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
						</button>
					{/each}
				{/if}
			</div>
		</aside>

		<!-- Right: diff view -->
		<main class="diff-panel">
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
						<span class="diff-file-path">
							{#if fileDir(activeFile.path)}
								<span class="diff-file-dir">{fileDir(activeFile.path)}/</span>
							{/if}
							<span class="diff-file-name">{fileLabel(activeFile.path)}</span>
						</span>
						<span class="diff-file-meta">
							{#if activeFile.isUntracked}<span class="badge untracked">untracked</span>{:else if activeFile.isNew}<span class="badge new">new file</span>{/if}
							{#if activeFile.isDeleted}<span class="badge del">deleted</span>{/if}
							{#if !activeFile.isBinary}
								<span class="stat-add">+{activeFile.additions}</span>
								<span class="stat-del">-{activeFile.deletions}</span>
								<span class="stat-boxes" aria-hidden="true">
									{#each statBoxes(activeFile.additions, activeFile.deletions) as box}
										<span class="box {box}"></span>
									{/each}
								</span>
							{/if}
						</span>
					</div>

					{#if activeFile.isBinary}
						<div class="binary-notice">Binary file changed</div>
					{:else if activeFile.hunks.length === 0}
						<div class="binary-notice">No textual changes</div>
					{:else}
						<div class="diff-table-wrap">
							<table class="diff-table">
								<tbody>
									{#each activeFile.hunks as hunk}
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
										{#each hunk.lines as line}
											<tr class="diff-row {line.type}">
												<td class="ln ln-old">{line.oldNum ?? ''}</td>
												<td class="ln ln-new">{line.newNum ?? ''}</td>
												<td class="diff-sign">
													{#if line.type === 'add'}+{:else if line.type === 'remove'}-{:else}&nbsp;{/if}
												</td>
												<td class="diff-content">{line.content}</td>
											</tr>
										{/each}
									{/each}
								</tbody>
							</table>
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

	/* "This repo" also needs active state */
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
		width: 240px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border-right: 1px solid var(--border);
		overflow: hidden;
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
		background: none;
		border: none;
		color: var(--text-muted);
		text-align: left;
		gap: 0.5rem;
		font-size: 0.8rem;
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
		color: var(--text-2);
	}

	.hunk-row td {
		background: #0d1a0d;
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
		color: #4a8f5a;
		font-weight: 700;
		margin-right: 0.5rem;
	}

	.hunk-ctx {
		color: var(--text-ghost);
		margin-left: 0.5rem;
	}

	.diff-row.add td {
		background: #071507;
	}

	.diff-row.add .ln,
	.diff-row.add .diff-sign {
		background: #0a1f0a;
		color: #4a8f5a;
	}

	.diff-row.add .diff-sign {
		color: #4ade80;
	}

	.diff-row.add .diff-content {
		color: #9de8b0;
	}

	.diff-row.remove td {
		background: #1e0505;
	}

	.diff-row.remove .ln,
	.diff-row.remove .diff-sign {
		background: #2a0808;
		color: #8f4a4a;
	}

	.diff-row.remove .diff-sign {
		color: var(--accent);
	}

	.diff-row.remove .diff-content {
		color: #e8a0a0;
	}

	.diff-row.context td {
		background: var(--bg-2);
	}

	.diff-row.context .diff-content {
		color: var(--text-dim);
	}

	/* ── Shared ─────────────────────────────────────────────── */
	.stat-add {
		color: #4ade80;
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
		background: #4ade80;
	}

	.box.del {
		background: var(--accent);
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
		background: #071507;
		color: #4ade80;
		border: 1px solid #0a1f0a;
	}

	.badge.untracked {
		background: #0f0e02;
		color: #c9a84c;
		border: 1px solid #2a2508;
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
