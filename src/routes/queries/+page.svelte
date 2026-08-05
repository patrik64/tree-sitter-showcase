<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Query, type Parser, type Language, type Tree } from 'web-tree-sitter';
	import { createParser, type HighlightRange } from '$lib/ts/engine';
	import { LANGUAGES, languageById } from '$lib/ts/languages';
	import CodeEditor from '$lib/components/CodeEditor.svelte';

	interface CaptureRow {
		name: string;
		colorIndex: number;
		nodeType: string;
		text: string;
		row: number;
		column: number;
		start: number;
		end: number;
	}

	let langId = $state('javascript');
	let code = $state(languageById('javascript').sample);
	let querySource = $state(languageById('javascript').queryPresets[0].query);
	let presetIndex = $state(0);
	let ready = $state(false);
	let queryError = $state<string | null>(null);
	let captureRows = $state<CaptureRow[]>([]);
	let legend = $state<{ name: string; colorIndex: number; count: number }[]>([]);
	let hoverRange = $state<HighlightRange | null>(null);

	let parser: Parser | null = null;
	let language: Language | null = null;
	let tree: Tree | null = null;

	const config = $derived(languageById(langId));

	const editorRanges = $derived.by(() => {
		const ranges: HighlightRange[] = captureRows.map((c) => ({
			start: c.start,
			end: c.end,
			cls: `cap-${c.colorIndex}`
		}));
		if (hoverRange) ranges.push(hoverRange);
		return ranges;
	});

	async function switchLanguage(id: string) {
		ready = false;
		langId = id;
		const cfg = languageById(id);
		code = cfg.sample;
		presetIndex = 0;
		querySource = cfg.queryPresets[0].query;
		({ parser, language } = await createParser(id));
		tree?.delete();
		tree = null;
		ready = true;
		run();
	}

	function selectPreset(i: number) {
		presetIndex = i;
		querySource = config.queryPresets[i].query;
	}

	function run() {
		if (!parser || !language) return;
		tree?.delete();
		tree = parser.parse(code);
		if (!tree) return;

		let query: Query | null = null;
		try {
			query = new Query(language, querySource);
			const captures = query.captures(tree.rootNode);
			const colorByName = new Map<string, number>();
			const counts = new Map<string, number>();
			captureRows = captures.map((cap) => {
				if (!colorByName.has(cap.name)) colorByName.set(cap.name, colorByName.size % 8);
				counts.set(cap.name, (counts.get(cap.name) ?? 0) + 1);
				const text = cap.node.text;
				return {
					name: cap.name,
					colorIndex: colorByName.get(cap.name)!,
					nodeType: cap.node.type,
					text: text.length > 42 ? text.slice(0, 42) + '…' : text,
					row: cap.node.startPosition.row,
					column: cap.node.startPosition.column,
					start: cap.node.startIndex,
					end: cap.node.endIndex
				};
			});
			legend = [...colorByName.entries()].map(([name, colorIndex]) => ({
				name,
				colorIndex,
				count: counts.get(name) ?? 0
			}));
			queryError = null;
		} catch (e) {
			queryError = e instanceof Error ? e.message : String(e);
			captureRows = [];
			legend = [];
		} finally {
			query?.delete();
		}
	}

	$effect(() => {
		code;
		querySource;
		// untrack: run() writes captureRows/legend, which must not become
		// dependencies of this effect.
		if (ready) untrack(run);
	});

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
		<label>
			Preset
			<select
				value={presetIndex}
				onchange={(e) => selectPreset(Number(e.currentTarget.value))}
			>
				{#each config.queryPresets as preset, i}
					<option value={i}>{preset.name}</option>
				{/each}
			</select>
		</label>
		<span class="stat">
			{#if queryError}
				<span class="error">query error</span>
			{:else}
				<strong>{captureRows.length}</strong> captures
			{/if}
		</span>
	</div>

	<div class="panes">
		<div class="col">
			<div class="pane query-pane">
				<div class="pane-title">Query <span class="hint">— S-expression patterns, editable</span></div>
				<textarea class="query-input" bind:value={querySource} spellcheck="false"></textarea>
				{#if queryError}
					<div class="query-error">{queryError}</div>
				{/if}
			</div>
			<div class="pane code-pane">
				<div class="pane-title">Source</div>
				<CodeEditor bind:value={code} ranges={editorRanges} />
			</div>
		</div>
		<div class="pane">
			<div class="pane-title">Captures</div>
			{#if legend.length > 0}
				<div class="legend">
					{#each legend as item}
						<span class="legend-item cap-{item.colorIndex}">@{item.name} × {item.count}</span>
					{/each}
				</div>
			{/if}
			<div class="captures">
				{#if !ready}
					<p class="loading">Loading grammar WASM…</p>
				{:else if captureRows.length === 0 && !queryError}
					<p class="loading">No matches.</p>
				{:else}
					{#each captureRows as cap}
						<div
							class="cap-row"
							role="button"
							tabindex="-1"
							onmouseenter={() => (hoverRange = { start: cap.start, end: cap.end, cls: 'hl-node' })}
							onmouseleave={() => (hoverRange = null)}
						>
							<span class="cap-name cap-{cap.colorIndex}">@{cap.name}</span>
							<span class="cap-type">({cap.nodeType})</span>
							<span class="cap-text">{cap.text}</span>
							<span class="cap-pos">{cap.row}:{cap.column}</span>
						</div>
					{/each}
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
	}

	.error {
		color: var(--error);
	}

	.panes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		flex: 1;
		min-height: 0;
	}

	.col {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-height: 0;
	}

	.pane {
		display: flex;
		flex-direction: column;
		min-height: 0;
		gap: 6px;
	}

	.query-pane {
		flex: 0 0 auto;
	}

	.code-pane {
		flex: 1;
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

	.query-input {
		height: 170px;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--accent-2);
		font: 13px/1.55 var(--mono);
		padding: 12px 14px;
		resize: vertical;
		outline: none;
		white-space: pre;
	}

	.query-input:focus {
		border-color: var(--accent-2);
	}

	.query-error {
		font: 12px/1.5 var(--mono);
		color: var(--error);
		background: rgba(255, 123, 114, 0.1);
		border: 1px solid rgba(255, 123, 114, 0.4);
		border-radius: 6px;
		padding: 8px 10px;
		white-space: pre-wrap;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		flex: none;
	}

	.legend-item {
		font: 12px var(--mono);
		padding: 2px 8px;
		border-radius: 10px;
	}

	.captures {
		flex: 1;
		min-height: 0;
		overflow: auto;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 6px;
	}

	.cap-row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 3px 8px;
		border-radius: 4px;
		font: 12.5px/1.6 var(--mono);
		cursor: default;
		white-space: nowrap;
	}

	.cap-row:hover {
		background: rgba(96, 165, 250, 0.1);
	}

	.cap-name {
		padding: 0 6px;
		border-radius: 8px;
		flex: none;
	}

	.cap-type {
		color: var(--muted);
		flex: none;
	}

	.cap-text {
		color: var(--fg);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cap-pos {
		margin-left: auto;
		color: var(--muted);
		font-size: 11px;
		flex: none;
	}

	.loading {
		color: var(--muted);
		padding: 12px;
	}
</style>
