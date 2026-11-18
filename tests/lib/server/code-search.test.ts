import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { searchCode } from '$lib/server/code-search';

const settings = {
	testGlobs: ['**/tests/**'],
	searchExcludeGlobs: ['**/*.lock']
};

let root = '';

const writeProjectFile = (relativePath: string, content: string) => {
	const absolutePath = join(root, relativePath);
	mkdirSync(join(absolutePath, '..'), { recursive: true });
	writeFileSync(absolutePath, content);
};

const initGitRepository = () => {
	const result = spawnSync('git', ['init', '--quiet'], { cwd: root, encoding: 'utf8' });
	if (result.status !== 0) {
		throw new Error(`initialising test git repository in ${root}: ${result.stderr}`);
	}
};

const matchedPaths = (options: { includeTests?: boolean } = {}) => [
	...new Set(
		searchCode({ root, query: 'loadThing', settings, ...options }).matches.map(
			(match) => match.path
		)
	)
];

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'code-search-'));
	writeProjectFile('src/lib/alpha.ts', 'export const loadThing = () => 1;\r\nloadThing();\r\n');
	writeProjectFile('src/routes/page.svelte', '<script>\n\tlet value = loadThing();\n</script>\n');
	writeProjectFile('src/logo.bin', 'loadThing\0binary');
	writeProjectFile('db/seed.sql', '-- loadThing\n');
	writeProjectFile('packages/core/index.ts', 'export { loadThing };\n');
	writeProjectFile('packages/core/tests/core.test.ts', 'loadThing();\n');
	writeProjectFile('tests/alpha.test.ts', 'expect(loadThing()).toBe(1);\n');
	writeProjectFile('yarn.lock', 'loadThing@1.0.0\n');
	writeProjectFile('node_modules/dep/index.js', 'loadThing();\n');
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('searchCode in a git repository', () => {
	beforeEach(() => {
		initGitRepository();
		writeProjectFile('.gitignore', 'node_modules/\ngenerated/\n');
		writeProjectFile('generated/output.ts', 'loadThing();\n');
		writeProjectFile('packages/core/.gitignore', 'cache/\n');
		writeProjectFile('packages/core/cache/stale.ts', 'loadThing();\n');
	});

	it('searches every file .gitignore allows, with forward-slash paths and 1-based positions', () => {
		const result = searchCode({ root, query: 'loadThing', settings });
		expect(result.source).toBe('gitignore');
		expect(result.sourceNote).toBeNull();
		expect(result.matches).toEqual([
			{ path: 'db/seed.sql', line: 1, column: 4, text: '-- loadThing' },
			{ path: 'packages/core/index.ts', line: 1, column: 10, text: 'export { loadThing };' },
			{ path: 'src/lib/alpha.ts', line: 1, column: 14, text: 'export const loadThing = () => 1;' },
			{ path: 'src/lib/alpha.ts', line: 2, column: 1, text: 'loadThing();' },
			{ path: 'src/routes/page.svelte', line: 2, column: 14, text: 'let value = loadThing();' }
		]);
	});

	it('honours nested .gitignore files', () => {
		expect(matchedPaths()).not.toContain('packages/core/cache/stale.ts');
		expect(matchedPaths()).not.toContain('generated/output.ts');
		expect(matchedPaths()).not.toContain('node_modules/dep/index.js');
	});

	it('leaves out top-level and sub-project test folders unless tests are included', () => {
		expect(matchedPaths()).not.toContain('tests/alpha.test.ts');
		expect(matchedPaths()).not.toContain('packages/core/tests/core.test.ts');
		expect(matchedPaths({ includeTests: true })).toContain('tests/alpha.test.ts');
		expect(matchedPaths({ includeTests: true })).toContain('packages/core/tests/core.test.ts');
		expect(searchCode({ root, query: 'loadThing', settings }).testsExcluded).toBe(true);
	});

	it('always applies the search exclude globs', () => {
		expect(matchedPaths({ includeTests: true })).not.toContain('yarn.lock');
	});

	it('is case-sensitive', () => {
		expect(searchCode({ root, query: 'loadthing', settings }).matches).toEqual([]);
	});

	it('stops at the match limit and reports truncation', () => {
		const result = searchCode({ root, query: 'loadThing', settings, maxMatches: 2 });
		expect(result.matches).toHaveLength(2);
		expect(result.truncated).toBe(true);
	});
});

describe('searchCode outside a git repository', () => {
	it('walks the folder, skips dependency folders and says why .gitignore was not used', () => {
		const result = searchCode({ root, query: 'loadThing', settings });
		expect(result.source).toBe('folder-walk');
		expect(result.sourceNote).toMatch(/Not a git repository/);
		expect(result.matches.map((match) => match.path)).not.toContain('node_modules/dep/index.js');
		expect(result.matches.map((match) => match.path)).toContain('src/lib/alpha.ts');
	});
});
