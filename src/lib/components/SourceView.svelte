<script lang="ts">
	import type { HighlightRange } from '$lib/ts/engine';

	interface Props {
		source: string;
		ranges?: HighlightRange[];
		/** 0-based line to scroll into view and mark. */
		activeLine?: number | null;
	}

	let { source, ranges = [], activeLine = null }: Props = $props();

	interface Segment {
		text: string;
		cls: string;
	}

	let container: HTMLElement | undefined = $state();

	/**
	 * Split the source into lines of class-tagged segments. One sweep over the
	 * ranges sorted by start keeps this linear-ish even for tens of thousands of
	 * highlight captures (a big grammar.js produces that many).
	 */
	const lines: Segment[][] = $derived.by(() => {
		const text = source;
		const clip = (n: number) => Math.max(0, Math.min(n, text.length));
		const sorted = ranges
			.map((r) => ({ start: clip(r.start), end: clip(r.end), cls: r.cls }))
			.filter((r) => r.end > r.start)
			.sort((a, b) => a.start - b.start || b.end - a.end);
		const points = new Set<number>([0, text.length]);
		for (const r of sorted) {
			points.add(r.start);
			points.add(r.end);
		}
		const cuts = [...points].sort((a, b) => a - b);

		const out: Segment[][] = [[]];
		const push = (piece: string, cls: string) => {
			const parts = piece.split('\n');
			for (let i = 0; i < parts.length; i++) {
				if (i > 0) out.push([]);
				if (parts[i]) out[out.length - 1].push({ text: parts[i], cls });
			}
		};

		let active: typeof sorted = [];
		let next = 0;
		for (let i = 0; i < cuts.length - 1; i++) {
			const s = cuts[i];
			while (next < sorted.length && sorted[next].start <= s) active.push(sorted[next++]);
			active = active.filter((r) => r.end > s);
			push(text.slice(s, cuts[i + 1]), active.map((r) => r.cls).join(' '));
		}
		return out;
	});

	$effect(() => {
		if (activeLine === null || !container) return;
		const el = container.querySelector<HTMLElement>(`[data-line="${activeLine}"]`);
		el?.scrollIntoView({ block: 'center' });
	});

	$effect(() => {
		source;
		if (container) container.scrollTop = 0;
	});
</script>

<div class="source" bind:this={container}>
	{#each lines as segs, i}
		<div class="line" class:active={i === activeLine} data-line={i}><span class="ln">{i + 1}</span><span
				class="code">{#each segs as seg}<span class={seg.cls || undefined}>{seg.text}</span>{/each}</span></div>
	{/each}
</div>

<style>
	.source {
		height: 100%;
		min-height: 0;
		overflow: auto;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px 0;
		font: 12.5px/1.6 var(--mono);
		color: var(--fg);
	}

	.line {
		display: flex;
		white-space: pre;
		min-width: max-content;
		padding-right: 16px;
	}

	.line.active {
		background: rgba(126, 231, 135, 0.12);
		box-shadow: inset 3px 0 0 var(--accent);
	}

	.ln {
		flex: none;
		position: sticky;
		left: 0;
		width: 44px;
		padding-right: 14px;
		text-align: right;
		color: var(--muted);
		opacity: 0.7;
		background: var(--panel-bg);
		user-select: none;
	}

	.line.active .ln {
		background: #233330;
		opacity: 1;
	}

	.code {
		flex: none;
	}
</style>
