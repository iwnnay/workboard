import type { RequestHandler } from './$types';
import { setFileReviewed } from '$lib/server/full-review';
import { badRequest, readJsonBody, route } from '$lib/server/http';

type FileBody = { projectId?: string; path?: string; checked?: boolean };

export const PATCH: RequestHandler = ({ request }) =>
	route(async () => {
		const body = await readJsonBody<FileBody>(request);
		if (!body.path || typeof body.checked !== 'boolean') {
			throw badRequest('path and checked are required');
		}
		return setFileReviewed(body.projectId ?? '', body.path, body.checked);
	});
