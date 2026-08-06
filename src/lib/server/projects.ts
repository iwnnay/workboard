import { db } from '$lib/server/db';
import { project } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from './http';

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
