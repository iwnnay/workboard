export type ProjectSettings = {
	testGlobs: string[];
	searchExcludeGlobs: string[];
	importantDirectories: string[];
};

export const defaultProjectSettings: ProjectSettings = {
	testGlobs: ['**/tests/**'],
	searchExcludeGlobs: [
		'**/*.lock',
		'**/package-lock.json',
		'**/pnpm-lock.yaml',
		'**/*.min.js',
		'**/*.min.css',
		'**/*.map',
		'drizzle/meta/**'
	],
	importantDirectories: []
};

const settingKeys = Object.keys(defaultProjectSettings) as (keyof ProjectSettings)[];

const cleanList = (values: string[]): string[] => [
	...new Set(values.map((value) => value.trim()).filter(Boolean))
];

const readList = (value: unknown, key: string, context: string): string[] => {
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
		throw new Error(
			`${context}: setting "${key}" must be a list of strings, got ${JSON.stringify(value)}`
		);
	}
	return cleanList(value);
};

export const parseProjectSettings = (
	stored: string | null | undefined,
	context: string
): ProjectSettings => {
	let parsed: unknown;
	const settings = { ...defaultProjectSettings };
	try {
		parsed = JSON.parse(stored || '{}');
	} catch (caught) {
		throw new Error(
			`${context}: stored settings are not valid JSON (${JSON.stringify(stored)}): ${(caught as Error).message}`,
			{ cause: caught }
		);
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`${context}: stored settings must be a JSON object, got ${stored}`);
	}
	for (const key of settingKeys) {
		const value = (parsed as Record<string, unknown>)[key];
		if (value !== undefined) {
			settings[key] = readList(value, key, context);
		}
	}
	return settings;
};

export const normalizeProjectSettings = (
	input: unknown,
	current: ProjectSettings,
	context: string
): ProjectSettings => {
	const settings = { ...current };
	if (input === undefined) {
		return settings;
	}
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new Error(`${context}: "settings" must be an object, got ${JSON.stringify(input)}`);
	}
	for (const [key, value] of Object.entries(input)) {
		if (!settingKeys.includes(key as keyof ProjectSettings)) {
			throw new Error(
				`${context}: unknown setting "${key}"; expected one of ${settingKeys.join(', ')}`
			);
		}
		settings[key as keyof ProjectSettings] = readList(value, key, context);
	}
	return settings;
};

export const settingsToText = (lines: string[]): string => lines.join('\n');

export const textToSettings = (text: string): string[] => cleanList(text.split('\n'));
