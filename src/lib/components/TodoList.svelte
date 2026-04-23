<script lang="ts">
	import { tick, onMount } from "svelte";

	interface Task {
		id: number;
		title: string;
		completed: boolean;
		priority: number;
		createdAt: string;
		updatedAt: string;
	}

	let tasks = $state<Task[]>([]);
	let newTitle = $state("");
	let editingId = $state<number | null>(null);
	let editingText = $state("");
	let editInputEl: HTMLInputElement | null = $state(null);
	let expandedTasks = $state<Set<number>>(new Set());
	let subtasksMap = $state<Record<number, { id: number; title: string; completed: boolean }[]>>({});
	let newSubtaskTitles = $state<Record<number, string>>({});

	onMount(() => {
		loadTasks();
	});

	async function loadTasks() {
		const res = await fetch("/api/todos");
		tasks = (await res.json()) as Task[];
		for (const t of tasks) {
			loadSubtasks(t.id);
		}
	}

	async function loadSubtasks(taskId: number) {
		const res = await fetch(`/api/todos/${taskId}`);
		const data = (await res.json()) as Task & { subtasks: { id: number; title: string; completed: boolean }[] };
		subtasksMap = { ...subtasksMap, [taskId]: data.subtasks ?? [] };
	}

	async function addTask(e: Event) {
		e.preventDefault();
		if (!newTitle.trim()) return;
		const res = await fetch("/api/todos", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: newTitle.trim(), priority: 0 }),
		});
		const task = (await res.json()) as Task;
		tasks = [...tasks, task];
		newTitle = "";
	}

	async function toggleTask(task: Task) {
		await fetch(`/api/todos/${task.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ completed: !task.completed }),
		});
		tasks = tasks.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t));
	}

	async function saveTitle(id: number) {
		const text = editingText.trim() || "Untitled";
		await fetch(`/api/todos/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: text }),
		});
		tasks = tasks.map((t) => (t.id === id ? { ...t, title: text } : t));
		editingId = null;
		editingText = "";
	}

	async function deleteTask(id: number) {
		await fetch(`/api/todos/${id}`, { method: "DELETE" });
		tasks = tasks.filter((t) => t.id !== id);
		delete subtasksMap[id];
	}

	function startEdit(task: Task) {
		editingId = task.id;
		editingText = task.title;
		tick().then(() => {
			editInputEl?.focus();
			editInputEl?.select();
		});
	}

	function handleEditKey(id: number, e: KeyboardEvent) {
		if (e.key === "Enter") saveTitle(id);
		if (e.key === "Escape") editingId = null;
	}

	function toggleExpanded(taskId: number) {
		const next = new Set(expandedTasks);
		if (next.has(taskId)) next.delete(taskId);
		else next.add(taskId);
		expandedTasks = next;
	}

	async function addSubtask(taskId: number) {
		const title = (newSubtaskTitles[taskId] ?? "").trim();
		if (!title) return;
		const res = await fetch(`/api/todos/${taskId}/subtasks`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title }),
		});
		const st = (await res.json()) as { id: number; title: string; completed: boolean };
		subtasksMap = { ...subtasksMap, [taskId]: [...(subtasksMap[taskId] ?? []), st] };
		newSubtaskTitles = { ...newSubtaskTitles, [taskId]: "" };
	}

	async function toggleSubtask(taskId: number, st: { id: number; completed: boolean }) {
		await fetch(`/api/subtasks/${st.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ completed: !st.completed }),
		});
		subtasksMap = {
			...subtasksMap,
			[taskId]: subtasksMap[taskId].map((s) => (s.id === st.id ? { ...s, completed: !s.completed } : s)),
		};
	}

	async function deleteSubtask(taskId: number, subtaskId: number) {
		await fetch(`/api/subtasks/${subtaskId}`, { method: "DELETE" });
		subtasksMap = {
			...subtasksMap,
			[taskId]: subtasksMap[taskId].filter((s) => s.id !== subtaskId),
		};
	}
</script>

<div class="todo-list">
	<h2 class="heading">Tasks</h2>
	<form class="add-form" onsubmit={addTask}>
		<input class="add-input" bind:value={newTitle} placeholder="Add a task..." />
		<button class="add-btn" type="submit" disabled={!newTitle.trim()}>Add</button>
	</form>

	<ul class="list">
		{#each tasks as task (task.id)}
			<li class="item" class:completed={task.completed}>
				<div class="row">
					{#if (subtasksMap[task.id]?.length ?? 0) > 0}
						<button class="expand-btn" onclick={() => toggleExpanded(task.id)} aria-label="Toggle subtasks"
						>
							{#if expandedTasks.has(task.id)}▼{:else}▶{/if}
						</button>
					{:else}
						<span class="expand-placeholder"></span>
					{/if}
					<input class="checkbox" type="checkbox" checked={task.completed} onchange={() => toggleTask(task)} />
					{#if editingId === task.id}
						<input
							class="title-input"
							bind:value={editingText}
							onblur={() => saveTitle(task.id)}
							onkeydown={(e) => handleEditKey(task.id, e)}
							bind:this={editInputEl}
						/>
					{:else}
						<span
							class="title"
							role="button"
							tabindex="0"
							ondblclick={() => startEdit(task)}
							onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") startEdit(task); }}
						>{task.title}</span>
					{/if}
					<button class="delete-btn" onclick={() => deleteTask(task.id)} aria-label="Delete task">×</button>
				</div>

				{#if expandedTasks.has(task.id)}
					<ul class="subtask-list">
						{#each subtasksMap[task.id] ?? [] as st (st.id)}
							<li class="subtask-row">
								<input
									class="subtask-checkbox"
									type="checkbox"
									checked={st.completed}
									onchange={() => toggleSubtask(task.id, st)}
								/>
								<span class="subtask-title">{st.title}</span>
								<button
									class="subtask-delete-btn"
									onclick={() => deleteSubtask(task.id, st.id)}
									aria-label="Delete subtask"
								>×</button>
							</li>
						{/each}
						<li class="subtask-add-row">
							<input
								class="subtask-add-input"
								placeholder="Add subtask..."
								bind:value={newSubtaskTitles[task.id]}
								onkeydown={(e) => { if (e.key === "Enter") addSubtask(task.id); }}
							/>
							<button
								class="subtask-add-btn"
								onclick={() => addSubtask(task.id)}
								disabled={!(newSubtaskTitles[task.id] ?? "").trim()}
							>Add</button>
						</li>
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.todo-list {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		padding: 1rem;
	}

	.heading {
		margin: 0 0 0.75rem;
		font-size: 0.875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.8;
	}

	.add-form {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.add-input {
		flex: 1;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		color: inherit;
		font: inherit;
		outline: none;
	}

	.add-input:focus {
		border-color: rgba(255, 255, 255, 0.25);
	}

	.add-btn {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		color: inherit;
		font: inherit;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
	}

	.add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.item {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 0.5rem 0.625rem;
		transition: background 0.2s ease;
	}

	.item:hover {
		background: rgba(255, 255, 255, 0.07);
	}

	.item.completed .title {
		text-decoration: line-through;
		opacity: 0.65;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.expand-btn {
		background: none;
		border: none;
		color: inherit;
		font-size: 0.625rem;
		cursor: pointer;
		padding: 0.1rem;
		opacity: 0.7;
	}

	.expand-placeholder {
		display: inline-block;
		width: 1.1rem;
	}

	.checkbox {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: rgba(255, 255, 255, 0.9);
		cursor: pointer;
	}

	.title {
		flex: 1;
		cursor: pointer;
		font-size: 0.95rem;
		line-height: 1.35;
	}

	.title-input {
		flex: 1;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 6px;
		color: inherit;
		font: inherit;
		padding: 0.25rem 0.5rem;
		outline: none;
	}

	.delete-btn {
		background: none;
		border: none;
		color: inherit;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0.1rem 0.35rem;
		opacity: 0.5;
	}

	.delete-btn:hover {
		opacity: 1;
	}

	.subtask-list {
		list-style: none;
		margin: 0.5rem 0 0 1.5rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.subtask-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		opacity: 0.9;
	}

	.subtask-checkbox {
		width: 0.9rem;
		height: 0.9rem;
		accent-color: rgba(255, 255, 255, 0.9);
		cursor: pointer;
	}

	.subtask-title {
		flex: 1;
	}

	.subtask-delete-btn {
		background: none;
		border: none;
		color: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.1rem 0.25rem;
		opacity: 0.45;
	}

	.subtask-delete-btn:hover {
		opacity: 1;
	}

	.subtask-add-row {
		display: flex;
		gap: 0.35rem;
	}

	.subtask-add-input {
		flex: 1;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: inherit;
		font: inherit;
		padding: 0.25rem 0.5rem;
		font-size: 0.85rem;
		outline: none;
	}

	.subtask-add-input:focus {
		border-color: rgba(255, 255, 255, 0.25);
	}

	.subtask-add-btn {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		color: inherit;
		font: inherit;
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.subtask-add-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
