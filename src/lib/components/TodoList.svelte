<script lang="ts">
	interface Subtask {
		id: string;
		taskId: string;
		title: string;
		completed: boolean;
	}

	interface Todo {
		id: string;
		title: string;
		completed: boolean;
		priority: number;
		subtasks: Subtask[];
	}

	interface Props {
		todos: Todo[];
	}

	let { todos }: Props = $props();

	let completedTodos = $derived(todos.filter((t) => t.completed));
	let activeTodos = $derived(todos.filter((t) => !t.completed));

	let newTodoTitle = $state('');
	let expandedTasks = $state<Set<string>>(
		new Set(
			typeof sessionStorage !== 'undefined'
				? JSON.parse(sessionStorage.getItem('expandedTasks') || '[]')
				: []
		)
	);
	let newSubtaskTitles = $state<Record<string, string>>({});
	let mainInputEl = $state<HTMLInputElement | null>(null);
	let subtaskInputEls = $state<Record<string, HTMLInputElement>>({});
	let focusedTaskId = $state<string | null>(
		typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('focusSubtaskTaskId') : null
	);
	if (focusedTaskId && typeof window !== 'undefined') {
		sessionStorage.removeItem('focusSubtaskTaskId');
		$effect(() => {
			if (focusedTaskId && subtaskInputEls[focusedTaskId]) {
				subtaskInputEls[focusedTaskId]?.focus();
			}
		});
	}

	function toggleExpand(taskId: string) {
		const newSet = new Set(expandedTasks);
		if (newSet.has(taskId)) {
			newSet.delete(taskId);
		} else {
			newSet.add(taskId);
		}
		expandedTasks = newSet;
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem('expandedTasks', JSON.stringify([...newSet]));
		}
	}

	function isExpanded(taskId: string) {
		return expandedTasks.has(taskId);
	}

	function hasSubtasks(todo: Todo) {
		return todo.subtasks && todo.subtasks.length > 0;
	}

	function allSubtasksCompleted(todo: Todo) {
		return todo.subtasks.length > 0 && todo.subtasks.every((s) => s.completed);
	}

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

	async function addSubtask(e: Event, taskId: string) {
		e.preventDefault();
		const title = newSubtaskTitles[taskId];
		if (!title?.trim()) return;

		await fetch('/api/todos/subtasks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ taskId, title })
		});

		newSubtaskTitles[taskId] = '';
		sessionStorage.setItem('focusSubtaskTaskId', taskId);
		window.location.reload();
	}

	async function toggleSubtask(id: string, completed: boolean) {
		await fetch(`/api/todos/subtasks/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ completed })
		});
		window.location.reload();
	}

	async function removeSubtask(id: string) {
		await fetch(`/api/todos/subtasks/${id}`, { method: 'DELETE' });
		window.location.reload();
	}
</script>

<div class="todo-list">
	<h2>Tasks</h2>

	<form onsubmit={addTodo}>
		<input
			type="text"
			placeholder="Add a task..."
			bind:value={newTodoTitle}
			bind:this={mainInputEl}
		/>
	</form>

	<ul>
		{#each activeTodos as todo (todo.id)}
			<li class:has-subtasks={hasSubtasks(todo)}>
				<div class="task-row">
					{#if hasSubtasks(todo)}
						<button
							class="expand-btn"
							class:expanded={isExpanded(todo.id)}
							onclick={() => toggleExpand(todo.id)}
							aria-label={isExpanded(todo.id) ? 'Collapse' : 'Expand'}
						>
							{isExpanded(todo.id) ? '▼' : '▶'}
						</button>
					{/if}
					<label>
						<input
							type="checkbox"
							checked={allSubtasksCompleted(todo)}
							onchange={() => toggleTodo(todo.id, !allSubtasksCompleted(todo))}
						/>
						<span>{todo.title}</span>
					</label>
					<button
						class="add-subtask-btn"
						onclick={() => {
							newSubtaskTitles[todo.id] = '';
							toggleExpand(todo.id);
						}}>+</button
					>
					<button class="delete" onclick={() => removeTodo(todo.id)}>×</button>
				</div>
				{#if isExpanded(todo.id)}
					<div class="subtask-container">
						<div class="subtask-header">
							<form class="subtask-form" onsubmit={(e) => addSubtask(e, todo.id)}>
								<input
									type="text"
									placeholder="Add subtask..."
									bind:value={newSubtaskTitles[todo.id]}
									bind:this={subtaskInputEls[todo.id]}
								/>
							</form>
						</div>
						{#if todo.subtasks.length > 0}
							<ul class="subtask-list">
								{#each todo.subtasks as subtask (subtask.id)}
									<li class="subtask-item">
										<label>
											<input
												type="checkbox"
												checked={subtask.completed}
												onchange={() => toggleSubtask(subtask.id, !subtask.completed)}
											/>
											<span>{subtask.title}</span>
										</label>
										<button class="delete" onclick={() => removeSubtask(subtask.id)}>×</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	{#if completedTodos.length > 0}
		<div class="completed-section">
			<h3>Completed</h3>
			<ul>
				{#each completedTodos as todo (todo.id)}
					<li class="completed">
						<div class="task-row">
							{#if hasSubtasks(todo)}
								<button
									class="expand-btn"
									class:expanded={isExpanded(todo.id)}
									onclick={() => toggleExpand(todo.id)}
									aria-label={isExpanded(todo.id) ? 'Collapse' : 'Expand'}
								>
									{isExpanded(todo.id) ? '▼' : '▶'}
								</button>
							{/if}
							<label>
								<input type="checkbox" checked={true} onchange={() => toggleTodo(todo.id, false)} />
								<span>{todo.title}</span>
							</label>
							<button class="delete" onclick={() => removeTodo(todo.id)}>×</button>
						</div>
						{#if isExpanded(todo.id) && todo.subtasks.length > 0}
							<div class="subtask-container">
								<ul class="subtask-list">
									{#each todo.subtasks as subtask (subtask.id)}
										<li class="subtask-item">
											<label>
												<input
													type="checkbox"
													checked={subtask.completed}
													onchange={() => toggleSubtask(subtask.id, !subtask.completed)}
												/>
												<span>{subtask.title}</span>
											</label>
											<button class="delete" onclick={() => removeSubtask(subtask.id)}>×</button>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
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
		flex-direction: column;
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

	li.has-subtasks > .task-row > label > span {
		font-weight: 500;
	}

	.task-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	.subtask-container {
		width: 100%;
		margin-top: 0.5rem;
		padding-left: 1.5rem;
		border-left: 2px solid #e0e0e0;
	}

	.subtask-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.expand-btn {
		background: none;
		border: none;
		font-size: 0.7rem;
		cursor: pointer;
		color: #666;
		padding: 0.25rem;
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.expand-btn:hover {
		background: #f0f0f0;
		border-radius: 3px;
	}

	.add-subtask-btn {
		background: none;
		border: none;
		font-size: 1rem;
		cursor: pointer;
		color: #999;
		padding: 0 0.25rem;
	}

	.add-subtask-btn:hover {
		color: #333;
	}

	.subtask-container {
		width: 100%;
		margin-top: 0.5rem;
		padding-left: 1.5rem;
		border-left: 2px solid #e0e0e0;
	}

	.subtask-form {
		margin-bottom: 0.25rem;
	}

	.subtask-form input {
		width: 100%;
		padding: 0.35rem;
		border: 1px solid #eee;
		border-radius: 4px;
		font-size: 0.85rem;
	}

	.subtask-form input:focus {
		outline: none;
		border-color: #999;
	}

	.subtask-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.subtask-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding: 0.35rem 0;
		border-bottom: 1px solid #f5f5f5;
	}

	.subtask-item:last-child {
		border-bottom: none;
	}

	.subtask-item > label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.subtask-item > label > span {
		font-size: 0.9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
