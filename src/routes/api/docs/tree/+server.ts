import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { db } from '$lib/server/db';
import { project } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface TreeNode {
	name: string;
	path: string;
	type: 'file' | 'dir';
	ext?: string;
	children?: TreeNode[];
}

const IGNORE = new Set([
	'node_modules', '.git', 'dist', '.svelte-kit', 'build', 'coverage',
	'.cache', '__pycache__', '.next', '.nuxt', 'target', 'vendor',
	'.turbo', 'out', '.output', '.vercel', '.netlify', '.pnp', '.yarn'
]);

const CODE_EXTS = new Set([
	'.ts', '.tsx', '.js', '.jsx', '.svelte', '.vue',
	'.css', '.scss', '.less', '.html',
	'.py', '.go', '.rs', '.rb', '.php', '.java', '.kt', '.swift',
	'.c', '.cpp', '.h', '.hpp',
	'.json', '.toml', '.yaml', '.yml', '.md', '.sql',
	'.sh', '.bash', '.zsh', '.fish',
	'.prisma', '.graphql', '.gql', '.proto',
	'.env.example', '.gitignore', '.eslintrc', '.prettierrc'
]);

export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('projectId') ?? '';
	let root = process.cwd();

	if (projectId) {
		const rows = await db.select().from(project).where(eq(project.id, projectId));
		if (rows[0]) root = rows[0].path;
	}

	const tree = walk(root, '', 0);
	return json(tree);
};

function walk(root: string, rel: string, depth: number): TreeNode[] {
	if (depth > 12) return [];
	const abs = rel ? join(root, rel) : root;
	let entries: string[];
	try { entries = readdirSync(abs); } catch { return []; }

	const dirs: TreeNode[] = [];
	const files: TreeNode[] = [];

	for (const name of entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))) {
		if (name.startsWith('.') && !name.startsWith('.env') && name !== '.gitignore') continue;
		if (IGNORE.has(name)) continue;

		const relPath = rel ? `${rel}/${name}` : name;
		const fullPath = join(root, relPath);
		let st;
		try { st = statSync(fullPath); } catch { continue; }

		if (st.isDirectory()) {
			dirs.push({ name, path: relPath, type: 'dir', children: walk(root, relPath, depth + 1) });
		} else {
			const dot = name.lastIndexOf('.');
			const ext = dot > 0 ? name.slice(dot) : '';
			if (ext && !CODE_EXTS.has(ext)) continue;
			files.push({ name, path: relPath, type: 'file', ext: ext || undefined });
		}
	}

	return [...dirs, ...files];
}
