<script lang="ts">
	import type { Todo } from '$lib/types';
	import { untrack } from 'svelte';

	let { initialTodos }: { initialTodos: Todo[] } = $props();

	let todos = $state<Todo[]>(untrack(() => initialTodos));
	let newText = $state('');
	let inputEl: HTMLInputElement;

	const active = $derived(todos.filter((t) => !t.completed));
	const completed = $derived(
		todos
			.filter((t) => t.completed)
			.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
	);

	async function addTodo() {
		const text = newText.trim();
		if (!text) return;
		const res = await fetch('/api/todos', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text })
		});
		const created: Todo = await res.json();
		todos = [...todos, created];
		newText = '';
		inputEl?.focus();
	}

	async function toggleTodo(item: Todo) {
		const nowCompleted = !item.completed;
		const res = await fetch(`/api/todos/${item.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				completed: nowCompleted,
				completedAt: nowCompleted ? new Date().toISOString() : null
			})
		});
		const updated: Todo = await res.json();
		todos = todos.map((t) => (t.id === updated.id ? updated : t));
	}

	async function deleteTodo(id: string) {
		await fetch(`/api/todos/${id}`, { method: 'DELETE' });
		todos = todos.filter((t) => t.id !== id);
	}
</script>

<section class="section">
	<h3 class="section-label">To Do</h3>

	<input
		bind:this={inputEl}
		bind:value={newText}
		onkeydown={(e) => e.key === 'Enter' && addTodo()}
		placeholder="Add new item..."
		class="add-input"
	/>

	<ul class="list">
		{#each active as item (item.id)}
			<li class="item">
				<label class="item-label" data-tip={item.text}>
					<input class="check" type="checkbox" onchange={() => toggleTodo(item)} />
					<span>{item.text}</span>
				</label>
				<button class="del" onclick={() => deleteTodo(item.id)} aria-label="Delete">×</button>
			</li>
		{/each}
		{#if active.length === 0}
			<li class="empty">Nothing pending.</li>
		{/if}
	</ul>

	{#if completed.length > 0}
		<div class="completed-group">
			<h4 class="completed-label">Completed</h4>
			<ul class="list">
				{#each completed as item (item.id)}
					<li class="item done">
						<label class="item-label" data-tip={item.text}>
							<input class="check" type="checkbox" checked onchange={() => toggleTodo(item)} />
							<span>{item.text}</span>
						</label>
						<button class="del" onclick={() => deleteTodo(item.id)} aria-label="Delete">×</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>

<style>
	.section {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-height: 0;
	}

	.section-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-ghost);
	}

	.add-input {
		background: var(--surface);
		border: 1px solid var(--border-2);
		border-radius: 6px;
		color: var(--text);
		padding: 0.5rem 0.625rem;
		outline: none;
		transition: border-color 0.15s;
		width: 100%;
	}

	.add-input::placeholder {
		color: var(--text-ghost);
	}

	.add-input:focus {
		border-color: var(--accent);
	}

	.list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3rem 0.4rem;
		border-radius: 5px;
		transition: background 0.1s;
	}

	.item:hover {
		background: var(--surface);
	}

	.item-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		cursor: pointer;
		color: var(--text-2);
		min-width: 0;
		position: relative;
	}

	.item-label:hover::after {
		content: attr(data-tip);
		position: absolute;
		left: 0;
		top: calc(100% + 3px);
		background: var(--surface-2);
		border: 1px solid var(--border);
		color: var(--text);
		padding: 0.375rem 0.625rem;
		border-radius: 6px;
		font-size: 0.8125rem;
		white-space: normal;
		width: 240px;
		z-index: 60;
		box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
		pointer-events: none;
		word-break: break-word;
		line-height: 1.45;
	}

	.item-label span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.check {
		accent-color: var(--accent);
		width: 13px;
		height: 13px;
		flex-shrink: 0;
	}

	.item.done .item-label span {
		text-decoration: line-through;
		color: var(--text-ghost);
	}

	.del {
		background: none;
		border: none;
		color: transparent;
		font-size: 1rem;
		line-height: 1;
		padding: 0 0.2rem;
		flex-shrink: 0;
		transition: color 0.1s;
	}

	.item:hover .del {
		color: var(--text-ghost);
	}

	.item:hover .del:hover {
		color: var(--accent);
	}

	.empty {
		color: var(--text-faint);
		font-size: 0.8125rem;
		padding: 0.375rem 0.4rem;
	}

	.completed-group {
		margin-top: 0.25rem;
		padding-top: 0.625rem;
		border-top: 1px solid var(--surface);
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.completed-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-faint);
	}
</style>
