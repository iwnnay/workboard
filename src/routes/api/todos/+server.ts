import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { task } from '$lib/server/db/schema';

export async function GET() {
	try {
		const todos = db.select().from(task).all();
		return json(todos);
	} catch (e) {
		console.error('GET todos error:', e);
		throw error(500, 'Failed to fetch todos');
	}
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { title } = body;
		if (!title) {
			throw error(400, 'Title is required');
		}
		const newTodo = db.insert(task).values({ title }).returning().get();
		return json(newTodo, { status: 201 });
	} catch (e: any) {
		console.error('POST todo error:', e);
		throw error(500, e.message || 'Failed to create todo');
	}
}