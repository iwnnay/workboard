import type { PageServerLoad } from './$types';
import { listProjects } from '$lib/server/projects';
import { getFullReviewState } from '$lib/server/full-review';

export const load: PageServerLoad = async ({ url, depends }) => {
	depends('full-review:data');
	depends('app:projects');
	const projects = await listProjects();
	const requestedId = url.searchParams.get('projectId') ?? '';
	const projectId = projects.some((entry) => entry.id === requestedId)
		? requestedId
		: (projects[0]?.id ?? '');
	const review = projectId
		? await getFullReviewState(projectId)
		: { directories: [], files: [], baselineAt: null, lastPolledAt: null };
	return { projectId, review };
};
