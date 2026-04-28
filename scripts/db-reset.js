/**
 * Drops and recreates all tables. Safe to run repeatedly.
 * Usage: yarn db:reset
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'fs';

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

db.exec(`
  DROP TABLE IF EXISTS todo;
  DROP TABLE IF EXISTS note;

  CREATE TABLE todo (
    id         TEXT    PRIMARY KEY NOT NULL,
    text       TEXT    NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT    NOT NULL
  );

  CREATE TABLE note (
    id         TEXT PRIMARY KEY NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

console.log(`✓  Reset complete → ${DB_PATH}`);
db.close();
