import { redirect } from '@sveltejs/kit';

const TOKEN_FILE = './.outlook_tokens.json';

export const GET = async () => {
	const fs = await import('fs');
	try {
		fs.unlinkSync(TOKEN_FILE);
	} catch (e) {}
	throw redirect(302, '/');
};