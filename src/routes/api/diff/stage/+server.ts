import type { RequestHandler } from './$types';
import { runGit } from '$lib/server/git';
import { badRequest, readJsonBody, route } from '$lib/server/http';
import { resolveProjectRoot } from '$lib/server/projects';
import { resolveSafePath } from '$lib/server/paths';

/**
 * `git add -- <path>` for one file, or `git add -- .` from the project root with
 * `all: true`. Deletions stage too, as they do on the command line.
 */
export const POST: RequestHandler = ({ request }) =>
	route(async () => {
		const body = await readJsonBody<{ projectId?: string; path?: string; all?: boolean }>(request);
		const filePath = body.path ?? '';
		const stageAll = body.all === true;

		if (!stageAll && !filePath) {
			throw badRequest('staging file: no path was provided and "all" was not set');
		}

		const root = await resolveProjectRoot(body.projectId ?? '');
		if (!stageAll) {
			resolveSafePath(root, filePath);
		}

		const target = stageAll ? '.' : filePath;
		const label = stageAll ? 'all changes' : `file "${filePath}"`;
		runGit(['add', '--', target], root, `staging ${label}`);

		return { staged: target };
	});
