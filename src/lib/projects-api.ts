import { api } from './api';
import type { Project, ProjectDraft } from './types';

const projectUrl = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}`;

export const projectsApi = {
	list: () => api.get<Project[]>('/api/projects'),
	create: (draft: ProjectDraft) => api.post<Project>('/api/projects', draft),
	update: (projectId: string, draft: ProjectDraft) =>
		api.patch<Project>(projectUrl(projectId), draft),
	remove: (projectId: string) => api.del(projectUrl(projectId))
};
