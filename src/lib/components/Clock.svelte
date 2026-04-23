<script lang="ts">
	interface Props {
		label: string;
		timezone: string;
		canSwap?: boolean;
	}

	let { label, timezone, canSwap = false }: Props = $props();

	let timeStr = $state("");
	let currentLabel = $state(label);
	let currentTimezone = $state(timezone);
	let isSwapped = $state(false);

	const SWAP_DURATION = 3500;

	function update() {
		timeStr = new Date().toLocaleTimeString("en-US", {
			timeZone: currentTimezone,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	$effect(() => {
		update();
		const interval = setInterval(update, 1000);
		return () => clearInterval(interval);
	});

	function handleClick() {
		if (!canSwap || isSwapped) return;
		isSwapped = true;
		currentLabel = "Eastern Time";
		currentTimezone = "America/New_York";
		update();
		setTimeout(() => {
			isSwapped = false;
			currentLabel = label;
			currentTimezone = timezone;
			update();
		}, SWAP_DURATION);
	}
</script>

{#if canSwap}
	<button class="clock interactive" onclick={handleClick} aria-label="Show Eastern Time briefly">
		<span class="clock-label">{currentLabel}</span>
		<span class="clock-time">{timeStr}</span>
	</button>
{:else}
	<div class="clock">
		<span class="clock-label">{label}</span>
		<span class="clock-time">{timeStr}</span>
	</div>
{/if}

<style>
	.clock {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 0.5rem 0.75rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		color: inherit;
		font: inherit;
		cursor: default;
		min-width: 0;
		flex: 1 1 0;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	.clock.interactive {
		cursor: pointer;
	}

	.clock.interactive:hover {
		background: rgba(168, 237, 255, 0.08);
		border-color: rgba(168, 237, 255, 0.25);
	}

	.clock-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.55;
	}

	.clock-time {
		font-size: 0.95rem;
		font-weight: 500;
		letter-spacing: 0.03em;
		opacity: 0.85;
	}
</style>
