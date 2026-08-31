import { beforeEach, describe, expect, it, vi } from 'vitest';

const git = vi.hoisted(() => ({
	getUntrackedDiffs: vi.fn(),
	markStagedFiles: vi.fn(),
	parseDiff: vi.fn(),
	runGit: vi.fn(),
	tryGit: vi.fn()
}));
vi.mock('$lib/server/git', () => git);

const { readDiffFiles, sanitiseDiffRange } = await import('$lib/server/diff');

beforeEach(() => {
	vi.clearAllMocks();
	git.runGit.mockReturnValue('raw diff');
	git.parseDiff.mockReturnValue([{ path: 'tracked.ts' }]);
	git.tryGit.mockReturnValue('');
	git.getUntrackedDiffs.mockReturnValue([{ path: 'untracked.ts' }]);
});

describe('readDiffFiles', () => {
	it('passes a sanitised range to git as an argument and combines untracked files', () => {
		expect(readDiffFiles('C:\\repo', 'HEAD; remove-everything')).toEqual({
			files: [{ path: 'tracked.ts' }, { path: 'untracked.ts' }],
			error: null
		});
		expect(git.runGit).toHaveBeenCalledWith(
			['diff', 'HEADremove-everything'],
			'C:\\repo',
			'reading diff for HEAD; remove-everything',
			10_000
		);
	});

	it('falls back to untracked files and returns the Git error', () => {
		git.runGit.mockImplementation(() => {
			throw new Error('bad revision');
		});
		expect(readDiffFiles('C:\\repo', 'missing')).toEqual({
			files: [{ path: 'untracked.ts' }],
			error: 'bad revision'
		});
	});
});

describe('sanitiseDiffRange', () => {
	it('uses HEAD when sanitising leaves an empty range', () => {
		expect(sanitiseDiffRange(' ; ')).toBe('HEAD');
	});
});
