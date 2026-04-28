<script lang="ts">
	let time = $state(new Date());
	let lastClicked = $state<Date | null>(null);

	$effect(() => {
		const interval = setInterval(() => {
			time = new Date();
		}, 1000);
		return () => clearInterval(interval);
	});

	function fmt(d: Date) {
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}
</script>

<div class="clock">
	<button class="time" onclick={() => (lastClicked = new Date())}>
		{fmt(time)}
	</button>
	{#if lastClicked}
		<p class="last-clicked">Last clicked at: {fmt(lastClicked)}</p>
	{/if}
</div>

<style>
	.clock {
		padding-bottom: 0.25rem;
	}

	.time {
		background: none;
		border: none;
		color: var(--text-dim);
		font-size: 0.8125rem;
		font-family: 'Courier New', monospace;
		letter-spacing: 0.04em;
		padding: 0;
		transition: color 0.15s;
	}

	.time:hover {
		color: var(--text-muted);
	}

	.last-clicked {
		font-size: 0.6875rem;
		color: var(--text-ghost);
		margin-top: 0.2rem;
	}
</style>
