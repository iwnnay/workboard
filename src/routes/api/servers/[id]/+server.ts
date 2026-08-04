import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { failWith } from '$lib/server/servers/http';
import { deleteServer, normaliseDraft, updateServer } from '$lib/server/servers/service';
import { probeServerStatus } from '$lib/server/servers/status';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	try {
		const draft = await normaliseDraft(body);
		const updated = await updateServer(params.id, draft);
		return json({ ...updated, status: await probeServerStatus(updated) });
	} catch (caught) {
		failWith(`updating managed server ${params.id}`, caught);
	}
};

/** Stops the server and its Docker resources, verifies, then drops the record. */
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const finalStatus = await deleteServer(params.id);
		return json({ success: true, status: finalStatus });
	} catch (caught) {
		failWith(`removing managed server ${params.id}`, caught);
	}
};
