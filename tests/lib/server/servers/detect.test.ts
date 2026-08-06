import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
	detectPort,
	detectServer,
	listDirectories,
	parseDevScriptPort,
	parseEnvPort,
	parseViteServerPort
} from '$lib/server/servers/detect';

let root: string;

async function makeProject(
	name: string,
	files: Record<string, string> | string[]
): Promise<string> {
	const directory = join(root, name);
	await mkdir(directory, { recursive: true });
	const entries = Array.isArray(files)
		? files.map((file) => [file, ''] as const)
		: Object.entries(files);
	for (const [file, contents] of entries) {
		await writeFile(join(directory, file), contents);
	}
	return directory;
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'workboard-servers-'));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe('detectServer', () => {
	it('detects a python project from its pyproject.toml', async () => {
		const directory = await makeProject('py-app', ['pyproject.toml']);
		const detection = await detectServer(directory);

		expect(detection).toMatchObject({
			exists: true,
			alias: 'py-app',
			serverType: 'python',
			docker: false,
			markers: ['pyproject.toml']
		});
	});

	it('detects a node project from its package.json', async () => {
		const directory = await makeProject('svelte-app', ['package.json']);
		const detection = await detectServer(directory);

		expect(detection).toMatchObject({ serverType: 'node', markers: ['package.json'] });
	});

	it('prefers python when a project carries both markers', async () => {
		const directory = await makeProject('hybrid', ['pyproject.toml', 'package.json']);
		const detection = await detectServer(directory);

		expect(detection.serverType).toBe('python');
	});

	it('flags docker and suggests the default command', async () => {
		const directory = await makeProject('with-docker', ['package.json', 'docker-compose.yml']);
		const detection = await detectServer(directory);

		expect(detection.docker).toBe(true);
		expect(detection.dockerCommand).toBe('docker compose up -d');
		expect(detection.markers).toContain('docker-compose.yml');
	});

	it('recognises the modern compose.yaml name', async () => {
		const directory = await makeProject('modern-docker', ['package.json', 'compose.yaml']);
		const detection = await detectServer(directory);

		expect(detection.docker).toBe(true);
	});

	it('lifts the port out of the project and records where it came from', async () => {
		const directory = await makeProject('ported', {
			'package.json': '{}',
			'.env': 'PORT=7042\n'
		});
		const detection = await detectServer(directory);

		expect(detection.port).toBe(7042);
		expect(detection.portSource).toBe('.env (PORT)');
		expect(detection.markers).toContain('.env (PORT)');
	});

	it('leaves the port null when the project configures none', async () => {
		const directory = await makeProject('portless', ['package.json']);
		const detection = await detectServer(directory);

		expect(detection.port).toBeNull();
		expect(detection.portSource).toBeNull();
	});

	it('reports a missing directory instead of throwing', async () => {
		const detection = await detectServer(join(root, 'not-there'));

		expect(detection.exists).toBe(false);
		expect(detection.serverType).toBeNull();
	});

	it('leaves the type unset when no marker file is present', async () => {
		const directory = await makeProject('plain', ['README.md']);
		const detection = await detectServer(directory);

		expect(detection.serverType).toBeNull();
		expect(detection.markers).toEqual([]);
	});
});

describe('parseEnvPort', () => {
	it('reads a plain assignment', () => {
		expect(parseEnvPort('DATABASE_URL=local.db\nPORT=8000\n')).toBe(8000);
	});

	it('tolerates export, quotes, padding and a trailing comment', () => {
		expect(parseEnvPort('  export PORT = "3000"  # dev only\n')).toBe(3000);
	});

	it('ignores a commented-out assignment', () => {
		expect(parseEnvPort('# PORT=9999\n')).toBeNull();
	});

	it('ignores a port-like variable that is not PORT', () => {
		expect(parseEnvPort('VITE_PORT=4000\n')).toBeNull();
	});

	it('rejects a value outside the port range', () => {
		expect(parseEnvPort('PORT=99999\n')).toBeNull();
	});
});

describe('parseViteServerPort', () => {
	it('reads server.port from a config', () => {
		const config = `export default defineConfig({\n\tserver: { port: 5173 },\n\tplugins: []\n});`;
		expect(parseViteServerPort(config)).toBe(5173);
	});

	it('reads a multi-line server block', () => {
		const config = `export default {\n  server: {\n    host: true,\n    port: 4321\n  }\n};`;
		expect(parseViteServerPort(config)).toBe(4321);
	});

	it('returns null when the port is computed rather than literal', () => {
		expect(
			parseViteServerPort('export default { server: { port: Number(env.PORT) } };')
		).toBeNull();
	});

	it('returns null when there is no server block', () => {
		expect(parseViteServerPort('export default { plugins: [] };')).toBeNull();
	});
});

describe('parseDevScriptPort', () => {
	it('reads a space-separated flag', () => {
		expect(parseDevScriptPort('{"scripts":{"dev":"vite dev --port 7010"}}')).toBe(7010);
	});

	it('reads an equals-separated flag', () => {
		expect(parseDevScriptPort('{"scripts":{"dev":"vite dev --port=7010"}}')).toBe(7010);
	});

	it('returns null when the dev script sets no port', () => {
		expect(parseDevScriptPort('{"scripts":{"dev":"vite dev"}}')).toBeNull();
	});

	it('returns null for malformed package.json', () => {
		expect(parseDevScriptPort('{not json')).toBeNull();
	});
});

describe('detectPort', () => {
	it('prefers .env over a vite config', async () => {
		const directory = await makeProject('both', {
			'.env': 'PORT=1111\n',
			'vite.config.ts': 'export default { server: { port: 2222 } };'
		});

		expect(await detectPort(directory)).toEqual({ port: 1111, portSource: '.env (PORT)' });
	});

	it('prefers a vite config over the dev script', async () => {
		const directory = await makeProject('vite-wins', {
			'vite.config.ts': 'export default { server: { port: 2222 } };',
			'package.json': '{"scripts":{"dev":"vite dev --port 3333"}}'
		});

		expect(await detectPort(directory)).toEqual({
			port: 2222,
			portSource: 'vite.config.ts (server.port)'
		});
	});

	it('falls back to the dev script', async () => {
		const directory = await makeProject('script-only', {
			'package.json': '{"scripts":{"dev":"vite dev --port 3333"}}'
		});

		expect(await detectPort(directory)).toEqual({
			port: 3333,
			portSource: 'package.json (dev script --port)'
		});
	});

	it('finds nothing in a project with no port anywhere', async () => {
		const directory = await makeProject('nothing', { 'package.json': '{}' });

		expect(await detectPort(directory)).toEqual({ port: null, portSource: null });
	});
});

describe('listDirectories', () => {
	it('lists sub-directories and marks the ones that look like projects', async () => {
		await makeProject('alpha', ['package.json']);
		await makeProject('beta', ['README.md']);
		await writeFile(join(root, 'loose-file.txt'), '');

		const listing = await listDirectories(root);

		expect(listing.entries.map((entry) => entry.name)).toEqual(['alpha', 'beta']);
		expect(listing.entries[0].isProject).toBe(true);
		expect(listing.entries[1].isProject).toBe(false);
	});

	it('hides build output and dot directories', async () => {
		await makeProject('node_modules', []);
		await makeProject('.git', []);
		await makeProject('real-app', ['pyproject.toml']);

		const listing = await listDirectories(root);

		expect(listing.entries.map((entry) => entry.name)).toEqual(['real-app']);
	});

	it('can walk up to the parent of any directory', async () => {
		await makeProject('child', []);

		const listing = await listDirectories(join(root, 'child'));

		expect(listing.parent).toBe(resolve(root));
	});

	it('has no parent at a filesystem root', async () => {
		let filesystemRoot = resolve(root);
		while (dirname(filesystemRoot) !== filesystemRoot) {
			filesystemRoot = dirname(filesystemRoot);
		}

		const listing = await listDirectories(filesystemRoot);

		expect(listing.parent).toBeNull();
	});

	it('reports which directory could not be read', async () => {
		await expect(listDirectories(join(root, 'missing'))).rejects.toThrow(/listing directories in/);
	});
});
