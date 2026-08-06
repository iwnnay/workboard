import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import Modal from '$lib/components/Modal.svelte';

function body(text: string) {
	return createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));
}

function open(props: { locked?: boolean; onClose?: () => void } = {}) {
	const onClose = props.onClose ?? vi.fn();
	const page = render(Modal, {
		title: 'Commit',
		locked: props.locked ?? false,
		onClose,
		children: body('dialog contents')
	});
	return { page, onClose };
}

function backdrop(): HTMLElement {
	const element = document.querySelector('.overlay');
	if (!element) {
		throw new Error('the modal overlay was not rendered');
	}
	return element as HTMLElement;
}

function pressBackdrop() {
	const overlay = backdrop();
	overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
	overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function pressEscape() {
	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

describe('chrome', () => {
	it('renders the title, its contents and a labelled dialog', async () => {
		const { page } = open();

		await expect.element(page.getByRole('dialog', { name: 'Commit' })).toBeInTheDocument();
		await expect.element(page.getByText('Commit')).toBeInTheDocument();
		await expect.element(page.getByText('dialog contents')).toBeInTheDocument();
	});

	it('closes from the ✕ button', async () => {
		const { page, onClose } = open();
		await page.getByRole('button', { name: 'Close' }).click();
		expect(onClose).toHaveBeenCalledOnce();
	});
});

describe('dismissal', () => {
	it('closes on a press and release that both land on the backdrop', () => {
		const { onClose } = open();
		pressBackdrop();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('stays open when the press started inside the dialog', () => {
		const { onClose } = open();
		const overlay = backdrop();

		overlay.querySelector('.modal')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(onClose).not.toHaveBeenCalled();
	});

	it('closes on Escape', () => {
		const { onClose } = open();
		pressEscape();
		expect(onClose).toHaveBeenCalledOnce();
	});
});

describe('locked', () => {
	it('ignores Escape and the backdrop while an action is in flight', () => {
		const { onClose } = open({ locked: true });

		pressEscape();
		pressBackdrop();

		expect(onClose).not.toHaveBeenCalled();
	});

	it('disables the ✕ button', async () => {
		const { page } = open({ locked: true });
		await expect.element(page.getByRole('button', { name: 'Close' })).toBeDisabled();
	});
});

describe('nesting', () => {
	it('gives Escape to the innermost modal only', () => {
		const outerClose = vi.fn();
		const innerClose = vi.fn();

		render(Modal, { title: 'Outer', onClose: outerClose, children: body('outer') });
		render(Modal, { title: 'Inner', onClose: innerClose, children: body('inner') });

		pressEscape();

		expect(innerClose).toHaveBeenCalledOnce();
		expect(outerClose).not.toHaveBeenCalled();
	});
});
