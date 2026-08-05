<script lang="ts">
	import type { PlainNode } from '$lib/ts/engine';
	import TreeNode from './TreeNode.svelte';

	interface Props {
		node: PlainNode;
		depth?: number;
		showAnonymous?: boolean;
		selectedId?: number | null;
		pathIds?: Set<number> | null;
		onhover?: (node: PlainNode | null) => void;
		onselect?: (node: PlainNode) => void;
	}

	let {
		node,
		depth = 0,
		showAnonymous = false,
		selectedId = null,
		pathIds = null,
		onhover,
		onselect
	}: Props = $props();

	let expanded = $state(true);
	let rowEl: HTMLElement | undefined = $state();

	const visibleChildren = $derived(
		showAnonymous ? node.children : node.children.filter((c) => c.named || c.isError)
	);
	const isSelected = $derived(selectedId === node.id);

	$effect(() => {
		if (pathIds?.has(node.id)) expanded = true;
	});

	$effect(() => {
		if (isSelected && rowEl) {
			rowEl.scrollIntoView({ block: 'nearest' });
		}
	});
</script>

<div class="node" style:--depth={depth}>
	<div
		bind:this={rowEl}
		class="row"
		class:selected={isSelected}
		role="button"
		tabindex="-1"
		onmouseenter={() => onhover?.(node)}
		onmouseleave={() => onhover?.(null)}
		onclick={() => onselect?.(node)}
		onkeydown={(e) => e.key === 'Enter' && onselect?.(node)}
	>
		{#if visibleChildren.length > 0}
			<button
				class="twist"
				onclick={(e) => {
					e.stopPropagation();
					expanded = !expanded;
				}}>{expanded ? '▾' : '▸'}</button
			>
		{:else}
			<span class="twist leaf">·</span>
		{/if}
		{#if node.field}
			<span class="field">{node.field}:</span>
		{/if}
		{#if node.isError}
			<span class="type error">ERROR</span>
		{:else if node.isMissing}
			<span class="type error">MISSING {node.type}</span>
		{:else if node.named}
			<span class="type">{node.type}</span>
		{:else}
			<span class="anon">"{node.type}"</span>
		{/if}
		<span class="pos"
			>[{node.startPos.row}, {node.startPos.column}] – [{node.endPos.row}, {node.endPos.column}]</span
		>
	</div>
	{#if expanded && visibleChildren.length > 0}
		<div class="children">
			{#each visibleChildren as child (child.id)}
				<TreeNode
					node={child}
					depth={depth + 1}
					{showAnonymous}
					{selectedId}
					{pathIds}
					{onhover}
					{onselect}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.node {
		font: 12.5px/1.7 var(--mono);
	}

	.row {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 0 8px 0 calc(8px + var(--depth) * 16px);
		white-space: nowrap;
		cursor: pointer;
		border-radius: 4px;
	}

	.row:hover {
		background: rgba(96, 165, 250, 0.1);
	}

	.row.selected {
		background: rgba(96, 165, 250, 0.22);
	}

	.twist {
		flex: none;
		width: 14px;
		background: none;
		border: none;
		color: var(--muted);
		font-size: 11px;
		cursor: pointer;
		padding: 0;
	}

	.leaf {
		text-align: center;
		opacity: 0.4;
	}

	.field {
		color: var(--accent-2);
	}

	.type {
		color: var(--accent);
		font-weight: 600;
	}

	.type.error {
		color: var(--error);
	}

	.anon {
		color: var(--muted);
	}

	.pos {
		color: var(--muted);
		font-size: 11px;
		opacity: 0.75;
	}
</style>
