<script lang="ts">
	import type { BookmarkDraft } from '$lib/types';
	import { BOOKMARK_DESCRIPTION_MAX } from '$lib/constants';

	let {
		draft = $bindable(),
		variant = 'edit',
		onSave,
		onCancel
	}: {
		draft: BookmarkDraft;
		variant?: 'edit' | 'add';
		onSave: () => void;
		onCancel: () => void;
	} = $props();
</script>

<div class="bookmark-edit" class:adding={variant === 'add'}>
	<div class="edit-row">
		<input
			class="edit-input"
			bind:value={draft.name}
			placeholder="Name"
			onkeydown={(e) => {
				if (e.key === 'Escape') onCancel();
			}}
		/>
		<input
			class="edit-input url"
			bind:value={draft.url}
			placeholder="URL"
			onkeydown={(e) => {
				if (e.key === 'Enter') onSave();
				if (e.key === 'Escape') onCancel();
			}}
		/>
		<button class="icon-btn" onclick={onSave} aria-label="Save">✓</button>
		<button class="icon-btn" onclick={onCancel} aria-label="Cancel">✗</button>
	</div>
	<textarea
		class="edit-desc"
		bind:value={draft.description}
		maxlength={BOOKMARK_DESCRIPTION_MAX}
		placeholder="Description (optional, max {BOOKMARK_DESCRIPTION_MAX} chars)"
	></textarea>
</div>

<style>
	.bookmark-edit {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border-2);
	}
	.bookmark-edit.adding {
		background: var(--bg-2);
	}
	.edit-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.edit-input {
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		padding: 0.375rem 0.625rem;
		outline: none;
		font-size: 0.8125rem;
		transition: border-color 0.15s;
		min-width: 0;
		flex: 1;
	}
	.edit-input.url {
		flex: 2;
	}
	.edit-input:focus {
		border-color: var(--accent);
	}
	.edit-desc {
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text-2);
		padding: 0.375rem 0.625rem;
		outline: none;
		font-size: 0.8125rem;
		line-height: 1.5;
		resize: none;
		height: 60px;
		transition: border-color 0.15s;
		width: 100%;
	}
	.edit-desc:focus {
		border-color: var(--accent);
	}
	.edit-desc::placeholder {
		color: var(--text-ghost);
	}
	.icon-btn {
		background: none;
		border: none;
		color: var(--text-dim);
		font-size: 0.875rem;
		padding: 0.2rem 0.3rem;
		border-radius: 3px;
		line-height: 1;
		flex-shrink: 0;
		transition:
			color 0.1s,
			background 0.1s;
	}
	.icon-btn:hover {
		color: var(--text-2);
		background: var(--surface-2);
	}
</style>
