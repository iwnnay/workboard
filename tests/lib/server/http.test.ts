import { describe, it, expect } from 'vitest';
import {
	ApiError,
	badRequest,
	forbidden,
	jsonError,
	notFound,
	readJsonBody,
	route
} from '$lib/server/http';

function jsonRequest(body: string): Request {
	return new Request('http://localhost/api/test', { method: 'POST', body });
}

describe('ApiError constructors', () => {
	it.each([
		[badRequest, 400],
		[forbidden, 403],
		[notFound, 404]
	])('carries its status', (build, status) => {
		const error = build('something specific went wrong');
		expect(error).toBeInstanceOf(ApiError);
		expect(error.status).toBe(status);
		expect(error.message).toBe('something specific went wrong');
	});
});

describe('jsonError', () => {
	it('answers with the status the error asked for', async () => {
		const response = jsonError(notFound('loading widget 7: no such row'));
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'loading widget 7: no such row' });
	});

	it('falls back to 400 for a plain error', async () => {
		const response = jsonError(new Error('saving widget: the name was empty'));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'saving widget: the name was empty' });
	});

	it('honours a caller-supplied fallback status', async () => {
		expect(jsonError(new Error('broken'), 500).status).toBe(500);
	});

	it('stringifies a thrown non-error', async () => {
		const response = jsonError('just a string');
		expect(await response.json()).toEqual({ error: 'just a string' });
	});
});

describe('route', () => {
	it('answers with the handler value as JSON', async () => {
		const response = await route(() => ({ alias: 'knowledge', port: 9150 }));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ alias: 'knowledge', port: 9150 });
	});

	it('awaits an async handler', async () => {
		const response = await route(async () => 'done');
		expect(await response.json()).toBe('done');
	});

	it('uses the requested success status', async () => {
		const response = await route(() => ({ created: true }), { status: 201 });
		expect(response.status).toBe(201);
	});

	it('turns a thrown ApiError into its status and message', async () => {
		const response = await route(() => {
			throw notFound('loading managed server abc: no such row');
		});
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			error: 'loading managed server abc: no such row'
		});
	});

	it('turns a plain thrown error into a 400 carrying its message', async () => {
		const response = await route(() => {
			throw new Error('starting managed server "app": port 9150 is already listening');
		});
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'starting managed server "app": port 9150 is already listening'
		});
	});

	it('applies errorStatus to non-ApiError failures', async () => {
		const response = await route(
			() => {
				throw new Error('git exploded');
			},
			{ errorStatus: 500 }
		);
		expect(response.status).toBe(500);
	});
});

describe('readJsonBody', () => {
	it('parses a JSON body', async () => {
		await expect(readJsonBody(jsonRequest('{"port":9150}'))).resolves.toEqual({ port: 9150 });
	});

	it('rejects a body that is not JSON, naming the problem', async () => {
		await expect(readJsonBody(jsonRequest('not json at all'))).rejects.toThrow(
			/request body is not valid JSON/
		);
	});

	it('rejects with a 400', async () => {
		await readJsonBody(jsonRequest('{')).catch((caught) => {
			expect(caught).toBeInstanceOf(ApiError);
			expect((caught as ApiError).status).toBe(400);
		});
	});
});
