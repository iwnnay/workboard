import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { todo, note } from '$lib/server/db/schema';
import { and, asc, desc, eq, isNotNull, lt } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

	await db
		.delete(todo)
		.where(and(eq(todo.completed, true), isNotNull(todo.completedAt), lt(todo.completedAt, threeDaysAgo)));

	const [todos, notes] = await Promise.all([
		db.select().from(todo).orderBy(asc(todo.createdAt)),
		db.select().from(note).orderBy(desc(note.updatedAt))
	]);

	return { todos, notes };
};
