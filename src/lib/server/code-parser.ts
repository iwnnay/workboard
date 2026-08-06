import { readFileSync } from 'fs';
import { extname } from 'path';

export interface FunctionInfo {
	name: string;
	line: number;
	isExport: boolean;
	isAsync: boolean;
	doc?: string;
}

export interface MethodInfo {
	name: string;
	line: number;
	isAsync: boolean;
}

export interface ClassInfo {
	name: string;
	line: number;
	isExport: boolean;
	methods: MethodInfo[];
	doc?: string;
}

export interface InterfaceInfo {
	name: string;
	line: number;
	isExport: boolean;
	doc?: string;
}

export interface TypeAliasInfo {
	name: string;
	line: number;
	isExport: boolean;
}

export interface ImportInfo {
	module: string;
	named: string[];
	defaultImport?: string;
	line: number;
}

export interface ParsedFile {
	language: string;
	functions: FunctionInfo[];
	classes: ClassInfo[];
	interfaces: InterfaceInfo[];
	types: TypeAliasInfo[];
	imports: ImportInfo[];
}

const EXT_TO_LANG: Record<string, string> = {
	'.ts': 'typescript',
	'.tsx': 'typescript',
	'.js': 'javascript',
	'.jsx': 'javascript',
	'.svelte': 'svelte',
	'.css': 'css',
	'.scss': 'scss',
	'.html': 'html',
	'.json': 'json',
	'.md': 'markdown',
	'.py': 'python',
	'.go': 'go',
	'.rs': 'rust',
	'.sql': 'sql',
	'.sh': 'bash',
	'.yaml': 'yaml',
	'.yml': 'yaml',
	'.toml': 'toml',
	'.graphql': 'graphql',
	'.gql': 'graphql'
};

export function parseFile(filePath: string): ParsedFile {
	const ext = extname(filePath).toLowerCase();
	const language = EXT_TO_LANG[ext] ?? 'plaintext';

	let raw: string;
	try {
		raw = readFileSync(filePath, 'utf-8');
	} catch {
		return empty(language);
	}

	// Binary check
	if (raw.includes('\0')) {
		return empty(language);
	}

	// For non-JS/TS/Svelte files, skip parsing
	if (!['typescript', 'javascript', 'svelte'].includes(language)) {
		return empty(language);
	}

	let src = raw;
	if (ext === '.svelte') {
		const match = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
		if (!match) {
			return empty(language);
		}
		const before = raw.slice(0, raw.indexOf(match[0])).split('\n').length - 1;
		src = '\n'.repeat(before) + match[1];
	}

	return { language, ...parseLines(src.split('\n')) };
}

const METHOD_SKIP = new Set([
	'if',
	'while',
	'for',
	'switch',
	'return',
	'throw',
	'new',
	'class',
	'catch',
	'try',
	'else',
	'do',
	'case'
]);

function parseLines(lines: string[]) {
	const functions: FunctionInfo[] = [];
	const classes: ClassInfo[] = [];
	const interfaces: InterfaceInfo[] = [];
	const types: TypeAliasInfo[] = [];
	const imports: ImportInfo[] = [];

	let pendingDoc: string | undefined;
	let inJsDoc = false;
	let jsDocBuf: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const t = lines[i].trim();
		const lineNum = i + 1;

		// JSDoc
		if (t.startsWith('/**')) {
			inJsDoc = true;
			jsDocBuf = [t];
			if (t.endsWith('*/') && t.length > 4) {
				inJsDoc = false;
				pendingDoc = jsDocBuf.join('\n');
			}
			continue;
		}
		if (inJsDoc) {
			jsDocBuf.push(t);
			if (t.endsWith('*/')) {
				inJsDoc = false;
				pendingDoc = jsDocBuf.join('\n');
			}
			continue;
		}

		if (!t) {
			pendingDoc = undefined;
			continue;
		}
		if (t.startsWith('//')) {
			continue;
		}

		// Import (may span multiple lines)
		if (t.startsWith('import ') && !t.startsWith('import type ')) {
			let full = t;
			let j = i;
			while (!full.includes(';') && j + 1 < lines.length) {
				j++;
				full += ' ' + lines[j].trim();
			}
			if (j > i) {
				i = j;
			}

			const m = full.match(/^import\s+(.+?)\s+from\s+['"](.+?)['"]/);
			if (m) {
				const clause = m[1].replace(/\s+/g, ' ').trim();
				const named: string[] = [];
				let defaultImport: string | undefined;

				if (!clause.startsWith('{') && !clause.startsWith('*')) {
					const def = clause.match(/^(\w+)/);
					if (def) {
						defaultImport = def[1];
					}
				}
				const namedBlock = clause.match(/\{([^}]+)\}/);
				if (namedBlock) {
					named.push(
						...namedBlock[1]
							.split(',')
							.map((s) =>
								s
									.trim()
									.replace(/\s+as\s+\w+$/, '')
									.replace(/^type\s+/, '')
									.trim()
							)
							.filter(Boolean)
					);
				}
				imports.push({ module: m[2], named, defaultImport, line: lineNum });
			}
			pendingDoc = undefined;
			continue;
		}

		// Function declaration
		const fnDecl = t.match(/^(export\s+(?:default\s+)?)?(async\s+)?function\b\s*\*?\s*(\w+)/);
		if (fnDecl) {
			functions.push({
				name: fnDecl[3],
				line: lineNum,
				isExport: !!fnDecl[1],
				isAsync: !!fnDecl[2],
				doc: pendingDoc
			});
			pendingDoc = undefined;
			continue;
		}

		// Arrow / function expression
		const varDecl = t.match(/^(export\s+)?(const|let|var)\s+(\w+)\b/);
		if (varDecl && (t.includes('=>') || /=\s*function\b/.test(t))) {
			functions.push({
				name: varDecl[3],
				line: lineNum,
				isExport: !!varDecl[1],
				isAsync: /(?:=|:)\s*async\s/.test(t),
				doc: pendingDoc
			});
			pendingDoc = undefined;
			continue;
		}

		// Class
		const classDecl = t.match(/^(export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)/);
		if (classDecl) {
			const info: ClassInfo = {
				name: classDecl[2],
				line: lineNum,
				isExport: !!classDecl[1],
				methods: [],
				doc: pendingDoc
			};
			classes.push(info);
			pendingDoc = undefined;
			scanMethods(lines, i, info);
			continue;
		}

		// Interface
		const ifaceDecl = t.match(/^(export\s+)?interface\s+(\w+)/);
		if (ifaceDecl) {
			interfaces.push({
				name: ifaceDecl[2],
				line: lineNum,
				isExport: !!ifaceDecl[1],
				doc: pendingDoc
			});
			pendingDoc = undefined;
			continue;
		}

		// Type alias
		const typeDecl = t.match(/^(export\s+)?type\s+(\w+)\b/);
		if (typeDecl && t.includes('=')) {
			types.push({ name: typeDecl[2], line: lineNum, isExport: !!typeDecl[1] });
			pendingDoc = undefined;
			continue;
		}

		pendingDoc = undefined;
	}

	return { functions, classes, interfaces, types, imports };
}

function scanMethods(lines: string[], classIdx: number, info: ClassInfo) {
	let depth = 0;
	let entered = false;
	for (let k = classIdx; k < lines.length; k++) {
		for (const ch of lines[k]) {
			if (ch === '{') {
				depth++;
				entered = true;
			} else if (ch === '}') {
				depth--;
			}
		}
		if (entered && depth === 1 && k > classIdx) {
			const t = lines[k].trim();
			const m = t.match(
				/^(?:(?:public|private|protected|static|async|override|abstract|readonly|get|set)\s+)*(\w+)\s*[(<]/
			);
			if (m && !METHOD_SKIP.has(m[1]) && !t.startsWith('//') && !t.startsWith('*')) {
				info.methods.push({ name: m[1], line: k + 1, isAsync: /\basync\b/.test(t) });
			}
		}
		if (entered && depth === 0) {
			break;
		}
	}
}

function empty(language: string): ParsedFile {
	return { language, functions: [], classes: [], interfaces: [], types: [], imports: [] };
}
