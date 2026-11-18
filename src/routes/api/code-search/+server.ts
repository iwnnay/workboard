import type { RequestHandler } from './$types';
import { badRequest, route } from '$lib/server/http';
import { resolveProjectContext } from '$lib/server/projects';
import { searchCode } from '$lib/server/code-search';

const maxQueryLength = 200;

export const GET: RequestHandler = ({ url }) =>
	route(async () => {
		const query = url.searchParams.get('query') ?? '';
		const projectId = url.searchParams.get('projectId') ?? '';
		const includeTests = url.searchParams.get('includeTests') === '1';
		if (!query.trim()) {
			throw badRequest('searching code: the "query" parameter is empty');
		}
		if (query.includes('\n')) {
			throw badRequest(
				'searching code: the query spans multiple lines; only single-line text is searched'
			);
		}
		if (query.length > maxQueryLength) {
			throw badRequest(
				`searching code: the query is ${query.length} characters, longer than the ${maxQueryLength}-character limit`
			);
		}
		const { root, settings } = await resolveProjectContext(projectId);
		return { root, ...searchCode({ root, query, settings, includeTests }) };
	});
