import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { detectServer } from '$lib/server/servers/detect';
import { failWith } from '$lib/server/servers/http';

/** What the add/edit form calls to pre-fill type, alias and Docker command. */
export const GET: RequestHandler = async ({ url }) => {
	const directory = url.searchParams.get('directory') ?? '';
	try {
		return json(await detectServer(directory));
	} catch (caught) {
		failWith(`detecting the server type of "${directory}"`, caught);
	}
};
