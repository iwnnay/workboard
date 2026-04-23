import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
	id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
	title: text("title").notNull(),
	completed: integer("completed", { mode: "boolean" }).notNull().default(false),
	priority: integer("priority").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const subtasks = sqliteTable("subtasks", {
	id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
	taskId: integer("task_id").notNull(),
	title: text("title").notNull(),
	completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});

export const notes = sqliteTable("notes", {
	id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
	title: text("title").notNull().default("Untitled"),
	content: text("content").notNull().default(""),
	order: integer("order").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Subtask = typeof subtasks.$inferSelect;
export type NewSubtask = typeof subtasks.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
