import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subtask, task } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function GET({ url }) {
	try {
		const taskId = url.searchParams.get('taskId');
		if (!taskId) {
			throw error(400, 'taskId is required');
		}
		const subtasks = db.select().from(subtask).where(eq(subtask.taskId, taskId)).all();
		return json(subtasks);
	} catch (e) {
		console.error('GET subtasks error:', e);
		throw error(500, 'Failed to fetch subtasks');
	}
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { taskId, title } = body;
		if (!taskId || !title) {
			throw error(400, 'taskId and title are required');
		}
		const newSubtask = db.insert(subtask).values({ taskId, title }).returning().get();
		return json(newSubtask, { status: 201 });
	} catch (e: any) {
		console.error('POST subtask error:', e);
		throw error(500, e.message || 'Failed to create subtask');
	}
}
