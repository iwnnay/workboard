import type { RequestHandler } from './$types';
import { readJsonBody, route } from '$lib/server/http';
import { deleteProject, getProject, updateProject } from '$lib/server/projects';

export const GET: RequestHandler = ({ params }) => route(() => getProject(params.id));

export const PATCH: RequestHandler = ({ params, request }) =>
	route(async () => updateProject(params.id, await readJsonBody(request)));

export const DELETE: RequestHandler = ({ params }) => route(() => deleteProject(params.id));
