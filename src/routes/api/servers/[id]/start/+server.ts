import type { RequestHandler } from './$types';
import { route } from '$lib/server/http';
import { startServer } from '$lib/server/servers/service';

/** Brings up Docker resources (if any) and launches the server process. */
export const POST: RequestHandler = ({ params }) => route(() => startServer(params.id));
