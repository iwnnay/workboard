import type { PageServerLoad } from './$types';
import { listServers } from '$lib/server/servers/service';

/**
 * Only the records — statuses are probed from the browser once the page is up,
 * so a slow Docker daemon can never hold up the first paint.
 */
export const load: PageServerLoad = async () => {
	return { servers: await listServers() };
};
