import type { DiffFile, DiffLine } from '$lib/server/git';

export const ABSENT_DIFF_FINGERPRINT = '<absent>';

/** A compact identity for the rendered diff, including binary Git object ids. */
export function diffFileFingerprint(file: DiffFile): string {
	const content = file.hunks
		.map(
			(hunk) => `${hunk.header}\n${hunk.lines.map((line) => line.type + line.content).join('\n')}`
		)
		.join('\n');
	let hash = 0x811c9dc5;
	for (let charIndex = 0; charIndex < content.length; charIndex++) {
		hash ^= content.charCodeAt(charIndex);
		hash = Math.imul(hash, 0x01000193);
	}
	return `${(hash >>> 0).toString(36)}:${file.additions}:${file.deletions}:${file.revision ?? ''}`;
}

export function findTouchedDiffPaths(
	acknowledged: ReadonlyMap<string, string>,
	currentFiles: Iterable<DiffFile>
): Set<string> {
	const current = new Map([...currentFiles].map((file) => [file.path, diffFileFingerprint(file)]));
	const paths = new Set([...acknowledged.keys(), ...current.keys()]);
	return new Set(
		[...paths].filter(
			(path) =>
				(current.get(path) ?? ABSENT_DIFF_FINGERPRINT) !==
				(acknowledged.get(path) ?? ABSENT_DIFF_FINGERPRINT)
		)
	);
}

function lineFingerprint(line: DiffLine): string {
	return `${line.type}\0${line.content}`;
}

/**
 * Return live +/- lines not present in the acknowledged diff. Matching is
 * occurrence-aware so duplicate lines do not hide a newly added occurrence.
 */
export function findIncrementalDiffLines(
	acknowledged: DiffFile | undefined,
	current: DiffFile
): Set<DiffLine> {
	const remaining = new Map<string, number>();
	for (const hunk of acknowledged?.hunks ?? []) {
		for (const line of hunk.lines) {
			if (line.type !== 'context') {
				const key = lineFingerprint(line);
				remaining.set(key, (remaining.get(key) ?? 0) + 1);
			}
		}
	}

	const incremental = new Set<DiffLine>();
	for (const hunk of current.hunks) {
		for (const line of hunk.lines) {
			if (line.type === 'context') {
				continue;
			}
			const key = lineFingerprint(line);
			const matches = remaining.get(key) ?? 0;
			if (matches > 0) {
				remaining.set(key, matches - 1);
			} else {
				incremental.add(line);
			}
		}
	}
	return incremental;
}
