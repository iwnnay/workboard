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

		--diff-text: var(--text-2);
		--diff-context-text: #ffecec;

		--diff-add-text: #9de8b0;
		--diff-add-bg: #071507;
		--diff-add-gutter-bg: #0a1f0a;
		--diff-add-gutter-text: #4a8f5a;
		--diff-add-strong: #4ade80;

		--diff-del-text: #e8a0a0;
		--diff-del-bg: #1e0505;
		--diff-del-gutter-bg: #2a0808;
		--diff-del-gutter-text: #8f4a4a;
		--diff-del-strong: var(--accent);

		--diff-incremental-add-bg: #092724;
		--diff-incremental-add-gutter-bg: #0d3530;
		--diff-incremental-add-text: #76e6d5;
		--diff-incremental-del-bg: #301805;
		--diff-incremental-del-gutter-bg: #442208;
		--diff-incremental-del-text: #f3b562;

		--diff-hunk-bg: #0d1a0d;
		--diff-hunk-text: #4a8f5a;

		--diff-untracked-text: #c9a84c;
		--diff-untracked-bg: #0f0e02;
		--diff-untracked-border: #2a2508;

		--diff-highlight-bg: rgba(250, 220, 80, 0.28);
		--diff-highlight-outline: rgba(250, 220, 80, 0.4);
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
