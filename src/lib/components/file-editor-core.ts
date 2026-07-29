/**
 * Browser-only CodeMirror 6 factory for the diff-page file editor. This
 * module must only ever be loaded via dynamic `import()` from the client
 * (FileEditor.svelte does so in onMount) — a static import would pull
 * CodeMirror into SSR evaluation of the diff page.
 */
import {
	EditorView,
	keymap,
	lineNumbers,
	drawSelection,
	highlightActiveLine,
	highlightActiveLineGutter
} from '@codemirror/view';
import { Prec, type Extension, type Text } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
	indentOnInput,
	bracketMatching,
	syntaxHighlighting,
	HighlightStyle
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { vim, Vim } from '@replit/codemirror-vim';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';

export type FileEditorHandlers = {
	/** Persist the buffer; resolves true when the write succeeded. */
	save: () => Promise<boolean>;
	/** Close the editor; `force` skips the dirty-buffer refusal (`:q!`). */
	requestClose: (options: { force: boolean }) => void;
	dirtyChanged: (dirty: boolean) => void;
};

export type FileEditorHandle = {
	view: EditorView;
	isDirty: () => boolean;
	/** Mark the current document as the on-disk state (after a successful save). */
	markSaved: () => void;
	destroy: () => void;
};

// Vim.defineEx registers globally, so the handlers of the currently mounted
// editor are resolved through this pointer instead of being captured at
// registration time (a stale capture would target a destroyed editor when
// the component remounts).
let activeHandlers: FileEditorHandlers | null = null;
let exCommandsRegistered = false;

type ExCommandParams = { input?: string; bang?: boolean };

function hasBang(params?: ExCommandParams): boolean {
	return params?.bang === true || (params?.input ?? '').trim().endsWith('!');
}

function registerExCommands() {
	if (exCommandsRegistered) return;
	exCommandsRegistered = true;
	Vim.defineEx('write', 'w', () => {
		void activeHandlers?.save();
	});
	Vim.defineEx('quit', 'q', (_adapter: unknown, params?: ExCommandParams) => {
		activeHandlers?.requestClose({ force: hasBang(params) });
	});
	Vim.defineEx('wq', 'wq', () => {
		const handlers = activeHandlers;
		void handlers?.save().then((saved) => {
			if (saved && activeHandlers === handlers) handlers.requestClose({ force: true });
		});
	});
}

function languageExtension(filePath: string): Extension {
	const fileExtension = filePath.split('.').at(-1)?.toLowerCase() ?? '';
	switch (fileExtension) {
		case 'ts':
		case 'mts':
		case 'cts':
			return javascript({ typescript: true });
		case 'tsx':
			return javascript({ typescript: true, jsx: true });
		case 'js':
		case 'mjs':
		case 'cjs':
		case 'jsx':
			return javascript({ jsx: true });
		case 'svelte':
		case 'html':
		case 'htm':
			return html();
		case 'css':
			return css();
		case 'json':
			return json();
		case 'py':
			return python();
		case 'sql':
			return sql();
		case 'md':
		case 'markdown':
			return markdown();
		default:
			return [];
	}
}

// Maps the app's dark-red palette (CSS vars from +layout.svelte) onto the
// editor. CodeMirror injects these styles at document level, so Svelte
// scoped styles cannot reach them.
const editorTheme = EditorView.theme(
	{
		'&': {
			backgroundColor: 'var(--bg-2)',
			color: 'var(--text-2)',
			height: '100%',
			fontSize: '0.8125rem'
		},
		'.cm-scroller': {
			fontFamily: "'Courier New', monospace",
			lineHeight: '1.5',
			overflow: 'auto'
		},
		'.cm-content': { caretColor: 'var(--accent)' },
		'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
		'&.cm-focused .cm-fat-cursor': { background: 'var(--accent-muted)' },
		'&:not(.cm-focused) .cm-fat-cursor': {
			background: 'none',
			outline: '1px solid var(--accent-muted)'
		},
		'.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
			backgroundColor: 'var(--accent-bg)'
		},
		'.cm-selectionMatch': { backgroundColor: 'rgba(250, 220, 80, 0.15)' },
		'.cm-activeLine': { backgroundColor: 'rgba(239, 68, 68, 0.06)' },
		'.cm-gutters': {
			backgroundColor: 'var(--bg-2)',
			color: 'var(--text-ghost)',
			border: 'none',
			borderRight: '1px solid var(--border-2)'
		},
		'.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-dim)' },
		'.cm-matchingBracket': {
			backgroundColor: 'var(--accent-bg)',
			outline: '1px solid var(--accent-muted)'
		},
		'.cm-panels': {
			backgroundColor: 'var(--surface)',
			color: 'var(--text-2)',
			borderTop: '1px solid var(--border)',
			fontFamily: "'Courier New', monospace"
		},
		'.cm-vim-panel input': {
			color: 'var(--text)',
			fontFamily: "'Courier New', monospace"
		}
	},
	{ dark: true }
);

const editorHighlightStyle = HighlightStyle.define([
	{ tag: tags.keyword, color: '#e57373' },
	{ tag: [tags.string, tags.special(tags.string), tags.regexp], color: '#c9a84c' },
	{ tag: tags.comment, color: 'var(--text-ghost)', fontStyle: 'italic' },
	{ tag: [tags.number, tags.bool, tags.null], color: '#d8956f' },
	{ tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#9de8b0' },
	{ tag: [tags.typeName, tags.className, tags.namespace], color: '#8fbcd4' },
	{ tag: [tags.propertyName, tags.attributeName], color: '#d4a5a5' },
	{ tag: [tags.operator, tags.punctuation, tags.bracket], color: 'var(--text-dim)' },
	{ tag: [tags.variableName, tags.definition(tags.variableName)], color: 'var(--text-2)' },
	{ tag: tags.tagName, color: '#e57373' },
	{ tag: tags.heading, color: 'var(--text)', fontWeight: 'bold' },
	{ tag: tags.link, color: '#8fbcd4', textDecoration: 'underline' },
	{ tag: tags.invalid, color: 'var(--accent)' }
]);

export function createFileEditor(options: {
	parent: HTMLElement;
	doc: string;
	filePath: string;
	handlers: FileEditorHandlers;
}): FileEditorHandle {
	const { parent, doc, filePath, handlers } = options;
	registerExCommands();
	activeHandlers = handlers;

	let lastSavedDoc: Text | null = null;
	let lastDirty = false;

	const view = new EditorView({
		parent,
		doc,
		extensions: [
			// vim() must come first so its keymap takes precedence.
			vim({ status: true }),
			lineNumbers(),
			history(),
			drawSelection(),
			highlightActiveLine(),
			highlightActiveLineGutter(),
			highlightSelectionMatches(),
			indentOnInput(),
			bracketMatching(),
			syntaxHighlighting(editorHighlightStyle, { fallback: true }),
			languageExtension(filePath),
			editorTheme,
			EditorView.updateListener.of((update) => {
				if (!update.docChanged || !lastSavedDoc) return;
				const dirty = !update.state.doc.eq(lastSavedDoc);
				if (dirty !== lastDirty) {
					lastDirty = dirty;
					handlers.dirtyChanged(dirty);
				}
			}),
			Prec.highest(
				keymap.of([
					{
						key: 'Mod-s',
						preventDefault: true,
						run: () => {
							void handlers.save();
							return true;
						}
					}
				])
			),
			keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap])
		]
	});

	lastSavedDoc = view.state.doc;
	view.focus();

	return {
		view,
		isDirty: () => lastDirty,
		markSaved: () => {
			lastSavedDoc = view.state.doc;
			if (lastDirty) {
				lastDirty = false;
				handlers.dirtyChanged(false);
			}
		},
		destroy: () => {
			if (activeHandlers === handlers) activeHandlers = null;
			view.destroy();
		}
	};
}
