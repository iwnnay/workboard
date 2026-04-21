<script lang="ts">
	interface CalendarEvent {
		id: string;
		title: string;
		startTime: Date;
		endTime: Date;
		location?: string;
		isAllDay: boolean;
	}

	interface Props {
		events: CalendarEvent[];
	}

	let { events }: Props = $props();

	function formatTime(date: Date): string {
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	function formatDate(date: Date): string {
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		if (date.toDateString() === today.toDateString()) {
			return 'Today';
		}
		if (date.toDateString() === tomorrow.toDateString()) {
			return 'Tomorrow';
		}
		return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}
</script>

<aside class="calendar-aside">
	<div class="header">
		<h2>Calendar</h2>
		<button class="sync">↻</button>
	</div>

	<div class="events">
		{#if events.length === 0}
			<p class="empty">No upcoming events</p>
		{:else}
			{#each events as event (event.id)}
				<div class="event">
					<div class="event-time">
						{#if event.isAllDay}
							<span class="all-day">All day</span>
						{:else}
							<span>{formatTime(event.startTime)}</span>
							<span class="separator">-</span>
							<span>{formatTime(event.endTime)}</span>
						{/if}
					</div>
					<div class="event-title">{event.title}</div>
					{#if event.location}
						<div class="event-location">{event.location}</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<p class="note">Connect to Outlook to see your calendar</p>
</aside>

<style>
	.calendar-aside {
		background: white;
		border-radius: 8px;
		padding: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		height: fit-content;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	h2 {
		font-size: 1rem;
		font-weight: 600;
	}

	.sync {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		color: #666;
	}

	.events {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.empty {
		color: #999;
		font-size: 0.875rem;
		text-align: center;
		padding: 1rem 0;
	}

	.event {
		padding: 0.5rem;
		background: #f9f9f9;
		border-radius: 4px;
	}

	.event-time {
		font-size: 0.75rem;
		color: #666;
		display: flex;
		gap: 0.25rem;
	}

	.all-day {
		font-weight: 500;
	}

	.event-title {
		font-weight: 500;
		font-size: 0.875rem;
		margin-top: 0.25rem;
	}

	.event-location {
		font-size: 0.75rem;
		color: #999;
		margin-top: 0.25rem;
	}

	.note {
		font-size: 0.75rem;
		color: #999;
		text-align: center;
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid #eee;
	}
</style>