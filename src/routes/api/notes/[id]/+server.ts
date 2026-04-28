import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { note } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH({ params, request }) {
	const data = await request.json();
	const [updated] = await db
		.update(note)
		.set({ ...data, updatedAt: new Date().toISOString() })
		.where(eq(note.id, params.id))
		.returning();
	return json(updated);
}

export async function DELETE({ params }) {
	await db.delete(note).where(eq(note.id, params.id));
	return json({ success: true });
}
