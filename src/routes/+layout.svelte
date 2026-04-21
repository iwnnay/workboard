<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Focused Todo</title>
</svelte:head>

<div class="app">
	{@render children()}
</div>

<style>
	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		background: #f5f5f5;
		color: #333;
	}

	.app {
		display: grid;
		grid-template-columns: 1fr 280px;
		grid-template-areas: 'center right';
		min-height: 100vh;
	}

	@media (max-width: 768px) {
		.app {
			grid-template-columns: 1fr;
			grid-template-areas:
				'center'
				'right';
		}
	}
</style>
