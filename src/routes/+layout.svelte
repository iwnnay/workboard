<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import NavDrawer from '$lib/components/NavDrawer.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Workboard</title>
</svelte:head>

{@render children()}
<NavDrawer />

<style>
	:global(:root) {
		--bg: #0e0404;
		--bg-2: #0b0303;
		--surface: #180808;
		--surface-2: #1e0b0b;
		--border: #2d1212;
		--border-2: #180808;
		--accent: #ef4444;
		--accent-muted: #7f1d1d;
		--accent-bg: #2d0a0a;
		--text: #f5eaea;
		--text-2: #e0c0c0;
		--text-muted: #c48888;
		--text-dim: #a06060;
		--text-ghost: #6e4040;
		--text-faint: #3f2020;
	}

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
