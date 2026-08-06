import { api, query } from './api';
import type {
	DirectoryListing,
	ManagedServerDraft,
	ManagedServerWithStatus,
	ServerDetection,
	ServerStatus
} from './types';

export const serversApi = {
	list: () => api.get<ManagedServerWithStatus[]>('/api/servers'),

	create: (draft: ManagedServerDraft) => api.post<ManagedServerWithStatus>('/api/servers', draft),

	update: (id: string, draft: ManagedServerDraft) =>
		api.patch<ManagedServerWithStatus>(`/api/servers/${id}`, draft),

	remove: (id: string) => api.del<{ success: boolean; status: ServerStatus }>(`/api/servers/${id}`),

	status: (id: string) => api.get<ServerStatus>(`/api/servers/${id}/status`),

	start: (id: string) => api.post<ServerStatus>(`/api/servers/${id}/start`),

	stop: (id: string) => api.post<ServerStatus>(`/api/servers/${id}/stop`),

	restart: (id: string) => api.post<ServerStatus>(`/api/servers/${id}/restart`),

	detect: (directory: string) =>
		api.get<ServerDetection>(`/api/servers/detect${query({ directory })}`),

	browse: (path?: string | null) =>
		api.get<DirectoryListing>(`/api/servers/browse${query({ path })}`)
};
