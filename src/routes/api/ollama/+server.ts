import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEFAULT_HOST = 'http://127.0.0.1:11434';

export interface OllamaModelDetails {
	parent_model?: string;
	format?: string;
	family?: string;
	families?: string[] | null;
	parameter_size?: string;
	quantization_level?: string;
}

export interface OllamaModel {
	name: string;
	model: string;
	modified_at?: string;
	size: number;
	digest: string;
	details?: OllamaModelDetails;
	expires_at?: string;
	size_vram?: number;
}

export interface OllamaModelShow {
	license?: string;
	modelfile?: string;
	parameters?: string;
	template?: string;
	details?: OllamaModelDetails;
	model_info?: Record<string, unknown>;
	capabilities?: string[];
	error?: string;
}

export interface OllamaInfo {
	host: string;
	reachable: boolean;
	error?: string;
	version?: { version?: string };
	models: OllamaModel[];
	running: OllamaModel[];
	details: Record<string, OllamaModelShow>;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, init);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	return (await res.json()) as T;
}

export const GET: RequestHandler = async ({ url }) => {
	const host = (url.searchParams.get('host') || DEFAULT_HOST).replace(/\/+$/, '');

	const info: OllamaInfo = {
		host,
		reachable: false,
		models: [],
		running: [],
		details: {}
	};

	try {
		// Probe version first — this is also the cheapest reachability check.
		info.version = await getJson(`${host}/api/version`);
		info.reachable = true;
	} catch (e) {
		info.error = e instanceof Error ? e.message : 'Could not reach Ollama';
		return json(info);
	}

	// Local models and running models are independent — fetch in parallel.
	const [tags, ps] = await Promise.allSettled([
		getJson<{ models: OllamaModel[] }>(`${host}/api/tags`),
		getJson<{ models: OllamaModel[] }>(`${host}/api/ps`)
	]);

	if (tags.status === 'fulfilled') info.models = tags.value.models ?? [];
	if (ps.status === 'fulfilled') info.running = ps.value.models ?? [];

	// Detailed metadata for every local model, fetched concurrently.
	const shows = await Promise.allSettled(
		info.models.map((m) =>
			getJson<OllamaModelShow>(`${host}/api/show`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ model: m.name })
			})
		)
	);

	shows.forEach((result, i) => {
		const key = info.models[i].name;
		info.details[key] =
			result.status === 'fulfilled'
				? result.value
				: { error: result.reason instanceof Error ? result.reason.message : 'show failed' };
	});

	return json(info);
};
