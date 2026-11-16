import type { RequestHandler } from './$types';
import { getFullReviewState } from '$lib/server/full-review';
import { route } from '$lib/server/http';

export const GET: RequestHandler = ({ url }) =>
	route(() => getFullReviewState(url.searchParams.get('projectId') ?? ''));
