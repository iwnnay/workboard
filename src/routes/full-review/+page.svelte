<script lang="ts">
	import type { PageData } from './$types';
	import type { FullReviewFile, FullReviewState, ReviewStatus } from '$lib/server/full-review';
	import { api } from '$lib/api';
	import { goto } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import ProjectPicker from '$lib/components/ProjectPicker.svelte';
	import { projectsManager } from '$lib/projects-manager.svelte';

	let { data }: { data: PageData } = $props();
	let review = $state<FullReviewState>(untrack(() => data.review));
	let directoryInput = $state(untrack(() => data.review.directories.join('\n')));
	let filterQuery = $state('');
	let statusFilter = $state<'all' | 'attention' | 'unchecked' | 'checked'>('all');
	let busy = $state<'poll' | 'reset' | string | null>(null);
	let error = $state('');
	let showSettings = $state(untrack(() => data.review.directories.length === 0));
	let loadedProjectId = $state(untrack(() => data.projectId));

	const selectedProject = $derived(data.projects.find((entry) => entry.id === data.projectId));
	const checkedCount = $derived(review.files.filter((file) => file.checked).length);
	const attentionCount = $derived(review.files.filter((file) => file.status !== 'current').length);
	const completion = $derived(
		review.files.length ? Math.round((checkedCount / review.files.length) * 100) : 0
	);
	const visibleFiles = $derived.by(() => {
		const query = filterQuery.trim().toLowerCase();
		return review.files.filter((file) => {
			if (query && !file.path.toLowerCase().includes(query)) {
				return false;
			}
			if (statusFilter === 'attention' && file.status === 'current') {
				return false;
			}
			if (statusFilter === 'unchecked' && file.checked) {
				return false;
			}
			if (statusFilter === 'checked' && !file.checked) {
				return false;
			}
			return true;
		});
	});

	onMount(() => {
		const saved = localStorage.getItem('full_review_projectId');
		if (
			!new URLSearchParams(location.search).has('projectId') &&
			saved &&
			data.projects.some((entry) => entry.id === saved)
		) {
			void goto(`/full-review?projectId=${encodeURIComponent(saved)}`, { replaceState: true });
		}
	});

	$effect(() => {
		const projectId = data.projectId;
		const nextReview = data.review;
		untrack(() => {
			if (projectId === loadedProjectId) {
				return;
			}
			loadedProjectId = projectId;
			review = nextReview;
			directoryInput = nextReview.directories.join('\n');
			showSettings = nextReview.directories.length === 0;
			filterQuery = '';
			error = '';
			busy = null;
		});
	});

	function selectProject(projectId: string) {
		localStorage.setItem('full_review_projectId', projectId);
		void goto(`/full-review?projectId=${encodeURIComponent(projectId)}`);
	}

	function message(caught: unknown) {
		return caught instanceof Error ? caught.message : String(caught);
	}

	async function poll() {
		if (!data.projectId || busy) {
			return;
		}
		busy = 'poll';
		error = '';
		try {
			review = await api.post<FullReviewState>('/api/full-review/poll', {
				projectId: data.projectId
			});
		} catch (caught) {
			error = message(caught);
		} finally {
			busy = null;
		}
	}

	async function resetBaseline() {
		if (!data.projectId || busy) {
			return;
		}
		const directories = directoryInput
			.split(/[\n,]/)
			.map((path) => path.trim())
			.filter(Boolean);
		if (directories.length === 0) {
			error = 'Add at least one project-relative directory.';
			return;
		}
		if (
			review.files.length &&
			!confirm('Reset the review baseline? Existing checkmarks and update flags will be cleared.')
		) {
			return;
		}
		busy = 'reset';
		error = '';
		try {
			review = await api.post<FullReviewState>('/api/full-review/reset', {
				projectId: data.projectId,
				directories
			});
			directoryInput = review.directories.join('\n');
			showSettings = false;
		} catch (caught) {
			error = message(caught);
		} finally {
			busy = null;
		}
	}

	async function toggleFile(file: FullReviewFile, checked: boolean) {
		if (busy || file.status === 'deleted') {
			return;
		}
		busy = file.path;
		error = '';
		try {
			review = await api.patch<FullReviewState>('/api/full-review/file', {
				projectId: data.projectId,
				path: file.path,
				checked
			});
		} catch (caught) {
			error = message(caught);
		} finally {
			busy = null;
		}
	}

	function formatDate(value: string | null): string {
		if (!value) {
			return '—';
		}
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(value));
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) {
			return `${bytes} B`;
		}
		if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(1)} KB`;
		}
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	function statusLabel(status: ReviewStatus): string {
		return status === 'current' ? 'No change' : status[0].toUpperCase() + status.slice(1);
	}
</script>

<svelte:head><title>Full Review · Workboard</title></svelte:head>

<div class="page">
	<header class="topbar">
		<div class="title-block">
			<h1>Full Review</h1>
			<span>Long-running codebase review</span>
		</div>
		<ProjectPicker projects={data.projects} selectedId={data.projectId} onSelect={selectProject} />
		<div class="spacer"></div>
		<button
			class="button secondary"
			onclick={() => (showSettings = !showSettings)}
			disabled={!data.projectId}>Directories</button
		>
		<button class="button primary" onclick={poll} disabled={!review.directories.length || !!busy}>
			{busy === 'poll' ? 'Checking…' : 'Check for updates'}
		</button>
	</header>

	{#if showSettings}
		<section class="settings">
			<div>
				<label for="review-directories">Directories to review</label>
				<p>
					One project-relative directory per line. Use <code>.</code> for the whole project. Generated
					and dependency folders are skipped.
				</p>
			</div>
			<textarea
				id="review-directories"
				bind:value={directoryInput}
				placeholder={'src\ntests'}
				rows="3"
			></textarea>
			<button class="button danger" onclick={resetBaseline} disabled={!data.projectId || !!busy}>
				{busy === 'reset' ? 'Resetting…' : 'Save & reset baseline'}
			</button>
		</section>
	{/if}

	{#if error}<div class="error" role="alert">{error}</div>{/if}

	{#if !selectedProject}
		<main class="empty">
			<h2>No project selected</h2>
			<p>Add a project to start reviewing it.</p>
			<button class="button primary" onclick={() => projectsManager.show()}>Add a project</button>
		</main>
	{:else if review.directories.length === 0}
		<main class="empty">
			<h2>Choose what to review</h2>
			<p>Add one or more directories above, then create the first baseline.</p>
		</main>
	{:else}
		<section class="summary">
			<div class="progress-copy">
				<strong>{checkedCount} of {review.files.length}</strong><span>files reviewed</span>
			</div>
			<div class="progress" aria-label={`${completion}% reviewed`}>
				<span style={`width: ${completion}%`}></span>
			</div>
			<strong class:has-attention={attentionCount > 0}>{attentionCount} changed</strong>
			<span class="dates"
				>Baseline {formatDate(review.baselineAt)} · Last poll {formatDate(
					review.lastPolledAt
				)}</span
			>
			<span class="scope" title={review.directories.join(', ')}
				>{review.directories.join(' · ')}</span
			>
		</section>

		<section class="controls">
			<input bind:value={filterQuery} aria-label="Filter files" placeholder="Filter files…" />
			<div class="filters" aria-label="File filters">
				{#each [['all', 'All'], ['attention', 'Changed'], ['unchecked', 'Unchecked'], ['checked', 'Checked']] as filter}
					<button
						class:active={statusFilter === filter[0]}
						onclick={() => (statusFilter = filter[0] as typeof statusFilter)}>{filter[1]}</button
					>
				{/each}
			</div>
		</section>

		<main class="file-list">
			<div class="list-head">
				<span></span><span>File</span><span>Status</span><span>Last checked off</span><span
					>Modified on disk</span
				><span>Size</span>
			</div>
			{#each visibleFiles as file (file.path)}
				<label
					class="file-row"
					class:checked={file.checked}
					class:changed={file.status !== 'current'}
				>
					<span class="check-wrap"
						><input
							type="checkbox"
							checked={file.checked}
							disabled={!!busy || file.status === 'deleted'}
							onchange={(event) => toggleFile(file, event.currentTarget.checked)}
						/></span
					>
					<span class="path" title={file.path}>{file.path}</span>
					<span
						><span
							class="status"
							class:current={file.status === 'current'}
							class:created={file.status === 'created'}
							class:updated={file.status === 'updated'}
							class:deleted={file.status === 'deleted'}>{statusLabel(file.status)}</span
						></span
					>
					<time>{formatDate(file.checkedAt)}</time>
					<time>{formatDate(file.modifiedAt)}</time>
					<span class="size">{formatSize(file.byteSize)}</span>
				</label>
			{/each}
			{#if visibleFiles.length === 0}<div class="no-results">No files match this view.</div>{/if}
		</main>
	{/if}
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--bg);
		color: var(--text);
		padding-bottom: 5rem;
	}
	.topbar {
		min-height: 58px;
		padding: 0.65rem 1.25rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.title-block {
		display: flex;
		align-items: baseline;
		gap: 0.65rem;
	}
	h1 {
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-muted);
	}
	.title-block span {
		font-size: 0.75rem;
		color: var(--text-ghost);
	}
	.spacer {
		flex: 1;
	}
	input,
	textarea {
		background: var(--bg-2);
		border: 1px solid var(--border);
		color: var(--text);
		border-radius: 5px;
		outline: none;
	}
	input:focus,
	textarea:focus {
		border-color: var(--accent-muted);
	}
	.button {
		border-radius: 5px;
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--border);
		color: var(--text-muted);
		white-space: nowrap;
	}
	.button:hover:not(:disabled) {
		border-color: var(--accent-muted);
		color: var(--text);
	}
	.button.primary {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
		font-weight: 600;
	}
	.button.secondary {
		background: var(--surface-2);
	}
	.button.danger {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--accent);
		align-self: end;
	}
	.button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.settings {
		display: grid;
		grid-template-columns: minmax(220px, 0.7fr) minmax(300px, 1.3fr) auto;
		gap: 1rem;
		align-items: start;
		padding: 1rem 1.25rem;
		background: var(--surface-2);
		border-bottom: 1px solid var(--border);
	}
	.settings label {
		font-weight: 600;
		color: var(--text-2);
	}
	.settings p {
		color: var(--text-dim);
		font-size: 0.75rem;
		margin-top: 0.25rem;
	}
	.settings code {
		color: var(--text-muted);
	}
	textarea {
		width: 100%;
		resize: vertical;
		padding: 0.5rem 0.625rem;
		font-family: monospace;
	}
	.error {
		margin: 0.75rem 1.25rem 0;
		padding: 0.6rem 0.75rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
	}
	.summary {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem 1.25rem;
		border-bottom: 1px solid var(--border);
	}
	.progress-copy {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
		min-width: 130px;
	}
	.progress-copy strong {
		font-variant-numeric: tabular-nums;
	}
	.progress-copy span,
	.scope,
	.dates {
		color: var(--text-dim);
		font-size: 0.75rem;
	}
	.progress {
		width: 180px;
		height: 5px;
		background: var(--border);
		border-radius: 5px;
		overflow: hidden;
	}
	.progress span {
		display: block;
		height: 100%;
		background: var(--diff-add-strong);
	}
	.has-attention {
		color: var(--changed);
	}
	.dates {
		margin-left: auto;
		white-space: nowrap;
	}
	.scope {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: monospace;
	}
	.controls {
		display: flex;
		gap: 0.75rem;
		padding: 0.65rem 1.25rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.controls input {
		width: min(360px, 45vw);
		padding: 0.35rem 0.55rem;
	}
	.filters {
		display: flex;
		gap: 2px;
	}
	.filters button {
		padding: 0.25rem 0.5rem;
		color: var(--text-ghost);
		border-bottom: 1px solid transparent;
	}
	.filters button:hover,
	.filters button.active {
		color: var(--text-2);
	}
	.filters button.active {
		border-color: var(--accent);
	}
	.file-list {
		padding: 0.75rem 1.25rem;
	}
	.list-head,
	.file-row {
		display: grid;
		grid-template-columns: 36px minmax(240px, 1fr) 100px 175px 175px 75px;
		align-items: center;
	}
	.list-head {
		color: var(--text-ghost);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.65rem;
		padding: 0 0.65rem 0.4rem;
	}
	.file-row {
		min-height: 43px;
		padding: 0.35rem 0.65rem;
		background: var(--surface);
		border: 1px solid var(--border-2);
		border-radius: 4px;
		margin-bottom: 3px;
		cursor: pointer;
		transition:
			background 0.1s,
			border-color 0.1s;
	}
	.file-row:hover {
		background: var(--surface-2);
		border-color: var(--border);
	}
	.file-row.checked .path {
		color: var(--text-ghost);
		text-decoration: line-through;
	}
	.file-row.changed {
		border-left-color: var(--changed-strong);
	}
	.check-wrap {
		display: flex;
	}
	.check-wrap input {
		accent-color: var(--diff-add-strong);
		width: 15px;
		height: 15px;
	}
	.path {
		color: var(--text-2);
		font: 0.8rem monospace;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding-right: 0.75rem;
	}
	time,
	.size {
		color: var(--text-dim);
		font-size: 0.73rem;
		font-variant-numeric: tabular-nums;
	}
	.status {
		display: inline-block;
		font-size: 0.68rem;
		padding: 0.12rem 0.4rem;
		border-radius: 9px;
		border: 1px solid var(--border);
		color: var(--text-dim);
	}
	.status.created {
		color: var(--diff-add-strong);
		border-color: var(--diff-add-gutter-bg);
		background: var(--diff-add-bg);
	}
	.status.updated {
		color: var(--changed);
		border-color: var(--changed-border);
		background: var(--changed-bg);
	}
	.status.deleted {
		color: var(--accent);
		border-color: var(--accent-muted);
		background: var(--accent-bg);
	}
	.no-results,
	.empty {
		color: var(--text-ghost);
		text-align: center;
		padding: 5rem 1rem;
	}
	.empty h2 {
		color: var(--text-muted);
		font-size: 1rem;
		margin-bottom: 0.35rem;
	}
	@media (max-width: 900px) {
		.title-block span {
			display: none;
		}
		.settings {
			grid-template-columns: 1fr;
		}
		.button.danger {
			justify-self: start;
		}
		.list-head {
			display: none;
		}
		.file-row {
			grid-template-columns: 30px minmax(180px, 1fr) 90px;
		}
		.file-row time,
		.file-row .size {
			display: none;
		}
	}
</style>
