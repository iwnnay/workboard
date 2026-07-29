import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

export type Eol = 'crlf' | 'lf';

/**
 * Detect the dominant line ending of a file so an edited buffer can be
 * written back without whole-file EOL churn. Ties and newline-free files
 * report 'lf'.
 */
export function detectEol(raw: string): Eol {
	const crlfCount = (raw.match(/\r\n/g) ?? []).length;
	const newlineCount = (raw.match(/\n/g) ?? []).length;
	const loneLfCount = newlineCount - crlfCount;
	return crlfCount > loneLfCount ? 'crlf' : 'lf';
}

export function normalizeToLf(raw: string): string {
	return raw.replace(/\r\n/g, '\n');
}

/** Inverse of {@link normalizeToLf}; `lfContent` must not contain `\r\n`. */
export function restoreEol(lfContent: string, eol: Eol): string {
	return eol === 'crlf' ? lfContent.replace(/\n/g, '\r\n') : lfContent;
}

/** Optimistic-concurrency token for a file's exact on-disk bytes. */
export function hashContent(raw: string): string {
	return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export type SaveTextFileResult =
	| { status: 'saved'; baseHash: string; byteSize: number }
	| { status: 'conflict'; reason: string; currentHash: string | null };

/**
 * Write an LF-normalized buffer back to disk with its original line endings,
 * refusing when the file changed on disk since `baseHash` was computed
 * (unless `force` is set, for a user-confirmed overwrite). Pure of any
 * HTTP/db concerns so the conflict path is unit-testable.
 */
export function saveTextFile(options: {
	absolutePath: string;
	content: string;
	eol: Eol;
	baseHash: string;
	force?: boolean;
}): SaveTextFileResult {
	const { absolutePath, content, eol, baseHash, force = false } = options;

	if (!force) {
		let currentRaw: string;
		try {
			currentRaw = readFileSync(absolutePath, 'utf-8');
		} catch (caught) {
			return {
				status: 'conflict',
				reason:
					`saving file ${absolutePath}: the file no longer exists on disk ` +
					`(deleted or renamed since it was opened in the editor): ${(caught as Error).message}`,
				currentHash: null
			};
		}
		const currentHash = hashContent(currentRaw);
		if (currentHash !== baseHash) {
			return {
				status: 'conflict',
				reason:
					`saving file ${absolutePath}: the file changed on disk since it was opened ` +
					`in the editor (opened at hash ${baseHash.slice(0, 12)}…, disk is now at ` +
					`${currentHash.slice(0, 12)}…)`,
				currentHash
			};
		}
	}

	const rawToWrite = restoreEol(content, eol);
	writeFileSync(absolutePath, rawToWrite, 'utf-8');
	return {
		status: 'saved',
		baseHash: hashContent(rawToWrite),
		byteSize: Buffer.byteLength(rawToWrite, 'utf8')
	};
}
