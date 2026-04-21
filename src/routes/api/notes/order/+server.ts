import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { note } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { ids } = body;
		if (!ids || !Array.isArray(ids)) {
			throw error(400, 'ids array is required');
		}

		for (let i = 0; i < ids.length; i++) {
			db.update(note).set({ orderIndex: i }).where(eq(note.id, ids[i])).run();
		}

		return json({ success: true });
	} catch (e: any) {
		console.error('POST notes order error:', e);
		throw error(500, e.message || 'Failed to update notes order');
	}
}
