import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const todo = sqliteTable('todo', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	text: text('text').notNull(),
	completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
	completedAt: text('completed_at'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export const note = sqliteTable('note', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull().default(''),
	content: text('content').notNull().default(''),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export const reminder = sqliteTable('reminder', {
	id: text('id').primaryKey().default('singleton'),
	content: text('content').notNull().default(''),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export const project = sqliteTable('project', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	path: text('path').notNull(),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export const bookmarkFolder = sqliteTable('bookmark_folder', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export const bookmark = sqliteTable('bookmark', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	folderId: text('folder_id'),
	name: text('name').notNull(),
	url: text('url').notNull(),
	description: text('description').notNull().default(''),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});
