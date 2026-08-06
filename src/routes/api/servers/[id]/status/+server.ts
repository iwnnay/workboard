import type { RequestHandler } from './$types';
import { route } from '$lib/server/http';
import { checkServer } from '$lib/server/servers/service';

/** Backs the per-row refresh button — probes just this one server. */
export const GET: RequestHandler = ({ params }) => route(() => checkServer(params.id));
