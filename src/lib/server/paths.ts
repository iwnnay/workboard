import { resolve, sep } from 'path';
import { forbidden } from './http';

/**
 * Resolve `filePath` against `root` and guarantee the result stays inside
 * `root`. Rejects traversal (`../`), absolute inputs that point elsewhere,
 * and sibling-prefix escapes (`C:\root-evil` passing a prefix check for
 * `C:\root`) by requiring a path-separator boundary after the root.
 */
export function resolveSafePath(root: string, filePath: string): string {
	const resolvedRoot = resolve(root);
	const absolutePath = resolve(resolvedRoot, filePath);
	if (absolutePath !== resolvedRoot && !absolutePath.startsWith(resolvedRoot + sep)) {
		throw forbidden(
			`resolving path "${filePath}" against project root "${resolvedRoot}": ` +
				`it resolves to "${absolutePath}", which is outside the project root`
		);
	}
	return absolutePath;
}
