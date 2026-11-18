export type PathSegment = {
	name: string;
	path: string;
};

const separatorPattern = /[\\/]+/;

const usesBackslashes = (path: string): boolean => /^[a-zA-Z]:/.test(path) || path.includes('\\');

const comparable = (path: string): string => {
	const trimmed = path.replace(/[\\/]+$/, '');
	return usesBackslashes(path) ? trimmed.replace(/\//g, '\\').toLowerCase() : trimmed;
};

export const pathSegments = (path: string): PathSegment[] => {
	const segments: PathSegment[] = [];
	const windowsStyle = usesBackslashes(path);
	const separator = windowsStyle ? '\\' : '/';
	const parts = path.split(separatorPattern).filter(Boolean);
	let built = windowsStyle ? '' : '/';
	if (!windowsStyle) {
		segments.push({ name: '/', path: '/' });
	}
	for (const [partIndex, part] of parts.entries()) {
		if (windowsStyle && partIndex === 0) {
			built = `${part}${separator}`;
		} else {
			built = built.endsWith(separator) ? `${built}${part}` : `${built}${separator}${part}`;
		}
		segments.push({ name: part, path: built });
	}
	return segments;
};

export const isWithinRoot = (path: string, root: string): boolean => {
	const candidate = comparable(path);
	const base = comparable(root);
	const separator = usesBackslashes(root) ? '\\' : '/';
	return candidate === base || candidate.startsWith(`${base}${separator}`);
};

export const findOwningProject = <Candidate extends { path: string }>(
	candidates: Candidate[],
	directory: string
): Candidate | null => {
	let owner: Candidate | null = null;
	for (const candidate of candidates) {
		const deeper = !owner || comparable(candidate.path).length > comparable(owner.path).length;
		if (isWithinRoot(directory, candidate.path) && deeper) {
			owner = candidate;
		}
	}
	return owner;
};

export const relativeToRoot = (path: string, root: string): string | null => {
	const base = root.replace(/[\\/]+$/, '');
	if (!isWithinRoot(path, root)) {
		return null;
	}
	const remainder = path.slice(base.length).replace(/^[\\/]+/, '');
	return remainder ? remainder.split(separatorPattern).join('/') : '.';
};
