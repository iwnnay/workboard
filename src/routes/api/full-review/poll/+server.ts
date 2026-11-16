import type { RequestHandler } from './$types';
import { pollFullReview } from '$lib/server/full-review';
import { readJsonBody, route } from '$lib/server/http';

type PollBody = { projectId?: string };

export const POST: RequestHandler = ({ request }) =>
	route(async () => {
		const body = await readJsonBody<PollBody>(request);
		return pollFullReview(body.projectId ?? '');
	});
