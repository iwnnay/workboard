import { describe, it, expect } from 'vitest';
import {
	buildStartCommand,
	buildStartEnvironment,
	describeStartCommand,
	deriveDockerStopCommand,
	isServerType,
	parsePort,
	DEFAULT_DOCKER_STOP_COMMAND
} from './start-command';

describe('buildStartCommand', () => {
	it('starts a python project with the Nacelle entry point', () => {
		expect(buildStartCommand('python', null, true)).toBe('uv run start_server');
	});

	it('ignores the port for python, which takes no port argument', () => {
		expect(buildStartCommand('python', 8000, true)).toBe('uv run start_server');
	});

	it('starts a node project with the dev script', () => {
		expect(buildStartCommand('node', null, true)).toBe('npm run dev');
	});

	it('forwards a configured port to the node dev server', () => {
		expect(buildStartCommand('node', 7010, true)).toBe('npm run dev -- --port=7010');
	});

	it('leaves the port off when the project sets its own', () => {
		expect(buildStartCommand('node', 7010, false)).toBe('npm run dev');
	});

	it('rejects an unknown server type', () => {
		expect(() => buildStartCommand('ruby' as 'node', null, true)).toThrow(/unknown server type/);
	});
});

describe('buildStartEnvironment', () => {
	it('gives a python server its port via PORT', () => {
		expect(buildStartEnvironment('python', 8000, true)).toEqual({ PORT: '8000' });
	});

	it('adds nothing for python when the flag is off', () => {
		expect(buildStartEnvironment('python', 8000, false)).toEqual({});
	});

	it('adds nothing for python when there is no port', () => {
		expect(buildStartEnvironment('python', null, true)).toEqual({});
	});

	it('adds nothing for node, which takes the port on the command line', () => {
		expect(buildStartEnvironment('node', 7010, true)).toEqual({});
	});
});

describe('describeStartCommand', () => {
	it('shows the env prefix a python server will be launched with', () => {
		expect(describeStartCommand('python', 8000, true)).toBe('PORT=8000 uv run start_server');
	});

	it('shows a bare python command when the flag is off', () => {
		expect(describeStartCommand('python', 8000, false)).toBe('uv run start_server');
	});

	it('shows the --port argument a node server will be launched with', () => {
		expect(describeStartCommand('node', 7010, true)).toBe('npm run dev -- --port=7010');
	});

	it('shows a bare node command when the flag is off', () => {
		expect(describeStartCommand('node', 7010, false)).toBe('npm run dev');
	});
});

describe('deriveDockerStopCommand', () => {
	it('turns the default up command into down', () => {
		expect(deriveDockerStopCommand('docker compose up -d')).toBe('docker compose down');
	});

	it('keeps flags that precede the verb', () => {
		expect(deriveDockerStopCommand('docker compose -f other.yml up -d --build')).toBe(
			'docker compose -f other.yml down'
		);
	});

	it('handles the hyphenated legacy binary', () => {
		expect(deriveDockerStopCommand('docker-compose up')).toBe('docker-compose down');
	});

	it('falls back to a plain down for an empty command', () => {
		expect(deriveDockerStopCommand('')).toBe(DEFAULT_DOCKER_STOP_COMMAND);
	});

	it('falls back to a plain down for something that is not compose', () => {
		expect(deriveDockerStopCommand('make services')).toBe(DEFAULT_DOCKER_STOP_COMMAND);
	});
});

describe('parsePort', () => {
	it('treats blank input as no port', () => {
		expect(parsePort('')).toBeNull();
		expect(parsePort(null)).toBeNull();
		expect(parsePort(undefined)).toBeNull();
	});

	it('accepts a numeric string', () => {
		expect(parsePort(' 7010 ')).toBe(7010);
	});

	it('accepts a number', () => {
		expect(parsePort(3000)).toBe(3000);
	});

	it.each([0, 65536, -1, 1.5, 'abc'])('rejects %s', (value) => {
		expect(() => parsePort(value)).toThrow(/between 1 and 65535/);
	});
});

describe('isServerType', () => {
	it('accepts the two supported types', () => {
		expect(isServerType('python')).toBe(true);
		expect(isServerType('node')).toBe(true);
	});

	it('rejects anything else', () => {
		expect(isServerType('svelte')).toBe(false);
		expect(isServerType(null)).toBe(false);
	});
});
