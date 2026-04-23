import { db } from "$lib/server/db";
import { subtasks, tasks } from "$lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
	const task = db.select().from(tasks).where(eq(tasks.id, Number(params.id))).get();
	if (!task) return json({ error: "Not found" }, { status: 404 });
	const children = db.select().from(subtasks).where(eq(subtasks.taskId, task.id)).all();
	return json({ ...task, subtasks: children });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = (await request.json()) as { completed?: boolean; title?: string; priority?: number };
	const result = db
		.update(tasks)
		.set({ ...body, updatedAt: new Date() })
		.where(eq(tasks.id, Number(params.id)))
		.returning()
		.get();
	if (!result) return json({ error: "Not found" }, { status: 404 });
	return json(result);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	db.delete(subtasks).where(eq(subtasks.taskId, id)).run();
	db.delete(tasks).where(eq(tasks.id, id)).run();
	return json({ success: true });
};
