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

/**
 * A dev server under this app's management. `pid`/`startedAt`/`logPath` track
 * the process we last launched so status survives a restart of the workboard
 * itself; they are cleared whenever the process is found to be gone.
 */
export const managedServer = sqliteTable('managed_server', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	alias: text('alias').notNull(),
	directory: text('directory').notNull(),
	serverType: text('server_type').notNull(),
	port: integer('port'),
	/** False when the project configures its own port, so we must not force one. */
	passPortToCommand: integer('pass_port_to_command', { mode: 'boolean' }).notNull().default(true),
	docker: integer('docker', { mode: 'boolean' }).notNull().default(false),
	dockerCommand: text('docker_command').notNull().default(''),
	pid: integer('pid'),
	startedAt: text('started_at'),
	logPath: text('log_path'),
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
