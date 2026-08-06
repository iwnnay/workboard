/**
 * Typed JSON fetch. Non-2xx throws with the server's own message, which is what
 * the UI shows when an action fails; the status line is the fallback for a body
 * that isn't the usual `{ error }`.
 */
async function failureMessage(response: Response, url: string, method: string): Promise<string> {
	try {
		const body = await response.json();
		const message = body?.error ?? body?.message;
		if (typeof message === 'string' && message) {
			return message;
		}
	} catch {
		// Not JSON; the status line below says as much as we know.
	}
	return `${method} ${url} → ${response.status} ${response.statusText}`;
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: { 'Content-Type': 'application/json', ...init?.headers }
	});

	if (!response.ok) {
		throw new Error(await failureMessage(response, url, init?.method ?? 'GET'));
	}

	return response.json();
}

export const api = {
	get: <T>(url: string) => request<T>(url),
	post: <T>(url: string, body?: unknown) =>
		request<T>(url, {
			method: 'POST',
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
	patch: <T>(url: string, body: unknown) =>
		request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
	put: <T>(url: string, body: unknown) =>
		request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
	del: <T = { success: boolean }>(url: string) => request<T>(url, { method: 'DELETE' })
};

export function query(params: Record<string, string | null | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== null && value !== undefined && value !== '') {
			search.set(key, value);
		}
	}
	const encoded = search.toString();
	return encoded ? `?${encoded}` : '';
}
