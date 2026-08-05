<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Parser, Tree } from 'web-tree-sitter';
	import { createParser, diffToEdit, type HighlightRange } from '$lib/ts/engine';
	import CodeEditor from '$lib/components/CodeEditor.svelte';

	interface EditStat {
		editChars: number;
		incrementalMs: number;
		fullMs: number;
	}

	let size = $state(300);
	let code = $state('');
	let ready = $state(false);
	let initialMs = $state(0);
	let nodeCount = $state(0);
	let changedRanges = $state<HighlightRange[]>([]);
	let stats = $state<EditStat[]>([]);

	let parser: Parser | null = null;
	let tree: Tree | null = null;
	let prevCode = '';

	const lineCount = $derived(code.split('\n').length);
	const lastStat = $derived(stats[0] ?? null);
	const avgSpeedup = $derived.by(() => {
		if (stats.length === 0) return null;
		const ratios = stats.map((s) => s.fullMs / Math.max(s.incrementalMs, 0.001));
		return ratios.reduce((a, b) => a + b, 0) / ratios.length;
	});

	function generateSample(n: number): string {
		let out = 'use std::collections::HashMap;\n\n';
		for (let i = 0; i < n; i++) {
			out += `fn compute_${i}(x: u64) -> u64 {\n`;
			out += `    let mut total = 0;\n`;
			out += `    for step in 0..x {\n`;
			out += `        total += step * ${i};\n`;
			out += `    }\n`;
			out += `    total\n`;
			out += `}\n\n`;
		}
		return out;
	}

	async function reset(n: number) {
		ready = false;
		size = n;
		if (!parser) ({ parser } = await createParser('rust'));
		const sample = generateSample(n);
		const t0 = performance.now();
		tree?.delete();
		tree = parser.parse(sample);
		initialMs = performance.now() - t0;
		nodeCount = tree?.rootNode.descendantCount ?? 0;
		prevCode = sample;
		code = sample;
		changedRanges = [];
		stats = [];
		ready = true;
	}

	function onEdited(oldText: string, newText: string) {
		if (!parser || !tree) return;

		// 1. Tell the old tree where the edit happened...
		const edit = diffToEdit(oldText, newText);
		tree.edit(edit);

		// 2. ...then re-parse, letting tree-sitter reuse everything untouched.
		const t0 = performance.now();
		const newTree = parser.parse(newText, tree);
		const incrementalMs = performance.now() - t0;
		if (!newTree) return;

		// 3. For comparison: a full parse from scratch of the same text.
		const t1 = performance.now();
		const scratchTree = parser.parse(newText);
		const fullMs = performance.now() - t1;
		scratchTree?.delete();

		changedRanges = tree
			.getChangedRanges(newTree)
			.map((r) => ({ start: r.startIndex, end: r.endIndex, cls: 'hl-changed' }));

		tree.delete();
		tree = newTree;
		nodeCount = newTree.rootNode.descendantCount;

		const editChars = Math.max(edit.oldEndIndex - edit.startIndex, edit.newEndIndex - edit.startIndex);
		stats = [{ editChars, incrementalMs, fullMs }, ...stats].slice(0, 10);
	}

	$effect(() => {
		const newText = code;
		if (!ready || newText === prevCode) return;
		const oldText = prevCode;
		prevCode = newText;
		// untrack: onEdited writes stats/changedRanges, which must not become
		// dependencies of this effect.
		untrack(() => onEdited(oldText, newText));
	});

	onMount(() => {
		reset(size);
		return () => {
			tree?.delete();
			parser?.delete();
		};
	});
</script>

<div class="page">
	<div class="toolbar">
		<label>
			Sample size
			<select value={size} onchange={(e) => reset(Number(e.currentTarget.value))}>
				<option value={100}>100 functions</option>
				<option value={300}>300 functions</option>
				<option value={1000}>1,000 functions</option>
				<option value={3000}>3,000 functions</option>
			</select>
		</label>
		<span class="stat">{lineCount.toLocaleString()} lines · {nodeCount.toLocaleString()} nodes</span>
		<span class="stat">initial full parse: <strong>{initialMs.toFixed(1)} ms</strong></span>
		<span class="spacer"></span>
		<button class="reset" onclick={() => reset(size)}>Reset sample</button>
	</div>

	<div class="panes">
		<div class="pane">
			<div class="pane-title">
				Rust source <span class="hint">— type anywhere; changed subtree is highlighted</span>
			</div>
			<CodeEditor bind:value={code} ranges={changedRanges} />
		</div>

		<div class="side">
			<div class="explain">
				<p>
					After every keystroke this page does <strong>two</strong> parses of the whole file: one
					<em>incremental</em> (reusing the previous tree via <code>tree.edit()</code> +
					<code>parser.parse(text, oldTree)</code>) and one from scratch. Same input, same
					resulting tree — very different cost.
				</p>
			</div>

			{#if lastStat}
				<div class="scoreboard">
					<div class="score incremental">
						<div class="label">incremental re-parse</div>
						<div class="value">{lastStat.incrementalMs.toFixed(2)} ms</div>
					</div>
					<div class="score full">
						<div class="label">full parse from scratch</div>
						<div class="value">{lastStat.fullMs.toFixed(2)} ms</div>
					</div>
					<div class="score speedup">
						<div class="label">speedup</div>
						<div class="value">
							{(lastStat.fullMs / Math.max(lastStat.incrementalMs, 0.001)).toFixed(0)}×
						</div>
					</div>
				</div>

				<table>
					<thead>
						<tr><th>edit size</th><th>incremental</th><th>full</th><th>speedup</th></tr>
					</thead>
					<tbody>
						{#each stats as s}
							<tr>
								<td>{s.editChars} ch</td>
								<td class="good">{s.incrementalMs.toFixed(2)} ms</td>
								<td>{s.fullMs.toFixed(2)} ms</td>
								<td>{(s.fullMs / Math.max(s.incrementalMs, 0.001)).toFixed(0)}×</td>
							</tr>
						{/each}
					</tbody>
				</table>

				{#if avgSpeedup !== null}
					<p class="avg">average speedup over last {stats.length} edits: <strong>{avgSpeedup.toFixed(0)}×</strong></p>
				{/if}
			{:else if ready}
				<p class="waiting">Make an edit in the source to start measuring…</p>
			{:else}
				<p class="waiting">Loading grammar WASM…</p>
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
	}

	.spacer {
		flex: 1;
	}

	.reset {
		background: var(--panel-bg);
		color: var(--fg);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 5px 12px;
		font-size: 13px;
		cursor: pointer;
	}

	.reset:hover {
		border-color: var(--accent);
	}

	.panes {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
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

	.side {
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.explain {
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 4px 16px;
		font-size: 13.5px;
		line-height: 1.6;
		color: #c9d1d9;
	}

	.explain code {
		font-family: var(--mono);
		font-size: 0.9em;
		background: rgba(255, 255, 255, 0.08);
		padding: 1px 5px;
		border-radius: 4px;
	}

	.scoreboard {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 10px;
	}

	.score {
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px 14px;
		text-align: center;
	}

	.score .label {
		font-size: 11.5px;
		color: var(--muted);
		margin-bottom: 6px;
	}

	.score .value {
		font: 700 22px var(--mono);
	}

	.score.incremental .value {
		color: var(--accent);
	}

	.score.full .value {
		color: var(--error);
	}

	.score.speedup .value {
		color: var(--accent-2);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font: 12.5px var(--mono);
	}

	th,
	td {
		text-align: right;
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}

	th {
		color: var(--muted);
		font-weight: 500;
	}

	td.good {
		color: var(--accent);
	}

	.avg {
		font-size: 13px;
		color: var(--muted);
	}

	.avg strong {
		color: var(--accent-2);
		font-family: var(--mono);
	}

	.waiting {
		color: var(--muted);
	}
</style>
