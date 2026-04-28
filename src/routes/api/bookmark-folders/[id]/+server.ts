import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { bookmarkFolder, bookmark } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH({ params, request }) {
	const { name } = await request.json();
	const [updated] = await db
		.update(bookmarkFolder)
		.set({ name })
		.where(eq(bookmarkFolder.id, params.id))
		.returning();
	return json(updated);
}

export async function DELETE({ params }) {
	await db.update(bookmark).set({ folderId: null }).where(eq(bookmark.folderId, params.id));
	await db.delete(bookmarkFolder).where(eq(bookmarkFolder.id, params.id));
	return json({ success: true });
}
