import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, query, request } from '$lib/api';

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	fetchMock.mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
	return new Response(JSON.stringify(body), {
		status,
		statusText,
		headers: { 'Content-Type': 'application/json' }
	});
}

describe('request', () => {
	it('returns the parsed body', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ alias: 'knowledge' }));
		await expect(request('/api/servers')).resolves.toEqual({ alias: 'knowledge' });
	});

	it('sends JSON content type, keeping caller headers', async () => {
		fetchMock.mockResolvedValue(jsonResponse({}));
		await request('/api/servers', { method: 'POST', headers: { 'X-Trace': 'abc' } });

		expect(fetchMock).toHaveBeenCalledWith('/api/servers', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Trace': 'abc' }
		});
	});

	it('throws the server’s own error message, which the UI shows', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(
				{ error: 'starting managed server "app": port 9150 is already listening (pid 8888)' },
				400,
				'Bad Request'
			)
		);

		await expect(request('/api/servers/1/start', { method: 'POST' })).rejects.toThrow(
			'starting managed server "app": port 9150 is already listening (pid 8888)'
		);
	});

	it('accepts a SvelteKit-shaped { message } error body', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ message: 'not found' }, 404, 'Not Found'));
		await expect(request('/api/servers/nope')).rejects.toThrow('not found');
	});

	it('falls back to the status line when the body is not JSON', async () => {
		fetchMock.mockResolvedValue(
			new Response('<html>502</html>', { status: 502, statusText: 'Bad Gateway' })
		);
		await expect(request('/api/servers')).rejects.toThrow('GET /api/servers → 502 Bad Gateway');
	});

	it('falls back to the status line when the body has no message', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ nothing: true }, 500, 'Server Error'));
		await expect(request('/api/x', { method: 'DELETE' })).rejects.toThrow(
			'DELETE /api/x → 500 Server Error'
		);
	});
});

describe('api verbs', () => {
	beforeEach(() => {
		fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
	});

	it('gets with neither a method nor a body', async () => {
		await api.get('/api/servers');
		const init = fetchMock.mock.calls[0][1];

		expect(init).not.toHaveProperty('method');
		expect(init).not.toHaveProperty('body');
	});

	it('posts a serialised body', async () => {
		await api.post('/api/servers', { port: 9150 });
		expect(fetchMock.mock.calls[0][1]).toMatchObject({
			method: 'POST',
			body: '{"port":9150}'
		});
	});

	it('posts without a body when there is nothing to send', async () => {
		await api.post('/api/servers/1/start');
		expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: undefined });
	});

	it.each([
		['patch', 'PATCH'],
		['put', 'PUT']
	] as const)('%s sends its body', async (verb, method) => {
		await api[verb]('/api/servers/1', { alias: 'renamed' });
		expect(fetchMock.mock.calls[0][1]).toMatchObject({ method, body: '{"alias":"renamed"}' });
	});

	it('deletes', async () => {
		await api.del('/api/servers/1');
		expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
	});
});

describe('query', () => {
	it('builds a query string', () => {
		expect(query({ projectId: 'abc', path: 'src/app.ts' })).toBe(
			'?projectId=abc&path=src%2Fapp.ts'
		);
	});

	it('drops empty, null and undefined values', () => {
		expect(query({ path: '', projectId: null, range: undefined })).toBe('');
	});

	it('keeps only what was given', () => {
		expect(query({ path: 'a b', projectId: null })).toBe('?path=a+b');
	});
});
