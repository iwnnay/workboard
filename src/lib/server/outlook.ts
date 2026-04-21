import { env } from '$env/dynamic/private';

const TOKEN_FILE = './.outlook_tokens.json';
const GRAPH_API = 'https://graph.microsoft.com/v1.0';

interface OutlookToken {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	obtainedAt: number;
}

function getTokens(): OutlookToken | null {
	try {
		const fs = require('fs');
		const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
		return JSON.parse(data);
	} catch (e) {
		return null;
	}
}

export function isAuthenticated(): boolean {
	const tokens = getTokens();
	if (!tokens) return false;
	const expiresAt = tokens.obtainedAt + tokens.expires_in * 1000;
	return Date.now() < expiresAt - 60000;
}

async function refreshAccessToken(): Promise<OutlookToken | null> {
	const tokens = getTokens();
	if (!tokens?.refresh_token) return null;

	const clientId = env.OUTLOOK_CLIENT_ID;
	const clientSecret = env.OUTLOOK_CLIENT_SECRET;
	const tenantId = env.OUTLOOK_TENANT_ID || 'common';

	const response = await fetch(
		`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams([
				['client_id', clientId],
				['client_secret', clientSecret],
				['refresh_token', tokens.refresh_token],
				['grant_type', 'refresh_token'],
				['scope', 'Calendars.Read offline_access openid profile email']
			])
		}
	);

	if (!response.ok) {
		console.error('Token refresh failed');
		return null;
	}

	const newTokens = await response.json();
	newTokens.obtainedAt = Date.now();

	const fs = require('fs');
	fs.writeFileSync(TOKEN_FILE, JSON.stringify(newTokens, null, 2));

	return newTokens;
}

export async function getCalendarEvents(startDate: Date, endDate: Date): Promise<any[]> {
	let tokens = getTokens();
	if (!tokens) return [];

	const expiresAt = tokens.obtainedAt + tokens.expires_in * 1000;
	if (Date.now() >= expiresAt - 60000) {
		tokens = await refreshAccessToken();
		if (!tokens) return [];
	}

	const query = new URLSearchParams({
		startDateTime: startDate.toISOString(),
		endDateTime: endDate.toISOString(),
		$select: 'subject,start,end,location,isAllDay',
		$orderby: 'start/dateTime'
	});

	const response = await fetch(`${GRAPH_API}/me/calendarView?${query}`, {
		headers: {
			Authorization: `Bearer ${tokens.access_token}`
		}
	});

	if (!response.ok) {
		console.error('Graph API error:', response.status);
		return [];
	}

	const data = await response.json();
	return data.value || [];
}