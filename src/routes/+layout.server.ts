import type { LayoutServerLoad } from './$types';
import { listProjects } from '$lib/server/projects';

export const load: LayoutServerLoad = async ({ depends }) => {
	depends('app:projects');
	return { projects: await listProjects() };
};
