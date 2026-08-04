import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { failWith } from '$lib/server/servers/http';
import { createServer, listServersWithStatus, normaliseDraft } from '$lib/server/servers/service';
import { probeServerStatus } from '$lib/server/servers/status';

/** Every managed server plus a freshly probed status — this is the poll target. */
export const GET: RequestHandler = async () => {
	return json(await listServersWithStatus());
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	try {
		const draft = await normaliseDraft(body);
		const created = await createServer(draft);
		return json({ ...created, status: await probeServerStatus(created) }, { status: 201 });
	} catch (caught) {
		failWith('adding a managed server', caught);
	}
};
