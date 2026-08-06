import { json } from '@sveltejs/kit';

/** An error carrying the HTTP status its message should be answered with. */
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

export function badRequest(message: string): ApiError {
	return new ApiError(message, 400);
}

export function forbidden(message: string): ApiError {
	return new ApiError(message, 403);
}

export function notFound(message: string): ApiError {
	return new ApiError(message, 404);
}

export function jsonError(caught: unknown, fallbackStatus = 400): Response {
	const message = caught instanceof Error ? caught.message : String(caught);
	const status = caught instanceof ApiError ? caught.status : fallbackStatus;
	return json({ error: message }, { status });
}

/**
 * Answer with `handler`'s value as JSON, or with `{ error }` at the status a
 * thrown {@link ApiError} carries. The message reaches the client intact.
 */
export async function route<T>(
	handler: () => T | Promise<T>,
	options: { status?: number; errorStatus?: number } = {}
): Promise<Response> {
	try {
		return json(await handler(), { status: options.status ?? 200 });
	} catch (caught) {
		return jsonError(caught, options.errorStatus);
	}
}

export async function readJsonBody<T>(request: Request): Promise<T> {
	try {
		return (await request.json()) as T;
	} catch (caught) {
		throw badRequest(
			`request body is not valid JSON: ${caught instanceof Error ? caught.message : String(caught)}`
		);
	}
}
