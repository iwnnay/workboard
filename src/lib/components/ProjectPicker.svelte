<script lang="ts">
	import { projectsManager } from '$lib/projects-manager.svelte';
	import type { Project } from '$lib/types';

	let {
		projects,
		selectedId,
		onSelect,
		defaultOption = null,
		placeholder = 'Select project'
	}: {
		projects: Project[];
		selectedId: string;
		onSelect: (projectId: string) => void;
		defaultOption?: { label: string; path: string } | null;
		placeholder?: string;
	} = $props();

	let open = $state(false);

	const selectedProject = $derived(projects.find((entry) => entry.id === selectedId) ?? null);
	const buttonLabel = $derived(
		selectedProject?.name ?? (defaultOption && !selectedId ? defaultOption.label : placeholder)
	);
	const buttonTitle = $derived(
		selectedProject?.path ?? (defaultOption && !selectedId ? defaultOption.path : '')
	);

	const choose = (projectId: string) => {
		open = false;
		if (projectId !== selectedId) {
			onSelect(projectId);
		}
	};

	const manage = () => {
		open = false;
		projectsManager.show(selectedId || null);
	};
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && open && (open = false)} />

{#if open}
	<div class="picker-backdrop" role="presentation" onclick={() => (open = false)}></div>
{/if}

<div class="picker">
	<button
		class="picker-btn"
		class:open
		onclick={() => (open = !open)}
		title={buttonTitle}
		aria-haspopup="listbox"
		aria-expanded={open}
	>
		<span class="picker-name">{buttonLabel}</span>
		<span class="picker-chevron">▾</span>
	</button>

	{#if open}
		<div class="picker-menu" role="listbox" aria-label="Projects">
			{#if defaultOption}
				<button
					class="picker-option"
					class:active={!selectedId}
					role="option"
					aria-selected={!selectedId}
					onclick={() => choose('')}
				>
					<span class="option-name">{defaultOption.label}</span>
					<span class="option-path">{defaultOption.path}</span>
				</button>
				{#if projects.length > 0}<div class="picker-divider"></div>{/if}
			{/if}

			{#each projects as entry (entry.id)}
				<button
					class="picker-option"
					class:active={entry.id === selectedId}
					role="option"
					aria-selected={entry.id === selectedId}
					onclick={() => choose(entry.id)}
				>
					<span class="option-name">{entry.name}</span>
					<span class="option-path">{entry.path}</span>
				</button>
			{/each}

			{#if !defaultOption && projects.length === 0}
				<div class="picker-empty">No projects yet.</div>
			{/if}

			<div class="picker-divider"></div>
			<button class="picker-manage" onclick={manage}>Manage projects…</button>
		</div>
	{/if}
</div>

<style>
	.picker-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
	}

	.picker {
		position: relative;
		z-index: 41;
	}

	.picker-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: 260px;
		padding: 0.35rem 0.75rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text-2);
		font-size: 0.82rem;
	}

	.picker-btn:hover,
	.picker-btn.open {
		border-color: var(--accent-muted);
		color: var(--text);
	}

	.picker-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}

	.picker-chevron {
		color: var(--text-ghost);
		font-size: 0.7rem;
	}

	.picker-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		min-width: 320px;
		max-width: 480px;
		max-height: 60vh;
		overflow-y: auto;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.375rem;
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6);
	}

	.picker-option {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		width: 100%;
		padding: 0.4rem 0.625rem;
		border-radius: 5px;
		text-align: left;
	}

	.picker-option:hover {
		background: var(--accent-soft);
	}

	.picker-option.active {
		background: var(--accent-bg);
	}

	.option-name {
		color: var(--text-2);
		font-size: 0.82rem;
		font-weight: 600;
	}

	.picker-option.active .option-name {
		color: var(--accent);
	}

	.option-path {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-ghost);
		font-family: 'Courier New', monospace;
		font-size: 0.7rem;
	}

	.picker-divider {
		height: 1px;
		margin: 0.3rem 0.25rem;
		background: var(--border);
	}

	.picker-empty {
		padding: 0.5rem 0.625rem;
		color: var(--text-dim);
		font-size: 0.8rem;
	}

	.picker-manage {
		width: 100%;
		padding: 0.4rem 0.625rem;
		border-radius: 5px;
		text-align: left;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.picker-manage:hover {
		background: var(--accent-bg);
		color: var(--accent);
	}
</style>
