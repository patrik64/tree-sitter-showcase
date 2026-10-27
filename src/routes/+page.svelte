<div class="intro">
	<h1>🌳 tree-sitter</h1>
	<p class="tagline">An incremental parsing system for programming tools</p>

	<div class="cards">
		<a class="card" href="/playground">
			<h2>Playground</h2>
			<p>
				Type code, watch the concrete syntax tree update live. Hover tree nodes to see the source
				they span — and break the code to see <strong>error recovery</strong> keep the rest of the
				tree intact.
			</p>
		</a>
		<a class="card" href="/queries">
			<h2>Queries</h2>
			<p>
				Tree-sitter's S-expression <strong>query language</strong> pattern-matches the syntax tree —
				it's how editors do syntax highlighting, code navigation, and structural search.
			</p>
		</a>
		<a class="card" href="/incremental">
			<h2>Incremental parsing</h2>
			<p>
				The headline feature: after an edit, tree-sitter reuses the old tree and only re-parses
				what changed. Watch it beat a full re-parse on every keystroke, live.
			</p>
		</a>
		<a class="card" href="/grammars">
			<h2>Grammars</h2>
			<p>
				Read the real <strong>grammar.js</strong> behind each of the four languages — the JavaScript
				DSL that tree-sitter compiles into a parser — with a clickable index of every rule.
			</p>
		</a>
	</div>

	<section>
		<h2>What is it?</h2>
		<ul>
			<li>
				A parser generator and incremental parsing library, written in <strong>Rust and C</strong>,
				created at GitHub. It powers syntax highlighting and code navigation in Neovim, Zed, Helix,
				Emacs, GitHub.com, and more.
			</li>
			<li>
				<strong>General</strong> — one API for every language; grammars exist for hundreds of languages.
			</li>
			<li>
				<strong>Fast</strong> — designed to parse on every keystroke in a text editor, using GLR
				parsing with incremental tree reuse.
			</li>
			<li>
				<strong>Robust</strong> — recovers from syntax errors, producing a useful tree even for
				code that's mid-edit.
			</li>
			<li>
				<strong>Dependency-free</strong> — the runtime is pure C11, so it embeds anywhere: native
				apps, editors… or compiled to <strong>WebAssembly</strong>, which is exactly what this site
				does.
			</li>
		</ul>
	</section>

	<section>
		<h2>How this demo works</h2>
		<p>
			Everything runs <strong>in your browser</strong> — there is no server-side parsing. The
			tree-sitter runtime and each grammar (JavaScript, Rust, Python, JSON) are compiled to
			WebAssembly and loaded via the <code>web-tree-sitter</code> bindings inside this SvelteKit app.
			Open the network tab: you'll see <code>.wasm</code> files load, then everything is local.
		</p>
	</section>

	<section class="links">
		<h2>Links</h2>
		<p>
			<a href="https://tree-sitter.github.io/tree-sitter/" target="_blank" rel="noreferrer"
				>Documentation</a
			>
			·
			<a href="https://github.com/tree-sitter/tree-sitter" target="_blank" rel="noreferrer"
				>GitHub</a
			>
			·
			<a
				href="https://tree-sitter.github.io/tree-sitter/7-playground.html"
				target="_blank"
				rel="noreferrer">Official playground</a
			>
		</p>
	</section>
</div>

<style>
	.intro {
		max-width: 860px;
		margin: 0 auto;
		padding: 40px 24px 80px;
	}

	h1 {
		font-family: var(--mono);
		font-size: 44px;
		margin: 0 0 4px;
		color: var(--accent);
	}

	.tagline {
		font-size: 19px;
		color: var(--muted);
		margin: 0 0 36px;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 16px;
		margin-bottom: 40px;
	}

	.card {
		display: block;
		padding: 18px 20px;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 10px;
		text-decoration: none;
		color: var(--fg);
		transition: border-color 0.15s;
	}

	.card:hover {
		border-color: var(--accent);
	}

	.card h2 {
		margin: 0 0 8px;
		font-size: 17px;
		color: var(--accent);
	}

	.card p {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--muted);
	}

	.card strong {
		color: var(--fg);
		font-weight: 600;
	}

	section {
		margin-bottom: 32px;
	}

	section h2 {
		font-size: 20px;
		margin: 0 0 12px;
	}

	section p,
	section li {
		font-size: 15px;
		line-height: 1.65;
		color: #c9d1d9;
	}

	li {
		margin-bottom: 8px;
	}

	code {
		font-family: var(--mono);
		font-size: 0.9em;
		background: rgba(255, 255, 255, 0.08);
		padding: 1px 5px;
		border-radius: 4px;
	}

	.links a {
		color: var(--accent-2);
	}
</style>
