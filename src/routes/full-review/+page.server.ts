import type { PageServerLoad } from './$types';
import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { project } from '$lib/server/db/schema';
import { getFullReviewState } from '$lib/server/full-review';

export const load: PageServerLoad = async ({ url, depends }) => {
	depends('full-review:data');
	const projects = await db.select().from(project).orderBy(asc(project.name));
	const requestedId = url.searchParams.get('projectId') ?? '';
	const projectId = projects.some((entry) => entry.id === requestedId)
		? requestedId
		: (projects[0]?.id ?? '');
	const review = projectId
		? await getFullReviewState(projectId)
		: { directories: [], files: [], baselineAt: null, lastPolledAt: null };
	return { projects, projectId, review };
};
