<script lang="ts">
	import Clock from '$lib/components/Clock.svelte';
	import ReminderModal from '$lib/components/ReminderModal.svelte';
	import TodoList from '$lib/components/TodoList.svelte';
	import NotesPanel from '$lib/components/NotesPanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let reminderOpen = $state(false);
</script>

<div class="dashboard">
	<aside class="left-col">
		<Clock />
		<button class="reminder-btn" onclick={() => (reminderOpen = true)}>Reminder</button>
		<TodoList initialTodos={data.todos} />
	</aside>

	<main class="right-col">
		<NotesPanel initialNotes={data.notes} />
	</main>
</div>

<ReminderModal bind:open={reminderOpen} />

<style>
	.dashboard {
		display: grid;
		grid-template-columns: 300px 1fr;
		height: 100dvh;
		overflow: hidden;
	}

	.left-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem;
		border-right: 1px solid #1e293b;
		overflow-y: auto;
	}

	.right-col {
		overflow: hidden;
		background: #080e1a;
	}

	.reminder-btn {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: #1e293b;
		border: 1px solid #2d3748;
		border-radius: 6px;
		color: #64748b;
		text-align: left;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.reminder-btn:hover {
		background: #263448;
		color: #94a3b8;
	}
</style>
