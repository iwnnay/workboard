import { describe, expect, it } from 'vitest';
import {
	ABSENT_DIFF_FINGERPRINT,
	diffFileFingerprint,
	findIncrementalDiffLines,
	findTouchedDiffPaths
} from '$lib/diff-snapshot';
import type { DiffFile } from '$lib/server/git';

function diffFile(path: string, content: string, revision?: string): DiffFile {
	return {
		path,
		hunks: [
			{
				header: '@@ -1 +1 @@',
				context: '',
				lines: [{ type: 'add', content, oldNum: null, newNum: 1 }]
			}
		],
		additions: 1,
		deletions: 0,
		isBinary: false,
		isNew: false,
		isDeleted: false,
		isUntracked: false,
		isStaged: false,
		revision
	};
}

describe('diff snapshots', () => {
	it('keeps equal files untouched and finds changed, added, and removed files', () => {
		const stable = diffFile('stable.ts', 'same');
		const changed = diffFile('changed.ts', 'before');
		const removed = diffFile('removed.ts', 'before');
		const acknowledged = new Map([
			['stable.ts', diffFileFingerprint(stable)],
			['changed.ts', diffFileFingerprint(changed)],
			['removed.ts', diffFileFingerprint(removed)]
		]);

		expect(
			findTouchedDiffPaths(acknowledged, [
				stable,
				diffFile('changed.ts', 'after'),
				diffFile('added.ts', 'new')
			])
		).toEqual(new Set(['changed.ts', 'removed.ts', 'added.ts']));
	});

	it('uses the absent marker to acknowledge a file that dropped out of the diff', () => {
		expect(findTouchedDiffPaths(new Map([['gone.ts', ABSENT_DIFF_FINGERPRINT]]), [])).toEqual(
			new Set()
		);
	});

	it('distinguishes binary revisions even when there are no textual hunks', () => {
		const before = { ...diffFile('image.png', ''), hunks: [], additions: 0, revision: 'aaa..bbb' };
		const after = { ...before, revision: 'aaa..ccc' };
		expect(diffFileFingerprint(before)).not.toBe(diffFileFingerprint(after));
	});

	it('identifies only live +/- lines introduced since acknowledgement', () => {
		const before = diffFile('app.ts', 'before');
		before.hunks[0].lines.unshift({ type: 'remove', content: 'original', oldNum: 1, newNum: null });
		const after = diffFile('app.ts', 'after');
		after.hunks[0].lines.unshift({ type: 'remove', content: 'original', oldNum: 1, newNum: null });

		const incremental = findIncrementalDiffLines(before, after);
		expect([...incremental]).toEqual([after.hunks[0].lines[1]]);
	});

	it('marks all changed lines in a newly appearing file but never context', () => {
		const current = diffFile('new.ts', 'new');
		current.hunks[0].lines.unshift({ type: 'context', content: 'nearby', oldNum: 1, newNum: 1 });
		expect(findIncrementalDiffLines(undefined, current)).toEqual(
			new Set([current.hunks[0].lines[1]])
		);
	});
});
