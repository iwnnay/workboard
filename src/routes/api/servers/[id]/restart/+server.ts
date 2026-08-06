import type { RequestHandler } from './$types';
import { route } from '$lib/server/http';
import { restartServer } from '$lib/server/servers/service';

export const POST: RequestHandler = ({ params }) => route(() => restartServer(params.id));
