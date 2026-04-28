import type { PageServerLoad } from './$types';
import { execSync } from 'child_process';
import { parseDiff, type DiffFile } from '$lib/server/git';

export const load: PageServerLoad = async ({ url }) => {
	const range = url.searchParams.get('range') ?? 'HEAD~1..HEAD';

	// Allow only characters valid in git refs / ranges
	const safeRange = range.replace(/[^a-zA-Z0-9.\-_/~^@{}:]/g, '');

	try {
		const raw = execSync(`git diff ${safeRange}`, {
			encoding: 'utf8',
			cwd: process.cwd(),
			maxBuffer: 10 * 1024 * 1024,
			timeout: 10_000
		});
		return { files: parseDiff(raw), range, error: null };
	} catch (e: unknown) {
		const msg =
			(e as { stderr?: Buffer })?.stderr?.toString()?.trim() ??
			(e instanceof Error ? e.message : String(e));
		return { files: [] as DiffFile[], range, error: msg };
	}
};
