import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFileEditor, type FileEditorHandle } from '$lib/components/file-editor-core';

let editor: FileEditorHandle | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
	editor?.destroy();
	host?.remove();
	editor = null;
	host = null;
});

function press(key: string, code: string): boolean {
	return editor!.view.contentDOM.dispatchEvent(
		new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true })
	);
}

describe('file editor keyboard handling', () => {
	it('keeps focus in the editor and indents when Tab is pressed in insert mode', () => {
		host = document.createElement('div');
		document.body.append(host);
		editor = createFileEditor({
			parent: host,
			doc: 'const answer = 42;',
			filePath: 'answer.ts',
			handlers: {
				save: vi.fn(async () => true),
				requestClose: vi.fn(),
				dirtyChanged: vi.fn()
			}
		});

		press('i', 'KeyI');
		const tabWasNotCancelled = press('Tab', 'Tab');

		expect(tabWasNotCancelled).toBe(false);
		expect(editor.view.state.doc.toString()).toBe('  const answer = 42;');
		expect(editor.view.hasFocus).toBe(true);
	});
});
