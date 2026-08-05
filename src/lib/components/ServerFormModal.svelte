<script lang="ts">
	import { untrack } from 'svelte';
	import DirectoryPickerModal from '$lib/components/DirectoryPickerModal.svelte';
	import { serversApi } from '$lib/servers-api';
	import { describeStartCommand, isValidPort } from '$lib/start-command';
	import type { ManagedServer, ManagedServerDraft, ServerType } from '$lib/types';

	let {
		server = null,
		onSaved,
		onDeleted,
		onClose
	}: {
		server?: ManagedServer | null;
		onSaved: () => void;
		onDeleted: () => void;
		onClose: () => void;
	} = $props();

	const SERVER_TYPE_OPTIONS: { value: ServerType; label: string }[] = [
		{ value: 'python', label: 'Python (uv run start_server)' },
		{ value: 'node', label: 'Svelte / NPM (npm run dev)' }
	];

	const initial = untrack(() => server);

	let alias = $state(initial?.alias ?? '');
	let directory = $state(initial?.directory ?? '');
	let serverType = $state<ServerType>(initial?.serverType ?? 'node');
	let portText = $state(
		initial?.port === null || initial?.port === undefined ? '' : String(initial.port)
	);
	let docker = $state(initial?.docker ?? false);
	let dockerCommand = $state(initial?.dockerCommand ?? '');

	let portSource = $state<string | null>(null);

	let showPicker = $state(false);
	let detecting = $state(false);
	let saving = $state(false);
	let removing = $state(false);
	let errorMessage = $state('');
	let detectionNote = $state('');
	let pressStartedOnBackdrop = false;

	function onBackdropMouseDown(event: MouseEvent) {
		pressStartedOnBackdrop = event.target === event.currentTarget;
	}

	function onBackdropClick(event: MouseEvent) {
		const releasedOnBackdrop = event.target === event.currentTarget;
		const shouldClose = pressStartedOnBackdrop && releasedOnBackdrop;
		pressStartedOnBackdrop = false;
		if (shouldClose) onClose();
	}

	const isEditing = $derived(server !== null);

	const draftPort = $derived.by(() => {
		const trimmed = portText.trim();
		if (trimmed === '') return null;
		const port = Number(trimmed);
		return isValidPort(port) ? port : null;
	});

	const startCommandPreview = $derived(
		draftPort === null ? '' : describeStartCommand(serverType, draftPort)
	);

	async function applyDetection(pickedDirectory: string) {
		detecting = true;
		errorMessage = '';
		detectionNote = '';
		try {
			const detection = await serversApi.detect(pickedDirectory);
			directory = detection.directory;

			if (!detection.exists) {
				detectionNote = 'That directory does not exist.';
				portSource = null;
				return;
			}

			if (!alias || !isEditing) alias = detection.alias;
			if (detection.serverType && !isEditing) serverType = detection.serverType;
			if (detection.docker) {
				docker = true;
				if (!dockerCommand) dockerCommand = detection.dockerCommand;
			}

			portSource = detection.portSource;
			if (detection.port !== null && (!portText.trim() || !isEditing)) {
				portText = String(detection.port);
			}

			detectionNote = detection.markers.length
				? `Detected: ${detection.markers.join(', ')}`
				: 'No pyproject.toml or package.json found — pick the type manually.';
		} catch (caught) {
			errorMessage = caught instanceof Error ? caught.message : String(caught);
		} finally {
			detecting = false;
		}
	}

	function buildDraft(port: number): ManagedServerDraft {
		return {
			alias: alias.trim(),
			directory: directory.trim(),
			serverType,
			port,
			docker,
			dockerCommand: dockerCommand.trim()
		};
	}

	async function save() {
		if (!directory.trim()) {
			errorMessage = 'Pick a project directory before saving.';
			return;
		}
		if (draftPort === null) {
			errorMessage =
				portText.trim() === ''
					? 'Set the port this server listens on.'
					: `"${portText.trim()}" is not a valid port — use a whole number between 1 and 65535.`;
			return;
		}
		saving = true;
		errorMessage = '';
		try {
			const draft = buildDraft(draftPort);
			if (server) await serversApi.update(server.id, draft);
			else await serversApi.create(draft);
			onSaved();
		} catch (caught) {
			errorMessage = caught instanceof Error ? caught.message : String(caught);
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!server) return;

		const confirmed = confirm(
			`Stop "${server.alias}" and remove it from the launcher?\n\n` +
				`Its server process${server.docker ? ' and Docker resources' : ''} will be shut down first.`
		);
		if (!confirmed) return;

		removing = true;
		errorMessage = '';
		try {
			await serversApi.remove(server.id);
			onDeleted();
		} catch (caught) {
			errorMessage = caught instanceof Error ? caught.message : String(caught);
		} finally {
			removing = false;
		}
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && !showPicker && onClose()} />

<div
	class="overlay"
	role="presentation"
	onmousedown={onBackdropMouseDown}
	onclick={onBackdropClick}
>
	<div
		class="modal"
		role="dialog"
		aria-modal="true"
		aria-label={isEditing ? 'Edit server' : 'Add server'}
	>
		<header class="modal-head">
			<h2 class="modal-title">{isEditing ? 'Edit server' : 'Add server'}</h2>
			<button class="close-btn" aria-label="Close" onclick={onClose}>✕</button>
		</header>

		<div class="form">
			<div class="field">
				<label class="field-label" for="server-directory">Directory</label>
				<div class="dir-row">
					<input
						id="server-directory"
						class="input mono"
						bind:value={directory}
						placeholder="C:\Users\you\projects\my-app"
						spellcheck="false"
						onblur={() => directory.trim() && applyDetection(directory)}
					/>
					<button class="browse-btn" onclick={() => (showPicker = true)}>Browse…</button>
				</div>
				{#if detecting}
					<span class="hint">Inspecting directory…</span>
				{:else if detectionNote}
					<span class="hint">{detectionNote}</span>
				{/if}
			</div>

			<div class="field">
				<label class="field-label" for="server-alias">Alias</label>
				<input
					id="server-alias"
					class="input"
					bind:value={alias}
					placeholder="Derived from the folder name"
				/>
			</div>

			<div class="field">
				<label class="field-label" for="server-type">Server type</label>
				<select id="server-type" class="input" bind:value={serverType}>
					{#each SERVER_TYPE_OPTIONS as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label class="field-label" for="server-port">Port</label>
				<input
					id="server-port"
					class="input mono"
					bind:value={portText}
					inputmode="numeric"
					placeholder="7010"
					spellcheck="false"
					required
				/>
				{#if portSource}
					<span class="hint found">Found in {portSource}.</span>
				{/if}
			</div>

			<div class="field">
				<span class="field-label">Start command</span>
				<code class="command-preview">{startCommandPreview}</code>
			</div>

			<label class="field checkbox-field">
				<input type="checkbox" bind:checked={docker} />
				<span class="field-label inline">Docker resources</span>
			</label>

			{#if docker}
				<div class="field">
					<label class="field-label" for="server-docker-command">Docker command</label>
					<input
						id="server-docker-command"
						class="input mono"
						bind:value={dockerCommand}
						placeholder="docker compose up -d"
						spellcheck="false"
					/>
					<span class="hint">Stopping runs the matching <code>down</code> command.</span>
				</div>
			{/if}

			{#if errorMessage}
				<p class="error">{errorMessage}</p>
			{/if}
		</div>

		<footer class="modal-foot">
			{#if isEditing}
				<button class="remove-btn" onclick={remove} disabled={saving || removing}>
					{removing ? 'Stopping & removing…' : 'Remove server'}
				</button>
			{/if}
			<button class="cancel-btn" onclick={onClose}>Cancel</button>
			<button
				class="save-btn"
				onclick={save}
				disabled={saving || removing || !directory.trim() || draftPort === null}
			>
				{saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add server'}
			</button>
		</footer>
	</div>
</div>

{#if showPicker}
	<DirectoryPickerModal
		initialPath={directory.trim() || null}
		onPick={(picked) => {
			showPicker = false;
			void applyDetection(picked);
		}}
		onClose={() => (showPicker = false)}
	/>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.modal {
		width: 100%;
		max-width: 520px;
		max-height: 88vh;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}

	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.modal-title {
		font-size: 0.9rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.close-btn {
		color: var(--text-ghost);
		font-size: 0.85rem;
		padding: 0.25rem 0.4rem;
		border-radius: 4px;
	}

	.close-btn:hover {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.form {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.checkbox-field {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}

	.field-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-ghost);
	}

	.field-label.inline {
		text-transform: none;
		letter-spacing: 0;
		font-size: 0.8125rem;
		color: var(--text-2);
	}

	.input {
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		font-size: 0.8125rem;
		padding: 0.4rem 0.5rem;
		outline: none;
	}

	.input:focus {
		border-color: var(--accent-muted);
	}

	.mono {
		font-family: monospace;
	}

	.dir-row {
		display: flex;
		gap: 0.375rem;
	}

	.browse-btn {
		flex-shrink: 0;
		padding: 0 0.75rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.browse-btn:hover {
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.hint {
		font-size: 0.7rem;
		color: var(--text-ghost);
	}

	.hint.found {
		color: #86efac;
	}

	.command-preview {
		display: block;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg-2);
		color: var(--text-2);
		font-family: monospace;
		font-size: 0.75rem;
		word-break: break-all;
	}

	code {
		font-family: monospace;
		color: var(--text-dim);
	}

	.error {
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--accent-muted);
		border-radius: 6px;
		background: var(--accent-bg);
		color: var(--accent);
		font-size: 0.75rem;
		font-family: monospace;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 180px;
		overflow-y: auto;
	}

	.modal-foot {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border);
	}

	.remove-btn {
		margin-right: auto;
		padding: 0.35rem 0.75rem;
		background: transparent;
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		font-size: 0.8125rem;
	}

	.remove-btn:hover:not(:disabled) {
		background: var(--accent-bg);
	}

	.remove-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.cancel-btn {
		padding: 0.35rem 0.75rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-muted);
		font-size: 0.8125rem;
	}

	.cancel-btn:hover {
		color: var(--text-2);
	}

	.save-btn {
		padding: 0.35rem 0.9rem;
		background: var(--accent-bg);
		border: 1px solid var(--accent-muted);
		border-radius: 5px;
		color: var(--accent);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.save-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
