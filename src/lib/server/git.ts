import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

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
				hunk.lines.push({ type: 'remove', content: line.slice(1), oldNum: oldLine++, newNum: null });
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
	let output: string;
	try {
		output = execSync('git ls-files --others --exclude-standard -z', {
			encoding: 'utf8',
			cwd,
			timeout: 10_000
		}).trim();
	} catch {
		return [];
	}

	if (!output) return [];

	// -z uses NUL as separator — safe for filenames with spaces/newlines
	const paths = output.split('\0').filter(Boolean);
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
			if (lines.at(-1) === '') lines.pop(); // strip trailing newline artifact

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
