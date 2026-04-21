<script lang="ts">
	import Clock from '$lib/components/Clock.svelte';
	import TodoList from '$lib/components/TodoList.svelte';
	import NotesAside from '$lib/components/NotesAside.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<aside class="left-aside"></aside>

<main class="center">
	<div class="clocks">
		<Clock timezone="America/Chicago" label="Central Time" large />
		<Clock timezone="America/New_York" label="Eastern Time" />
	</div>

	<div class="todo-container">
		<TodoList todos={data.todos} />
	</div>
</main>

<aside class="right-aside">
	<NotesAside notes={data.notes} />
</aside>

<style>
	.left-aside {
		grid-area: left;
		padding: 1rem;
	}

	.center {
		grid-area: center;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
	}

	.clocks {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.todo-container {
		width: 100%;
		max-width: 500px;
	}

	.right-aside {
		grid-area: right;
		padding: 1rem;
	}
</style>
