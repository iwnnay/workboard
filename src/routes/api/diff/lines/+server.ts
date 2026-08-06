import type { RequestHandler } from './$types';
import { readFileSync } from 'fs';
import { join } from 'path';
import { tryGit } from '$lib/server/git';
import { route } from '$lib/server/http';
import { resolveProjectRoot } from '$lib/server/projects';

const GIT_SHOW_TIMEOUT_MS = 5_000;

/** Refs may only contain the characters git itself allows in a revision. */
function sanitiseRef(range: string): string {
	const safeRange = range.replace(/[^a-zA-Z0-9.\-_/~^@{}:]/g, '');
	if (!safeRange.includes('..')) {
		return 'HEAD';
	}
	return safeRange.split('..').at(-1) || 'HEAD';
}

/** Context lines for expanding a hunk: from the ref when tracked, else from disk. */
export const GET: RequestHandler = ({ url }) =>
	route(async () => {
		const filePath = url.searchParams.get('path') ?? '';
		const start = Math.max(1, parseInt(url.searchParams.get('start') ?? '1'));
		const end = parseInt(url.searchParams.get('end') ?? '1');
		if (!filePath || start > end) {
			return { lines: [] };
		}

		const cwd = await resolveProjectRoot(url.searchParams.get('projectId') ?? '');
		const ref = sanitiseRef(url.searchParams.get('range') ?? 'HEAD');

		let content = tryGit(['show', `${ref}:${filePath}`], cwd, GIT_SHOW_TIMEOUT_MS);
		if (content === null) {
			try {
				content = readFileSync(join(cwd, filePath), 'utf8');
			} catch {
				return { lines: [] };
			}
		}

		const lines = content.split('\n');
		if (lines.at(-1) === '') {
			lines.pop();
		}
		return { lines: lines.slice(start - 1, end) };
	});
