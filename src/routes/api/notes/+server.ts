import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { note } from '$lib/server/db/schema';

export async function GET() {
	const notes = db.select().from(note).all();
	return json(notes);
}

export async function POST({ request }) {
	const { title, content } = await request.json();
	const now = new Date();
	const newNote = db.insert(note).values({ title, content, createdAt: now, updatedAt: now }).returning().get();
	return json(newNote, { status: 201 });
}