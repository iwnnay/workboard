import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, resolveThemeName, themeStyleTag } from '$lib/themes';

describe('resolveThemeName', () => {
	it('accepts every named theme', () => {
		for (const name of ['red', 'purple', 'pink', 'blue', 'amber', 'light-blue']) {
			expect(resolveThemeName(name)).toBe(name);
		}
	});

	it('normalises case, padding, spaces and underscores', () => {
		expect(resolveThemeName('  Amber ')).toBe('amber');
		expect(resolveThemeName('Light Blue')).toBe('light-blue');
		expect(resolveThemeName('light_blue')).toBe('light-blue');
	});

	it('falls back to the default for unknown or missing names', () => {
		expect(resolveThemeName('chartreuse')).toBe(DEFAULT_THEME);
		expect(resolveThemeName('')).toBe(DEFAULT_THEME);
		expect(resolveThemeName(null)).toBe(DEFAULT_THEME);
		expect(resolveThemeName(undefined)).toBe(DEFAULT_THEME);
	});
});

describe('themeStyleTag', () => {
	it('marks dark themes as a dark color scheme with the shared diff colors', () => {
		const tag = themeStyleTag('pink');
		expect(tag).toContain('color-scheme: dark;');
		expect(tag).toContain('--accent: #ec4899;');
		expect(tag).toContain('--diff-add-bg: #071507;');
	});

	it('lets the light theme replace the shared dark diff and status colors', () => {
		const tag = themeStyleTag('light-blue');
		expect(tag).toContain('color-scheme: light;');
		expect(tag).toContain('--diff-add-bg: #e8f7ec;');
		expect(tag).toContain('--success: #15803d;');
		expect(tag).not.toContain('--diff-add-bg: #071507;');
	});

	it('declares each token exactly once', () => {
		for (const name of ['red', 'pink', 'light-blue']) {
			const tokens = [...themeStyleTag(name).matchAll(/--([a-z0-9-]+):/g)].map((match) => match[1]);
			expect(new Set(tokens).size).toBe(tokens.length);
		}
	});
});
