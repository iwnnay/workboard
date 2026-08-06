<script lang="ts">
	type DiffChunk = { val: string; op: 'eq' | 'del' | 'ins' };

	let leftText = $state('');
	let rightText = $state('');
	let chunks = $state<DiffChunk[]>([]);
	let compared = $state(false);
	let truncated = $state(false);

	const MAX_TOKENS = 4000;

	function tokenize(text: string): string[] {
		return text.match(/[^\s]+|\s+/g) ?? [];
	}

	function lcsDiff(a: string[], b: string[]): DiffChunk[] {
		const m = a.length;
		const n = b.length;

		// DP for LCS lengths
		const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				dp[i][j] =
					a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}

		// Backtrack
		const result: DiffChunk[] = [];
		let i = m,
			j = n;
		while (i > 0 || j > 0) {
			if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
				result.unshift({ val: a[i - 1], op: 'eq' });
				i--;
				j--;
			} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
				result.unshift({ val: b[j - 1], op: 'ins' });
				j--;
			} else {
				result.unshift({ val: a[i - 1], op: 'del' });
				i--;
			}
		}
		return result;
	}

	function compare() {
		let a = tokenize(leftText);
		let b = tokenize(rightText);
		truncated = a.length > MAX_TOKENS || b.length > MAX_TOKENS;
		if (truncated) {
			a = a.slice(0, MAX_TOKENS);
			b = b.slice(0, MAX_TOKENS);
		}
		chunks = lcsDiff(a, b);
		compared = true;
	}

	const leftChunks = $derived(chunks.filter((c) => c.op !== 'ins'));
	const rightChunks = $derived(chunks.filter((c) => c.op !== 'del'));
	const hasDiff = $derived(chunks.some((c) => c.op !== 'eq'));

	let syncing = false;
	let leftEl: HTMLElement | null = null;
	let rightEl: HTMLElement | null = null;

	function attachLeft(node: HTMLElement) {
		leftEl = node;
		const onScroll = () => {
			if (syncing || !rightEl) {
				return;
			}
			syncing = true;
			rightEl.scrollTop = node.scrollTop;
			syncing = false;
		};
		node.addEventListener('scroll', onScroll);
		return () => {
			node.removeEventListener('scroll', onScroll);
			leftEl = null;
		};
	}

	function attachRight(node: HTMLElement) {
		rightEl = node;
		const onScroll = () => {
			if (syncing || !leftEl) {
				return;
			}
			syncing = true;
			leftEl.scrollTop = node.scrollTop;
			syncing = false;
		};
		node.addEventListener('scroll', onScroll);
		return () => {
			node.removeEventListener('scroll', onScroll);
			rightEl = null;
		};
	}
</script>

<div class="page">
	<header class="topbar">
		<span class="topbar-label">Compare</span>
		<div class="topbar-actions">
			{#if truncated}
				<span class="trunc-badge" title="Input truncated to {MAX_TOKENS} tokens per side"
					>Truncated</span
				>
			{/if}
			<button class="compare-btn" onclick={compare}>Compare</button>
		</div>
	</header>

	<div class="inputs">
		<textarea
			class="text-input"
			bind:value={leftText}
			placeholder="Original text…"
			spellcheck="false"
		></textarea>
		<div class="input-divider"></div>
		<textarea class="text-input" bind:value={rightText} placeholder="New text…" spellcheck="false"
		></textarea>
	</div>

	{#if compared}
		<div class="output">
			{#if !hasDiff}
				<div class="no-diff">Texts are identical.</div>
			{:else}
				<div class="diff-side left-side">
					<div class="side-label">Original</div>
					<div class="side-content" {@attach attachLeft}>
						{#each leftChunks as chunk, i (i)}{#if chunk.op === 'del'}<mark class="del"
									>{chunk.val}</mark
								>{:else}{chunk.val}{/if}{/each}
					</div>
				</div>
				<div class="side-divider"></div>
				<div class="diff-side right-side">
					<div class="side-label">New</div>
					<div class="side-content" {@attach attachRight}>
						{#each rightChunks as chunk, i (i)}{#if chunk.op === 'ins'}<mark class="ins"
									>{chunk.val}</mark
								>{:else}{chunk.val}{/if}{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
	}

	/* ── Topbar ─────────────────────────────────────────────── */
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.875rem;
		background: var(--bg-2);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.topbar-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-ghost);
	}

	.topbar-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.compare-btn {
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		padding: 0.3rem 0.875rem;
		font-size: 0.8125rem;
		transition: background 0.15s;
	}

	.compare-btn:hover {
		background: var(--accent-muted);
		color: var(--text);
	}

	.trunc-badge {
		font-size: 0.75rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		color: var(--accent);
		border-radius: 4px;
		padding: 0.15rem 0.5rem;
	}

	/* ── Inputs ─────────────────────────────────────────────── */
	.inputs {
		display: flex;
		flex-shrink: 0;
		height: 220px;
		border-bottom: 1px solid var(--border);
	}

	.text-input {
		flex: 1;
		background: var(--surface);
		border: none;
		color: var(--text-2);
		padding: 0.75rem 1rem;
		font-family: 'Courier New', monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		resize: none;
		outline: none;
	}

	.text-input::placeholder {
		color: var(--text-ghost);
	}

	.text-input:focus {
		background: var(--surface-2);
	}

	.input-divider {
		width: 1px;
		background: var(--border);
		flex-shrink: 0;
	}

	/* ── Output ─────────────────────────────────────────────── */
	.output {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.no-diff {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-ghost);
		font-size: 0.875rem;
	}

	.diff-side {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.side-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-ghost);
		padding: 0.4rem 1rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border-2);
		flex-shrink: 0;
	}

	.side-content {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		line-height: 1.7;
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--text-dim);
	}

	.side-divider {
		width: 1px;
		background: var(--border);
		flex-shrink: 0;
	}

	/* ── Diff marks ─────────────────────────────────────────── */
	:global(mark.del) {
		background: #2a0808;
		color: #e8a0a0;
		border-radius: 2px;
	}

	:global(mark.ins) {
		background: #0a1f0a;
		color: #9de8b0;
		border-radius: 2px;
	}
</style>
