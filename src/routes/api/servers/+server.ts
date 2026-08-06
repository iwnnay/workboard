import type { RequestHandler } from './$types';
import { readJsonBody, route } from '$lib/server/http';
import { createServer, listServersWithStatus, normaliseDraft } from '$lib/server/servers/service';
import { probeServerStatus } from '$lib/server/servers/status';

/** Every managed server plus a freshly probed status — this is the poll target. */
export const GET: RequestHandler = () => route(() => listServersWithStatus());

export const POST: RequestHandler = ({ request }) =>
	route(
		async () => {
			const created = await createServer(await normaliseDraft(await readJsonBody(request)));
			return { ...created, status: await probeServerStatus(created) };
		},
		{ status: 201 }
	);
