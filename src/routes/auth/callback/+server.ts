import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import crypto from 'crypto';

const TOKEN_FILE = './.outlook_tokens.json';

function saveTokens(tokens: any) {
	const fs = require('fs');
	fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

export const GET = async ({ url }) => {
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');

	if (error) {
		console.error('OAuth error:', error);
		throw redirect(302, '/?auth_error=' + encodeURIComponent(error));
	}

	if (!code) {
		throw redirect(302, '/?auth_error=no_code');
	}

	const clientId = env.OUTLOOK_CLIENT_ID;
	const clientSecret = env.OUTLOOK_CLIENT_SECRET;
	const tenantId = env.OUTLOOK_TENANT_ID || 'common';
	const redirectUri = env.OUTLOOK_REDIRECT_URI;

	const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
	const body = new URLSearchParams();
	body.append('client_id', clientId);
	body.append('client_secret', clientSecret);
	body.append('code', code);
	body.append('redirect_uri', redirectUri);
	body.append('grant_type', 'authorization_code');
	body.append('scope', 'Calendars.Read offline_access openid profile email');

	const response = await fetch(tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
	});

	if (!response.ok) {
		const err = await response.text();
		console.error('Token exchange error:', err);
		throw redirect(302, '/?auth_error=token_exchange_failed');
	}

	const tokens = await response.json();
	tokens.obtainedAt = Date.now();
	saveTokens(tokens);

	throw redirect(302, '/');
};