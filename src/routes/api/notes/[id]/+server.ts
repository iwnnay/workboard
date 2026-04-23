import { db } from "$lib/server/db";
import { notes } from "$lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
	const note = db.select().from(notes).where(eq(notes.id, Number(params.id))).get();
	if (!note) return json({ error: "Not found" }, { status: 404 });
	return json(note);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const body = (await request.json()) as { title?: string; content?: string; order?: number };
	const result = db
		.update(notes)
		.set({ ...body, updatedAt: new Date() })
		.where(eq(notes.id, Number(params.id)))
		.returning()
		.get();
	if (!result) return json({ error: "Not found" }, { status: 404 });
	return json(result);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	db.delete(notes).where(eq(notes.id, id)).run();
	return json({ success: true });
};
