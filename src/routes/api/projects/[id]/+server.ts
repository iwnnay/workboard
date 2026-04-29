import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { project } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH({ params, request }) {
	const { name } = await request.json();
	const [updated] = await db
		.update(project)
		.set({ name })
		.where(eq(project.id, params.id))
		.returning();
	return json(updated);
}

export async function DELETE({ params }) {
	await db.delete(project).where(eq(project.id, params.id));
	return json({ success: true });
}
