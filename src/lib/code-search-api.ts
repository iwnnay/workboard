import { api, query } from './api';
import type { CodeSearchResult } from '$lib/server/code-search';

export type FileContent = {
	path: string;
	content: string;
};

export const codeSearchApi = {
	search: (projectId: string, text: string, includeTests: boolean) =>
		api.get<CodeSearchResult & { root: string }>(
			`/api/code-search${query({ projectId, query: text, includeTests: includeTests ? '1' : '' })}`
		),

	file: (projectId: string, path: string) =>
		api.get<FileContent>(`/api/file${query({ projectId, path })}`)
};
