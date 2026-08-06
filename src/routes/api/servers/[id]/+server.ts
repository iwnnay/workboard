import type { RequestHandler } from './$types';
import { readJsonBody, route } from '$lib/server/http';
import { deleteServer, normaliseDraft, updateServer } from '$lib/server/servers/service';
import { probeServerStatus } from '$lib/server/servers/status';

export const PATCH: RequestHandler = ({ params, request }) =>
	route(async () => {
		const updated = await updateServer(
			params.id,
			await normaliseDraft(await readJsonBody(request))
		);
		return { ...updated, status: await probeServerStatus(updated) };
	});

/** Stops the server and its Docker resources, verifies, then drops the record. */
export const DELETE: RequestHandler = ({ params }) =>
	route(async () => ({ success: true, status: await deleteServer(params.id) }));
