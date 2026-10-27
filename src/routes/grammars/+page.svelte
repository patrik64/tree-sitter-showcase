<script lang="ts">
	import { onMount } from 'svelte';
	import { Query, type Parser, type Language, type Node } from 'web-tree-sitter';
	import { createParser, computeHighlights, type HighlightRange } from '$lib/ts/engine';
	import { LANGUAGES, languageById } from '$lib/ts/languages';
	import SourceView from '$lib/components/SourceView.svelte';

	interface RuleEntry {
		name: string;
		line: number;
		/** Rules starting with `_` are hidden: they never appear as nodes in the tree. */
		hidden: boolean;
	}

	interface GrammarView {
		source: string;
		ranges: HighlightRange[];
		rules: RuleEntry[];
		sections: { key: string; count: number }[];
		lineCount: number;
		parseMs: number;
	}

	/** Every `name: $ => …` pair inside the `rules: { … }` object. */
	const RULES_QUERY = `(pair
  key: (property_identifier) @rules.key
  value: (object
    (pair key: (property_identifier) @rule.name) @rule.def)
  (#eq? @rules.key "rules"))`;

	/** Top-level keys of the object passed to grammar({ … }). */
	const CONFIG_QUERY = `(call_expression
  function: (identifier) @fn
  arguments: (arguments
    (object (pair key: (property_identifier) @key value: (_) @value)))
  (#eq? @fn "grammar"))`;

	/** Config sections whose value is `$ => [ … ]`; we show how many entries each has. */
	const SECTION_KEYS = ['extras', 'externals', 'conflicts', 'supertypes', 'inline', 'precedences'];

	let langId = $state('javascript');
	let views = $state.raw<Record<string, GrammarView>>({});
	let error = $state<string | null>(null);
	let filter = $state('');
	let activeLine = $state<number | null>(null);
	let activeRule = $state<string | null>(null);

	// grammar.js is JavaScript, so the demo's own JavaScript grammar parses it.
	let parser: Parser | null = null;
	let language: Language | null = null;
	let disposed = false;

	const config = $derived(languageById(langId));
	const view = $derived(views[langId] ?? null);
	const hiddenCount = $derived(view ? view.rules.filter((r) => r.hidden).length : 0);
	const filteredRules = $derived.by(() => {
		if (!view) return [];
		const q = filter.trim().toLowerCase();
		return q ? view.rules.filter((r) => r.name.toLowerCase().includes(q)) : view.rules;
	});

	function capture(captures: { name: string; node: Node }[], name: string): Node {
		const cap = captures.find((c) => c.name === name);
		if (!cap) throw new Error(`missing capture @${name}`);
		return cap.node;
	}

	function analyze(source: string): GrammarView {
		if (!parser || !language) throw new Error('parser not ready');
		const t0 = performance.now();
		const tree = parser.parse(source);
		if (!tree) throw new Error('parse failed');
		try {
			const ranges = computeHighlights(language, tree, languageById('javascript').highlightQuery);

			const rulesQuery = new Query(language, RULES_QUERY);
			const rules = rulesQuery.matches(tree.rootNode).map((m) => {
				const name = capture(m.captures, 'rule.name').text;
				const def = capture(m.captures, 'rule.def');
				return { name, line: def.startPosition.row, hidden: name.startsWith('_') };
			});
			rulesQuery.delete();

			const configQuery = new Query(language, CONFIG_QUERY);
			const sections: { key: string; count: number }[] = [];
			for (const m of configQuery.matches(tree.rootNode)) {
				const key = capture(m.captures, 'key').text;
				const value = capture(m.captures, 'value');
				if (!SECTION_KEYS.includes(key) || value.type !== 'arrow_function') continue;
				const body = value.childForFieldName('body');
				if (body?.type !== 'array') continue;
				const count = body.namedChildren.filter((c) => c !== null && c.type !== 'comment').length;
				sections.push({ key, count });
			}
			configQuery.delete();
			sections.sort((a, b) => SECTION_KEYS.indexOf(a.key) - SECTION_KEYS.indexOf(b.key));

			return {
				source,
				ranges,
				rules,
				sections,
				lineCount: source.split('\n').length,
				parseMs: performance.now() - t0
			};
		} finally {
			tree.delete();
		}
	}

	async function loadAll() {
		try {
			const handles = await createParser('javascript');
			if (disposed) {
				handles.parser.delete();
				return;
			}
			({ parser, language } = handles);
			await Promise.all(
				LANGUAGES.map(async (lang) => {
					const res = await fetch(`/grammars/${lang.id}/grammar.js`);
					if (!res.ok) throw new Error(`${res.status} ${res.statusText} loading ${lang.id}/grammar.js`);
					const source = await res.text();
					if (disposed) return;
					views = { ...views, [lang.id]: analyze(source) };
				})
			);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	function select(id: string) {
		langId = id;
		filter = '';
		activeLine = null;
		activeRule = null;
	}

	function jump(rule: RuleEntry) {
		activeRule = rule.name;
		activeLine = rule.line;
	}

	onMount(() => {
		loadAll();
		return () => {
			disposed = true;
			parser?.delete();
		};
	});
</script>

<div class="page">
	<div class="toolbar">
		<div class="tabs" role="tablist">
			{#each LANGUAGES as lang}
				<button
					class="tab"
					role="tab"
					class:active={lang.id === langId}
					aria-selected={lang.id === langId}
					onclick={() => select(lang.id)}>{lang.label}</button
				>
			{/each}
		</div>
		{#if view}
			<span class="facts">
				<span class="fact"><strong>{view.lineCount.toLocaleString()}</strong> lines</span>
				<span class="fact">
					<strong>{view.rules.length}</strong> rules <span class="dim">({hiddenCount} hidden)</span>
				</span>
				{#each view.sections as s}
					<span class="fact">{s.key} <strong>{s.count}</strong></span>
				{/each}
				<span class="fact dim">parsed in {view.parseMs.toFixed(1)} ms</span>
			</span>
		{/if}
		<span class="spacer"></span>
		<a
			class="upstream"
			href="https://github.com/tree-sitter/tree-sitter-{langId}/blob/master/grammar.js"
			target="_blank"
			rel="noreferrer">tree-sitter/tree-sitter-{langId} ↗</a
		>
	</div>

	<div class="panes">
		<div class="pane index">
			<div class="pane-title">
				Rules <span class="hint">— click to jump; <code>_names</code> are hidden rules</span>
			</div>
			<input
				class="filter"
				type="search"
				placeholder="filter rules…"
				bind:value={filter}
				spellcheck="false"
				autocomplete="off"
			/>
			<div class="rules">
				{#if error}
					<p class="error">{error}</p>
				{:else if !view}
					<p class="loading">Loading grammar.js…</p>
				{:else if filteredRules.length === 0}
					<p class="loading">No rules match.</p>
				{:else}
					{#each filteredRules as rule}
						<button
							class="rule"
							class:hidden={rule.hidden}
							class:active={rule.name === activeRule}
							onclick={() => jump(rule)}
						>
							<span class="rule-name">{rule.name}</span>
							<span class="rule-line">{rule.line + 1}</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>
		<div class="pane">
			<div class="pane-title">
				grammar.js <span class="hint"
					>— the {config.label} grammar, MIT · highlighted by tree-sitter-javascript, because
					grammar.js is JavaScript</span
				>
			</div>
			{#if view}
				<SourceView source={view.source} ranges={view.ranges} {activeLine} />
			{:else}
				<div class="placeholder">{error ? 'Could not load grammar.js' : 'Loading grammar.js…'}</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 14px 18px;
		box-sizing: border-box;
		gap: 12px;
	}

	.toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px 18px;
		flex: none;
		font-size: 13px;
		color: var(--muted);
	}

	.tabs {
		display: flex;
		gap: 4px;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 3px;
	}

	.tab {
		background: none;
		border: none;
		color: var(--muted);
		font-size: 13px;
		padding: 4px 12px;
		border-radius: 6px;
		cursor: pointer;
	}

	.tab:hover {
		color: var(--fg);
		background: rgba(255, 255, 255, 0.06);
	}

	.tab.active {
		color: var(--fg);
		background: rgba(126, 231, 135, 0.12);
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
	}

	.fact strong {
		color: var(--fg);
		font-family: var(--mono);
		font-weight: 600;
	}

	.dim {
		opacity: 0.75;
	}

	.spacer {
		flex: 1;
	}

	.upstream {
		color: var(--accent-2);
		text-decoration: none;
		font-family: var(--mono);
		font-size: 12px;
	}

	.upstream:hover {
		text-decoration: underline;
	}

	.panes {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		gap: 14px;
		flex: 1;
		min-height: 0;
	}

	.pane {
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
		gap: 6px;
	}

	.pane-title {
		font-size: 13px;
		font-weight: 600;
		flex: none;
	}

	.hint {
		color: var(--muted);
		font-weight: 400;
	}

	.hint code {
		font-family: var(--mono);
		font-size: 0.95em;
	}

	.filter {
		flex: none;
		background: var(--panel-bg);
		color: var(--fg);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 6px 10px;
		font: 13px var(--mono);
		outline: none;
	}

	.filter:focus {
		border-color: var(--accent-2);
	}

	.rules {
		flex: 1;
		min-height: 0;
		overflow: auto;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 4px;
	}

	.rule {
		display: flex;
		align-items: baseline;
		gap: 8px;
		width: 100%;
		background: none;
		border: none;
		border-radius: 4px;
		padding: 2px 8px;
		font: 12.5px/1.6 var(--mono);
		color: var(--accent);
		text-align: left;
		cursor: pointer;
	}

	.rule:hover {
		background: rgba(96, 165, 250, 0.1);
	}

	.rule.active {
		background: rgba(126, 231, 135, 0.18);
	}

	.rule.hidden .rule-name {
		color: var(--muted);
	}

	.rule-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rule-line {
		margin-left: auto;
		flex: none;
		color: var(--muted);
		font-size: 11px;
		opacity: 0.75;
	}

	.loading,
	.error,
	.placeholder {
		color: var(--muted);
		padding: 12px;
		margin: 0;
	}

	.error {
		color: var(--error);
	}

	.placeholder {
		flex: 1;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	@media (max-width: 800px) {
		.panes {
			grid-template-columns: 1fr;
			grid-template-rows: 220px minmax(0, 1fr);
		}
	}
</style>
