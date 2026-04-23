import { db } from "$lib/server/db";
import { notes } from "$lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { orders: { id: number; order: number }[] };
	for (const item of body.orders) {
		db.update(notes).set({ order: item.order, updatedAt: new Date() }).where(eq(notes.id, item.id)).run();
	}
	return json({ success: true });
};
