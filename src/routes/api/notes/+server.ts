import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { note } from '$lib/server/db/schema';
import { asc, sql } from 'drizzle-orm';

export async function GET() {
	try {
		const notes = db.select().from(note).orderBy(asc(note.orderIndex)).all();
		return json(notes);
	} catch (e) {
		console.error('GET notes error:', e);
		throw error(500, 'Failed to fetch notes');
	}
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { title, content } = body;
		if (!title || !content) {
			throw error(400, 'Title and content are required');
		}
		const now = new Date();
		const maxOrderResult = db
			.select({ maxOrder: sql<number>`max(${note.orderIndex})` })
			.from(note)
			.get();
		const orderIndex = (maxOrderResult?.maxOrder ?? -1) + 1;
		const newNote = db
			.insert(note)
			.values({ title, content, orderIndex, createdAt: now, updatedAt: now })
			.returning()
			.get();
		return json(newNote, { status: 201 });
	} catch (e: any) {
		console.error('POST note error:', e);
		throw error(500, e.message || 'Failed to create note');
	}
}
