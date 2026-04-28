import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { bookmarkFolder } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
	const folders = await db.select().from(bookmarkFolder).orderBy(asc(bookmarkFolder.name));
	return json(folders);
}

export async function POST({ request }) {
	const { name } = await request.json();
	const [created] = await db.insert(bookmarkFolder).values({ name }).returning();
	return json(created);
}
