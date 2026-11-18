import { describe, expect, it } from 'vitest';
import {
	defaultProjectSettings,
	normalizeProjectSettings,
	parseProjectSettings,
	textToSettings
} from '$lib/project-settings';

describe('parseProjectSettings', () => {
	it('fills in defaults for settings that were never stored', () => {
		expect(parseProjectSettings('{}', 'reading project p1')).toEqual(defaultProjectSettings);
		expect(parseProjectSettings('{"testGlobs":["spec/**"]}', 'reading project p1')).toEqual({
			...defaultProjectSettings,
			testGlobs: ['spec/**']
		});
	});

	it('names the project and the stored text when the JSON is corrupt', () => {
		expect(() => parseProjectSettings('{nope', 'reading project p1')).toThrow(
			/reading project p1: stored settings are not valid JSON \("\{nope"\)/
		);
	});
});

describe('normalizeProjectSettings', () => {
	it('merges a partial update over the current settings and tidies the lists', () => {
		expect(
			normalizeProjectSettings(
				{ importantDirectories: [' src ', 'src', '', 'db'] },
				defaultProjectSettings,
				'updating project p1'
			)
		).toEqual({ ...defaultProjectSettings, importantDirectories: ['src', 'db'] });
	});

	it('rejects unknown settings and lists the valid ones', () => {
		expect(() =>
			normalizeProjectSettings({ colour: ['red'] }, defaultProjectSettings, 'updating project p1')
		).toThrow(
			'updating project p1: unknown setting "colour"; expected one of testGlobs, searchExcludeGlobs, importantDirectories'
		);
	});

	it('rejects a setting that is not a list of strings', () => {
		expect(() =>
			normalizeProjectSettings(
				{ testGlobs: 'tests/**' },
				defaultProjectSettings,
				'creating project'
			)
		).toThrow('creating project: setting "testGlobs" must be a list of strings, got "tests/**"');
	});
});

describe('textToSettings', () => {
	it('turns a one-per-line textarea into a clean list', () => {
		expect(textToSettings('tests/**\n\n  **/*.spec.ts \ntests/**')).toEqual([
			'tests/**',
			'**/*.spec.ts'
		]);
	});
});
