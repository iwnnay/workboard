import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { spawnSync } from 'child_process';
import { resolveProjectRoot } from '$lib/server/projects';

/**
 * `git status` for the project's working tree, returned verbatim so the commit
 * modal can show exactly what a terminal would show (staged vs. unstaged vs.
 * untracked, plus the branch line).
 */
export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('projectId') ?? '';

	let root: string;
	try {
		root = await resolveProjectRoot(projectId);
	} catch (caught) {
		return json({ error: (caught as Error).message }, { status: 404 });
	}

	const result = spawnSync('git', ['status'], {
		encoding: 'utf8',
		cwd: root,
		timeout: 30_000
	});

	if (result.error) {
		return json(
			{
				error: `reading git status in ${root}: could not run git status: ${result.error.message}`
			},
			{ status: 500 }
		);
	}

	if (result.status !== 0) {
		return json(
			{
				error:
					`reading git status in ${root}: git status exited with status ` +
					`${result.status}: ${result.stderr?.trim() || 'no stderr output'}`
			},
			{ status: 500 }
		);
	}

	return json({ root, status: result.stdout });
};
