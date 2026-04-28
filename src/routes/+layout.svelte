<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Workboard</title>
</svelte:head>

{@render children()}

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		background: #0f172a;
		color: #e2e8f0;
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
		background: #334155;
		border-radius: 3px;
	}
</style>
