import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { note } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
	const notes = await db.select().from(note).orderBy(desc(note.updatedAt));
	return json(notes);
}

export async function POST({ request }) {
	const { title = '', content = '' } = await request.json();
	const [created] = await db.insert(note).values({ title, content }).returning();
	return json(created);
}
