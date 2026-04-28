import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { bookmark } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH({ params, request }) {
	const data = await request.json();
	const [updated] = await db
		.update(bookmark)
		.set({ name: data.name, url: data.url, description: data.description })
		.where(eq(bookmark.id, params.id))
		.returning();
	return json(updated);
}

export async function DELETE({ params }) {
	await db.delete(bookmark).where(eq(bookmark.id, params.id));
	return json({ success: true });
}
