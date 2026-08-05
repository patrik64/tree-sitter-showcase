import { Parser, Language, Query, Edit, type Tree, type Node } from 'web-tree-sitter';

let initPromise: Promise<void> | null = null;
const languageCache = new Map<string, Promise<Language>>();

/** Initialize the tree-sitter WASM runtime (once per session). */
export function initTreeSitter(): Promise<void> {
	initPromise ??= Parser.init({
		locateFile: (file: string) => `/wasm/${file}`
	});
	return initPromise;
}

/** Load (and cache) a grammar compiled to WASM. */
export async function loadLanguage(id: string): Promise<Language> {
	await initTreeSitter();
	if (!languageCache.has(id)) {
		languageCache.set(id, Language.load(`/wasm/tree-sitter-${id}.wasm`));
	}
	return languageCache.get(id)!;
}

export async function createParser(id: string): Promise<{ parser: Parser; language: Language }> {
	const language = await loadLanguage(id);
	const parser = new Parser();
	parser.setLanguage(language);
	return { parser, language };
}

/** A plain-JS snapshot of a syntax node, safe to keep after the WASM tree is deleted. */
export interface PlainNode {
	id: number;
	type: string;
	named: boolean;
	field: string | null;
	start: number;
	end: number;
	startPos: { row: number; column: number };
	endPos: { row: number; column: number };
	isError: boolean;
	isMissing: boolean;
	hasError: boolean;
	children: PlainNode[];
}

export function toPlain(node: Node, field: string | null = null): PlainNode {
	return {
		id: node.id,
		type: node.type,
		named: node.isNamed,
		field,
		start: node.startIndex,
		end: node.endIndex,
		startPos: { row: node.startPosition.row, column: node.startPosition.column },
		endPos: { row: node.endPosition.row, column: node.endPosition.column },
		isError: node.isError,
		isMissing: node.isMissing,
		hasError: node.hasError,
		children: node.children
			.filter((c): c is Node => c !== null)
			.map((c, i) => toPlain(c, node.fieldNameForChild(i)))
	};
}

/** The ids of every node on the path to the deepest node containing `pos`, plus that node's id. */
export function pathToPosition(root: PlainNode, pos: number): { path: Set<number>; target: PlainNode | null } {
	const path = new Set<number>();
	let target: PlainNode | null = null;
	let current: PlainNode | undefined = root;
	while (current) {
		path.add(current.id);
		target = current;
		current = current.children.find((c) => c.start <= pos && pos < c.end);
	}
	return { path, target };
}

export interface HighlightRange {
	start: number;
	end: number;
	cls: string;
}

/** Priority when several patterns capture the same node: earlier in this list wins. */
const CAPTURE_PRIORITY = [
	'comment',
	'string',
	'keyword',
	'constant',
	'number',
	'function',
	'type',
	'property',
	'label',
	'variable'
];

function priorityOf(name: string): number {
	const base = name.split('.')[0];
	const i = CAPTURE_PRIORITY.indexOf(base);
	return i === -1 ? CAPTURE_PRIORITY.length : i;
}

/** Run a highlight query over a tree and produce CSS-class ranges for the editor overlay. */
export function computeHighlights(language: Language, tree: Tree, querySource: string): HighlightRange[] {
	const query = new Query(language, querySource);
	try {
		const captures = query.captures(tree.rootNode);
		const best = new Map<number, { name: string; start: number; end: number }>();
		for (const cap of captures) {
			const existing = best.get(cap.node.id);
			if (!existing || priorityOf(cap.name) < priorityOf(existing.name)) {
				best.set(cap.node.id, { name: cap.name, start: cap.node.startIndex, end: cap.node.endIndex });
			}
		}
		return [...best.values()]
			.map((c) => ({ start: c.start, end: c.end, cls: `tok-${c.name.split('.')[0]}` }))
			.sort((a, b) => a.start - b.start);
	} finally {
		query.delete();
	}
}

/** Ranges of ERROR / missing nodes, for the red squiggle overlay. */
export function errorRanges(root: PlainNode): HighlightRange[] {
	const out: HighlightRange[] = [];
	const visit = (n: PlainNode) => {
		if (n.isError || n.isMissing) {
			out.push({ start: n.start, end: Math.max(n.end, n.start + 1), cls: 'tok-error' });
		}
		if (n.hasError) n.children.forEach(visit);
	};
	visit(root);
	return out;
}

export function indexToPoint(text: string, index: number): { row: number; column: number } {
	let row = 0;
	let lineStart = 0;
	for (let i = 0; i < index; i++) {
		if (text.charCodeAt(i) === 10) {
			row++;
			lineStart = i + 1;
		}
	}
	return { row, column: index - lineStart };
}

/** Single-range diff between two texts (common prefix/suffix), as a tree-sitter edit. */
export function diffToEdit(oldText: string, newText: string) {
	let start = 0;
	const minLen = Math.min(oldText.length, newText.length);
	while (start < minLen && oldText[start] === newText[start]) start++;
	let oldEnd = oldText.length;
	let newEnd = newText.length;
	while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
		oldEnd--;
		newEnd--;
	}
	return new Edit({
		startIndex: start,
		oldEndIndex: oldEnd,
		newEndIndex: newEnd,
		startPosition: indexToPoint(oldText, start),
		oldEndPosition: indexToPoint(oldText, oldEnd),
		newEndPosition: indexToPoint(newText, newEnd)
	});
}
