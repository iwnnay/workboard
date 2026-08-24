import type { PageServerLoad } from './$types';
import { execSync } from 'child_process';
import { parseDiff, getUntrackedDiffs, markStagedFiles, tryGit } from '$lib/server/git';
import { DEFAULT_DIFF_RANGE } from '$lib/constants';
import { db } from '$lib/server/db';
import { project } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

const CHANGED_PATHS_TIMEOUT_MS = 10_000;

function readChangedPaths(cwd: string, staged: boolean): Set<string> {
	const args = ['diff', ...(staged ? ['--cached'] : []), '--name-only', '-z'];
	const listing = tryGit(args, cwd, CHANGED_PATHS_TIMEOUT_MS);
	return new Set(listing ? listing.split('\0').filter(Boolean) : []);
}

export const load: PageServerLoad = async ({ url, depends }) => {
	depends('diff:data');
	const range = url.searchParams.get('range') ?? DEFAULT_DIFF_RANGE;
	const projectId = url.searchParams.get('projectId') ?? '';
	const safeRange = range.replace(/[^a-zA-Z0-9.\-_/~^@{}:]/g, '');

	const projects = await db.select().from(project).orderBy(asc(project.name));

	let cwd = process.cwd();
	if (projectId) {
		const found = projects.find((p) => p.id === projectId);
		if (found) {
			cwd = found.path;
		}
	}

	try {
		const raw = execSync(`git diff ${safeRange}`, {
			encoding: 'utf8',
			cwd,
			maxBuffer: 10 * 1024 * 1024,
			timeout: 10_000
		});
		const tracked = parseDiff(raw);
		const stagedPaths = readChangedPaths(cwd, true);
		const unstagedPaths = readChangedPaths(cwd, false);
		markStagedFiles(tracked, stagedPaths, unstagedPaths);
		const trackedPaths = new Set(tracked.map((f) => f.path));
		const untracked = getUntrackedDiffs(cwd).filter((f) => !trackedPaths.has(f.path));
		return { files: [...tracked, ...untracked], range, error: null, projectId, projects, cwd };
	} catch (e: unknown) {
		const msg =
			(e as { stderr?: Buffer })?.stderr?.toString()?.trim() ??
			(e instanceof Error ? e.message : String(e));
		const untracked = getUntrackedDiffs(cwd);
		return { files: untracked, range, error: msg, projectId, projects, cwd };
	}
};
