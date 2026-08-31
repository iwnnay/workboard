import type { RequestHandler } from './$types';
import { readDiffFiles } from '$lib/server/diff';
import { route } from '$lib/server/http';
import { resolveProjectRoot } from '$lib/server/projects';

/** Re-read the diff without replacing the diff page's cached data. */
export const GET: RequestHandler = ({ url }) =>
	route(async () => {
		const root = await resolveProjectRoot(url.searchParams.get('projectId') ?? '');
		return readDiffFiles(root, url.searchParams.get('range') ?? 'HEAD');
	});
