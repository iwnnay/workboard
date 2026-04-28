<script lang="ts">
	import { page } from '$app/state';

	let open = $state(false);

	const navItems = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/bookmarks', label: 'Bookmarks' }
	];

	function close() {
		open = false;
	}
</script>

{#if open}
	<div
		class="backdrop"
		role="presentation"
		tabindex="-1"
		onclick={close}
		onkeydown={(e) => e.key === 'Escape' && close()}
	></div>
{/if}

<div class="nav-container">
	{#if open}
		<nav class="nav-menu" aria-label="Main navigation">
			{#each navItems as item (item.href)}
				<a
					href={item.href}
					class="nav-item"
					class:active={page.url.pathname === item.href}
					onclick={close}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	{/if}

	<button
		class="nav-toggle"
		class:is-open={open}
		onclick={() => (open = !open)}
		aria-label="Toggle navigation"
		aria-expanded={open}
	>
		<span class="bar"></span>
		<span class="bar"></span>
		<span class="bar"></span>
	</button>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
	}

	.nav-container {
		position: fixed;
		bottom: 1.25rem;
		left: 1.25rem;
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.nav-menu {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.375rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 150px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
	}

	.nav-item {
		display: block;
		padding: 0.5rem 0.875rem;
		border-radius: 5px;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.875rem;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.nav-item:hover {
		background: var(--accent-bg);
		color: var(--text-2);
	}

	.nav-item.active {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.nav-toggle {
		width: 34px;
		height: 34px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 7px 8px;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.nav-toggle:hover,
	.nav-toggle.is-open {
		background: var(--accent-bg);
		border-color: var(--accent-muted);
	}

	.bar {
		display: block;
		width: 100%;
		height: 1.5px;
		background: var(--text-dim);
		border-radius: 2px;
		transition: background 0.15s;
	}

	.nav-toggle:hover .bar,
	.nav-toggle.is-open .bar {
		background: var(--accent);
	}
</style>
