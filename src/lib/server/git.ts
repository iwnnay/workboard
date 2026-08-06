import { readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { ApiError } from './http';

const GIT_TIMEOUT_MS = 30_000;

export type GitOutcome = {
	stdout: string;
	/** stdout and stderr together — git splits its reporting across both. */
	output: string;
	/** The message describing what went wrong, or null when the command ran. */
	failure: string | null;
};

function execGit(
	args: string[],
	cwd: string,
	operation: string,
	timeoutMs = GIT_TIMEOUT_MS
): GitOutcome {
	const result = spawnSync('git', args, { encoding: 'utf8', cwd, timeout: timeoutMs });
	const stdout = result.stdout ?? '';
	const output = [stdout.trim(), result.stderr?.trim()].filter(Boolean).join('\n');
	const subcommand = args[0] ?? '(none)';

	if (result.error) {
		return {
			stdout,
			output,
			failure: `${operation} in ${cwd}: could not run git ${subcommand}: ${result.error.message}`
		};
	}

	if (result.status !== 0) {
		return {
			stdout,
			output,
			failure:
				`${operation} in ${cwd}: git ${subcommand} exited with status ${result.status}: ` +
				`${output || 'no output'}`
		};
	}

	return { stdout, output, failure: null };
}

/** Run git, or throw a 500 naming the operation, the repository and git's output. */
export function runGit(
	args: string[],
	cwd: string,
	operation: string,
	timeoutMs = GIT_TIMEOUT_MS
): string {
	const outcome = execGit(args, cwd, operation, timeoutMs);
	if (outcome.failure !== null) {
		throw new ApiError(outcome.failure, 500);
	}
	return outcome.stdout;
}

/** Run git where failure is an expected answer; null means it did not succeed. */
export function tryGit(args: string[], cwd: string, timeoutMs = GIT_TIMEOUT_MS): string | null {
	const outcome = execGit(args, cwd, 'running git', timeoutMs);
	return outcome.failure === null ? outcome.stdout : null;
}

/** Run git and report the outcome, for callers that must not abandon their work. */
export function attemptGit(
	args: string[],
	cwd: string,
	operation: string,
	timeoutMs = GIT_TIMEOUT_MS
): GitOutcome {
	return execGit(args, cwd, operation, timeoutMs);
}

export type DiffLine = {
	type: 'add' | 'remove' | 'context';
	content: string;
	oldNum: number | null;
	newNum: number | null;
};

export type DiffHunk = {
	header: string;
	context: string;
	lines: DiffLine[];
};

export type DiffFile = {
	path: string;
	hunks: DiffHunk[];
	additions: number;
	deletions: number;
	isBinary: boolean;
	isNew: boolean;
	isDeleted: boolean;
	isUntracked: boolean;
};

export function parseDiff(raw: string): DiffFile[] {
	const files: DiffFile[] = [];
	let file: DiffFile | null = null;
	let hunk: DiffHunk | null = null;
	let oldLine = 0;
	let newLine = 0;

	for (const line of raw.split('\n')) {
		if (line.startsWith('diff --git ')) {
			const m = line.match(/diff --git a\/(.+) b\/(.+)/);
			file = {
				path: m?.[2] ?? 'unknown',
				hunks: [],
				additions: 0,
				deletions: 0,
				isBinary: false,
				isNew: false,
				isDeleted: false,
				isUntracked: false
			};
			hunk = null;
			files.push(file);
		} else if (!file) {
			continue;
		} else if (line.startsWith('new file')) {
			file.isNew = true;
		} else if (line.startsWith('deleted file')) {
			file.isDeleted = true;
		} else if (line.startsWith('Binary files')) {
			file.isBinary = true;
		} else if (line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('index ')) {
			continue;
		} else if (line.startsWith('@@ ')) {
			const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
			if (m) {
				oldLine = parseInt(m[1]);
				newLine = parseInt(m[2]);
				hunk = { header: line, context: m[3].trim(), lines: [] };
				file.hunks.push(hunk);
			}
		} else if (hunk) {
			if (line.startsWith('+')) {
				hunk.lines.push({ type: 'add', content: line.slice(1), oldNum: null, newNum: newLine++ });
				file.additions++;
			} else if (line.startsWith('-')) {
				hunk.lines.push({
					type: 'remove',
					content: line.slice(1),
					oldNum: oldLine++,
					newNum: null
				});
				file.deletions++;
			} else if (line.startsWith(' ') || line === '') {
				hunk.lines.push({
					type: 'context',
					content: line.startsWith(' ') ? line.slice(1) : '',
					oldNum: oldLine++,
					newNum: newLine++
				});
			}
			// skip '\ No newline at end of file'
		}
	}

	return files;
}

export function getUntrackedDiffs(cwd: string): DiffFile[] {
	const listing = tryGit(['ls-files', '--others', '--exclude-standard', '-z'], cwd, 10_000);
	if (!listing?.trim()) {
		return [];
	}

	// -z separates with NUL, which filenames cannot contain.
	const paths = listing.trim().split('\0').filter(Boolean);
	const result: DiffFile[] = [];

	for (const filePath of paths) {
		const fullPath = join(cwd, filePath);
		try {
			const buf = readFileSync(fullPath);
			const isBinary = buf.subarray(0, 8192).indexOf(0) !== -1;

			if (isBinary) {
				result.push({
					path: filePath,
					hunks: [],
					additions: 0,
					deletions: 0,
					isBinary: true,
					isNew: true,
					isDeleted: false,
					isUntracked: true
				});
				continue;
			}

			const text = buf.toString('utf8');
			const lines = text.split('\n');
			if (lines.at(-1) === '') {
				lines.pop();
			} // strip trailing newline artifact

			const diffLines: DiffLine[] = lines.map((content, i) => ({
				type: 'add' as const,
				content,
				oldNum: null,
				newNum: i + 1
			}));

			result.push({
				path: filePath,
				hunks: [
					{
						header: `@@ -0,0 +1,${lines.length} @@`,
						context: '',
						lines: diffLines
					}
				],
				additions: lines.length,
				deletions: 0,
				isBinary: false,
				isNew: true,
				isDeleted: false,
				isUntracked: true
			});
		} catch {
			// skip unreadable files (permissions, etc.)
		}
	}

	return result;
}
