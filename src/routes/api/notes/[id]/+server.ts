import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { note } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function GET({ params }) {
	const notes = db.select().from(note).where(eq(note.id, params.id)).all();
	return json(notes[0] || null);
}

export async function PUT({ params, request }) {
	const { title, content } = await request.json();
	db.update(note).set({ title, content, updatedAt: new Date() }).where(eq(note.id, params.id)).run();
	return json({ success: true });
}

export async function DELETE({ params }) {
	db.delete(note).where(eq(note.id, params.id)).run();
	return json({ success: true });
}