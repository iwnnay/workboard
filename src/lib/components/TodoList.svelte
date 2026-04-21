<script lang="ts">
	interface Todo {
		id: string;
		title: string;
		completed: boolean;
		priority: number;
	}

	interface Props {
		todos: Todo[];
	}

	let { todos }: Props = $props();

	let completedTodos = $derived(todos.filter((t) => t.completed));
	let activeTodos = $derived(todos.filter((t) => !t.completed));

	let newTodoTitle = $state('');

	async function addTodo(e: Event) {
		e.preventDefault();
		if (!newTodoTitle.trim()) return;

		await fetch('/api/todos', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: newTodoTitle })
		});

		newTodoTitle = '';
		window.location.reload();
	}

	async function toggleTodo(id: string, completed: boolean) {
		await fetch(`/api/todos/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ completed })
		});
		window.location.reload();
	}

	async function removeTodo(id: string) {
		await fetch(`/api/todos/${id}`, { method: 'DELETE' });
		window.location.reload();
	}
</script>

<div class="todo-list">
	<h2>Tasks</h2>

	<form onsubmit={addTodo}>
		<input type="text" placeholder="Add a task..." bind:value={newTodoTitle} />
	</form>

	<ul>
		{#each activeTodos as todo (todo.id)}
			<li>
				<label>
					<input type="checkbox" checked={false} onchange={() => toggleTodo(todo.id, true)} />
					<span>{todo.title}</span>
				</label>
				<button class="delete" onclick={() => removeTodo(todo.id)}>×</button>
			</li>
		{/each}
	</ul>

	{#if completedTodos.length > 0}
		<div class="completed-section">
			<h3>Completed</h3>
			<ul>
				{#each completedTodos as todo (todo.id)}
					<li class="completed">
						<label>
							<input type="checkbox" checked={true} onchange={() => toggleTodo(todo.id, false)} />
							<span>{todo.title}</span>
						</label>
						<button class="delete" onclick={() => removeTodo(todo.id)}>×</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.todo-list {
		background: white;
		border-radius: 8px;
		padding: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	h2 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	input[type='text'] {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	input[type='text']:focus {
		outline: none;
		border-color: #666;
	}

	ul {
		list-style: none;
		margin-top: 1rem;
	}

	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid #eee;
	}

	li:last-child {
		border-bottom: none;
	}

	li label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		flex: 1;
	}

	li.completed span {
		text-decoration: line-through;
		color: #999;
	}

	.completed-section {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid #eee;
	}

	.completed-section h3 {
		font-size: 0.85rem;
		font-weight: 500;
		color: #666;
		margin-bottom: 0.5rem;
	}

	.completed-section ul {
		margin-top: 0;
	}

	.delete {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		color: #999;
		padding: 0 0.25rem;
	}

	.delete:hover {
		color: #f00;
	}
</style>
