import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { failWith } from '$lib/server/servers/http';
import { restartServer } from '$lib/server/servers/service';

export const POST: RequestHandler = async ({ params }) => {
	try {
		return json(await restartServer(params.id));
	} catch (caught) {
		failWith(`restarting managed server ${params.id}`, caught);
	}
};
