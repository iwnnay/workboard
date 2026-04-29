import { describe, it, expect } from 'vitest';
import { parseDiff } from './git';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeDiff(files: string[]) {
	return files.join('\n');
}

// Minimal realistic unified-diff for a single file
function fileDiff(opts: {
	path?: string;
	oldPath?: string;
	isNew?: boolean;
	isDeleted?: boolean;
	isBinary?: boolean;
	hunks?: string[];
}) {
	const path = opts.path ?? 'src/file.ts';
	const oldPath = opts.oldPath ?? path;
	const lines: string[] = [`diff --git a/${oldPath} b/${path}`];

	if (opts.isNew) lines.push('new file mode 100644');
	if (opts.isDeleted) lines.push('deleted file mode 100644');
	if (opts.isBinary) {
		lines.push(`Binary files a/${oldPath} and b/${path} differ`);
		return lines.join('\n');
	}

	lines.push(`index abc1234..def5678 100644`);
	lines.push(`--- a/${oldPath}`);
	lines.push(`+++ b/${path}`);

	for (const hunk of opts.hunks ?? []) {
		lines.push(hunk);
	}
	return lines.join('\n');
}

// ─── parseDiff ────────────────────────────────────────────────────────────────

describe('parseDiff', () => {
	it('returns empty array for empty input', () => {
		expect(parseDiff('')).toEqual([]);
	});

	it('returns empty array for whitespace-only input', () => {
		expect(parseDiff('   \n\n  ')).toEqual([]);
	});

	it('parses a single file with one hunk', () => {
		const raw = fileDiff({
			path: 'src/index.ts',
			hunks: ['@@ -1,3 +1,4 @@\n context\n-removed\n+added\n+extra\n context']
		});
		const [file] = parseDiff(raw);

		expect(file.path).toBe('src/index.ts');
		expect(file.additions).toBe(2);
		expect(file.deletions).toBe(1);
		expect(file.isBinary).toBe(false);
		expect(file.isNew).toBe(false);
		expect(file.isDeleted).toBe(false);
		expect(file.isUntracked).toBe(false);
		expect(file.hunks).toHaveLength(1);
	});

	it('assigns correct line numbers', () => {
		const raw = fileDiff({
			hunks: ['@@ -10,3 +10,4 @@\n context\n-removed\n+added\n+extra\n context']
		});
		const { hunks } = parseDiff(raw)[0];
		const lines = hunks[0].lines;

		expect(lines[0]).toMatchObject({ type: 'context', oldNum: 10, newNum: 10 });
		expect(lines[1]).toMatchObject({ type: 'remove', oldNum: 11, newNum: null });
		expect(lines[2]).toMatchObject({ type: 'add', oldNum: null, newNum: 11 });
		expect(lines[3]).toMatchObject({ type: 'add', oldNum: null, newNum: 12 });
		expect(lines[4]).toMatchObject({ type: 'context', oldNum: 12, newNum: 13 });
	});

	it('strips the leading +/- from line content', () => {
		const raw = fileDiff({
			hunks: ['@@ -1,2 +1,2 @@\n-old content\n+new content']
		});
		const lines = parseDiff(raw)[0].hunks[0].lines;

		expect(lines[0].content).toBe('old content');
		expect(lines[1].content).toBe('new content');
	});

	it('captures hunk context (function name after @@)', () => {
		const raw = fileDiff({
			hunks: ['@@ -1,2 +1,2 @@ function myFunc\n-old\n+new']
		});
		expect(parseDiff(raw)[0].hunks[0].context).toBe('function myFunc');
	});

	it('parses multiple hunks in one file', () => {
		const raw = fileDiff({
			hunks: [
				'@@ -1,2 +1,2 @@\n-a\n+b',
				'@@ -50,2 +50,2 @@\n-c\n+d'
			]
		});
		const file = parseDiff(raw)[0];
		expect(file.hunks).toHaveLength(2);
		expect(file.additions).toBe(2);
		expect(file.deletions).toBe(2);
	});

	it('parses multiple files', () => {
		const raw = makeDiff([
			fileDiff({ path: 'a.ts', hunks: ['@@ -1,1 +1,1 @@\n-x\n+y'] }),
			fileDiff({ path: 'b.ts', hunks: ['@@ -1,1 +1,2 @@\n context\n+new'] })
		]);
		const files = parseDiff(raw);
		expect(files).toHaveLength(2);
		expect(files[0].path).toBe('a.ts');
		expect(files[1].path).toBe('b.ts');
	});

	it('detects new files', () => {
		const raw = fileDiff({
			path: 'new.ts',
			isNew: true,
			hunks: ['@@ -0,0 +1,2 @@\n+line1\n+line2']
		});
		const file = parseDiff(raw)[0];
		expect(file.isNew).toBe(true);
		expect(file.additions).toBe(2);
		expect(file.deletions).toBe(0);
	});

	it('detects deleted files', () => {
		const raw = fileDiff({ path: 'gone.ts', isDeleted: true, hunks: ['@@ -1,1 +0,0 @@\n-old'] });
		const file = parseDiff(raw)[0];
		expect(file.isDeleted).toBe(true);
		expect(file.deletions).toBe(1);
	});

	it('detects binary files and produces no hunks', () => {
		const raw = fileDiff({ path: 'image.png', isBinary: true });
		const file = parseDiff(raw)[0];
		expect(file.isBinary).toBe(true);
		expect(file.hunks).toHaveLength(0);
		expect(file.additions).toBe(0);
		expect(file.deletions).toBe(0);
	});

	it('marks all parsed files as not untracked', () => {
		const raw = fileDiff({ hunks: ['@@ -1,1 +1,1 @@\n-a\n+b'] });
		expect(parseDiff(raw)[0].isUntracked).toBe(false);
	});

	it('handles context lines that are blank (leading space omitted)', () => {
		// Some diff output has lines that are just '\n' (empty context lines)
		const raw = fileDiff({ hunks: ['@@ -1,3 +1,3 @@\n-old\n \n+new'] });
		const lines = parseDiff(raw)[0].hunks[0].lines;
		const contextLine = lines.find((l) => l.type === 'context');
		expect(contextLine).toBeDefined();
		expect(contextLine?.content).toBe('');
	});

	it('ignores \\ No newline at end of file markers', () => {
		const raw = fileDiff({
			hunks: ['@@ -1,1 +1,1 @@\n-old\n\\ No newline at end of file\n+new']
		});
		const lines = parseDiff(raw)[0].hunks[0].lines;
		// Should only have remove + add, not the backslash line
		expect(lines.every((l) => !l.content.includes('No newline'))).toBe(true);
		expect(lines).toHaveLength(2);
	});

	it('handles renames (different old/new path)', () => {
		const raw = fileDiff({ oldPath: 'src/old.ts', path: 'src/new.ts' });
		// path should be the destination (b/ side)
		expect(parseDiff(raw)[0].path).toBe('src/new.ts');
	});

	it('handles file with path containing spaces', () => {
		const raw = fileDiff({ path: 'src/my file.ts' });
		expect(parseDiff(raw)[0].path).toBe('src/my file.ts');
	});
});
