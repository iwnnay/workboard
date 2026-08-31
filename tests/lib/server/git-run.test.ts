import { describe, it, expect, vi, beforeEach } from 'vitest';

const spawnSync = vi.hoisted(() => vi.fn());
vi.mock('child_process', () => ({ spawnSync }));

const { attemptGit, runGit, tryGit } = await import('$lib/server/git');
const { ApiError } = await import('$lib/server/http');

function succeeds(stdout = '', stderr = '') {
	spawnSync.mockReturnValue({ status: 0, stdout, stderr, error: undefined });
}

function exits(status: number, stdout = '', stderr = '') {
	spawnSync.mockReturnValue({ status, stdout, stderr, error: undefined });
}

function failsToRun(message: string) {
	spawnSync.mockReturnValue({ status: null, stdout: '', stderr: '', error: new Error(message) });
}

beforeEach(() => {
	spawnSync.mockReset();
});

describe('runGit', () => {
	it('passes the arguments to git without a shell', () => {
		succeeds('On branch main\n');
		runGit(['status'], 'C:\\repo', 'reading git status');

		expect(spawnSync).toHaveBeenCalledWith('git', ['status'], {
			encoding: 'utf8',
			cwd: 'C:\\repo',
			timeout: 30_000,
			maxBuffer: 10 * 1024 * 1024
		});
	});

	it('returns stdout on success', () => {
		succeeds('On branch main\n');
		expect(runGit(['status'], 'C:\\repo', 'reading git status')).toBe('On branch main\n');
	});

	it('names the operation, repository and git output when git exits non-zero', () => {
		exits(1, 'nothing to commit, working tree clean');
		expect(() => runGit(['commit', '-m', 'x'], 'C:\\repo', 'committing changes')).toThrow(
			'committing changes in C:\\repo: git commit exited with status 1: ' +
				'nothing to commit, working tree clean'
		);
	});

	it('reports when git could not be run at all', () => {
		failsToRun('spawnSync git ENOENT');
		expect(() => runGit(['status'], 'C:\\repo', 'reading git status')).toThrow(
			'reading git status in C:\\repo: could not run git status: spawnSync git ENOENT'
		);
	});

	it('throws a 500, since a working git is the app\u2019s problem', () => {
		exits(128, '', 'fatal: not a git repository');
		try {
			runGit(['status'], 'C:\\repo', 'reading git status');
			expect.unreachable('runGit should have thrown');
		} catch (caught) {
			expect(caught).toBeInstanceOf(ApiError);
			expect((caught as InstanceType<typeof ApiError>).status).toBe(500);
		}
	});

	it('says so when git failed silently', () => {
		exits(1);
		expect(() => runGit(['push'], 'C:\\repo', 'pushing')).toThrow(/status 1: no output/);
	});

	it('honours a caller timeout', () => {
		succeeds();
		runGit(['show', 'HEAD:file.ts'], 'C:\\repo', 'reading file', 5_000);
		expect(spawnSync).toHaveBeenCalledWith('git', ['show', 'HEAD:file.ts'], {
			encoding: 'utf8',
			cwd: 'C:\\repo',
			timeout: 5_000,
			maxBuffer: 10 * 1024 * 1024
		});
	});
});

describe('tryGit', () => {
	it('returns stdout when git succeeds', () => {
		succeeds('file-one\0file-two\0');
		expect(tryGit(['ls-files'], 'C:\\repo')).toBe('file-one\0file-two\0');
	});

	it('returns null instead of throwing when git exits non-zero', () => {
		exits(128, '', 'fatal: path does not exist in HEAD');
		expect(tryGit(['show', 'HEAD:missing.ts'], 'C:\\repo')).toBeNull();
	});

	it('returns null when git could not be run', () => {
		failsToRun('spawnSync git ENOENT');
		expect(tryGit(['status'], 'C:\\repo')).toBeNull();
	});
});

describe('attemptGit', () => {
	it('reports success with both streams joined', () => {
		succeeds('Everything up-to-date\n', 'To github.com:me/repo.git\n');
		expect(attemptGit(['push'], 'C:\\repo', 'pushing after committing')).toEqual({
			stdout: 'Everything up-to-date\n',
			output: 'Everything up-to-date\nTo github.com:me/repo.git',
			failure: null
		});
	});

	it('reports a failure message instead of throwing', () => {
		exits(128, '', 'fatal: The current branch main has no upstream branch');
		const outcome = attemptGit(['push'], 'C:\\repo', 'pushing after committing');

		expect(outcome.failure).toBe(
			'pushing after committing in C:\\repo: git push exited with status 128: ' +
				'fatal: The current branch main has no upstream branch'
		);
	});

	it('keeps git\u2019s advice, which names the command that fixes it', () => {
		exits(128, '', 'use: git push --set-upstream origin main');
		expect(attemptGit(['push'], 'C:\\repo', 'pushing').failure).toContain('--set-upstream');
	});
});
