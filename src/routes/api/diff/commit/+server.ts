import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { spawnSync } from 'child_process';
import { resolveProjectRoot } from '$lib/server/projects';

/**
 * Commit the project's STAGED changes with the supplied message — `git commit
 * -m <message>`, nothing else (no `-a`, no `--no-verify`), so what gets
 * committed is exactly what the Stage buttons put in the index. The message is
 * passed as an argv entry, never through a shell, so newlines and quotes in it
 * are safe.
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: { projectId?: string; message?: string };
	try {
		body = await request.json();
	} catch (caught) {
		return json(
			{ error: `committing changes: request body is not valid JSON: ${(caught as Error).message}` },
			{ status: 400 }
		);
	}

	const projectId = body.projectId ?? '';
	const message = (body.message ?? '').trim();

	if (!message) {
		return json({ error: 'committing changes: the commit message was empty' }, { status: 400 });
	}

	let root: string;
	try {
		root = await resolveProjectRoot(projectId);
	} catch (caught) {
		return json({ error: (caught as Error).message }, { status: 404 });
	}

	const result = spawnSync('git', ['commit', '-m', message], {
		encoding: 'utf8',
		cwd: root,
		timeout: 120_000
	});

	if (result.error) {
		return json(
			{
				error: `committing changes in ${root}: could not run git commit: ${result.error.message}`
			},
			{ status: 500 }
		);
	}

	if (result.status !== 0) {
		// git writes the useful part here to stdout ("nothing to commit, working
		// tree clean", hook output) and only some of it to stderr — keep both.
		const detail = [result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join('\n');
		return json(
			{
				error:
					`committing changes in ${root}: git commit exited with status ` +
					`${result.status}: ${detail || 'no output'}`
			},
			{ status: 500 }
		);
	}

	return json({ root, output: result.stdout });
};
