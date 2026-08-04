import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { failWith } from '$lib/server/servers/http';
import { getServer } from '$lib/server/servers/service';
import { probeServerStatus } from '$lib/server/servers/status';

/** Backs the per-row refresh button — probes just this one server. */
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await probeServerStatus(await getServer(params.id)));
	} catch (caught) {
		failWith(`checking the status of managed server ${params.id}`, caught);
	}
};
