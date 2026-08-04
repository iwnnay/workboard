import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { db } from '$lib/server/db';
import { project } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { parseFile } from '$lib/server/code-parser';
import hljs from 'highlight.js';

export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('projectId') ?? '';
	const filePath = url.searchParams.get('path') ?? '';
	if (!filePath) return json({ error: 'missing path' }, { status: 400 });

	let root = process.cwd();
	if (projectId) {
		const rows = await db.select().from(project).where(eq(project.id, projectId));
		if (rows[0]) root = rows[0].path;
	}

	const abs = resolve(join(root, filePath));
	if (!abs.startsWith(resolve(root))) return json({ error: 'forbidden' }, { status: 403 });

	let content: string;
	try {
		content = readFileSync(abs, 'utf-8');
	} catch {
		return json({ error: 'not found' }, { status: 404 });
	}

	if (content.includes('\0')) return json({ error: 'binary file' }, { status: 415 });

	const st = statSync(abs);
	const lineCount = content.split('\n').length;
	const parsed = parseFile(abs);

	const hljsLang =
		parsed.language === 'svelte'
			? 'xml'
			: parsed.language === 'tsx'
				? 'typescript'
				: hljs.getLanguage(parsed.language)
					? parsed.language
					: 'plaintext';

	let highlighted: string;
	try {
		highlighted = hljs.highlight(content, { language: hljsLang, ignoreIllegals: true }).value;
	} catch {
		highlighted = escapeHtml(content);
	}

	return json({
		path: filePath,
		language: parsed.language,
		lineCount,
		byteSize: st.size,
		highlighted,
		parsed
	});
};

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
