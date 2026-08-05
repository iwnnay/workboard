import { describe, it, expect } from 'vitest';
import { parseLsofPids, parseNetstatListeningPids } from '$lib/server/servers/process';

describe('parseNetstatListeningPids', () => {
	const stdout = [
		'Active Connections',
		'',
		'  Proto  Local Address          Foreign Address        State           PID',
		'  TCP    0.0.0.0:7010           0.0.0.0:0              LISTENING       12345',
		'  TCP    127.0.0.1:5173         127.0.0.1:57012        ESTABLISHED     999',
		'  TCP    [::]:7010              [::]:0                 LISTENING       12345',
		'  TCP    0.0.0.0:7011           0.0.0.0:0              LISTENING       6789'
	].join('\r\n');

	it('finds the pid listening on the port', () => {
		expect(parseNetstatListeningPids(stdout, 7010)).toEqual([12345]);
	});

	it('ignores rows for other ports', () => {
		expect(parseNetstatListeningPids(stdout, 7011)).toEqual([6789]);
	});

	it('ignores established connections to the same port', () => {
		expect(parseNetstatListeningPids(stdout, 5173)).toEqual([]);
	});

	it('does not match a port that is only a suffix of the local port', () => {
		expect(parseNetstatListeningPids(stdout, 10)).toEqual([]);
	});

	it('returns nothing for empty output', () => {
		expect(parseNetstatListeningPids('', 7010)).toEqual([]);
	});
});

describe('parseLsofPids', () => {
	it('reads one pid per line', () => {
		expect(parseLsofPids('12345\n6789\n')).toEqual([12345, 6789]);
	});

	it('de-duplicates repeated pids', () => {
		expect(parseLsofPids('12345\n12345\n')).toEqual([12345]);
	});

	it('returns nothing for empty output', () => {
		expect(parseLsofPids('  \n')).toEqual([]);
	});
});
