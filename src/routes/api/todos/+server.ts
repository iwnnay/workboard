import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { todo } from '$lib/server/db/schema';
import { and, asc, eq, isNotNull, lt } from 'drizzle-orm';

export async function GET() {
	const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
	await db
		.delete(todo)
		.where(and(eq(todo.completed, true), isNotNull(todo.completedAt), lt(todo.completedAt, threeDaysAgo)));

	const todos = await db.select().from(todo).orderBy(asc(todo.createdAt));
	return json(todos);
}

export async function POST({ request }) {
	const { text } = await request.json();
	const [created] = await db.insert(todo).values({ text }).returning();
	return json(created);
}
