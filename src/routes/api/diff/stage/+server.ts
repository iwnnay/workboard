import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { spawnSync } from 'child_process';
import { resolveProjectRoot } from '$lib/server/projects';
import { resolveSafePath } from '$lib/server/paths';

/**
 * Stage files in the project's working tree. With `path`, runs
 * `git add -- <path>` for that single file; with `all: true`, runs
 * `git add .` from the project root. Also stages deletions, matching
 * `git add`'s normal behavior.
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: { projectId?: string; path?: string; all?: boolean };
	try {
		body = await request.json();
	} catch (caught) {
		return json(
			{ error: `staging file: request body is not valid JSON: ${(caught as Error).message}` },
			{ status: 400 }
		);
	}

	const projectId = body.projectId ?? '';
	const filePath = body.path ?? '';
	const stageAll = body.all === true;

	if (!stageAll && !filePath) {
		return json(
			{ error: 'staging file: no path was provided and "all" was not set' },
			{ status: 400 }
		);
	}

	let root: string;
	try {
		root = await resolveProjectRoot(projectId);
	} catch (caught) {
		return json({ error: (caught as Error).message }, { status: 404 });
	}

	if (!stageAll) {
		try {
			resolveSafePath(root, filePath);
		} catch (caught) {
			return json({ error: (caught as Error).message }, { status: 403 });
		}
	}

	const target = stageAll ? '.' : filePath;
	const targetLabel = stageAll ? 'all changes' : `file "${filePath}"`;

	const result = spawnSync('git', ['add', '--', target], {
		encoding: 'utf8',
		cwd: root,
		timeout: 30_000
	});

	if (result.error) {
		return json(
			{
				error: `staging ${targetLabel} in ${root}: could not run git add: ${result.error.message}`
			},
			{ status: 500 }
		);
	}

	if (result.status !== 0) {
		return json(
			{
				error:
					`staging ${targetLabel} in ${root}: git add exited with status ` +
					`${result.status}: ${result.stderr?.trim() || 'no stderr output'}`
			},
			{ status: 500 }
		);
	}

	return json({ staged: stageAll ? '.' : filePath });
};
