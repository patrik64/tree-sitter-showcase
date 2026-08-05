<script lang="ts">
	import type { HighlightRange } from '$lib/ts/engine';

	interface Props {
		value: string;
		ranges?: HighlightRange[];
		oncursor?: (pos: number) => void;
		spellcheck?: boolean;
	}

	let { value = $bindable(), ranges = [], oncursor, spellcheck = false }: Props = $props();

	let textarea: HTMLTextAreaElement | undefined = $state();
	let overlay: HTMLElement | undefined = $state();

	interface Segment {
		text: string;
		cls: string;
	}

	const segments: Segment[] = $derived.by(() => {
		const text = value;
		const clip = (n: number) => Math.max(0, Math.min(n, text.length));
		const points = new Set<number>([0, text.length]);
		const clipped = ranges
			.map((r) => ({ start: clip(r.start), end: clip(r.end), cls: r.cls }))
			.filter((r) => r.end > r.start);
		for (const r of clipped) {
			points.add(r.start);
			points.add(r.end);
		}
		const sorted = [...points].sort((a, b) => a - b);
		const segs: Segment[] = [];
		for (let i = 0; i < sorted.length - 1; i++) {
			const s = sorted[i];
			const e = sorted[i + 1];
			const cls = clipped
				.filter((r) => r.start <= s && r.end >= e)
				.map((r) => r.cls)
				.join(' ');
			segs.push({ text: text.slice(s, e), cls });
		}
		return segs;
	});

	function syncScroll() {
		if (textarea && overlay) {
			overlay.scrollTop = textarea.scrollTop;
			overlay.scrollLeft = textarea.scrollLeft;
		}
	}

	function reportCursor() {
		if (textarea) oncursor?.(textarea.selectionStart);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Tab' && textarea) {
			e.preventDefault();
			const { selectionStart, selectionEnd } = textarea;
			textarea.setRangeText('  ', selectionStart, selectionEnd, 'end');
			value = textarea.value;
		}
	}
</script>

<div class="editor">
	<pre bind:this={overlay} class="overlay" aria-hidden="true">{#each segments as seg}<span
				class={seg.cls || undefined}>{seg.text}</span>{/each}{'\n'}</pre>
	<textarea
		bind:this={textarea}
		bind:value
		onscroll={syncScroll}
		oninput={syncScroll}
		onkeyup={reportCursor}
		onclick={reportCursor}
		{onkeydown}
		{spellcheck}
		autocomplete="off"
		autocapitalize="off"
	></textarea>
</div>

<style>
	.editor {
		position: relative;
		height: 100%;
		min-height: 0;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
	}

	.overlay,
	textarea {
		position: absolute;
		inset: 0;
		margin: 0;
		padding: 12px 14px;
		font: 13px/1.55 var(--mono);
		white-space: pre;
		overflow: auto;
		tab-size: 4;
		border: none;
	}

	.overlay {
		pointer-events: none;
		color: var(--fg);
		overflow: hidden;
		z-index: 0;
	}

	textarea {
		z-index: 1;
		resize: none;
		background: transparent;
		color: transparent;
		caret-color: var(--fg);
		outline: none;
		width: 100%;
		height: 100%;
	}

	textarea::selection {
		background: rgba(96, 165, 250, 0.28);
		color: transparent;
	}
</style>
