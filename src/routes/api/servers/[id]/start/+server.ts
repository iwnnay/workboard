import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { failWith } from '$lib/server/servers/http';
import { startServer } from '$lib/server/servers/service';

/** Brings up Docker resources (if any) and launches the server process. */
export const POST: RequestHandler = async ({ params }) => {
	try {
		return json(await startServer(params.id));
	} catch (caught) {
		failWith(`starting managed server ${params.id}`, caught);
	}
};
