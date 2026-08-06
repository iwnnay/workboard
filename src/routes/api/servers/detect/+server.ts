import type { RequestHandler } from './$types';
import { route } from '$lib/server/http';
import { detectServer } from '$lib/server/servers/detect';

/** What the add/edit form calls to pre-fill type, alias and Docker command. */
export const GET: RequestHandler = ({ url }) =>
	route(() => detectServer(url.searchParams.get('directory') ?? ''));
