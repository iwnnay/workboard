/**
 * Tiny typed JSON fetch helper. Replaces ~30 hand-rolled fetch calls scattered
 * across components. Throws on non-2xx so callers don't silently consume errors.
 */
async function request<T>(input: string, init?: RequestInit): Promise<T> {
	const res = await fetch(input, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init?.headers
		}
	});
	if (!res.ok) {
		throw new Error(`${init?.method ?? 'GET'} ${input} → ${res.status} ${res.statusText}`);
	}
	return res.json();
}

export const api = {
	get: <T>(url: string) => request<T>(url),
	post: <T>(url: string, body: unknown) =>
		request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
	patch: <T>(url: string, body: unknown) =>
		request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
	put: <T>(url: string, body: unknown) =>
		request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
	del: (url: string) => request<{ success: boolean }>(url, { method: 'DELETE' })
};
