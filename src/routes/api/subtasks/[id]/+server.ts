import { db } from "$lib/server/db";
import { subtasks } from "$lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = (await request.json()) as { completed?: boolean; title?: string };
	const result = db
		.update(subtasks)
		.set(body)
		.where(eq(subtasks.id, Number(params.id)))
		.returning()
		.get();
	if (!result) return json({ error: "Not found" }, { status: 404 });
	return json(result);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	db.delete(subtasks).where(eq(subtasks.id, id)).run();
	return json({ success: true });
};
