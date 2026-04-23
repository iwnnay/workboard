import { db } from "$lib/server/db";
import { notes } from "$lib/server/db/schema.js";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	const allNotes = db.select().from(notes).all();
	return json(allNotes);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { title?: string; content?: string; order?: number };
	const result = db
		.insert(notes)
		.values({
			title: body.title ?? "Untitled",
			content: body.content ?? "",
			order: body.order ?? 0,
		})
		.returning()
		.get();
	return json(result, { status: 201 });
};
