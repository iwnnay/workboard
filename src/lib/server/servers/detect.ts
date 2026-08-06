import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import type { DirectoryEntry, DirectoryListing, ServerDetection, ServerType } from '$lib/types';
import { DEFAULT_DOCKER_COMMAND, isValidPort } from '$lib/start-command';

/** Presence of this file means the project is launched with `uv run start_server`. */
const PYTHON_MARKER = 'pyproject.toml';

/** Presence of this file means the project is launched with `npm run dev`. */
const NODE_MARKER = 'package.json';

/** Any of these means the project keeps its resources in Docker Compose. */
const DOCKER_MARKERS = [
	'docker-compose.yml',
	'docker-compose.yaml',
	'compose.yml',
	'compose.yaml'
] as const;

/** Env files searched for a `PORT=` line, in priority order. */
const ENV_FILES = ['.env', '.env.local'] as const;

/** Vite configs searched for `server: { port }`, in priority order. */
const VITE_CONFIGS = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'] as const;

/** Folders that are never worth showing in the directory picker. */
const HIDDEN_FROM_PICKER = new Set([
	'node_modules',
	'.git',
	'.svelte-kit',
	'dist',
	'build',
	'__pycache__',
	'.venv',
	'venv',
	'target',
	'.next',
	'.nuxt',
	'.cache'
]);

/** Where the directory picker opens: the folder the dev projects live in. */
export function defaultBrowsePath(): string {
	return join(homedir(), 'projects');
}

async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}

async function fileExists(directory: string, name: string): Promise<boolean> {
	try {
		return (await stat(join(directory, name))).isFile();
	} catch {
		return false;
	}
}

async function readFileOrNull(path: string): Promise<string | null> {
	try {
		return await readFile(path, 'utf8');
	} catch {
		return null;
	}
}

/**
 * A `PORT=` assignment in a dotenv file. Tolerates `export`, quotes, surrounding
 * whitespace and a trailing comment; ignores commented-out lines.
 */
export function parseEnvPort(content: string): number | null {
	const match = /^[ \t]*(?:export[ \t]+)?PORT[ \t]*=[ \t]*["']?(\d{1,5})["']?[ \t]*(?:#.*)?$/m.exec(
		content
	);
	if (!match) {
		return null;
	}
	const port = Number(match[1]);
	return isValidPort(port) ? port : null;
}

/**
 * `server: { port: 1234 }` in a Vite config. Read textually rather than
 * evaluated — the config is arbitrary code we are not going to run. A computed
 * port (`port: Number(process.env.PORT)`) simply doesn't match, which is the
 * right outcome: we don't know it either.
 */
export function parseViteServerPort(content: string): number | null {
	const serverBlock = /\bserver\s*:\s*\{([\s\S]*?)\}/.exec(content);
	if (!serverBlock) {
		return null;
	}
	const match = /\bport\s*:\s*(\d{1,5})\b/.exec(serverBlock[1]);
	if (!match) {
		return null;
	}
	const port = Number(match[1]);
	return isValidPort(port) ? port : null;
}

/** `--port 1234` or `--port=1234` inside package.json's `dev` script. */
export function parseDevScriptPort(packageJsonContent: string): number | null {
	let devScript: unknown;
	try {
		devScript = JSON.parse(packageJsonContent)?.scripts?.dev;
	} catch {
		return null;
	}
	if (typeof devScript !== 'string') {
		return null;
	}

	const match = /--port[= ]\s*["']?(\d{1,5})/.exec(devScript);
	if (!match) {
		return null;
	}
	const port = Number(match[1]);
	return isValidPort(port) ? port : null;
}

/**
 * Find the port a project already configures for itself, so the launcher can
 * link to it — and so we know not to force a `--port` the app has covered.
 * Returns the source alongside the number so the UI can say where it came from.
 */
export async function detectPort(
	directory: string
): Promise<{ port: number | null; portSource: string | null }> {
	for (const envFile of ENV_FILES) {
		const content = await readFileOrNull(join(directory, envFile));
		if (content === null) {
			continue;
		}
		const port = parseEnvPort(content);
		if (port !== null) {
			return { port, portSource: `${envFile} (PORT)` };
		}
	}

	for (const viteConfig of VITE_CONFIGS) {
		const content = await readFileOrNull(join(directory, viteConfig));
		if (content === null) {
			continue;
		}
		const port = parseViteServerPort(content);
		if (port !== null) {
			return { port, portSource: `${viteConfig} (server.port)` };
		}
	}

	const packageJson = await readFileOrNull(join(directory, NODE_MARKER));
	if (packageJson !== null) {
		const port = parseDevScriptPort(packageJson);
		if (port !== null) {
			return { port, portSource: 'package.json (dev script --port)' };
		}
	}

	return { port: null, portSource: null };
}

/**
 * Work out how a project folder should be launched from the files it contains.
 * A `pyproject.toml` wins over a `package.json` — a Python app may still carry
 * a `package.json` for front-end tooling, but not the other way round.
 */
export async function detectServer(directory: string): Promise<ServerDetection> {
	const absolute = resolve(directory);
	const detection: ServerDetection = {
		directory: absolute,
		exists: await isDirectory(absolute),
		alias: basename(absolute),
		serverType: null,
		port: null,
		portSource: null,
		docker: false,
		dockerCommand: '',
		markers: []
	};

	if (!detection.exists) {
		return detection;
	}

	const [hasPython, hasNode] = await Promise.all([
		fileExists(absolute, PYTHON_MARKER),
		fileExists(absolute, NODE_MARKER)
	]);

	if (hasPython) {
		detection.serverType = 'python';
		detection.markers.push(PYTHON_MARKER);
	}
	if (hasNode) {
		if (detection.serverType === null) {
			detection.serverType = 'node';
		}
		detection.markers.push(NODE_MARKER);
	}

	const dockerFiles = await Promise.all(
		DOCKER_MARKERS.map(async (name) => ((await fileExists(absolute, name)) ? name : null))
	);
	const dockerMarker = dockerFiles.find(
		(name): name is (typeof DOCKER_MARKERS)[number] => name !== null
	);
	if (dockerMarker) {
		detection.docker = true;
		detection.dockerCommand = DEFAULT_DOCKER_COMMAND;
		detection.markers.push(dockerMarker);
	}

	const { port, portSource } = await detectPort(absolute);
	detection.port = port;
	detection.portSource = portSource;
	if (portSource) {
		detection.markers.push(portSource);
	}

	return detection;
}

/** Cheap version of {@link detectServer} used to flag rows in the picker. */
async function looksLikeProject(directory: string): Promise<boolean> {
	const [hasPython, hasNode] = await Promise.all([
		fileExists(directory, PYTHON_MARKER),
		fileExists(directory, NODE_MARKER)
	]);
	return hasPython || hasNode;
}

/** List the sub-directories of `path` for the directory picker. */
export async function listDirectories(path: string): Promise<DirectoryListing> {
	const absolute = resolve(path);

	let names: string[];
	try {
		names = await readdir(absolute);
	} catch (caught) {
		throw new Error(
			`listing directories in "${absolute}": ${caught instanceof Error ? caught.message : String(caught)}`,
			{ cause: caught }
		);
	}

	const candidates = names
		.filter((name) => !HIDDEN_FROM_PICKER.has(name) && !name.startsWith('.'))
		.sort((first, second) => first.toLowerCase().localeCompare(second.toLowerCase()));

	const entries: DirectoryEntry[] = [];
	for (const name of candidates) {
		const childPath = join(absolute, name);
		if (!(await isDirectory(childPath))) {
			continue;
		}
		entries.push({ name, path: childPath, isProject: await looksLikeProject(childPath) });
	}

	const parent = dirname(absolute);

	return {
		path: absolute,
		// At a filesystem root, dirname() returns the path itself — nowhere to go up to.
		parent: parent === absolute ? null : parent,
		entries
	};
}

/** Label helper shared by the API and the page. */
export function aliasFromDirectory(directory: string): string {
	return basename(resolve(directory));
}

export type { ServerType };
