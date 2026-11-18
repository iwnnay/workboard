import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('$lib/server/db', async () => {
	const { default: Database } = await import('better-sqlite3');
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const schema = await import('$lib/server/db/schema');
	const db = drizzle(new Database(':memory:'), { schema });
	migrate(db, { migrationsFolder: 'drizzle' });
	return { db };
});

const { createProject, deleteProject, getProject, listProjects, updateProject } =
	await import('$lib/server/projects');
const { db } = await import('$lib/server/db');
const { fullReviewFile, fullReviewScope, project } = await import('$lib/server/db/schema');
const { defaultProjectSettings } = await import('$lib/project-settings');

let workspace = '';

const makeFolder = (name: string) => {
	const folder = join(workspace, name);
	mkdirSync(folder, { recursive: true });
	return folder;
};

beforeEach(() => {
	workspace = mkdtempSync(join(tmpdir(), 'projects-'));
});

afterEach(() => {
	db.delete(fullReviewFile).run();
	db.delete(fullReviewScope).run();
	db.delete(project).run();
	rmSync(workspace, { recursive: true, force: true });
});

describe('createProject', () => {
	it('names the project after its folder and stores default settings', async () => {
		const folder = makeFolder('alpha-app');
		const created = await createProject({ path: folder });
		expect(created).toMatchObject({
			name: 'alpha-app',
			path: folder,
			settings: defaultProjectSettings
		});
		expect((await listProjects()).map((entry) => entry.id)).toEqual([created.id]);
	});

	it('rejects a path that does not exist, naming it', async () => {
		const missing = join(workspace, 'missing');
		await expect(createProject({ path: missing })).rejects.toMatchObject({
			status: 400,
			message: expect.stringContaining(`creating project: path "${missing}" cannot be read`)
		});
	});

	it('rejects a file path', async () => {
		const file = join(workspace, 'notes.txt');
		writeFileSync(file, 'hello');
		await expect(createProject({ path: file })).rejects.toMatchObject({
			status: 400,
			message: `creating project: path "${file}" is a file, not a directory`
		});
	});

	it('refuses a second project on the same folder', async () => {
		const folder = makeFolder('shared');
		const first = await createProject({ path: folder, name: 'First' });
		await expect(createProject({ path: folder })).rejects.toMatchObject({
			status: 409,
			message: `creating project: path "${folder}" is already used by project "First" (${first.id})`
		});
	});
});

describe('updateProject', () => {
	it('renames, moves and merges settings without touching the others', async () => {
		const created = await createProject({ path: makeFolder('before') });
		const moved = makeFolder('after');
		const updated = await updateProject(created.id, {
			name: 'Renamed',
			path: moved,
			settings: { importantDirectories: ['src', 'db'] }
		});
		expect(updated).toMatchObject({
			name: 'Renamed',
			path: moved,
			settings: { ...defaultProjectSettings, importantDirectories: ['src', 'db'] }
		});
		expect(await getProject(created.id)).toEqual(updated);
	});

	it('turns a bad setting into a 400 that names the project', async () => {
		const created = await createProject({ path: makeFolder('settings') });
		await expect(
			updateProject(created.id, { settings: { testGlobs: 'tests/**' } })
		).rejects.toMatchObject({
			status: 400,
			message: `updating project ${created.id}: setting "testGlobs" must be a list of strings, got "tests/**"`
		});
	});

	it('reports a missing project as 404', async () => {
		await expect(updateProject('nope', { name: 'x' })).rejects.toMatchObject({
			status: 404,
			message: 'loading project nope: no such row in the project table'
		});
	});
});

describe('deleteProject', () => {
	it('removes the project and its full review rows', async () => {
		const created = await createProject({ path: makeFolder('doomed') });
		const now = new Date().toISOString();
		db.insert(fullReviewScope).values({ projectId: created.id, path: 'src' }).run();
		db.insert(fullReviewFile)
			.values({ projectId: created.id, path: 'src/a.ts', firstSeenAt: now })
			.run();

		await deleteProject(created.id);

		expect(await listProjects()).toEqual([]);
		expect(db.select().from(fullReviewScope).all()).toEqual([]);
		expect(db.select().from(fullReviewFile).all()).toEqual([]);
	});
});
