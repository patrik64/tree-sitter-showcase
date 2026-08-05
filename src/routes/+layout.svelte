<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const links = [
		{ href: '/', label: 'Intro' },
		{ href: '/playground', label: 'Playground' },
		{ href: '/queries', label: 'Queries' },
		{ href: '/incremental', label: 'Incremental' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>tree-sitter demo</title>
</svelte:head>

<div class="app">
	<header>
		<a class="brand" href="/">🌳 tree-sitter</a>
		<nav>
			{#each links as link}
				<a href={link.href} class:active={page.url.pathname === link.href}>{link.label}</a>
			{/each}
		</nav>
	</header>
	<main>
		{@render children()}
	</main>
</div>

<style>
	:global(:root) {
		--bg: #0d1117;
		--panel-bg: #161b22;
		--border: #30363d;
		--fg: #e6edf3;
		--muted: #8b949e;
		--accent: #7ee787;
		--accent-2: #79c0ff;
		--error: #ff7b72;
		--mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', Menlo, Consolas, monospace;
		--sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
	}

	:global(html, body) {
		margin: 0;
		height: 100%;
	}

	:global(body) {
		background: var(--bg);
		color: var(--fg);
		font-family: var(--sans);
	}

	/* Syntax token colors (GitHub-dark inspired) */
	:global(.tok-keyword) {
		color: #ff7b72;
	}
	:global(.tok-string) {
		color: #a5d6ff;
	}
	:global(.tok-comment) {
		color: #8b949e;
		font-style: italic;
	}
	:global(.tok-function) {
		color: #d2a8ff;
	}
	:global(.tok-number) {
		color: #79c0ff;
	}
	:global(.tok-constant) {
		color: #79c0ff;
	}
	:global(.tok-type) {
		color: #ffa657;
	}
	:global(.tok-property) {
		color: #7ee787;
	}
	:global(.tok-variable) {
		color: #e6edf3;
	}
	:global(.tok-label) {
		color: #ffa657;
	}
	:global(.tok-error) {
		text-decoration: underline wavy #ff7b72 1.5px;
		text-underline-offset: 3px;
	}
	:global(.hl-node) {
		background: rgba(126, 231, 135, 0.18);
		border-radius: 2px;
	}
	:global(.hl-selected) {
		background: rgba(96, 165, 250, 0.25);
		border-radius: 2px;
	}
	:global(.hl-changed) {
		background: rgba(255, 166, 87, 0.25);
		border-radius: 2px;
	}

	/* Capture colors for the query playground */
	:global(.cap-0) { background: rgba(126, 231, 135, 0.28); outline: 1px solid rgba(126, 231, 135, 0.5); }
	:global(.cap-1) { background: rgba(121, 192, 255, 0.28); outline: 1px solid rgba(121, 192, 255, 0.5); }
	:global(.cap-2) { background: rgba(255, 166, 87, 0.28); outline: 1px solid rgba(255, 166, 87, 0.5); }
	:global(.cap-3) { background: rgba(210, 168, 255, 0.3); outline: 1px solid rgba(210, 168, 255, 0.5); }
	:global(.cap-4) { background: rgba(255, 123, 114, 0.28); outline: 1px solid rgba(255, 123, 114, 0.5); }
	:global(.cap-5) { background: rgba(165, 214, 255, 0.3); outline: 1px solid rgba(165, 214, 255, 0.5); }
	:global(.cap-6) { background: rgba(255, 223, 93, 0.25); outline: 1px solid rgba(255, 223, 93, 0.5); }
	:global(.cap-7) { background: rgba(255, 157, 220, 0.28); outline: 1px solid rgba(255, 157, 220, 0.5); }

	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	header {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 10px 20px;
		border-bottom: 1px solid var(--border);
		background: var(--panel-bg);
		flex: none;
	}

	.brand {
		font-family: var(--mono);
		font-weight: 700;
		font-size: 15px;
		color: var(--accent);
		text-decoration: none;
	}

	nav {
		display: flex;
		gap: 4px;
	}

	nav a {
		color: var(--muted);
		text-decoration: none;
		font-size: 14px;
		padding: 5px 12px;
		border-radius: 6px;
	}

	nav a:hover {
		color: var(--fg);
		background: rgba(255, 255, 255, 0.06);
	}

	nav a.active {
		color: var(--fg);
		background: rgba(126, 231, 135, 0.12);
	}

	main {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
</style>
