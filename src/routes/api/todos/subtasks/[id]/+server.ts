import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subtask, task } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH({ params, request }) {
	try {
		const body = await request.json();
		const { completed, title } = body;
		const updates: Record<string, any> = {};
		if (completed !== undefined) updates.completed = completed;
		if (title !== undefined) updates.title = title;

		db.update(subtask).set(updates).where(eq(subtask.id, params.id)).run();

		if (completed !== undefined) {
			const parentSubtask = db.select().from(subtask).where(eq(subtask.id, params.id)).get();
			if (parentSubtask) {
				const allSubtasks = db
					.select()
					.from(subtask)
					.where(eq(subtask.taskId, parentSubtask.taskId))
					.all();
				const allCompleted = allSubtasks.every((s) => s.completed);
				db.update(task)
					.set({ completed: allCompleted })
					.where(eq(task.id, parentSubtask.taskId))
					.run();
			}
		}

		return json({ success: true });
	} catch (e: any) {
		console.error('PATCH subtask error:', e);
		throw error(500, e.message || 'Failed to update subtask');
	}
}

export async function DELETE({ params }) {
	try {
		db.delete(subtask).where(eq(subtask.id, params.id)).run();
		return json({ success: true });
	} catch (e: any) {
		console.error('DELETE subtask error:', e);
		throw error(500, e.message || 'Failed to delete subtask');
	}
}
