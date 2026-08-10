import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export function parseEnvFileKeys(contents: string): string[] {
	const keys: string[] = [];

	for (const line of contents.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
		const separatorIndex = withoutExport.indexOf('=');
		if (separatorIndex <= 0) {
			continue;
		}

		const key = withoutExport.slice(0, separatorIndex).trim();
		if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !keys.includes(key)) {
			keys.push(key);
		}
	}

	return keys;
}

export async function readOwnConfigKeys(rootDirectory: string): Promise<string[]> {
	try {
		return parseEnvFileKeys(await readFile(resolve(rootDirectory, '.env'), 'utf8'));
	} catch {
		return [];
	}
}

export function buildChildEnvironment(
	parentEnvironment: NodeJS.ProcessEnv,
	ownConfigKeys: string[],
	extraEnvironment: Record<string, string> = {}
): NodeJS.ProcessEnv {
	const childEnvironment: NodeJS.ProcessEnv = { ...parentEnvironment };

	for (const key of ownConfigKeys) {
		if (!(key in extraEnvironment)) {
			delete childEnvironment[key];
		}
	}

	return { ...childEnvironment, ...extraEnvironment };
}
