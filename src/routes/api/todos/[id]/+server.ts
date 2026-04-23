import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { task } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH({ params, request }) {
	const body = await request.json();
	if ('completed' in body) {
		db.update(task).set({ completed: body.completed }).where(eq(task.id, params.id)).run();
	}
	if ('title' in body) {
		db.update(task).set({ title: body.title }).where(eq(task.id, params.id)).run();
	}
	return json({ success: true });
}

export async function DELETE({ params }) {
	db.delete(task).where(eq(task.id, params.id)).run();
	return json({ success: true });
}