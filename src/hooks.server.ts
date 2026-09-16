import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { themeStyleTag } from '$lib/themes';

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%workboard.theme%', themeStyleTag(env.WORKBOARD_THEME))
	});
