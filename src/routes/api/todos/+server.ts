import { db } from "$lib/server/db";
import { tasks } from "$lib/server/db/schema.js";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	const allTasks = db.select().from(tasks).all();
	return json(allTasks);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { title: string; priority?: number };
	const result = db
		.insert(tasks)
		.values({ title: body.title, priority: body.priority ?? 0 })
		.returning()
		.get();
	return json(result, { status: 201 });
};
