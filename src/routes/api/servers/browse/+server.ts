import type { RequestHandler } from './$types';
import { route } from '$lib/server/http';
import { defaultBrowsePath, listDirectories } from '$lib/server/servers/detect';

/** Directory listing for the picker. Without a `path` it opens at ~/projects. */
export const GET: RequestHandler = ({ url }) =>
	route(() => {
		const requested = url.searchParams.get('path')?.trim();
		return listDirectories(requested || defaultBrowsePath());
	});
