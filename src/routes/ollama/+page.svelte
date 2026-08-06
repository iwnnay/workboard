<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import OllamaPullModal from '$lib/components/OllamaPullModal.svelte';
	import OllamaLogsModal from '$lib/components/OllamaLogsModal.svelte';
	import { pullQueue } from '$lib/ollama-pull.svelte';
	import type { OllamaInfo, OllamaModel, OllamaModelShow } from '../api/ollama/+server';

	let host = $state('http://127.0.0.1:11434');
	let info = $state<OllamaInfo | null>(null);
	let loading = $state(false);
	let selected = $state<string | null>(null);
	let showPull = $state(false);
	let showLogs = $state(false);
	let search = $state('');
	let activeCaps = new SvelteSet<string>();

	async function load() {
		loading = true;
		try {
			const res = await fetch(`/api/ollama?host=${encodeURIComponent(host)}`);
			info = res.ok ? await res.json() : null;
			if (info && info.models.length > 0 && !info.models.some((m) => m.name === selected)) {
				selected = info.models[0].name;
			}
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void load();
	});

	// Refresh the model list whenever a queued pull finishes.
	pullQueue.onComplete = load;

	function formatSize(bytes: number | undefined): string {
		if (!bytes) {
			return '—';
		}
		if (bytes < 1024) {
			return `${bytes} B`;
		}
		if (bytes < 1048576) {
			return `${(bytes / 1024).toFixed(1)} KB`;
		}
		if (bytes < 1073741824) {
			return `${(bytes / 1048576).toFixed(1)} MB`;
		}
		return `${(bytes / 1073741824).toFixed(2)} GB`;
	}

	function formatDate(s: string | undefined): string {
		if (!s) {
			return '—';
		}
		const d = new Date(s);
		if (isNaN(d.getTime())) {
			return s;
		}
		return d.toLocaleString();
	}

	function shortDigest(d: string | undefined): string {
		if (!d) {
			return '—';
		}
		return d.replace(/^sha256:/, '').slice(0, 12);
	}

	function runningFor(name: string): OllamaModel | undefined {
		return info?.running.find((m) => m.name === name);
	}

	function capsFor(name: string): string[] {
		return info?.details[name]?.capabilities ?? [];
	}

	function toggleCap(cap: string) {
		if (activeCaps.has(cap)) {
			activeCaps.delete(cap);
		} else {
			activeCaps.add(cap);
		}
	}

	// Every capability seen across the installed models, for the filter chips.
	let allCapabilities = $derived.by(() => {
		const set = new Set<string>();
		for (const m of info?.models ?? []) {
			for (const c of capsFor(m.name)) {
				set.add(c);
			}
		}
		return [...set].sort();
	});

	// Models matching the text search and (if any) every selected capability.
	let filteredModels = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const caps = [...activeCaps];
		return (info?.models ?? []).filter((m) => {
			if (q && !m.name.toLowerCase().includes(q)) {
				return false;
			}
			if (caps.length > 0) {
				const mc = capsFor(m.name);
				if (!caps.every((c) => mc.includes(c))) {
					return false;
				}
			}
			return true;
		});
	});

	let selectedModel = $derived(info?.models.find((m) => m.name === selected) ?? null);
	let selectedShow = $derived<OllamaModelShow | null>(
		selected && info ? (info.details[selected] ?? null) : null
	);
	let modelInfoEntries = $derived<[string, unknown][]>(
		selectedShow?.model_info ? Object.entries(selectedShow.model_info) : []
	);
</script>

<div class="ollama-page">
	<header class="topbar">
		<span class="page-title">Ollama</span>
		<input
			class="host-input"
			bind:value={host}
			placeholder="http://127.0.0.1:11434"
			onkeydown={(e) => e.key === 'Enter' && load()}
		/>
		<button class="refresh-btn" onclick={() => load()} disabled={loading}>
			{loading ? 'Loading…' : 'Refresh'}
		</button>
		<button class="logs-btn" onclick={() => (showLogs = true)}>≡ Logs</button>
		{#if info?.reachable}
			<button class="pull-btn" onclick={() => (showPull = true)}>
				↓ Pull model{#if pullQueue.activeCount > 0}<span class="pull-badge"
						>{pullQueue.activeCount}</span
					>{/if}
			</button>
		{/if}
		{#if info}
			<span class="status" class:ok={info.reachable} class:bad={!info.reachable}>
				<span class="dot"></span>
				{info.reachable ? 'connected' : 'offline'}
			</span>
		{/if}
	</header>

	<div class="body">
		{#if loading && !info}
			<div class="full-msg">Reaching out to Ollama…</div>
		{:else if !info || !info.reachable}
			<div class="full-msg error">
				<p>Could not reach Ollama at <code>{host}</code>.</p>
				{#if info?.error}<p class="error-detail">{info.error}</p>{/if}
				<p class="hint">Make sure <code>ollama serve</code> is running and the host is correct.</p>
			</div>
		{:else}
			<!-- Model list -->
			<aside class="list-panel">
				<div class="list-controls">
					<input
						class="search-input"
						bind:value={search}
						placeholder="Filter models…"
						spellcheck="false"
					/>
					{#if allCapabilities.length > 0}
						<div class="cap-filters">
							{#each allCapabilities as cap (cap)}
								<button
									class="cap-chip"
									class:active={activeCaps.has(cap)}
									onclick={() => toggleCap(cap)}
								>
									{cap}
								</button>
							{/each}
							{#if activeCaps.size > 0}
								<button class="cap-clear" onclick={() => activeCaps.clear()}>clear</button>
							{/if}
						</div>
					{/if}
				</div>
				<div class="list-section-label">
					Models <span class="count">{filteredModels.length} / {info.models.length}</span>
				</div>
				{#if info.models.length === 0}
					<div class="list-empty">No models installed.</div>
				{:else if filteredModels.length === 0}
					<div class="list-empty">No models match the filters.</div>
				{:else}
					{#each filteredModels as m (m.name)}
						<button
							class="model-btn"
							class:selected={selected === m.name}
							onclick={() => (selected = m.name)}
						>
							<span class="model-name">{m.name}</span>
							<span class="model-meta">
								{#if runningFor(m.name)}<span class="run-dot" title="Running"></span>{/if}
								<span class="model-size">{formatSize(m.size)}</span>
							</span>
						</button>
					{/each}
				{/if}
			</aside>

			<!-- Detail -->
			<main class="detail-panel">
				<!-- Server overview -->
				<section class="card">
					<h3 class="card-title">Server</h3>
					<div class="kv-grid">
						<div class="kv"><span class="k">Host</span><span class="v mono">{info.host}</span></div>
						<div class="kv">
							<span class="k">Version</span><span class="v mono"
								>{info.version?.version ?? '—'}</span
							>
						</div>
						<div class="kv">
							<span class="k">Models installed</span><span class="v">{info.models.length}</span>
						</div>
						<div class="kv">
							<span class="k">Models running</span><span class="v">{info.running.length}</span>
						</div>
					</div>
				</section>

				{#if info.running.length > 0}
					<section class="card">
						<h3 class="card-title">Running now</h3>
						{#each info.running as r (r.name)}
							<div class="running-row">
								<span class="mono running-name">{r.name}</span>
								<span class="pill">VRAM {formatSize(r.size_vram)}</span>
								<span class="pill">expires {formatDate(r.expires_at)}</span>
							</div>
						{/each}
					</section>
				{/if}

				{#if selectedModel}
					<section class="card">
						<div class="card-head">
							<h3 class="card-title">{selectedModel.name}</h3>
							{#if runningFor(selectedModel.name)}<span class="badge-running">running</span>{/if}
						</div>
						<div class="kv-grid">
							<div class="kv">
								<span class="k">Size</span><span class="v">{formatSize(selectedModel.size)}</span>
							</div>
							<div class="kv">
								<span class="k">Modified</span><span class="v"
									>{formatDate(selectedModel.modified_at)}</span
								>
							</div>
							<div class="kv">
								<span class="k">Digest</span><span class="v mono"
									>{shortDigest(selectedModel.digest)}</span
								>
							</div>
							{#if selectedModel.details?.family}
								<div class="kv">
									<span class="k">Family</span><span class="v">{selectedModel.details.family}</span>
								</div>
							{/if}
							{#if selectedModel.details?.parameter_size}
								<div class="kv">
									<span class="k">Parameters</span><span class="v"
										>{selectedModel.details.parameter_size}</span
									>
								</div>
							{/if}
							{#if selectedModel.details?.quantization_level}
								<div class="kv">
									<span class="k">Quantization</span><span class="v"
										>{selectedModel.details.quantization_level}</span
									>
								</div>
							{/if}
							{#if selectedModel.details?.format}
								<div class="kv">
									<span class="k">Format</span><span class="v">{selectedModel.details.format}</span>
								</div>
							{/if}
						</div>
					</section>

					{#if selectedShow?.error}
						<section class="card">
							<div class="show-error">Could not load details: {selectedShow.error}</div>
						</section>
					{:else if selectedShow}
						{#if selectedShow.capabilities && selectedShow.capabilities.length > 0}
							<section class="card">
								<h3 class="card-title">Capabilities</h3>
								<div class="tag-row">
									{#each selectedShow.capabilities as cap (cap)}
										<span class="tag">{cap}</span>
									{/each}
								</div>
							</section>
						{/if}

						{#if modelInfoEntries.length > 0}
							<section class="card">
								<h3 class="card-title">Model info</h3>
								<div class="info-table">
									{#each modelInfoEntries as [key, value] (key)}
										<div class="info-row">
											<span class="info-key mono">{key}</span>
											<span class="info-val mono">
												{Array.isArray(value) ? `[${value.length} items]` : String(value)}
											</span>
										</div>
									{/each}
								</div>
							</section>
						{/if}

						{#if selectedShow.parameters}
							<section class="card">
								<h3 class="card-title">Parameters</h3>
								<pre class="code-block">{selectedShow.parameters}</pre>
							</section>
						{/if}

						{#if selectedShow.template}
							<section class="card">
								<h3 class="card-title">Template</h3>
								<pre class="code-block">{selectedShow.template}</pre>
							</section>
						{/if}

						{#if selectedShow.modelfile}
							<section class="card">
								<h3 class="card-title">Modelfile</h3>
								<pre class="code-block">{selectedShow.modelfile}</pre>
							</section>
						{/if}

						{#if selectedShow.license}
							<section class="card">
								<h3 class="card-title">License</h3>
								<pre class="code-block license">{selectedShow.license}</pre>
							</section>
						{/if}
					{/if}
				{/if}
			</main>
		{/if}
	</div>
</div>

{#if showPull}
	<OllamaPullModal {host} onClose={() => (showPull = false)} />
{/if}

{#if showLogs}
	<OllamaLogsModal onClose={() => (showLogs = false)} />
{/if}

<style>
	.ollama-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
		background: var(--bg);
		color: var(--text);
	}

	.topbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
		flex-shrink: 0;
		min-height: 48px;
	}

	.page-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-muted);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.host-input {
		flex: 1;
		max-width: 320px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		font-size: 0.8125rem;
		font-family: monospace;
		padding: 0.3rem 0.5rem;
		outline: none;
	}

	.host-input:focus {
		border-color: var(--accent-muted);
	}

	.refresh-btn {
		padding: 0.3rem 0.75rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		font-size: 0.8125rem;
		transition: opacity 0.1s;
	}

	.refresh-btn:hover:not(:disabled) {
		opacity: 0.85;
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.pull-btn,
	.logs-btn {
		padding: 0.3rem 0.75rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-2);
		font-size: 0.8125rem;
		transition:
			border-color 0.15s,
			background 0.15s;
	}

	.pull-btn:hover,
	.logs-btn:hover {
		border-color: var(--accent-muted);
		background: var(--accent-bg);
		color: var(--accent);
	}

	.pull-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.05rem;
		height: 1.05rem;
		margin-left: 0.4rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--bg);
		font-size: 0.7rem;
		font-weight: 700;
		line-height: 1;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}

	.status.ok {
		color: #86efac;
	}
	.status.ok .dot {
		background: #86efac;
	}

	.status.bad {
		color: var(--text-dim);
	}
	.status.bad .dot {
		background: var(--text-dim);
	}

	.body {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.full-msg {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		color: var(--text-dim);
		font-size: 0.875rem;
		text-align: center;
		padding: 2rem;
	}

	.full-msg code {
		font-family: monospace;
		color: var(--text-2);
	}

	.full-msg.error .error-detail {
		color: var(--accent);
		font-family: monospace;
		font-size: 0.8125rem;
	}

	.full-msg .hint {
		color: var(--text-ghost);
		font-size: 0.8125rem;
	}

	/* Model list */
	.list-panel {
		width: 260px;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
		background: var(--surface);
		overflow-y: auto;
		padding: 0.5rem 0;
	}

	.list-controls {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.search-input {
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		font-size: 0.8125rem;
		padding: 0.3rem 0.5rem;
		outline: none;
	}

	.search-input:focus {
		border-color: var(--accent-muted);
	}

	.cap-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: center;
	}

	.cap-chip {
		font-size: 0.7rem;
		font-family: monospace;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-dim);
		transition:
			border-color 0.1s,
			color 0.1s,
			background 0.1s;
	}

	.cap-chip:hover {
		color: var(--text-2);
		border-color: var(--accent-muted);
	}

	.cap-chip.active {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.cap-clear {
		font-size: 0.7rem;
		color: var(--text-ghost);
		padding: 0.1rem 0.3rem;
		text-decoration: underline;
	}

	.cap-clear:hover {
		color: var(--text-2);
	}

	.list-section-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.875rem;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-ghost);
	}

	.count {
		color: var(--text-dim);
		background: var(--surface-2);
		border-radius: 8px;
		padding: 0 0.4rem;
		font-size: 0.7rem;
	}

	.list-empty {
		padding: 1rem 0.875rem;
		color: var(--text-dim);
		font-size: 0.8125rem;
	}

	.model-btn {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		padding: 0.4rem 0.875rem;
		color: var(--text-dim);
		text-align: left;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.model-btn:hover {
		background: var(--accent-bg);
		color: var(--text-2);
	}

	.model-btn.selected {
		background: var(--accent-bg);
		color: var(--text);
	}

	.model-name {
		font-family: monospace;
		font-size: 0.8125rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.model-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	.model-size {
		font-size: 0.7rem;
		color: var(--text-ghost);
	}

	.run-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #86efac;
	}

	/* Detail panel */
	.detail-panel {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1rem;
	}

	.card-head {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin-bottom: 0.75rem;
	}

	.card-head .card-title {
		margin-bottom: 0;
	}

	.card-title {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
		font-family: monospace;
	}

	.badge-running {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #86efac;
		border: 1px solid #2f6f4a;
		background: #0e2417;
		border-radius: 4px;
		padding: 0.1rem 0.4rem;
	}

	.kv-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.5rem 1.25rem;
	}

	.kv {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.k {
		font-size: 0.7rem;
		color: var(--text-ghost);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.v {
		font-size: 0.875rem;
		color: var(--text-2);
	}

	.mono {
		font-family: monospace;
		word-break: break-all;
	}

	.running-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding: 0.3rem 0;
	}

	.running-name {
		font-size: 0.8125rem;
		color: var(--text);
	}

	.pill {
		font-size: 0.7rem;
		color: var(--text-dim);
		padding: 0.1rem 0.45rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
	}

	.tag-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.tag {
		font-size: 0.75rem;
		font-family: monospace;
		color: var(--accent);
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 4px;
		padding: 0.15rem 0.5rem;
	}

	.info-table {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.25rem 0.5rem;
		background: var(--surface-2);
		border-radius: 3px;
		font-size: 0.75rem;
	}

	.info-key {
		color: var(--text-muted);
	}

	.info-val {
		color: var(--text-2);
		text-align: right;
		word-break: break-all;
	}

	.code-block {
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 0.75rem;
		font-family: 'Consolas', 'Fira Code', monospace;
		font-size: 0.775rem;
		line-height: 1.5;
		color: var(--text-2);
		white-space: pre-wrap;
		word-break: break-word;
		overflow-x: auto;
		max-height: 360px;
		overflow-y: auto;
	}

	.code-block.license {
		max-height: 200px;
		color: var(--text-dim);
	}

	.show-error {
		color: var(--accent);
		font-size: 0.8125rem;
		font-family: monospace;
	}
</style>
