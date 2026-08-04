import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { defaultBrowsePath, listDirectories } from '$lib/server/servers/detect';
import { failWith } from '$lib/server/servers/http';

/** Directory listing for the picker. Without a `path` it opens at ~/projects. */
export const GET: RequestHandler = async ({ url }) => {
	const requested = url.searchParams.get('path');
	try {
		const path = requested?.trim() ? requested.trim() : defaultBrowsePath();
		return json(await listDirectories(path));
	} catch (caught) {
		failWith(`browsing directories under "${requested ?? '(default)'}"`, caught);
	}
};
