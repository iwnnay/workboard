import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { bookmark } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
	const bookmarks = await db.select().from(bookmark).orderBy(asc(bookmark.name));
	return json(bookmarks);
}

export async function POST({ request }) {
	const { folderId = null, name, url, description = '' } = await request.json();
	const [created] = await db.insert(bookmark).values({ folderId, name, url, description }).returning();
	return json(created);
}
