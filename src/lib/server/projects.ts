import { statSync } from 'fs';
import { basename, resolve } from 'path';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { fullReviewFile, fullReviewScope, project } from '$lib/server/db/schema';
import {
	defaultProjectSettings,
	normalizeProjectSettings,
	parseProjectSettings,
	type ProjectSettings
} from '$lib/project-settings';
import type { Project } from '$lib/types';
import { ApiError, badRequest, notFound } from './http';

type ProjectRow = typeof project.$inferSelect;

export type ProjectContext = {
	root: string;
	settings: ProjectSettings;
};

const toProject = (row: ProjectRow): Project => ({
	...row,
	settings: parseProjectSettings(row.settings, `reading project ${row.id} ("${row.name}")`)
});

const comparablePath = (path: string): string => {
	const resolved = resolve(path);
	return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

const requireDirectory = (rawPath: unknown, context: string): string => {
	const trimmed = typeof rawPath === 'string' ? rawPath.trim() : '';
	if (!trimmed) {
		throw badRequest(`${context}: a project path is required, but none was given`);
	}
	const absolutePath = resolve(trimmed);
	let isDirectory: boolean;
	try {
		isDirectory = statSync(absolutePath).isDirectory();
	} catch (caught) {
		throw badRequest(
			`${context}: path "${absolutePath}" cannot be read: ${(caught as Error).message}`
		);
	}
	if (!isDirectory) {
		throw badRequest(`${context}: path "${absolutePath}" is a file, not a directory`);
	}
	return absolutePath;
};

const requireName = (rawName: unknown, fallback: string, context: string): string => {
	if (rawName === undefined) {
		return fallback;
	}
	if (typeof rawName !== 'string') {
		throw badRequest(`${context}: "name" must be a string, got ${JSON.stringify(rawName)}`);
	}
	return rawName.trim() || fallback;
};

const assertPathUnused = async (absolutePath: string, exceptId: string | null, context: string) => {
	const rows = await db.select().from(project);
	const clash = rows.find(
		(row) => row.id !== exceptId && comparablePath(row.path) === comparablePath(absolutePath)
	);
	if (clash) {
		throw new ApiError(
			`${context}: path "${absolutePath}" is already used by project "${clash.name}" (${clash.id})`,
			409
		);
	}
};

const toSettingsError = (caught: unknown): ApiError =>
	caught instanceof ApiError ? caught : badRequest((caught as Error).message);

export const listProjects = async (): Promise<Project[]> => {
	const rows = await db.select().from(project).orderBy(asc(project.name));
	return rows.map(toProject);
};

export const getProject = async (projectId: string): Promise<Project> => {
	const rows = await db.select().from(project).where(eq(project.id, projectId));
	if (!rows[0]) {
		throw notFound(`loading project ${projectId}: no such row in the project table`);
	}
	return toProject(rows[0]);
};

export const createProject = async (input: unknown): Promise<Project> => {
	const draft = (input ?? {}) as Record<string, unknown>;
	const context = 'creating project';
	const path = requireDirectory(draft.path, context);
	const name = requireName(draft.name, basename(path), context);
	let settings: ProjectSettings;
	try {
		settings = normalizeProjectSettings(draft.settings, defaultProjectSettings, context);
	} catch (caught) {
		throw toSettingsError(caught);
	}
	await assertPathUnused(path, null, context);
	const [created] = await db
		.insert(project)
		.values({ name, path, settings: JSON.stringify(settings) })
		.returning();
	return toProject(created);
};

export const updateProject = async (projectId: string, input: unknown): Promise<Project> => {
	const draft = (input ?? {}) as Record<string, unknown>;
	const context = `updating project ${projectId}`;
	const existing = await getProject(projectId);
	const path = draft.path === undefined ? existing.path : requireDirectory(draft.path, context);
	const name = requireName(draft.name, existing.name, context);
	let settings: ProjectSettings;
	try {
		settings = normalizeProjectSettings(draft.settings, existing.settings, context);
	} catch (caught) {
		throw toSettingsError(caught);
	}
	if (path !== existing.path) {
		await assertPathUnused(path, projectId, context);
	}
	const [updated] = await db
		.update(project)
		.set({ name, path, settings: JSON.stringify(settings) })
		.where(eq(project.id, projectId))
		.returning();
	return toProject(updated);
};

export const deleteProject = async (projectId: string): Promise<{ success: true }> => {
	await getProject(projectId);
	db.transaction((transaction) => {
		transaction.delete(fullReviewFile).where(eq(fullReviewFile.projectId, projectId)).run();
		transaction.delete(fullReviewScope).where(eq(fullReviewScope.projectId, projectId)).run();
		transaction.delete(project).where(eq(project.id, projectId)).run();
	});
	return { success: true };
};

/**
 * The filesystem root for a project id. An empty id means this repo and resolves
 * to the app's own working directory.
 */
export async function resolveProjectRoot(projectId: string): Promise<string> {
	if (!projectId) {
		return process.cwd();
	}
	const rows = await db.select().from(project).where(eq(project.id, projectId));
	if (!rows[0]) {
		throw notFound(
			`resolving project root: project ${projectId} does not exist in the project table`
		);
	}
	return rows[0].path;
}

export const resolveProjectContext = async (projectId: string): Promise<ProjectContext> => {
	if (!projectId) {
		return { root: process.cwd(), settings: { ...defaultProjectSettings } };
	}
	const found = await getProject(projectId);
	return { root: found.path, settings: found.settings };
};
