import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { task, note, calendarEvent } from '$lib/server/db/schema';
import { gt, asc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const todos = db.select().from(task).all();
	const notes = db.select().from(note).orderBy(note.updatedAt).all();
	const now = new Date();
	const events = db
		.select()
		.from(calendarEvent)
		.where(gt(calendarEvent.startTime, now))
		.orderBy(asc(calendarEvent.startTime))
		.all();

	return {
		todos,
		notes: notes.map((n) => ({ ...n, updatedAt: n.updatedAt })),
		events: events.map((e) => ({ ...e, startTime: e.startTime, endTime: e.endTime }))
	};
};