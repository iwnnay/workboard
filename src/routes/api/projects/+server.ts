import type { RequestHandler } from './$types';
import { readJsonBody, route } from '$lib/server/http';
import { createProject, listProjects } from '$lib/server/projects';

export const GET: RequestHandler = () => route(() => listProjects());

export const POST: RequestHandler = ({ request }) =>
	route(async () => createProject(await readJsonBody(request)), { status: 201 });
