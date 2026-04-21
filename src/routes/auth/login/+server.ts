import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const GET = async () => {
	const clientId = env.OUTLOOK_CLIENT_ID;
	const tenantId = env.OUTLOOK_TENANT_ID || 'common';
	const redirectUri = env.OUTLOOK_REDIRECT_URI;
	const scope = 'Calendars.Read offline_access openid profile email';

	const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
	authUrl.searchParams.set('client_id', clientId);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('scope', scope);
	authUrl.searchParams.set('response_mode', 'query');

	throw redirect(302, authUrl.toString());
};