import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { task, note, calendarEvent, subtask } from '$lib/server/db/schema';
import { gt, asc, sql } from 'drizzle-orm';
import { isAuthenticated, getCalendarEvents } from '$lib/server/outlook';

export const load: PageServerLoad = async () => {
	const todos = db.select().from(task).all();
	const allSubtasks = db.select().from(subtask).all();
	const notes = db.select().from(note).orderBy(asc(note.orderIndex)).all();

	const outlookEvents = isAuthenticated()
		? await getCalendarEvents(new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
		: [];

	const dbEvents = db
		.select()
		.from(calendarEvent)
		.where(gt(calendarEvent.startTime, new Date()))
		.orderBy(asc(calendarEvent.startTime))
		.all();

	const events = [...outlookEvents, ...dbEvents].sort(
		(a: any, b: any) =>
			new Date(a.start?.dateTime || a.startTime).getTime() -
			new Date(b.start?.dateTime || b.startTime).getTime()
	);

	const todosWithSubtasks = todos.map((t) => ({
		...t,
		subtasks: allSubtasks.filter((s) => s.taskId === t.id)
	}));

	return {
		todos: todosWithSubtasks,
		notes: notes.map((n) => ({ ...n, updatedAt: n.updatedAt })),
		events: events.map((e: any) => ({
			id: e.id || crypto.randomUUID(),
			title: e.subject || e.title,
			startTime: e.start?.dateTime ? new Date(e.start.dateTime) : e.startTime,
			endTime: e.end?.dateTime ? new Date(e.end.dateTime) : e.endTime,
			location: e.location?.displayName || e.location,
			isAllDay: e.isAllDay
		})),
		isAuthenticated: isAuthenticated()
	};
};
