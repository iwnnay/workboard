import type {
	DirectoryListing,
	ManagedServerDraft,
	ManagedServerWithStatus,
	ServerDetection,
	ServerStatus
} from './types';

/**
 * Like `$lib/api`, but surfaces the server's error message instead of the bare
 * status text — starting a server fails for reasons the user needs to read
 * (missing `uv`, port in use, Docker daemon down).
 */
async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: { 'Content-Type': 'application/json', ...init?.headers }
	});

	if (!response.ok) {
		let message = `${init?.method ?? 'GET'} ${url} → ${response.status} ${response.statusText}`;
		try {
			const body = await response.json();
			if (body && typeof body.message === 'string' && body.message) message = body.message;
		} catch {
			// Non-JSON error body — the status line above stays as the message.
		}
		throw new Error(message);
	}

	return response.json();
}

export const serversApi = {
	list: () => requestJson<ManagedServerWithStatus[]>('/api/servers'),

	create: (draft: ManagedServerDraft) =>
		requestJson<ManagedServerWithStatus>('/api/servers', {
			method: 'POST',
			body: JSON.stringify(draft)
		}),

	update: (id: string, draft: ManagedServerDraft) =>
		requestJson<ManagedServerWithStatus>(`/api/servers/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(draft)
		}),

	remove: (id: string) =>
		requestJson<{ success: boolean; status: ServerStatus }>(`/api/servers/${id}`, {
			method: 'DELETE'
		}),

	status: (id: string) => requestJson<ServerStatus>(`/api/servers/${id}/status`),

	start: (id: string) => requestJson<ServerStatus>(`/api/servers/${id}/start`, { method: 'POST' }),

	stop: (id: string) => requestJson<ServerStatus>(`/api/servers/${id}/stop`, { method: 'POST' }),

	restart: (id: string) =>
		requestJson<ServerStatus>(`/api/servers/${id}/restart`, { method: 'POST' }),

	detect: (directory: string) =>
		requestJson<ServerDetection>(`/api/servers/detect?directory=${encodeURIComponent(directory)}`),

	browse: (path?: string | null) =>
		requestJson<DirectoryListing>(
			path ? `/api/servers/browse?path=${encodeURIComponent(path)}` : '/api/servers/browse'
		)
};
