import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEFAULT_HOST = 'http://127.0.0.1:11434';

/**
 * Proxies Ollama's `POST /api/pull` and passes its NDJSON progress stream
 * straight back to the browser, line for line. Each upstream line looks like
 * `{"status":"downloading ...","total":123,"completed":45}` or `{"status":"success"}`.
 */
export const POST: RequestHandler = async ({ request, fetch }) => {
	const { model, host = DEFAULT_HOST } = await request.json();
	if (!model || typeof model !== 'string') throw error(400, 'model is required');

	const base = String(host).replace(/\/+$/, '');

	let upstream: Response;
	try {
		upstream = await fetch(`${base}/api/pull`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: model, stream: true })
		});
	} catch {
		throw error(502, `Could not reach Ollama at ${base}`);
	}

	if (!upstream.ok || !upstream.body) {
		throw error(upstream.status || 502, `Ollama pull failed (${upstream.status})`);
	}

	return new Response(upstream.body, {
		status: 200,
		headers: {
			'Content-Type': 'application/x-ndjson',
			'Cache-Control': 'no-cache',
			'X-Accel-Buffering': 'no'
		}
	});
};
