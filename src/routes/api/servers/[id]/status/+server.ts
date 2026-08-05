import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { failWith } from '$lib/server/servers/http';
import { checkServer } from '$lib/server/servers/service';

/** Backs the per-row refresh button — probes just this one server. */
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await checkServer(params.id));
	} catch (caught) {
		failWith(`checking the status of managed server ${params.id}`, caught);
	}
};
