<script lang="ts">
	import Clock from "$lib/components/Clock.svelte";
	import TodoList from "$lib/components/TodoList.svelte";
	import NotesAside from "$lib/components/NotesAside.svelte";
</script>

<div class="dashboard">
	<div class="col empty"></div>
	<div class="col center">
		<div class="clocks">
			<Clock label="Central Time" timezone="America/Chicago" />
			<Clock label="Eastern Time" timezone="America/New_York" />
		</div>
		<TodoList />
	</div>
	<div class="col right">
		<NotesAside />
	</div>
</div>

<style>
	.dashboard {
		display: grid;
		grid-template-columns: 1fr minmax(0, 720px) 280px;
		gap: 1rem;
		padding: 1rem;
		height: 100vh;
		box-sizing: border-box;
	}

	.col {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.empty {
		display: none;
	}

	@media (min-width: 1200px) {
		.empty {
			display: flex;
		}
	}

	.center {
		gap: 1rem;
		overflow-y: auto;
	}

	.right {
		padding-right: 0.5rem;
	}

	.clocks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.75rem;
	}

	@media (max-width: 860px) {
		.dashboard {
			grid-template-columns: 1fr minmax(0, 1fr) 220px;
			gap: 0.75rem;
			padding: 0.75rem;
		}
	}

	@media (max-width: 640px) {
		.dashboard {
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}
		.empty,
		.right {
			display: none;
		}
	}
</style>
