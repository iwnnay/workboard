import type { PageServerLoad } from './$types';
import { DEFAULT_DIFF_RANGE } from '$lib/constants';
import { db } from '$lib/server/db';
import { project } from '$lib/server/db/schema';
import { readDiffFiles } from '$lib/server/diff';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url, depends }) => {
	depends('diff:data');
	const range = url.searchParams.get('range') ?? DEFAULT_DIFF_RANGE;
	const projectId = url.searchParams.get('projectId') ?? '';

	const projects = await db.select().from(project).orderBy(asc(project.name));

	let cwd = process.cwd();
	if (projectId) {
		const found = projects.find((p) => p.id === projectId);
		if (found) {
			cwd = found.path;
		}
	}

	const { files, error } = readDiffFiles(cwd, range);
	return { files, range, error, projectId, projects, cwd };
};
