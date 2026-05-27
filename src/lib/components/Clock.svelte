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

	function fmtElapsed(from: Date, now: Date) {
		const totalSeconds = Math.floor((now.getTime() - from.getTime()) / 1000);
		const h = Math.floor(totalSeconds / 3600);
		const m = Math.floor((totalSeconds % 3600) / 60);
		const s = totalSeconds % 60;
		const mm = String(m).padStart(2, '0');
		const ss = String(s).padStart(2, '0');
		return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
	}
</script>

<div class="clock">
	<button class="time" onclick={() => (lastClicked = new Date())}>
		{fmt(time)}
	</button>
	{#if lastClicked}
		<p class="last-clicked">{fmtElapsed(lastClicked, time)} ago</p>
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
		font-family: 'Courier New', monospace;
	}
</style>
