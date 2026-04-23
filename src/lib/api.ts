export interface Task {
	id: number;
	title: string;
	completed: boolean;
	priority: number;
	createdAt: string;
	updatedAt: string;
}

export interface Subtask {
	id: number;
	taskId: number;
	title: string;
	completed: boolean;
}

export interface Note {
	id: number;
	title: string;
	content: string;
	order: number;
	createdAt: number;
	updatedAt: number;
}

export async function getTasks(): Promise<Task[]> {
	const res = await fetch("/api/todos");
	return res.json();
}

export async function getTask(id: number): Promise<Task & { subtasks: Subtask[] }> {
	const res = await fetch(`/api/todos/${id}`);
	return res.json();
}

export async function createTask(title: string, priority = 0): Promise<Task> {
	const res = await fetch("/api/todos", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title, priority }),
	});
	return res.json();
}

export async function updateTask(
	id: number,
	data: { title?: string; completed?: boolean; priority?: number }
): Promise<Task> {
	const res = await fetch(`/api/todos/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return res.json();
}

export async function deleteTask(id: number): Promise<void> {
	await fetch(`/api/todos/${id}`, { method: "DELETE" });
}

export async function createSubtask(taskId: number, title: string): Promise<Subtask> {
	const res = await fetch(`/api/todos/${taskId}/subtasks`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title }),
	});
	return res.json();
}

export async function updateSubtask(id: number, completed: boolean): Promise<Subtask> {
	const res = await fetch(`/api/subtasks/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ completed }),
	});
	return res.json();
}

export async function deleteSubtask(id: number): Promise<void> {
	await fetch(`/api/subtasks/${id}`, { method: "DELETE" });
}

export async function getNotes(): Promise<Note[]> {
	const res = await fetch("/api/notes");
	return res.json();
}

export async function createNote(data: { title?: string; content?: string; order?: number }): Promise<Note> {
	const res = await fetch("/api/notes", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title: data.title ?? "Untitled", content: data.content ?? "", order: data.order ?? 0 }),
	});
	return res.json();
}

export async function updateNote(id: number, data: { title?: string; content?: string; order?: number }): Promise<Note> {
	const res = await fetch(`/api/notes/${id}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return res.json();
}

export async function deleteNote(id: number): Promise<void> {
	await fetch(`/api/notes/${id}`, { method: "DELETE" });
}

export async function reorderNotes(orders: { id: number; order: number }[]): Promise<void> {
	await fetch("/api/notes/order", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ orders }),
	});
}
