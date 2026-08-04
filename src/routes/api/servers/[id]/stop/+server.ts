import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { failWith } from '$lib/server/servers/http';
import { stopServer } from '$lib/server/servers/service';

/** Kills the launched process tree and takes Docker resources back down. */
export const POST: RequestHandler = async ({ params }) => {
	try {
		return json(await stopServer(params.id));
	} catch (caught) {
		failWith(`stopping managed server ${params.id}`, caught);
	}
};
