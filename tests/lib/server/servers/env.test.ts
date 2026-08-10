import { describe, it, expect } from 'vitest';
import { buildChildEnvironment, parseEnvFileKeys } from '$lib/server/servers/env';

describe('parseEnvFileKeys', () => {
	it('reads the keys of a simple env file', () => {
		const contents = ['DATABASE_URL=local.db', 'PORT=7010'].join('\n');
		expect(parseEnvFileKeys(contents)).toEqual(['DATABASE_URL', 'PORT']);
	});

	it('ignores comments and blank lines', () => {
		const contents = ['# the database', '', 'DATABASE_URL=local.db', '   ', '# trailing'].join(
			'\n'
		);
		expect(parseEnvFileKeys(contents)).toEqual(['DATABASE_URL']);
	});

	it('handles CRLF line endings and export prefixes', () => {
		expect(parseEnvFileKeys('export DATABASE_URL=local.db\r\nPORT=7010\r\n')).toEqual([
			'DATABASE_URL',
			'PORT'
		]);
	});

	it('keeps values containing an equals sign out of the key', () => {
		expect(parseEnvFileKeys('CONNECTION=postgres://user:pass@host/db?ssl=true')).toEqual([
			'CONNECTION'
		]);
	});

	it('skips malformed lines and duplicates', () => {
		const contents = ['NOT_AN_ASSIGNMENT', '=leadingEquals', 'DUP=1', 'DUP=2', 'BAD KEY=3'].join(
			'\n'
		);
		expect(parseEnvFileKeys(contents)).toEqual(['DUP']);
	});

	it('returns nothing for empty contents', () => {
		expect(parseEnvFileKeys('')).toEqual([]);
	});
});

describe('buildChildEnvironment', () => {
	const parentEnvironment = {
		PATH: '/usr/bin',
		DATABASE_URL: 'local.db',
		HF_TOKEN: 'keep-me'
	};

	it('drops the parent app own config keys', () => {
		const result = buildChildEnvironment(parentEnvironment, ['DATABASE_URL'], {});
		expect(result.DATABASE_URL).toBeUndefined();
	});

	it('keeps environment the child may legitimately need', () => {
		const result = buildChildEnvironment(parentEnvironment, ['DATABASE_URL'], {});
		expect(result.PATH).toBe('/usr/bin');
		expect(result.HF_TOKEN).toBe('keep-me');
	});

	it('lets an explicit override win over the strip list', () => {
		const result = buildChildEnvironment(parentEnvironment, ['DATABASE_URL'], {
			DATABASE_URL: 'postgres://localhost/knowledge'
		});
		expect(result.DATABASE_URL).toBe('postgres://localhost/knowledge');
	});

	it('applies the extra environment on top', () => {
		const result = buildChildEnvironment(parentEnvironment, [], { PORT: '9150' });
		expect(result.PORT).toBe('9150');
	});

	it('leaves the parent environment untouched', () => {
		buildChildEnvironment(parentEnvironment, ['DATABASE_URL'], { PORT: '9150' });
		expect(parentEnvironment.DATABASE_URL).toBe('local.db');
		expect('PORT' in parentEnvironment).toBe(false);
	});

	it('strips nothing when there are no own config keys', () => {
		expect(buildChildEnvironment(parentEnvironment, [], {})).toEqual(parentEnvironment);
	});
});
