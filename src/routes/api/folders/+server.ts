import type { RequestHandler } from './$types';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { route } from '$lib/server/http';
import { defaultBrowsePath, listDirectories } from '$lib/server/servers/detect';
import type { FolderShortcut } from '$lib/types';

const driveLetters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const folderShortcuts = (): FolderShortcut[] => {
	const shortcuts: FolderShortcut[] = [];
	if (existsSync(defaultBrowsePath())) {
		shortcuts.push({ label: 'Projects', path: defaultBrowsePath() });
	}
	shortcuts.push({ label: 'Home', path: homedir() });
	if (process.platform === 'win32') {
		for (const letter of driveLetters) {
			const drive = `${letter}:\\`;
			if (existsSync(drive)) {
				shortcuts.push({ label: `${letter}:`, path: drive });
			}
		}
	} else {
		shortcuts.push({ label: '/', path: '/' });
	}
	return shortcuts;
};

export const GET: RequestHandler = ({ url }) =>
	route(async () => {
		const requested = url.searchParams.get('path')?.trim();
		const listing = await listDirectories(requested || defaultBrowsePath());
		return { ...listing, shortcuts: folderShortcuts() };
	});
