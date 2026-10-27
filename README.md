# 🌳 tree-sitter-showcase

A SvelteKit app showcasing [tree-sitter](https://tree-sitter.github.io/tree-sitter/),
the incremental parsing system written in Rust/C. All parsing happens **in the browser**:
the tree-sitter runtime and each grammar are compiled to WebAssembly and driven through
the [`web-tree-sitter`](https://www.npmjs.com/package/web-tree-sitter) bindings.

## Run

```sh
pnpm i
pnpm run dev
```

## Pages

1. **Intro** (`/`) — what tree-sitter is, who uses it, how this demo works.
2. **Playground** (`/playground`) — live code → concrete syntax tree.
   - Hover a tree node to highlight the source span; place the cursor in the code to
     locate its node in the tree.
   - Toggle *show anonymous nodes* to explain named vs. anonymous nodes.
   - **Demo moment:** delete a `)` or `}` mid-file — an `ERROR`/`MISSING` node appears
     (red squiggle), but the rest of the tree stays intact. That's the error recovery
     editors rely on.
3. **Queries** (`/queries`) — the S-expression query language.
   - Presets per language: function finding, structural patterns, `#match?` predicates,
     and the full syntax-highlighting query (which is also what colors every editor
     pane in this app — the highlighting is eating its own dog food).
   - The query textarea is live; compile errors are shown inline.
4. **Incremental** (`/incremental`) — the headline feature.
   - A generated Rust file (100–3,000 functions). Every keystroke runs both an
     incremental re-parse (`tree.edit()` + `parser.parse(text, oldTree)`) and a full
     parse from scratch; the scoreboard shows the speedup, which grows with file size.
   - The orange highlight shows `tree.getChangedRanges()` — exactly the region an
     editor would need to re-highlight.
5. **Grammars** (`/grammars`) — the `grammar.js` source of all four grammars.
   - Tree-sitter grammars are written in a JavaScript DSL (`seq`, `choice`, `repeat`,
     `prec`, …). This page shows the real upstream files for JavaScript, Rust, Python and
     JSON with a clickable, filterable index of every rule (`_names` are hidden rules).
   - Because `grammar.js` is plain JavaScript, the page highlights it with the demo's own
     tree-sitter-javascript grammar and extracts the rule index with a tree-sitter query.

## How the WASM fits together

- `static/wasm/web-tree-sitter.wasm` — the tree-sitter runtime (C compiled with emscripten).
- `static/wasm/tree-sitter-{javascript,rust,python,json}.wasm` — grammars, each a
  dynamically-linked WASM module loaded on demand by `Language.load()`.
- The `.wasm` files are copied out of npm packages by `npm run sync-wasm`
  (re-run it after upgrading `web-tree-sitter` or a grammar).
- `static/grammars/<lang>/grammar.js` — the upstream grammar definitions shown on the
  Grammars page, copied from the same npm packages by `npm run sync-grammars`.

> Grammar WASMs must be built for the same ABI as the runtime: `web-tree-sitter` ≥ 0.25
> expects a `dylink.0` custom section. The official `tree-sitter-<lang>` npm packages
> ship compatible builds; older aggregator packages (e.g. `tree-sitter-wasms`) may not.

## Code map

- `src/lib/ts/engine.ts` — runtime init, grammar loading, tree → plain-JS conversion,
  highlight-query execution, error ranges, and the text-diff → `Edit` helper used for
  incremental parsing.
- `src/lib/ts/languages.ts` — per-language sample code, highlight queries, query presets.
- `src/lib/components/CodeEditor.svelte` — textarea with a synced overlay `<pre>` for
  syntax colors and range highlights.
- `src/lib/components/TreeNode.svelte` — recursive syntax-tree view.
- `src/lib/components/SourceView.svelte` — read-only highlighted source with line numbers
  and jump-to-line (the Grammars page).
