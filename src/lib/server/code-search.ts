import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { MAX_EDITABLE_FILE_BYTES } from '$lib/constants';

export type CodeSearchMatch = {
	path: string;
	line: number;
	column: number;
	text: string;
};

export type CodeSearchResult = {
	matches: CodeSearchMatch[];
	directories: string[];
	searchedFiles: number;
	truncated: boolean;
};

export type CodeSearchOptions = {
	root: string;
	query: string;
	includeTests?: boolean;
	maxMatches?: number;
};

const skippedDirectories = new Set([
	'node_modules',
	'.git',
	'.svelte-kit',
	'build',
	'dist',
	'coverage',
	'.turbo',
	'.next'
]);

const maxPreviewLength = 300;
const defaultMaxMatches = 500;

const listFiles = (directory: string, collected: string[]): void => {
	let entries;
	try {
		entries = readdirSync(directory, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (!skippedDirectories.has(entry.name)) {
				listFiles(entryPath, collected);
			}
		} else if (entry.isFile()) {
			collected.push(entryPath);
		}
	}
};

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

const alwaysSearchedDirectories = ['src', 'db', 'scripts', 'packages'];

export const searchDirectories = (includeTests: boolean): string[] =>
	includeTests ? [...alwaysSearchedDirectories, 'tests'] : alwaysSearchedDirectories;

export const searchCode = (options: CodeSearchOptions): CodeSearchResult => {
	const { root, query, includeTests = false, maxMatches = defaultMaxMatches } = options;
	const directories = searchDirectories(includeTests);
	const files: string[] = [];
	const matches: CodeSearchMatch[] = [];
	let truncated = false;

	for (const directory of directories) {
		listFiles(join(root, directory), files);
	}
	files.sort((first, second) => first.localeCompare(second));

	for (const absolutePath of files) {
		if (truncated) {
			break;
		}
		const content = readSearchableText(absolutePath);
		if (content === null || !content.includes(query)) {
			continue;
		}
		const relativePath = relative(root, absolutePath).split(sep).join('/');
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

	return { matches, directories, searchedFiles: files.length, truncated };
};
