<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Parser, Language, Tree } from 'web-tree-sitter';
	import {
		createParser,
		toPlain,
		pathToPosition,
		computeHighlights,
		errorRanges,
		type PlainNode,
		type HighlightRange
	} from '$lib/ts/engine';
	import { LANGUAGES, languageById } from '$lib/ts/languages';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import TreeNode from '$lib/components/TreeNode.svelte';

	let langId = $state('javascript');
	let code = $state(languageById('javascript').sample);
	let ready = $state(false);
	let plainTree = $state<PlainNode | null>(null);
	let syntaxRanges = $state<HighlightRange[]>([]);
	let errRanges = $state<HighlightRange[]>([]);
	let parseMs = $state(0);
	let nodeCount = $state(0);
	let showAnonymous = $state(false);
	let hoverNode = $state<PlainNode | null>(null);
	let selectedNode = $state<PlainNode | null>(null);
	let pathIds = $state<Set<number> | null>(null);
	let cursorTargetId = $state<number | null>(null);

	// WASM handles live outside Svelte reactivity
	let parser: Parser | null = null;
	let language: Language | null = null;
	let tree: Tree | null = null;

	const editorRanges = $derived.by(() => {
		const ranges = [...syntaxRanges, ...errRanges];
		if (selectedNode) {
			ranges.push({ start: selectedNode.start, end: selectedNode.end, cls: 'hl-selected' });
		}
		if (hoverNode) {
			ranges.push({ start: hoverNode.start, end: hoverNode.end, cls: 'hl-node' });
		}
		return ranges;
	});

	const errorCount = $derived(errRanges.length);

	async function switchLanguage(id: string) {
		ready = false;
		langId = id;
		code = languageById(id).sample;
		({ parser, language } = await createParser(id));
		tree?.delete();
		tree = null;
		ready = true;
		parse();
	}

	function parse() {
		if (!parser || !language) return;
		const t0 = performance.now();
		const newTree = parser.parse(code);
		parseMs = performance.now() - t0;
		if (!newTree) return;
		tree?.delete();
		tree = newTree;
		nodeCount = newTree.rootNode.descendantCount;
		const plain = toPlain(newTree.rootNode);
		plainTree = plain;
		syntaxRanges = computeHighlights(language, newTree, languageById(langId).highlightQuery);
		errRanges = errorRanges(plain);
		selectedNode = null;
		hoverNode = null;
	}

	$effect(() => {
		code;
		// untrack: parse() writes state (plainTree, ranges, …) that must not
		// become a dependency of this effect, or it would loop forever.
		if (ready) untrack(parse);
	});

	function oncursor(pos: number) {
		if (!plainTree) return;
		const { path, target } = pathToPosition(plainTree, pos);
		pathIds = path;
		cursorTargetId = target?.id ?? null;
		selectedNode = null;
	}

	onMount(() => {
		switchLanguage(langId);
		return () => {
			tree?.delete();
			parser?.delete();
		};
	});
</script>

<div class="page">
	<div class="toolbar">
		<label>
			Language
			<select value={langId} onchange={(e) => switchLanguage(e.currentTarget.value)}>
				{#each LANGUAGES as lang}
					<option value={lang.id}>{lang.label}</option>
				{/each}
			</select>
		</label>
		<span class="stat">parse: <strong>{parseMs.toFixed(2)} ms</strong></span>
		<span class="stat">nodes: <strong>{nodeCount}</strong></span>
		{#if errorCount > 0}
			<span class="stat error">⚠ {errorCount} error node{errorCount === 1 ? '' : 's'} — tree still usable!</span>
		{:else}
			<span class="stat ok">✓ no errors</span>
		{/if}
		<span class="spacer"></span>
		<label class="toggle">
			<input type="checkbox" bind:checked={showAnonymous} />
			show anonymous nodes
		</label>
	</div>

	<div class="panes">
		<div class="pane">
			<div class="pane-title">Source <span class="hint">— place the cursor to locate its node; try breaking the syntax</span></div>
			<CodeEditor bind:value={code} ranges={editorRanges} {oncursor} />
		</div>
		<div class="pane">
			<div class="pane-title">Syntax tree <span class="hint">— hover to highlight source</span></div>
			<div class="tree-panel">
				{#if !ready}
					<p class="loading">Loading grammar WASM…</p>
				{:else if plainTree}
					<TreeNode
						node={plainTree}
						{showAnonymous}
						{pathIds}
						selectedId={selectedNode?.id ?? cursorTargetId}
						onhover={(n) => (hoverNode = n)}
						onselect={(n) => (selectedNode = n)}
					/>
				{/if}
			</div>
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
		gap: 18px;
		flex: none;
		font-size: 13px;
		color: var(--muted);
	}

	.toolbar label {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	select {
		background: var(--panel-bg);
		color: var(--fg);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 5px 8px;
		font-size: 13px;
	}

	.stat strong {
		color: var(--fg);
		font-family: var(--mono);
		font-weight: 600;
	}

	.stat.error {
		color: var(--error);
	}

	.stat.ok {
		color: var(--accent);
	}

	.spacer {
		flex: 1;
	}

	.toggle {
		cursor: pointer;
		user-select: none;
	}

	.panes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		flex: 1;
		min-height: 0;
	}

	.pane {
		display: flex;
		flex-direction: column;
		min-height: 0;
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

	.tree-panel {
		flex: 1;
		min-height: 0;
		overflow: auto;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px 4px;
	}

	.loading {
		color: var(--muted);
		padding: 12px;
	}
</style>
