import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { reminder } from '$lib/server/db/schema';
import { REMINDER_ID } from '$lib/server/constants';

export async function GET() {
	const row = await db.query.reminder.findFirst();
	return json({ content: row?.content ?? '' });
}

export async function PUT({ request }) {
	const { content } = await request.json();
	const now = new Date().toISOString();
	await db
		.insert(reminder)
		.values({ id: REMINDER_ID, content, updatedAt: now })
		.onConflictDoUpdate({ target: reminder.id, set: { content, updatedAt: now } });
	return json({ success: true });
}
