import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { resolveProjectRoot } from '$lib/server/projects';
import { resolveSafePath } from '$lib/server/paths';
import {
	detectEol,
	normalizeToLf,
	hashContent,
	saveTextFile,
	type Eol
} from '$lib/server/text-files';
import { MAX_EDITABLE_FILE_BYTES } from '$lib/constants';

/**
 * Read a file for the in-browser editor. Content is LF-normalized; `eol`
 * and `baseHash` must be sent back on save so the original line endings are
 * preserved and concurrent on-disk edits are detected.
 */
export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('projectId') ?? '';
	const filePath = url.searchParams.get('path') ?? '';
	if (!filePath) {
		return json({ error: 'reading file for editor: no path was provided' }, { status: 400 });
	}

	let root: string;
	try {
		root = await resolveProjectRoot(projectId);
	} catch (caught) {
		return json({ error: (caught as Error).message }, { status: 404 });
	}

	let absolutePath: string;
	try {
		absolutePath = resolveSafePath(root, filePath);
	} catch (caught) {
		return json({ error: (caught as Error).message }, { status: 403 });
	}

	let raw: string;
	try {
		raw = readFileSync(absolutePath, 'utf-8');
	} catch (caught) {
		return json(
			{
				error: `reading file "${filePath}" in project ${projectId || '(this repo)'}: ${(caught as Error).message}`
			},
			{ status: 404 }
		);
	}

	if (raw.includes('\0')) {
		return json(
			{ error: `reading file "${filePath}": it is binary and cannot be edited as text` },
			{ status: 415 }
		);
	}

	const byteSize = Buffer.byteLength(raw, 'utf8');
	if (byteSize > MAX_EDITABLE_FILE_BYTES) {
		return json(
			{
				error:
					`reading file "${filePath}": it is ${byteSize} bytes, which exceeds the ` +
					`editor limit of ${MAX_EDITABLE_FILE_BYTES} bytes`
			},
			{ status: 413 }
		);
	}

	return json({
		path: filePath,
		content: normalizeToLf(raw),
		eol: detectEol(raw),
		byteSize,
		baseHash: hashContent(raw)
	});
};

/**
 * Save an edited file back to disk. Writes are restricted to files that are
 * part of the project's current diff (changed or untracked) — this endpoint
 * has no authentication, so it must not be a general-purpose file writer.
 */
export const PUT: RequestHandler = async ({ request }) => {
	let body: {
		projectId?: string;
		path?: string;
		range?: string;
		content?: string;
		eol?: string;
		baseHash?: string;
		force?: boolean;
	};
	try {
		body = await request.json();
	} catch (caught) {
		return json(
			{ error: `saving file: request body is not valid JSON: ${(caught as Error).message}` },
			{ status: 400 }
		);
	}

	const projectId = body.projectId ?? '';
	const filePath = body.path ?? '';
	const { content, baseHash, force = false } = body;
	const eol = body.eol as Eol;

	if (!filePath) {
		return json({ error: 'saving file: no path was provided' }, { status: 400 });
	}
	if (typeof content !== 'string') {
		return json(
			{ error: `saving file "${filePath}": request body has no string "content" field` },
			{ status: 400 }
		);
	}
	if (content.includes('\0')) {
		return json(
			{ error: `saving file "${filePath}": content contains NUL bytes; refusing to write binary` },
			{ status: 400 }
		);
	}
	if (eol !== 'crlf' && eol !== 'lf') {
		return json(
			{ error: `saving file "${filePath}": "eol" must be "crlf" or "lf", got "${body.eol}"` },
			{ status: 400 }
		);
	}
	if (!force && typeof baseHash !== 'string') {
		return json(
			{ error: `saving file "${filePath}": request body has no "baseHash" and "force" is not set` },
			{ status: 400 }
		);
	}

	const byteSize = Buffer.byteLength(content, 'utf8');
	if (byteSize > MAX_EDITABLE_FILE_BYTES) {
		return json(
			{
				error:
					`saving file "${filePath}": content is ${byteSize} bytes, which exceeds the ` +
					`editor limit of ${MAX_EDITABLE_FILE_BYTES} bytes`
			},
			{ status: 413 }
		);
	}

	let root: string;
	try {
		root = await resolveProjectRoot(projectId);
	} catch (caught) {
		return json({ error: (caught as Error).message }, { status: 404 });
	}

	let absolutePath: string;
	try {
		absolutePath = resolveSafePath(root, filePath);
	} catch (caught) {
		return json({ error: (caught as Error).message }, { status: 403 });
	}

	const membership = checkDiffMembership(root, filePath, body.range ?? '');
	if (!membership.allowed) {
		return json({ error: membership.reason }, { status: 403 });
	}

	const result = saveTextFile({
		absolutePath,
		content,
		eol,
		baseHash: baseHash ?? '',
		force
	});

	if (result.status === 'conflict') {
		return json({ error: result.reason, currentHash: result.currentHash }, { status: 409 });
	}

	return json({ baseHash: result.baseHash, byteSize: result.byteSize });
};

/**
 * A path is writable only if it appears in `git diff --name-only <range>` or
 * in the untracked-file list for the project root. A file edited back to
 * exactly match the compared ref drops out of the diff, so a subsequent save
 * in the same editor session can be rejected here — reopening the file after
 * re-running the diff recovers.
 */
function checkDiffMembership(
	root: string,
	filePath: string,
	rawRange: string
): { allowed: true } | { allowed: false; reason: string } {
	const safeRange = rawRange.replace(/[^a-zA-Z0-9.\-_/~^@{}:]/g, '') || 'HEAD';

	const diffResult = spawnSync('git', ['diff', '--name-only', '-z', safeRange], {
		encoding: 'utf8',
		cwd: root,
		timeout: 10_000
	});
	if (diffResult.status !== 0) {
		return {
			allowed: false,
			reason:
				`saving file "${filePath}": could not verify it belongs to the diff for range ` +
				`"${safeRange}" in ${root}: git diff failed: ${diffResult.stderr?.trim() || 'unknown error'}`
		};
	}

	const untrackedResult = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
		encoding: 'utf8',
		cwd: root,
		timeout: 10_000
	});

	const writablePaths = new Set(
		[
			...diffResult.stdout.split('\0'),
			...(untrackedResult.status === 0 ? untrackedResult.stdout.split('\0') : [])
		].filter(Boolean)
	);

	if (!writablePaths.has(filePath)) {
		return {
			allowed: false,
			reason:
				`saving file "${filePath}": it is not among the ${writablePaths.size} changed or ` +
				`untracked files for range "${safeRange}" in ${root}; only files in the current ` +
				`diff can be written. If you just saved this file to match ${safeRange}, re-run ` +
				`the diff and reopen it.`
		};
	}

	return { allowed: true };
}
