import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { reminder } from '$lib/server/db/schema';

export async function GET() {
	const row = await db.query.reminder.findFirst();
	return json({ content: row?.content ?? '' });
}

export async function PUT({ request }) {
	const { content } = await request.json();
	await db
		.insert(reminder)
		.values({ id: 'singleton', content, updatedAt: new Date().toISOString() })
		.onConflictDoUpdate({
			target: reminder.id,
			set: { content, updatedAt: new Date().toISOString() }
		});
	return json({ success: true });
}
