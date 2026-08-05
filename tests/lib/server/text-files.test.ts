import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
	detectEol,
	normalizeToLf,
	restoreEol,
	hashContent,
	saveTextFile
} from '$lib/server/text-files';

describe('detectEol', () => {
	it('detects pure CRLF', () => {
		expect(detectEol('one\r\ntwo\r\nthree\r\n')).toBe('crlf');
	});

	it('detects pure LF', () => {
		expect(detectEol('one\ntwo\nthree\n')).toBe('lf');
	});

	it('picks the dominant ending in a mixed file', () => {
		expect(detectEol('one\r\ntwo\r\nthree\n')).toBe('crlf');
		expect(detectEol('one\ntwo\nthree\r\n')).toBe('lf');
	});

	it('defaults to lf for empty and newline-free content', () => {
		expect(detectEol('')).toBe('lf');
		expect(detectEol('single line no newline')).toBe('lf');
	});
});

describe('EOL round-trips', () => {
	it('round-trips a CRLF file byte-identically', () => {
		const raw = 'alpha\r\nbeta\r\n\r\ngamma\r\n';
		const eol = detectEol(raw);
		expect(restoreEol(normalizeToLf(raw), eol)).toBe(raw);
	});

	it('round-trips an LF file byte-identically', () => {
		const raw = 'alpha\nbeta\n\ngamma\n';
		const eol = detectEol(raw);
		expect(restoreEol(normalizeToLf(raw), eol)).toBe(raw);
	});

	it('round-trips a file without a trailing newline', () => {
		const raw = 'alpha\r\nbeta';
		expect(restoreEol(normalizeToLf(raw), detectEol(raw))).toBe(raw);
	});

	it('round-trips an empty file', () => {
		expect(restoreEol(normalizeToLf(''), detectEol(''))).toBe('');
	});

	it('homogenizes a mixed-EOL file to the dominant ending', () => {
		const raw = 'one\r\ntwo\r\nthree\n';
		expect(restoreEol(normalizeToLf(raw), detectEol(raw))).toBe('one\r\ntwo\r\nthree\r\n');
	});
});

describe('hashContent', () => {
	it('is stable for equal content and differs for different content', () => {
		expect(hashContent('same')).toBe(hashContent('same'));
		expect(hashContent('same')).not.toBe(hashContent('same '));
	});

	it('distinguishes EOL styles (hash covers raw bytes)', () => {
		expect(hashContent('a\r\nb')).not.toBe(hashContent('a\nb'));
	});
});

describe('saveTextFile', () => {
	let tempDir: string;
	let targetPath: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'text-files-test-'));
		targetPath = join(tempDir, 'sample.ts');
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('saves when the base hash matches and restores CRLF endings', () => {
		const original = 'line one\r\nline two\r\n';
		writeFileSync(targetPath, original, 'utf-8');

		const result = saveTextFile({
			absolutePath: targetPath,
			content: 'line one\nline two edited\n',
			eol: 'crlf',
			baseHash: hashContent(original)
		});

		expect(result.status).toBe('saved');
		expect(readFileSync(targetPath, 'utf-8')).toBe('line one\r\nline two edited\r\n');
		if (result.status === 'saved') {
			expect(result.baseHash).toBe(hashContent('line one\r\nline two edited\r\n'));
		}
	});

	it('returns a conflict when the file changed on disk since it was read', () => {
		const original = 'original\n';
		writeFileSync(targetPath, original, 'utf-8');
		const staleHash = hashContent(original);

		writeFileSync(targetPath, 'externally modified\n', 'utf-8');

		const result = saveTextFile({
			absolutePath: targetPath,
			content: 'edited in browser\n',
			eol: 'lf',
			baseHash: staleHash
		});

		expect(result.status).toBe('conflict');
		if (result.status === 'conflict') {
			expect(result.reason).toContain('changed on disk');
			expect(result.currentHash).toBe(hashContent('externally modified\n'));
		}
		expect(readFileSync(targetPath, 'utf-8')).toBe('externally modified\n');
	});

	it('returns a conflict with a null hash when the file was deleted', () => {
		const result = saveTextFile({
			absolutePath: targetPath,
			content: 'anything\n',
			eol: 'lf',
			baseHash: hashContent('anything\n')
		});

		expect(result.status).toBe('conflict');
		if (result.status === 'conflict') {
			expect(result.reason).toContain('no longer exists');
			expect(result.currentHash).toBeNull();
		}
	});

	it('overwrites despite a stale hash when force is set', () => {
		writeFileSync(targetPath, 'externally modified\n', 'utf-8');

		const result = saveTextFile({
			absolutePath: targetPath,
			content: 'forced content\n',
			eol: 'lf',
			baseHash: 'stale-hash-that-matches-nothing',
			force: true
		});

		expect(result.status).toBe('saved');
		expect(readFileSync(targetPath, 'utf-8')).toBe('forced content\n');
	});
});
