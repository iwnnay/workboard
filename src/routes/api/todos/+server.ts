import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { task } from '$lib/server/db/schema';

export async function GET() {
	const todos = db.select().from(task).all();
	return json(todos);
}

export async function POST({ request }) {
	const { title } = await request.json();
	const newTodo = db.insert(task).values({ title }).returning().get();
	return json(newTodo, { status: 201 });
}