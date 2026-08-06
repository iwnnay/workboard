import type { RequestHandler } from './$types';
import { runGit } from '$lib/server/git';
import { route } from '$lib/server/http';
import { resolveProjectRoot } from '$lib/server/projects';

/** `git status` verbatim, so the commit modal shows what a terminal would. */
export const GET: RequestHandler = ({ url }) =>
	route(async () => {
		const root = await resolveProjectRoot(url.searchParams.get('projectId') ?? '');
		return { root, status: runGit(['status'], root, 'reading git status') };
	});
