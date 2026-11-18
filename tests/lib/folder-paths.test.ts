import { describe, expect, it } from 'vitest';
import { findOwningProject, isWithinRoot, pathSegments, relativeToRoot } from '$lib/folder-paths';

describe('pathSegments', () => {
	it('builds clickable breadcrumbs for a Windows path', () => {
		expect(pathSegments('C:\\Users\\dev\\projects')).toEqual([
			{ name: 'C:', path: 'C:\\' },
			{ name: 'Users', path: 'C:\\Users' },
			{ name: 'dev', path: 'C:\\Users\\dev' },
			{ name: 'projects', path: 'C:\\Users\\dev\\projects' }
		]);
	});

	it('builds clickable breadcrumbs for a POSIX path, starting at the root', () => {
		expect(pathSegments('/home/dev')).toEqual([
			{ name: '/', path: '/' },
			{ name: 'home', path: '/home' },
			{ name: 'dev', path: '/home/dev' }
		]);
	});
});

describe('isWithinRoot', () => {
	it('accepts the root itself and its children, case-insensitively on Windows', () => {
		expect(isWithinRoot('C:\\Repo', 'C:\\repo')).toBe(true);
		expect(isWithinRoot('C:\\repo\\src', 'C:\\repo\\')).toBe(true);
	});

	it('rejects sibling folders that only share a prefix', () => {
		expect(isWithinRoot('C:\\repo-evil', 'C:\\repo')).toBe(false);
		expect(isWithinRoot('/home/dev2', '/home/dev')).toBe(false);
	});
});

describe('relativeToRoot', () => {
	it('returns a forward-slash path inside the root, or "." for the root', () => {
		expect(relativeToRoot('C:\\repo\\src\\lib', 'C:\\repo')).toBe('src/lib');
		expect(relativeToRoot('C:\\repo', 'C:\\repo')).toBe('.');
	});

	it('returns null outside the root', () => {
		expect(relativeToRoot('C:\\other', 'C:\\repo')).toBeNull();
	});
});

describe('findOwningProject', () => {
	const projects = [
		{ id: 'mono', path: 'C:\\work\\mono' },
		{ id: 'api', path: 'C:\\work\\mono\\packages\\api' },
		{ id: 'site', path: 'C:\\work\\site' }
	];

	it('picks the deepest project folder that contains the directory', () => {
		expect(findOwningProject(projects, 'C:\\work\\mono\\packages\\api\\src')?.id).toBe('api');
		expect(findOwningProject(projects, 'C:\\work\\mono\\packages\\web')?.id).toBe('mono');
	});

	it('returns null when no project contains the directory', () => {
		expect(findOwningProject(projects, 'C:\\elsewhere')).toBeNull();
	});
});
