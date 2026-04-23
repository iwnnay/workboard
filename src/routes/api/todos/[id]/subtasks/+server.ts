import { db } from "$lib/server/db";
import { subtasks } from "$lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json()) as { title: string };
	const result = db
		.insert(subtasks)
		.values({ taskId: Number(params.id), title: body.title })
		.returning()
		.get();
	return json(result, { status: 201 });
};
