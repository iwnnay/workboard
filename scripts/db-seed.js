/**
 * Inserts starter data. Skips if rows already exist.
 * Usage: yarn db:seed
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';

function loadDotEnv() {
	if (!existsSync('.env')) return;
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		const eq = line.indexOf('=');
		if (eq === -1) continue;
		const key = line.slice(0, eq).trim();
		const val = line.slice(eq + 1).trim();
		if (key && !process.env[key]) process.env[key] = val;
	}
}

loadDotEnv();
const DB_PATH = process.env.DATABASE_URL ?? 'local.db';
const db = new Database(DB_PATH);

const now = new Date().toISOString();

const todoCount = db.prepare('SELECT count(*) as n FROM todo').get().n;
const noteCount = db.prepare('SELECT count(*) as n FROM note').get().n;

if (todoCount === 0) {
	const insert = db.prepare(
		'INSERT INTO todo (id, text, completed, completed_at, created_at) VALUES (?, ?, ?, ?, ?)'
	);
	const rows = [
		[randomUUID(), 'Welcome to workboard', 0, null, now],
		[randomUUID(), 'Add your first real todo item', 0, null, now]
	];
	const tx = db.transaction(() => rows.forEach((r) => insert.run(...r)));
	tx();
	console.log(`✓  Seeded ${rows.length} todo(s)`);
} else {
	console.log(`   Todos already populated (${todoCount} rows) — skipping`);
}

if (noteCount === 0) {
	const insert = db.prepare(
		'INSERT INTO note (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
	);
	const rows = [
		[
			randomUUID(),
			'Getting started',
			'Click "+ New" to create a note.\n\nOpen multiple notes at once using the ☰ index button — each one gets its own tab.\n\nNotes auto-save to local storage as you type and are written to the database whenever you close a tab or switch away from the page.',
			now,
			now
		]
	];
	const tx = db.transaction(() => rows.forEach((r) => insert.run(...r)));
	tx();
	console.log(`✓  Seeded ${rows.length} note(s)`);
} else {
	console.log(`   Notes already populated (${noteCount} rows) — skipping`);
}

db.close();
