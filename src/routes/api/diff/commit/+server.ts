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
 *
 * With `push: true` a plain `git push` follows a successful commit. A push that
 * fails still answers 200 with `pushError` set: the commit itself landed, and
 * reporting the whole request as failed would suggest otherwise.
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: { projectId?: string; message?: string; push?: boolean };
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
	const push = body.push === true;

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

	if (!push) {
		return json({ root, output: result.stdout, pushed: false, pushOutput: '', pushError: null });
	}

	// Plain `git push` — the branch's configured upstream, no --set-upstream and no
	// force. When there is no upstream, git says so and names the command to fix
	// it; that message is carried back verbatim rather than guessed at here.
	const pushResult = spawnSync('git', ['push'], {
		encoding: 'utf8',
		cwd: root,
		timeout: 120_000
	});

	// git push reports progress on stderr even when it succeeds, so both streams
	// make up its output.
	const pushOutput = [pushResult.stdout?.trim(), pushResult.stderr?.trim()]
		.filter(Boolean)
		.join('\n');

	if (pushResult.error) {
		return json({
			root,
			output: result.stdout,
			pushed: false,
			pushOutput,
			pushError: `pushing ${root} after committing: could not run git push: ${pushResult.error.message}`
		});
	}

	if (pushResult.status !== 0) {
		return json({
			root,
			output: result.stdout,
			pushed: false,
			pushOutput,
			pushError:
				`pushing ${root} after committing: git push exited with status ` +
				`${pushResult.status}: ${pushOutput || 'no output'}`
		});
	}

	return json({ root, output: result.stdout, pushed: true, pushOutput, pushError: null });
};
