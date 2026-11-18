import { readdirSync, readFileSync, statSync } from 'fs';
import { join, posix } from 'path';
import { MAX_EDITABLE_FILE_BYTES } from '$lib/constants';
import type { ProjectSettings } from '$lib/project-settings';
import { attemptGit } from './git';

export type CodeSearchMatch = {
	path: string;
	line: number;
	column: number;
	text: string;
};

export type CodeSearchSource = 'gitignore' | 'folder-walk';

export type CodeSearchResult = {
	matches: CodeSearchMatch[];
	source: CodeSearchSource;
	sourceNote: string | null;
	testsExcluded: boolean;
	searchedFiles: number;
	truncated: boolean;
};

export type CodeSearchOptions = {
	root: string;
	query: string;
	settings: Pick<ProjectSettings, 'testGlobs' | 'searchExcludeGlobs'>;
	includeTests?: boolean;
	maxMatches?: number;
};

export type CandidateFiles = {
	paths: string[];
	source: CodeSearchSource;
	sourceNote: string | null;
};

const walkSkippedDirectories = new Set([
	'node_modules',
	'.git',
	'.svelte-kit',
	'build',
	'dist',
	'coverage',
	'.venv',
	'venv',
	'__pycache__',
	'.next'
]);

const maxPreviewLength = 300;
const defaultMaxMatches = 500;
const gitListTimeoutMs = 15_000;

const walkFolder = (root: string, relativeDirectory: string, collected: string[]): void => {
	const entries = readdirSync(join(root, relativeDirectory), { withFileTypes: true });
	for (const entry of entries) {
		const relativePath = relativeDirectory ? posix.join(relativeDirectory, entry.name) : entry.name;
		if (entry.isDirectory()) {
			if (!walkSkippedDirectories.has(entry.name)) {
				walkFolder(root, relativePath, collected);
			}
		} else if (entry.isFile()) {
			collected.push(relativePath);
		}
	}
};

export const listCandidateFiles = (root: string): CandidateFiles => {
	const outcome = attemptGit(
		['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
		root,
		'listing files for code search',
		gitListTimeoutMs
	);
	const collected: string[] = [];
	if (outcome.failure === null) {
		return {
			paths: [...new Set(outcome.stdout.split('\0').filter(Boolean))],
			source: 'gitignore',
			sourceNote: null
		};
	}
	try {
		walkFolder(root, '', collected);
	} catch (caught) {
		throw new Error(
			`listing files for code search in ${root}: git failed (${outcome.failure}) and walking the folder failed: ${(caught as Error).message}`,
			{ cause: caught }
		);
	}
	return {
		paths: collected,
		source: 'folder-walk',
		sourceNote: `Not a git repository, so .gitignore was not applied: ${outcome.failure}`
	};
};

const matchesAny = (path: string, globs: string[]): boolean =>
	globs.some((glob) => posix.matchesGlob(path, glob));

const readSearchableText = (absolutePath: string): string | null => {
	try {
		if (statSync(absolutePath).size > MAX_EDITABLE_FILE_BYTES) {
			return null;
		}
		const content = readFileSync(absolutePath, 'utf-8');
		return content.includes('\0') ? null : content;
	} catch {
		return null;
	}
};

const previewOf = (lineText: string, column: number): string => {
	const trimmed = lineText.trim();
	if (trimmed.length <= maxPreviewLength) {
		return trimmed;
	}
	const leadingWhitespace = lineText.length - lineText.trimStart().length;
	const start = Math.max(0, column - leadingWhitespace - maxPreviewLength / 2);
	return `…${trimmed.slice(start, start + maxPreviewLength)}…`;
};

export const searchCode = (options: CodeSearchOptions): CodeSearchResult => {
	const { root, query, settings, includeTests = false, maxMatches = defaultMaxMatches } = options;
	const candidates = listCandidateFiles(root);
	const excludedGlobs = includeTests
		? settings.searchExcludeGlobs
		: [...settings.searchExcludeGlobs, ...settings.testGlobs];
	const files = candidates.paths
		.filter((path) => !matchesAny(path, excludedGlobs))
		.sort((first, second) => first.localeCompare(second));
	const matches: CodeSearchMatch[] = [];
	let truncated = false;

	for (const relativePath of files) {
		if (truncated) {
			break;
		}
		const content = readSearchableText(join(root, relativePath));
		if (content === null || !content.includes(query)) {
			continue;
		}
		const lines = content.replace(/\r\n/g, '\n').split('\n');
		for (const [lineIndex, lineText] of lines.entries()) {
			const column = lineText.indexOf(query);
			if (column === -1) {
				continue;
			}
			if (matches.length >= maxMatches) {
				truncated = true;
				break;
			}
			matches.push({
				path: relativePath,
				line: lineIndex + 1,
				column: column + 1,
				text: previewOf(lineText, column)
			});
		}
	}

	return {
		matches,
		source: candidates.source,
		sourceNote: candidates.sourceNote,
		testsExcluded: !includeTests && settings.testGlobs.length > 0,
		searchedFiles: files.length,
		truncated
	};
};
