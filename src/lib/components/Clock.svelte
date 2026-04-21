<script lang="ts">
	interface Props {
		timezone: string;
		label: string;
		large?: boolean;
	}

	let { timezone, label, large = false }: Props = $props();

	let now = $state(new Date());

	$effect(() => {
		const interval = setInterval(() => {
			now = new Date();
		}, 1000);
		return () => clearInterval(interval);
	});

	const time = $derived(
		now.toLocaleTimeString('en-US', {
			timeZone: timezone,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		})
	);
</script>

<div class="clock" class:large>
	<span class="time">{time}</span>
	<span class="label">{label}</span>
</div>

<style>
	.clock {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.time {
		font-size: 1.5rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	.clock.large .time {
		font-size: 3rem;
		font-weight: 700;
	}

	.label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #666;
	}
</style>