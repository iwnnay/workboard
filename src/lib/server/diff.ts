import { getUntrackedDiffs, markStagedFiles, parseDiff, runGit, tryGit } from './git';

const DIFF_TIMEOUT_MS = 10_000;

function readChangedPaths(cwd: string, staged: boolean): Set<string> {
	const args = ['diff', ...(staged ? ['--cached'] : []), '--name-only', '-z'];
	const listing = tryGit(args, cwd, DIFF_TIMEOUT_MS);
	return new Set(listing ? listing.split('\0').filter(Boolean) : []);
}

export function sanitiseDiffRange(range: string): string {
	return range.replace(/[^a-zA-Z0-9.\-_/~^@{}:]/g, '') || 'HEAD';
}

/** Read the complete diff-page model without retaining a filesystem snapshot. */
export function readDiffFiles(cwd: string, range: string) {
	try {
		const raw = runGit(
			['diff', sanitiseDiffRange(range)],
			cwd,
			`reading diff for ${range}`,
			DIFF_TIMEOUT_MS
		);
		const tracked = parseDiff(raw);
		const stagedPaths = readChangedPaths(cwd, true);
		const unstagedPaths = readChangedPaths(cwd, false);
		markStagedFiles(tracked, stagedPaths, unstagedPaths);
		const trackedPaths = new Set(tracked.map((file) => file.path));
		const untracked = getUntrackedDiffs(cwd).filter((file) => !trackedPaths.has(file.path));
		return { files: [...tracked, ...untracked], error: null };
	} catch (caught) {
		return {
			files: getUntrackedDiffs(cwd),
			error: caught instanceof Error ? caught.message : String(caught)
		};
	}
}
