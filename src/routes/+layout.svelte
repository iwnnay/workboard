<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import NavDrawer from '$lib/components/NavDrawer.svelte';
	import ProjectsModal from '$lib/components/ProjectsModal.svelte';
	import { projectsManager } from '$lib/projects-manager.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Workboard</title>
</svelte:head>

{@render children()}
<NavDrawer />

{#if projectsManager.open}
	<ProjectsModal onClose={projectsManager.hide} />
{/if}

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		background: var(--bg);
		color: var(--text);
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 14px;
		line-height: 1.5;
	}

	:global(button) {
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
		background: none;
		border: none;
		appearance: none;
	}

	:global(input, textarea) {
		font-family: inherit;
		font-size: inherit;
	}

	:global(::-webkit-scrollbar) {
		width: 5px;
	}

	:global(::-webkit-scrollbar-track) {
		background: transparent;
	}

	:global(::-webkit-scrollbar-thumb) {
		background: var(--border);
		border-radius: 3px;
	}
</style>
