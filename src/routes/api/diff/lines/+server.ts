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

function readFromDisk(cwd: string, filePath: string): string | null {
	try {
		return readFileSync(join(cwd, filePath), 'utf8');
	} catch {
		return null;
	}
}

function readFromRef(cwd: string, filePath: string, ref: string): string | null {
	return tryGit(['show', `${ref}:${filePath}`], cwd, GIT_SHOW_TIMEOUT_MS);
}

function readNewSide(cwd: string, filePath: string, range: string): string | null {
	if (range.includes('..')) {
		return readFromRef(cwd, filePath, sanitiseRef(range)) ?? readFromDisk(cwd, filePath);
	}
	if (/--(cached|staged)\b/.test(range)) {
		return readFromRef(cwd, filePath, '') ?? readFromDisk(cwd, filePath);
	}
	return readFromDisk(cwd, filePath) ?? readFromRef(cwd, filePath, 'HEAD');
}

/** Context lines for expanding a hunk: from the ref when tracked, else from disk. */
export const GET: RequestHandler = ({ url }) =>
	route(async () => {
		const filePath = url.searchParams.get('path') ?? '';
		const start = Math.max(1, parseInt(url.searchParams.get('start') ?? '1'));
		const end = parseInt(url.searchParams.get('end') ?? '1');
		if (!filePath) {
			return { lines: [], total: 0 };
		}

		const cwd = await resolveProjectRoot(url.searchParams.get('projectId') ?? '');
		const content = readNewSide(cwd, filePath, url.searchParams.get('range') ?? 'HEAD');
		if (content === null) {
			return { lines: [], total: 0 };
		}

		const lines = content.split('\n');
		if (lines.at(-1) === '') {
			lines.pop();
		}
		return {
			lines: start > end ? [] : lines.slice(start - 1, end),
			total: lines.length
		};
	});
