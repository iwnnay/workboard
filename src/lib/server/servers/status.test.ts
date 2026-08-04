import { describe, it, expect } from 'vitest';
import { parseComposePs, summariseDockerState } from './status';

describe('parseComposePs', () => {
	it('parses the JSON array emitted by recent Compose versions', () => {
		const stdout = JSON.stringify([
			{ Name: 'app-db-1', Service: 'db', State: 'running' },
			{ Name: 'app-cache-1', Service: 'cache', State: 'exited' }
		]);

		expect(parseComposePs(stdout)).toEqual([
			{ name: 'db', state: 'running' },
			{ name: 'cache', state: 'exited' }
		]);
	});

	it('parses the one-object-per-line form emitted by older Compose versions', () => {
		const stdout = [
			'{"Name":"app-db-1","Service":"db","State":"Running"}',
			'{"Name":"app-web-1","Service":"web","State":"Running"}'
		].join('\n');

		expect(parseComposePs(stdout)).toEqual([
			{ name: 'db', state: 'running' },
			{ name: 'web', state: 'running' }
		]);
	});

	it('falls back to Name and Status when Service and State are absent', () => {
		expect(parseComposePs('{"Name":"lonely-1","Status":"Up 3 minutes"}')).toEqual([
			{ name: 'lonely-1', state: 'up 3 minutes' }
		]);
	});

	it('returns nothing for empty output', () => {
		expect(parseComposePs('   ')).toEqual([]);
	});
});

describe('summariseDockerState', () => {
	it('calls a project with no services stopped', () => {
		expect(summariseDockerState([])).toBe('stopped');
	});

	it('calls every service running "running"', () => {
		expect(
			summariseDockerState([
				{ name: 'db', state: 'running' },
				{ name: 'web', state: 'running' }
			])
		).toBe('running');
	});

	it('calls a mixed set "partial"', () => {
		expect(
			summariseDockerState([
				{ name: 'db', state: 'running' },
				{ name: 'web', state: 'exited' }
			])
		).toBe('partial');
	});

	it('calls an all-exited set "stopped"', () => {
		expect(summariseDockerState([{ name: 'db', state: 'exited' }])).toBe('stopped');
	});
});
