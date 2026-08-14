import { api, query } from './api';

export type CommitResult = {
	root: string;
	output: string;
	pushed: boolean;
	pushOutput: string;
	pushError: string | null;
};

export const diffApi = {
	status: (projectId: string) =>
		api.get<{ root: string; status: string }>(`/api/diff/status${query({ projectId })}`),

	commit: (projectId: string, message: string, push: boolean) =>
		api.post<CommitResult>('/api/diff/commit', { projectId, message, push }),

	stage: (projectId: string, path: string) =>
		api.post<{ staged: string }>('/api/diff/stage', { projectId, path }),

	stageAll: (projectId: string) =>
		api.post<{ staged: string }>('/api/diff/stage', { projectId, all: true }),

	lines: (projectId: string, path: string, range: string, start: number, end: number) =>
		api.get<{ lines: string[]; total: number }>(
			`/api/diff/lines${query({ projectId, path, range, start: String(start), end: String(end) })}`
		)
};
