import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { todo } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH({ params, request }) {
	const data = await request.json();
	const [updated] = await db.update(todo).set(data).where(eq(todo.id, params.id)).returning();
	return json(updated);
}

export async function DELETE({ params }) {
	await db.delete(todo).where(eq(todo.id, params.id));
	return json({ success: true });
}
