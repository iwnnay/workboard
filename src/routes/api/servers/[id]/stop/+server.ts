import type { RequestHandler } from './$types';
import { route } from '$lib/server/http';
import { stopServer } from '$lib/server/servers/service';

/** Kills the launched process tree and takes Docker resources back down. */
export const POST: RequestHandler = ({ params }) => route(() => stopServer(params.id));
