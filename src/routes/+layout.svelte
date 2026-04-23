<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>FocusToo</title>
</svelte:head>

<div class="app">
	{@render children()}
</div>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(html, body) {
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
	}

	:global(body) {
		background: #0b0d11;
		color: #e7e9ef;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		font-size: 15px;
		line-height: 1.5;
	}

	.app {
		width: 100%;
		height: 100%;
	}

	::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	::-webkit-scrollbar-track {
		background: rgba(255,255,255,0.04);
	}

	::-webkit-scrollbar-thumb {
		background: rgba(255,255,255,0.12);
		border-radius: 4px;
	}

	::-webkit-scrollbar-thumb:hover {
		background: rgba(255,255,255,0.2);
	}

	@media (prefers-color-scheme: light) {
		:global(body) {
			background: #f2f3f7;
			color: #1a1c23;
		}
	}
</style>
