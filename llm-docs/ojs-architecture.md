---
main_commit: fa5267fa0
analyzed_date: 2026-10-15
key_files:
  - src/execute/ojs/compile.ts
  - src/execute/ojs/extract-resources.ts
  - src/command/render/render-files.ts
  - src/command/render/pandoc.ts
  - src/command/render/resources.ts
  - src/resources/filters/quarto-post/ojs.lua
  - src/core/jupyter/jupyter.ts
  - src/resources/rmd/ojs.R
  - src/resources/jupyter/lang/python/setup.py
  - packages/ojs/package.json
  - packages/ojs/quarto-ojs-runtime/rollup.config.js
  - packages/ojs/quarto-ojs-runtime/src/quarto-ojs.js
  - package/src/common/prepare-dist.ts
  - .github/workflows/test-ojs-runtime.yml
---

# OJS Architecture

How `{ojs}` cells become Observable JavaScript in an HTML page: the render-time compile step in TypeScript, the Lua filter for inline `${...}` expressions, and the browser runtime built from `packages/ojs`.

## Entry Points

- `src/command/render/render-files.ts` calls `ojsExecuteResult()` after the engine has executed the document's other cells.
- `ojsExecuteResult()` (`src/execute/ojs/compile.ts`) wraps `ojsCompile()` and merges its markdown, includes, and filters into the execute result.
- `ojsCompile()` (same file) does the work: it rewrites `{ojs}` cells into placeholder divs and builds the scripts that hand the cell sources to the runtime.
- `src/command/render/resources.ts` calls `extractResolvedResourceFilenamesFromQmd()` (`src/execute/ojs/extract-resources.ts`) so files referenced by OJS code are copied as render resources.

## When OJS Runs

`ojsCompile()` returns the markdown untouched unless all of these hold:

1. `isJavascriptCompatible(format)` (`src/config/format.ts`) is true: HTML-compatible output (`isHtmlCompatible`) except EPUB.
2. `ojs-engine` metadata is not `false`.
3. The document has an `ojs` cell, contains the text `ojs_define`, or sets `ojs-engine: true`.

The `ojs_define` check is a plain substring search over the markdown, because the R/Python/Julia cells have already executed by this point and their outputs are no longer cells.

## Compile Output

For each `{ojs}` cell, `ojsCompile()` emits a div with an `ojs-cell-<n>` id and collects the cell source. It then writes an include-after-body file containing:

- `<script type="ojs-module-contents">` holding base64-encoded JSON (`{ contents: [{ methodName, source, cellName, ... }] }`). Base64 keeps user code from closing the script tag.
- A `<script type="module">` that ends with `window._ojs.runtime.interpretFromScriptTags()`, which makes the runtime read every `ojs-module-contents` and `ojs-define` script tag.

Shiny documents (`server: { type: shiny }`) get extra module contents. `server.ojs-export` (default `viewof`, i.e. every `viewof` name; also `all`, explicit names, `~name` exclusions) adds `shinyInput('<name>')` calls. `server.ojs-import` adds `<name> = shinyOutput('<name>')`. Misspelled plural keys (`ojs-exports`, `ojs-imports`) produce a warning.

## Runtime Injection

`ojsFormatDependency(selfContained)` declares the `quarto-ojs` HTML dependency: `quarto-ojs.css` always, plus `quarto-ojs-runtime.js` as a `type="module"` script unless the render is self-contained.

Self-contained renders (`embed-resources` / `self-contained`) inline the bundle instead, because a module script loaded by `src=` fails under `file://` CORS rules. `ojsCompile()` reads `formats/html/ojs/quarto-ojs-runtime.js` from `quartoConfig.sharePath()` and wraps it in `<script type="module">...</script>` inside an include-in-header file. The code carries an open `FIXME` asking whether `sharePath()` is the right way to locate the resource.

Invariant: the inlined bundle is not escaped, so `quarto-ojs-runtime.js` must never contain the text `</script`. Check after every rebuild:

```bash
rg -c '</script' src/resources/formats/html/ojs/quarto-ojs-runtime.js   # must print nothing
```

Only the unminified `quarto-ojs-runtime.js` is used: it is the linked script, the inlined script, and the only bundle `package/src/common/prepare-dist.ts` copies into the distribution's share directory. `quarto-ojs-runtime.min.js` is built and committed, but nothing in quarto-cli references it.

## Inline Expressions (Lua)

`src/resources/filters/quarto-post/ojs.lua` handles inline `${expr}` in prose. It runs as the `post-ojs` stage in `main.lua` and is active only when the `ojs` filter param is set. `ojsCompile()` returns `filters: ["ojs"]`; `src/command/render/pandoc.ts` turns that pseudo-filter name into `formatFilterParams.ojs = true` instead of running a filter file.

The filter replaces each `${...}` with an empty span (`ojs-element-id-<n>`) and appends a hidden `ojs-auto-generated` div holding its own base64 `ojs-module-contents` script, which `interpretFromScriptTags()` picks up alongside the compile output.

Other Lua touch points:

- `quarto-pre/outputs.lua` and `layout/hugo.lua` recognise `ojs-cell-` ids so Hugo output keeps OJS cell divs.
- `modules/constants.lua` lists `//` as the `ojs` comment syntax.

## `ojs_define` (engine side)

`ojs_define()` passes data from R, Python, or Julia to OJS by emitting `<script type="ojs-define">` JSON that the runtime reads on load.

| Engine | Definition |
|--------|------------|
| knitr | `src/resources/rmd/ojs.R` (Shiny, via `sendCustomMessage`), `src/resources/rmd/ojs_static.R` |
| Jupyter (Python) | `src/resources/jupyter/lang/python/setup.py` |
| Jupyter (Julia) | `src/resources/jupyter/lang/julia/setup.jl` |

The knitr `ojs_define()` stops with an error in a cached chunk (`cache: false` is required).

`src/core/jupyter/jupyter.ts` keeps outputs whose metadata has `ojs_define` even when the cell has `output: false`.

## Resource Extraction

`extract-resources.ts` finds files that OJS code references (`FileAttachment(...)`, `import` of local `.js`/`.ojs` modules) by parsing cell sources and following imports recursively. Local ES modules are compiled with the bundled esbuild (`src/core/esbuild.ts`).

For self-contained renders, `makeSelfContainedResources()` turns those files into `data:` URLs, with MIME types from the Deno `media_types` `lookup()`.

In the browser, `FileAttachment(...).mimeType` comes from a different source: the bundled `mime` package's `getType()`, called in `fileAttachmentPathResolver` (`packages/ojs/quarto-ojs-runtime/src/quarto-ojs.js`). Upgrading `mime` can therefore change the MIME types users observe.

## Generated vs Hand-Edited

| Path | How it changes |
|------|----------------|
| `packages/ojs/quarto-ojs-runtime/src/` | Hand-edited: Quarto's runtime (connector, code transforms, inspector, JSX, Shiny bridge) |
| `packages/ojs/external-*/` | Hand-edited copies of Observable runtime/stdlib/parser, d3-require, and unofficial-observablehq-compiler; no `git subtree` |
| `src/resources/formats/html/ojs/quarto-ojs-runtime{,.min}.js` | Generated by the `packages/ojs` build; never hand-edit |
| `src/resources/formats/html/ojs/quarto-ojs.css` | Hand-edited in place; not produced by the build |
| `src/execute/ojs/`, `quarto-post/ojs.lua` | Normal quarto-cli source |

Rebuild rule: any change under `packages/ojs/` is incomplete until both bundles are rebuilt and committed in the same change:

```bash
cd packages/ojs && npm ci && npm run build
```

`rollup.config.js` writes straight into `src/resources/formats/html/ojs/`. `.github/workflows/test-ojs-runtime.yml` rebuilds on Node 24 and fails when `git diff` on that directory is not empty. The bundles are `linguist-vendored` in `.gitattributes`. `src/resources/formats/html/ojs/` is not managed by `update-html-dependencies.ts`.

Maintainer procedure (dependency bumps, fork changes, verification): `dev-docs/update-ojs-runtime.md`.

## Tests

No unit tests cover OJS. Coverage is render-level:

- Playwright: `tests/integration/playwright/tests/ojs-*.spec.ts`, rendering docs from `tests/docs/playwright/ojs/`. Helpers `ojsVal()` / `ojsRuns()` are described in `.claude/rules/testing/playwright-tests.md`.
- Smoke: `tests/smoke/ojs/*.test.ts` (layout, dependency traversal, `ojs_define` numeric precision across knitr/jupyter/julia) and `tests/smoke/render/render-ojs.test.ts`.
- smoke-all: documents with `{ojs}` cells, found with `rg -l '```\{ojs' tests/docs/smoke-all --glob '*.qmd'`.

A change to the runtime bundle needs the Playwright `ojs-*` specs. A change to `compile.ts` or `ojs.lua` also needs the smoke tests.

## Key Files

| File | Purpose |
|------|---------|
| `src/execute/ojs/compile.ts` | `ojsCompile()`, `ojsExecuteResult()`, `ojsFormatDependency()`, Shiny export/import |
| `src/execute/ojs/extract-resources.ts` | Resource discovery, esbuild of local modules, self-contained `data:` URLs |
| `src/command/render/pandoc.ts` | `ojs` pseudo-filter → `ojs` filter param |
| `src/resources/filters/quarto-post/ojs.lua` | Inline `${...}` expressions |
| `src/resources/rmd/ojs.R`, `ojs_static.R` | `ojs_define()` for knitr |
| `src/resources/jupyter/lang/python/setup.py`, `julia/setup.jl` | `ojs_define()` for Jupyter |
| `packages/ojs/` | npm workspace: runtime source and Observable forks |
| `packages/ojs/quarto-ojs-runtime/src/quarto-ojs.js` | Runtime core: `interpretFromScriptTags()`, `FileAttachment` resolver |
| `src/resources/formats/html/ojs/` | Committed bundles and `quarto-ojs.css` |
| `package/src/common/prepare-dist.ts` | Copies `quarto-ojs-runtime.js` into the distribution |
| `.github/workflows/test-ojs-runtime.yml` | CI check that committed bundles match a rebuild |
