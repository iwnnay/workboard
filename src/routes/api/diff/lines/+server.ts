import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '$lib/server/db';
import { project } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('projectId') ?? '';
	const filePath = url.searchParams.get('path') ?? '';
	const range = url.searchParams.get('range') ?? 'HEAD';
	const start = Math.max(1, parseInt(url.searchParams.get('start') ?? '1'));
	const end = parseInt(url.searchParams.get('end') ?? '1');

	if (!filePath || start > end) return json({ lines: [] });

	const projects = await db.select().from(project).orderBy(asc(project.name));
	let cwd = process.cwd();
	if (projectId) {
		const found = projects.find((p) => p.id === projectId);
		if (found) cwd = found.path;
	}

	const safeRange = range.replace(/[^a-zA-Z0-9.\-_/~^@{}:]/g, '');
	const rightRef = safeRange.includes('..') ? (safeRange.split('..').at(-1) || 'HEAD') : 'HEAD';

	let allLines: string[];

	const gitResult = spawnSync('git', ['show', `${rightRef}:${filePath}`], {
		encoding: 'utf8',
		cwd,
		timeout: 5000
	});

	if (gitResult.status === 0) {
		allLines = gitResult.stdout.split('\n');
	} else {
		try {
			const content = readFileSync(join(cwd, filePath), 'utf8');
			allLines = content.split('\n');
		} catch {
			return json({ lines: [] });
		}
	}

	if (allLines.at(-1) === '') allLines.pop();
	return json({ lines: allLines.slice(start - 1, end) });
};
