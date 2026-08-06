export type PullStatus = 'queued' | 'downloading' | 'done' | 'error';

export interface PullItem {
	id: number;
	model: string;
	host: string;
	status: PullStatus;
	percent: number;
	statusText: string;
	error?: string;
	completed?: number;
	total?: number;
	controller?: AbortController;
}

interface PullLine {
	status?: string;
	error?: string;
	total?: number;
	completed?: number;
}

let nextId = 0;

/**
 * Singleton queue for `ollama pull`. Lives outside any component so the queue
 * and its in-flight downloads survive the modal being closed (or the user
 * navigating away). Both the page and the modal read this same instance.
 */
class PullQueue {
	items = $state<PullItem[]>([]);
	/** Called after each successful pull so the page can refresh its model list. */
	onComplete: (() => void) | null = null;
	private processing = false;

	get activeCount(): number {
		return this.items.filter((q) => q.status === 'queued' || q.status === 'downloading').length;
	}

	get finishedCount(): number {
		return this.items.filter((q) => q.status === 'done' || q.status === 'error').length;
	}

	/** Queue one or more models (newline- or comma-separated) for `host`. */
	add(input: string, host: string) {
		const names = input
			.split(/[\n,]+/)
			.map((s) => s.trim())
			.filter(Boolean);
		for (const model of names) {
			this.items.push({
				id: ++nextId,
				model,
				host,
				status: 'queued',
				percent: 0,
				statusText: 'queued'
			});
		}
		void this.process();
	}

	cancel(item: PullItem) {
		item.controller?.abort();
	}

	remove(item: PullItem) {
		if (item.status === 'downloading') {
			this.cancel(item);
		}
		this.items = this.items.filter((q) => q.id !== item.id);
	}

	clearFinished() {
		this.items = this.items.filter((q) => q.status !== 'done' && q.status !== 'error');
	}

	private async process() {
		if (this.processing) {
			return;
		}
		this.processing = true;
		try {
			let item: PullItem | undefined;
			while ((item = this.items.find((q) => q.status === 'queued'))) {
				await this.pull(item);
			}
		} finally {
			this.processing = false;
		}
	}

	private async pull(item: PullItem) {
		item.status = 'downloading';
		item.statusText = 'starting…';
		const controller = new AbortController();
		item.controller = controller;
		try {
			const res = await fetch('/api/ollama/pull', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ model: item.model, host: item.host }),
				signal: controller.signal
			});
			if (!res.ok || !res.body) {
				throw new Error(`HTTP ${res.status}`);
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				buffer += decoder.decode(value, { stream: true });
				let nl: number;
				while ((nl = buffer.indexOf('\n')) >= 0) {
					const line = buffer.slice(0, nl).trim();
					buffer = buffer.slice(nl + 1);
					if (line) {
						this.handleLine(item, line);
					}
				}
			}
			if (buffer.trim()) {
				this.handleLine(item, buffer.trim());
			}

			if (item.status === 'downloading') {
				item.status = 'done';
				item.percent = 100;
				item.statusText = 'complete';
			}
			if (item.status === 'done') {
				this.onComplete?.();
			}
		} catch (e) {
			item.status = 'error';
			if (controller.signal.aborted) {
				item.statusText = 'canceled';
			} else {
				item.error = e instanceof Error ? e.message : 'pull failed';
				item.statusText = 'failed';
			}
		} finally {
			item.controller = undefined;
		}
	}

	private handleLine(item: PullItem, line: string) {
		let obj: PullLine;
		try {
			obj = JSON.parse(line);
		} catch {
			return;
		}
		if (obj.error) {
			item.status = 'error';
			item.error = obj.error;
			item.statusText = 'failed';
			return;
		}
		if (typeof obj.total === 'number' && typeof obj.completed === 'number' && obj.total > 0) {
			item.total = obj.total;
			item.completed = obj.completed;
			item.percent = Math.min(100, (obj.completed / obj.total) * 100);
		}
		if (obj.status) {
			item.statusText = obj.status;
			if (obj.status === 'success') {
				item.status = 'done';
				item.percent = 100;
			}
		}
	}
}

export const pullQueue = new PullQueue();
