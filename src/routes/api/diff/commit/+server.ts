import type { RequestHandler } from './$types';
import { attemptGit, runGit } from '$lib/server/git';
import { badRequest, readJsonBody, route } from '$lib/server/http';
import { resolveProjectRoot } from '$lib/server/projects';

const COMMIT_TIMEOUT_MS = 120_000;

/**
 * Commit what the Stage buttons put in the index — `git commit -m <message>`,
 * no `-a` and no `--no-verify`. The message travels as an argv entry, never
 * through a shell.
 *
 * With `push: true` a plain `git push` follows. A push that fails still answers
 * 200 with `pushError` set, because the commit itself landed.
 */
export const POST: RequestHandler = ({ request }) =>
	route(async () => {
		const body = await readJsonBody<{ projectId?: string; message?: string; push?: boolean }>(
			request
		);
		const message = (body.message ?? '').trim();
		if (!message) {
			throw badRequest('committing changes: the commit message was empty');
		}

		const root = await resolveProjectRoot(body.projectId ?? '');
		const output = runGit(['commit', '-m', message], root, 'committing changes', COMMIT_TIMEOUT_MS);

		if (body.push !== true) {
			return { root, output, pushed: false, pushOutput: '', pushError: null };
		}

		const push = attemptGit(['push'], root, 'pushing after committing', COMMIT_TIMEOUT_MS);
		return {
			root,
			output,
			pushed: push.failure === null,
			pushOutput: push.output,
			pushError: push.failure
		};
	});
