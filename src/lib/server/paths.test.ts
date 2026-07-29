import { describe, it, expect } from 'vitest';
import { join, resolve, sep } from 'path';
import { resolveSafePath } from './paths';

const root = resolve(process.cwd(), 'fake-root');

describe('resolveSafePath', () => {
	it('accepts a nested relative path', () => {
		expect(resolveSafePath(root, join('src', 'lib', 'file.ts'))).toBe(
			join(root, 'src', 'lib', 'file.ts')
		);
	});

	it('accepts the root itself', () => {
		expect(resolveSafePath(root, '.')).toBe(root);
	});

	it('accepts a path containing a redundant but non-escaping ..', () => {
		expect(resolveSafePath(root, join('src', '..', 'other.ts'))).toBe(join(root, 'other.ts'));
	});

	it('rejects traversal above the root', () => {
		expect(() => resolveSafePath(root, join('..', 'escape.ts'))).toThrow(
			/outside the project root/
		);
	});

	it('rejects deep traversal', () => {
		expect(() => resolveSafePath(root, join('src', '..', '..', '..', 'etc', 'passwd'))).toThrow(
			/outside the project root/
		);
	});

	it('rejects an absolute path outside the root', () => {
		const outside = resolve(process.cwd(), 'elsewhere', 'file.ts');
		expect(() => resolveSafePath(root, outside)).toThrow(/outside the project root/);
	});

	it('rejects the sibling-prefix escape (root-evil vs root)', () => {
		const sibling = `${root}-evil${sep}file.ts`;
		expect(() => resolveSafePath(root, sibling)).toThrow(/outside the project root/);
	});

	it('accepts an absolute path inside the root', () => {
		const inside = join(root, 'src', 'file.ts');
		expect(resolveSafePath(root, inside)).toBe(inside);
	});
});
