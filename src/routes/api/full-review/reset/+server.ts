import type { RequestHandler } from './$types';
import { resetFullReview } from '$lib/server/full-review';
import { readJsonBody, route } from '$lib/server/http';

type ResetBody = { projectId?: string; directories?: unknown };

export const POST: RequestHandler = ({ request }) =>
	route(async () => {
		const body = await readJsonBody<ResetBody>(request);
		return resetFullReview(body.projectId ?? '', body.directories);
	});
