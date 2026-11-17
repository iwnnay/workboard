import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { searchCode } from '$lib/server/code-search';

let root = '';

const writeProjectFile = (relativePath: string, content: string) => {
	const absolutePath = join(root, relativePath);
	mkdirSync(join(absolutePath, '..'), { recursive: true });
	writeFileSync(absolutePath, content);
};

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'code-search-'));
	writeProjectFile('src/lib/alpha.ts', 'export const loadThing = () => 1;\r\nloadThing();\r\n');
	writeProjectFile('src/routes/page.svelte', '<script>\n\tlet value = loadThing();\n</script>\n');
	writeProjectFile('src/node_modules/dep/index.js', 'loadThing();\n');
	writeProjectFile('src/logo.bin', 'loadThing\0binary');
	writeProjectFile('db/seed.sql', '-- loadThing\n');
	writeProjectFile('scripts/reset.js', 'loadThing();\n');
	writeProjectFile('packages/core/index.ts', 'export { loadThing };\n');
	writeProjectFile('packages/core/node_modules/dep/index.js', 'loadThing();\n');
	writeProjectFile('packages/core/dist/index.js', 'loadThing();\n');
	writeProjectFile('tests/alpha.test.ts', 'expect(loadThing()).toBe(1);\n');
	writeProjectFile('docs/other.ts', 'loadThing();\n');
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('searchCode', () => {
	it('finds every matching line in src, db, scripts and packages with forward-slash paths and 1-based positions', () => {
		const result = searchCode({ root, query: 'loadThing' });
		expect(result.directories).toEqual(['src', 'db', 'scripts', 'packages']);
		expect(result.matches).toEqual([
			{ path: 'db/seed.sql', line: 1, column: 4, text: '-- loadThing' },
			{ path: 'packages/core/index.ts', line: 1, column: 10, text: 'export { loadThing };' },
			{ path: 'scripts/reset.js', line: 1, column: 1, text: 'loadThing();' },
			{ path: 'src/lib/alpha.ts', line: 1, column: 14, text: 'export const loadThing = () => 1;' },
			{ path: 'src/lib/alpha.ts', line: 2, column: 1, text: 'loadThing();' },
			{ path: 'src/routes/page.svelte', line: 2, column: 14, text: 'let value = loadThing();' }
		]);
		expect(result.truncated).toBe(false);
	});

	it('includes the tests directory only when asked and never searches other folders', () => {
		const withoutTests = searchCode({ root, query: 'loadThing' });
		const withTests = searchCode({ root, query: 'loadThing', includeTests: true });
		expect(withoutTests.matches.map((match) => match.path)).not.toContain('tests/alpha.test.ts');
		expect(withTests.directories).toEqual(['src', 'db', 'scripts', 'packages', 'tests']);
		expect(withTests.matches.map((match) => match.path)).toContain('tests/alpha.test.ts');
		expect(withTests.matches.map((match) => match.path)).not.toContain('docs/other.ts');
	});

	it('is case-sensitive', () => {
		expect(searchCode({ root, query: 'loadthing' }).matches).toEqual([]);
	});

	it('stops at the match limit and reports truncation', () => {
		const result = searchCode({ root, query: 'loadThing', maxMatches: 2 });
		expect(result.matches).toHaveLength(2);
		expect(result.truncated).toBe(true);
	});

	it('returns nothing when the searched directories do not exist', () => {
		for (const directory of ['src', 'db', 'scripts', 'packages']) {
			rmSync(join(root, directory), { recursive: true, force: true });
		}
		expect(searchCode({ root, query: 'loadThing' })).toEqual({
			matches: [],
			directories: ['src', 'db', 'scripts', 'packages'],
			searchedFiles: 0,
			truncated: false
		});
	});
});
