import { createHash } from 'crypto';
import { lstat, open, readdir } from 'fs/promises';
import { relative, resolve, sep } from 'path';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { fullReviewFile, fullReviewScope, project } from '$lib/server/db/schema';
import { badRequest, notFound } from '$lib/server/http';
import { resolveSafePath } from '$lib/server/paths';

const IGNORED_DIRECTORIES = new Set([
	'.git',
	'.svelte-kit',
	'.next',
	'.nuxt',
	'.cache',
	'.turbo',
	'.yarn',
	'node_modules',
	'coverage',
	'dist',
	'build',
	'out',
	'target',
	'vendor',
	'__pycache__'
]);

export type ReviewStatus = 'current' | 'created' | 'updated' | 'deleted';

export type FullReviewFile = {
	path: string;
	byteSize: number;
	modifiedAt: string | null;
	checked: boolean;
	checkedAt: string | null;
	changedAt: string | null;
	status: ReviewStatus;
};

export type FullReviewState = {
	directories: string[];
	files: FullReviewFile[];
	baselineAt: string | null;
	lastPolledAt: string | null;
};

type ScannedFile = {
	path: string;
	fingerprint: string;
	byteSize: number;
	modifiedAt: string;
};

function portablePath(root: string, absolutePath: string): string {
	return relative(root, absolutePath).split(sep).join('/');
}

export function normalizeReviewDirectories(paths: unknown): string[] {
	if (!Array.isArray(paths)) {
		throw badRequest('directories must be an array of project-relative paths');
	}
	const normalized = paths.map((value) => {
		if (typeof value !== 'string') {
			throw badRequest('each review directory must be a string');
		}
		const clean = value.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
		return clean || '.';
	});
	return [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
}

async function hashFile(path: string): Promise<string> {
	const handle = await open(path, 'r');
	try {
		const hash = createHash('sha256');
		for await (const chunk of handle.createReadStream({ autoClose: false })) {
			hash.update(chunk);
		}
		return hash.digest('hex');
	} finally {
		await handle.close();
	}
}

async function walkDirectory(root: string, directory: string, found: Map<string, ScannedFile>) {
	const entries = await readdir(directory, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
			continue;
		}
		const absolutePath = resolve(directory, entry.name);
		if (entry.isSymbolicLink()) {
			continue;
		}
		if (entry.isDirectory()) {
			await walkDirectory(root, absolutePath, found);
		} else if (entry.isFile()) {
			const path = portablePath(root, absolutePath);
			if (found.has(path)) {
				continue;
			}
			const stat = await lstat(absolutePath);
			found.set(path, {
				path,
				fingerprint: await hashFile(absolutePath),
				byteSize: stat.size,
				modifiedAt: stat.mtime.toISOString()
			});
		}
	}
}

function chunks<T>(values: T[], size = 250): T[][] {
	const result: T[][] = [];
	for (let index = 0; index < values.length; index += size) {
		result.push(values.slice(index, index + size));
	}
	return result;
}

async function findProject(projectId: string) {
	if (!projectId) {
		throw badRequest('projectId is required');
	}
	const [found] = await db.select().from(project).where(eq(project.id, projectId));
	if (!found) {
		throw notFound(`project ${projectId} was not found`);
	}
	return found;
}

async function scan(root: string, directories: string[]): Promise<Map<string, ScannedFile>> {
	const found = new Map<string, ScannedFile>();
	for (const reviewPath of directories) {
		const absolutePath = resolveSafePath(root, reviewPath);
		let stat;
		try {
			stat = await lstat(absolutePath);
		} catch {
			throw badRequest(`review directory does not exist: ${reviewPath}`);
		}
		if (!stat.isDirectory() || stat.isSymbolicLink()) {
			throw badRequest(`review path is not a directory: ${reviewPath}`);
		}
		await walkDirectory(root, absolutePath, found);
	}
	return found;
}

function statusOf(row: typeof fullReviewFile.$inferSelect): ReviewStatus {
	if (row.currentFingerprint === null) {
		return 'deleted';
	}
	if (row.baselineFingerprint === null) {
		return 'created';
	}
	if (row.currentFingerprint !== row.baselineFingerprint) {
		return 'updated';
	}
	return 'current';
}

export async function getFullReviewState(projectId: string): Promise<FullReviewState> {
	await findProject(projectId);
	const [scopes, rows] = await Promise.all([
		db
			.select()
			.from(fullReviewScope)
			.where(eq(fullReviewScope.projectId, projectId))
			.orderBy(asc(fullReviewScope.path)),
		db
			.select()
			.from(fullReviewFile)
			.where(eq(fullReviewFile.projectId, projectId))
			.orderBy(asc(fullReviewFile.path))
	]);
	return {
		directories: scopes.map((scope) => scope.path),
		files: rows.map((row) => ({
			path: row.path,
			byteSize: row.byteSize,
			modifiedAt: row.modifiedAt,
			checked: row.checked,
			checkedAt: row.checkedAt,
			changedAt: row.changedAt,
			status: statusOf(row)
		})),
		baselineAt: scopes[0]?.createdAt ?? null,
		lastPolledAt: scopes[0]?.lastPolledAt ?? null
	};
}

export async function resetFullReview(projectId: string, inputDirectories: unknown) {
	const foundProject = await findProject(projectId);
	const directories = normalizeReviewDirectories(inputDirectories);
	if (directories.length === 0) {
		throw badRequest('add at least one directory to review');
	}
	const files = await scan(foundProject.path, directories);
	const now = new Date().toISOString();
	db.transaction((tx) => {
		tx.delete(fullReviewScope).where(eq(fullReviewScope.projectId, projectId)).run();
		tx.delete(fullReviewFile).where(eq(fullReviewFile.projectId, projectId)).run();
		tx.insert(fullReviewScope)
			.values(
				directories.map((path) => ({
					projectId,
					path,
					createdAt: now,
					lastPolledAt: null
				}))
			)
			.run();
		if (files.size > 0) {
			for (const batch of chunks([...files.values()])) {
				tx.insert(fullReviewFile)
					.values(
						batch.map((file) => ({
							projectId,
							path: file.path,
							baselineFingerprint: file.fingerprint,
							currentFingerprint: file.fingerprint,
							byteSize: file.byteSize,
							modifiedAt: file.modifiedAt,
							checked: false,
							checkedAt: null,
							changedAt: null,
							firstSeenAt: now
						}))
					)
					.run();
			}
		}
	});
	return getFullReviewState(projectId);
}

export async function pollFullReview(projectId: string) {
	const foundProject = await findProject(projectId);
	const scopes = await db
		.select()
		.from(fullReviewScope)
		.where(eq(fullReviewScope.projectId, projectId));
	if (scopes.length === 0) {
		throw badRequest('configure review directories before polling');
	}
	const scanned = await scan(
		foundProject.path,
		scopes.map((scope) => scope.path)
	);
	const stored = await db
		.select()
		.from(fullReviewFile)
		.where(eq(fullReviewFile.projectId, projectId));
	const now = new Date().toISOString();
	db.transaction((tx) => {
		tx.update(fullReviewScope)
			.set({ lastPolledAt: now })
			.where(eq(fullReviewScope.projectId, projectId))
			.run();
		for (const row of stored) {
			const current = scanned.get(row.path);
			const changed = (current?.fingerprint ?? null) !== row.baselineFingerprint;
			tx.update(fullReviewFile)
				.set({
					currentFingerprint: current?.fingerprint ?? null,
					byteSize: current?.byteSize ?? row.byteSize,
					modifiedAt: current?.modifiedAt ?? null,
					checked: changed ? false : row.checked,
					changedAt: changed ? (row.changedAt ?? now) : null
				})
				.where(and(eq(fullReviewFile.projectId, projectId), eq(fullReviewFile.path, row.path)))
				.run();
			scanned.delete(row.path);
		}
		if (scanned.size > 0) {
			for (const batch of chunks([...scanned.values()])) {
				tx.insert(fullReviewFile)
					.values(
						batch.map((file) => ({
							projectId,
							path: file.path,
							baselineFingerprint: null,
							currentFingerprint: file.fingerprint,
							byteSize: file.byteSize,
							modifiedAt: file.modifiedAt,
							checked: false,
							checkedAt: null,
							changedAt: now,
							firstSeenAt: now
						}))
					)
					.run();
			}
		}
	});
	return getFullReviewState(projectId);
}

export async function setFileReviewed(projectId: string, path: string, checked: boolean) {
	await findProject(projectId);
	const [row] = await db
		.select()
		.from(fullReviewFile)
		.where(and(eq(fullReviewFile.projectId, projectId), eq(fullReviewFile.path, path)));
	if (!row) {
		throw notFound(`review file ${path} was not found`);
	}
	if (checked && row.currentFingerprint === null) {
		throw badRequest('a deleted file cannot be checked off');
	}
	const now = new Date().toISOString();
	await db
		.update(fullReviewFile)
		.set(
			checked
				? {
						checked: true,
						checkedAt: now,
						baselineFingerprint: row.currentFingerprint,
						changedAt: null
					}
				: {
						checked: false,
						checkedAt: null
					}
		)
		.where(and(eq(fullReviewFile.projectId, projectId), eq(fullReviewFile.path, path)));
	return getFullReviewState(projectId);
}
