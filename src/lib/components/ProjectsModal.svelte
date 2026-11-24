<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import DirectoryPickerModal from '$lib/components/DirectoryPickerModal.svelte';
	import { projectsApi } from '$lib/projects-api';
	import { serversApi } from '$lib/servers-api';
	import { projectsManager } from '$lib/projects-manager.svelte';
	import { findOwningProject, pathSegments } from '$lib/folder-paths';
	import { defaultProjectSettings, settingsToText, textToSettings } from '$lib/project-settings';
	import type { ManagedServerWithStatus, Project } from '$lib/types';

	let { onClose }: { onClose: () => void } = $props();

	const newProjectKey = 'new';

	let projects = $state<Project[]>([]);
	let servers = $state<ManagedServerWithStatus[]>([]);
	let serversError = $state('');
	let loading = $state(true);
	let loadError = $state('');
	let selectedKey = $state<string | null>(null);
	let nameDraft = $state('');
	let pathDraft = $state('');
	let testGlobsDraft = $state('');
	let excludeGlobsDraft = $state('');
	let importantDraft = $state<string[]>([]);
	let saving = $state(false);
	let actionError = $state('');
	let confirmingDelete = $state(false);
	let pickerMode = $state<'path' | 'important' | null>(null);

	const selectedProject = $derived(projects.find((entry) => entry.id === selectedKey) ?? null);
	const creating = $derived(selectedKey === newProjectKey);
	const linkedServers = $derived(
		selectedProject
			? servers.filter(
					(server) => findOwningProject(projects, server.directory)?.id === selectedProject.id
				)
			: []
	);
	const dirty = $derived.by(() => {
		if (creating) {
			return !!pathDraft.trim();
		}
		if (!selectedProject) {
			return false;
		}
		const settings = selectedProject.settings;
		return (
			nameDraft.trim() !== selectedProject.name ||
			pathDraft.trim() !== selectedProject.path ||
			testGlobsDraft !== settingsToText(settings.testGlobs) ||
			excludeGlobsDraft !== settingsToText(settings.searchExcludeGlobs) ||
			importantDraft.join('\n') !== settings.importantDirectories.join('\n')
		);
	});

	const folderName = (path: string): string => pathSegments(path).at(-1)?.name ?? path;

	const fillDraft = (key: string | null) => {
		const found = projects.find((entry) => entry.id === key);
		const settings = found?.settings ?? defaultProjectSettings;
		selectedKey = key;
		nameDraft = found?.name ?? '';
		pathDraft = found?.path ?? '';
		testGlobsDraft = settingsToText(settings.testGlobs);
		excludeGlobsDraft = settingsToText(settings.searchExcludeGlobs);
		importantDraft = [...settings.importantDirectories];
		actionError = '';
		confirmingDelete = false;
	};

	const selectKey = (key: string) => {
		if (key === selectedKey) {
			return;
		}
		if (dirty && !window.confirm('Discard unsaved changes to this project?')) {
			return;
		}
		fillDraft(key);
	};

	const refreshProjects = async () => {
		projects = await projectsApi.list();
	};

	const loadServers = async () => {
		try {
			servers = await serversApi.list();
			serversError = '';
		} catch (caught) {
			serversError = `loading managed servers: ${(caught as Error).message}`;
		}
	};

	const draftPayload = () => ({
		name: nameDraft.trim(),
		path: pathDraft.trim(),
		settings: {
			testGlobs: textToSettings(testGlobsDraft),
			searchExcludeGlobs: textToSettings(excludeGlobsDraft),
			importantDirectories: importantDraft
		}
	});

	const runAction = async (action: () => Promise<string | null>) => {
		saving = true;
		actionError = '';
		try {
			const nextKey = await action();
			await refreshProjects();
			await projectsManager.changed();
			fillDraft(nextKey);
		} catch (caught) {
			actionError = (caught as Error).message;
		} finally {
			saving = false;
		}
	};

	const save = () =>
		runAction(async () => {
			if (creating) {
				return (await projectsApi.create(draftPayload())).id;
			}
			if (!selectedProject) {
				return null;
			}
			return (await projectsApi.update(selectedProject.id, draftPayload())).id;
		});

	const remove = () =>
		runAction(async () => {
			if (!selectedProject) {
				return null;
			}
			await projectsApi.remove(selectedProject.id);
			return projects.find((entry) => entry.id !== selectedProject.id)?.id ?? newProjectKey;
		});

	const onPicked = (picked: string) => {
		if (pickerMode === 'path') {
			pathDraft = picked;
			if (!nameDraft.trim() || creating) {
				nameDraft = folderName(picked);
			}
		} else if (pickerMode === 'important' && !importantDraft.includes(picked)) {
			importantDraft = [...importantDraft, picked];
		}
		pickerMode = null;
	};

	const removeImportant = (directory: string) => {
		importantDraft = importantDraft.filter((entry) => entry !== directory);
	};

	const close = () => {
		if (dirty && !window.confirm('Discard unsaved changes to this project?')) {
			return;
		}
		onClose();
	};

	onMount(() => {
		void loadServers();
		void (async () => {
			try {
				await refreshProjects();
				const focus = projectsManager.focusProjectId;
				const initial = projects.some((entry) => entry.id === focus)
					? focus
					: (projects[0]?.id ?? newProjectKey);
				fillDraft(initial);
			} catch (caught) {
				loadError = `loading projects: ${(caught as Error).message}`;
			} finally {
				loading = false;
			}
		})();
	});
</script>

<Modal title="Projects" label="Manage projects" maxWidth="1000px" locked={saving} onClose={close}>
	<div class="manager">
		<aside class="project-list">
			<button
				class="new-btn"
				class:active={creating}
				disabled={saving}
				onclick={() => selectKey(newProjectKey)}>+ New project</button
			>
			{#if loading}
				<div class="muted">Loading…</div>
			{:else if loadError}
				<div class="error">{loadError}</div>
			{/if}
			{#each projects as entry (entry.id)}
				<button
					class="list-item"
					class:active={entry.id === selectedKey}
					disabled={saving}
					onclick={() => selectKey(entry.id)}
				>
					<span class="list-name">{entry.name}</span>
					<span class="list-path">{entry.path}</span>
				</button>
			{/each}
		</aside>

		<section class="editor">
			{#if selectedKey === null}
				<div class="muted">{loading ? '' : 'Select a project.'}</div>
			{:else}
				<div class="field">
					<span class="label">Folder</span>
					<div class="path-row">
						<span class="path-value mono" class:empty={!pathDraft}
							>{pathDraft || 'No folder chosen'}</span
						>
						<button class="secondary-btn" disabled={saving} onclick={() => (pickerMode = 'path')}
							>{pathDraft ? 'Change…' : 'Choose folder…'}</button
						>
					</div>
				</div>

				<label class="field">
					<span class="label">Name</span>
					<input
						class="text-input"
						bind:value={nameDraft}
						placeholder={pathDraft ? folderName(pathDraft) : 'Defaults to the folder name'}
						disabled={saving}
					/>
				</label>

				<div class="settings-grid">
					<label class="field">
						<span class="label">Test globs</span>
						<span class="hint">Left out of code search unless “Include tests” is on.</span>
						<textarea
							class="text-input mono"
							rows="4"
							bind:value={testGlobsDraft}
							spellcheck="false"
							disabled={saving}
						></textarea>
					</label>

					<label class="field">
						<span class="label">Search excludes</span>
						<span class="hint">Always left out of code search, on top of .gitignore.</span>
						<textarea
							class="text-input mono"
							rows="4"
							bind:value={excludeGlobsDraft}
							spellcheck="false"
							disabled={saving}
						></textarea>
					</label>
				</div>

				<div class="field">
					<span class="label">Important directories</span>
					<span class="hint">Folders inside the project to surface first.</span>
					<div class="chips">
						{#each importantDraft as directory (directory)}
							<span class="chip mono"
								>{directory}<button
									class="chip-remove"
									aria-label="Remove {directory}"
									disabled={saving}
									onclick={() => removeImportant(directory)}>×</button
								></span
							>
						{/each}
						<button
							class="secondary-btn small"
							disabled={saving || !pathDraft || creating}
							title={creating ? 'Create the project first' : ''}
							onclick={() => (pickerMode = 'important')}>+ Add directory</button
						>
					</div>
				</div>

				{#if selectedProject}
					<div class="field">
						<span class="label">Servers</span>
						{#if serversError}
							<span class="error">{serversError}</span>
						{:else if linkedServers.length === 0}
							<span class="hint">No managed servers run from this folder.</span>
						{:else}
							<ul class="server-list">
								{#each linkedServers as server (server.id)}
									<li class="server-item">
										<span
											class="status-dot"
											class:running={server.status.process.state === 'running'}
										></span>
										<span class="server-alias">{server.alias}</span>
										<span class="server-port mono">:{server.port}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}

				{#if actionError}
					<div class="error action-error">{actionError}</div>
				{/if}
			{/if}
		</section>
	</div>

	{#snippet footer()}
		{#if selectedProject}
			{#if confirmingDelete}
				<span class="confirm-text"
					>Delete “{selectedProject.name}” and its Full Review history?</span
				>
				<button class="danger-btn" disabled={saving} onclick={remove}>Delete</button>
				<button class="secondary-btn" disabled={saving} onclick={() => (confirmingDelete = false)}
					>Keep</button
				>
			{:else}
				<button class="danger-link" disabled={saving} onclick={() => (confirmingDelete = true)}
					>Delete project</button
				>
			{/if}
		{/if}
		<span class="spacer"></span>
		{#if dirty && !creating}
			<button class="secondary-btn" disabled={saving} onclick={() => fillDraft(selectedKey)}
				>Revert</button
			>
		{/if}
		<button class="primary-btn" disabled={saving || !dirty} onclick={save}>
			{#if saving}Saving…{:else if creating}Add project{:else}Save{/if}
		</button>
	{/snippet}
</Modal>

{#if pickerMode}
	<DirectoryPickerModal
		title={pickerMode === 'path' ? 'Choose project folder' : 'Choose an important directory'}
		initialPath={pickerMode === 'path' ? pathDraft || null : null}
		root={pickerMode === 'important' ? pathDraft : null}
		onPick={onPicked}
		onClose={() => (pickerMode = null)}
	/>
{/if}

<style>
	.mono {
		font-family: 'Courier New', monospace;
	}

	.manager {
		display: grid;
		grid-template-columns: 260px 1fr;
		height: 68vh;
		min-height: 0;
	}

	.project-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0.5rem;
		border-right: 1px solid var(--border);
		overflow-y: auto;
		min-height: 0;
	}

	.new-btn {
		margin-bottom: 0.375rem;
		padding: 0.45rem 0.625rem;
		border: 1px dashed var(--border);
		border-radius: 6px;
		color: var(--text-muted);
		font-size: 0.8rem;
		text-align: left;
	}

	.new-btn:hover:not(:disabled),
	.new-btn.active {
		border-color: var(--accent-muted);
		color: var(--accent);
		background: var(--accent-soft);
	}

	.list-item {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		padding: 0.4rem 0.625rem;
		border-radius: 5px;
		border-left: 2px solid transparent;
		text-align: left;
	}

	.list-item:hover:not(:disabled) {
		background: var(--accent-soft);
	}

	.list-item.active {
		background: var(--accent-bg);
		border-left-color: var(--accent);
	}

	.list-name {
		color: var(--text-2);
		font-size: 0.82rem;
		font-weight: 600;
	}

	.list-path {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-ghost);
		font-family: 'Courier New', monospace;
		font-size: 0.68rem;
	}

	.editor {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 1.25rem;
		overflow-y: auto;
		min-height: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.label {
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.hint {
		color: var(--text-dim);
		font-size: 0.75rem;
	}

	.path-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.path-value {
		flex: 1;
		min-width: 0;
		padding: 0.4rem 0.625rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-2);
		font-size: 0.8rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.path-value.empty {
		color: var(--text-ghost);
	}

	.text-input {
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		font-size: 0.82rem;
		padding: 0.4rem 0.625rem;
		resize: vertical;
	}

	.text-input:focus {
		outline: none;
		border-color: var(--accent-muted);
	}

	.settings-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.25rem 0.15rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		color: var(--text-2);
		font-size: 0.75rem;
	}

	.chip-remove {
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 50%;
		color: var(--text-ghost);
		line-height: 1;
	}

	.chip-remove:hover:not(:disabled) {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.server-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.server-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.status-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--text-faint);
	}

	.status-dot.running {
		background: var(--success-strong);
	}

	.server-port {
		color: var(--text-dim);
	}

	.muted {
		padding: 0.5rem;
		color: var(--text-dim);
		font-size: 0.8rem;
	}

	.error {
		color: var(--accent);
		font-size: 0.8rem;
		white-space: pre-wrap;
	}

	.action-error {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		background: var(--accent-bg);
	}

	.spacer {
		flex: 1;
	}

	.confirm-text {
		color: var(--text-2);
		font-size: 0.8rem;
	}

	.primary-btn,
	.secondary-btn,
	.danger-btn {
		padding: 0.375rem 0.875rem;
		border-radius: 5px;
		border: 1px solid var(--border);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.secondary-btn {
		color: var(--text-muted);
	}

	.secondary-btn.small {
		padding: 0.15rem 0.625rem;
		border-radius: 999px;
		font-size: 0.75rem;
	}

	.secondary-btn:hover:not(:disabled) {
		color: var(--text-2);
		border-color: var(--accent-muted);
	}

	.primary-btn {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--accent);
		font-weight: 600;
	}

	.danger-btn {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--bg);
		font-weight: 600;
	}

	.danger-link {
		color: var(--text-dim);
		font-size: 0.78rem;
	}

	.danger-link:hover:not(:disabled) {
		color: var(--accent);
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
