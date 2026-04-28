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
				isDeleted: false
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
