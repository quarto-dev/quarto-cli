# Plan: Add Pagefind Search Support to Quarto

## Motivation

Quarto currently supports two search backends:
- **fuse.js** (default): Client-side fuzzy search. Simple but has limitations — loads entire `search.json` upfront (poor for large sites), fuzzy matching can return irrelevant results, no stemming/language awareness.
- **Algolia**: Cloud-hosted search. Powerful but requires external service, API keys, and account setup.

**Pagefind** fills the gap: a high-quality, static, client-side search engine that indexes at build time and loads index chunks lazily. It uses WASM + BM25 ranking, supports stemming in 26 languages, and produces a static bundle that requires no server or external service.

## Current Architecture Summary

### Index Generation (`src/project/types/website/website-search.ts`)
- `updateSearchIndex()` runs after rendering, parses each output HTML file
- Extracts text from `<main>`, splits into page-level and section-level (`section.level2`) entries
- Produces `search.json` — a flat array of `SearchDoc` objects: `{objectID, href, title, section, text, crumbs}`
- Supports incremental updates (preserves existing entries, updates changed files)
- Respects `search: false` per-page and draft visibility

### Client-Side Search (`src/resources/projects/website/search/`)
- `quarto-search.js` (1457 lines) — main search logic, uses Algolia Autocomplete.js as UI framework
- `fuse.min.js` — fuse.js v6.6.2 library
- `autocomplete.umd.js` — Algolia Autocomplete UI
- `quarto-search.scss` — search styling
- Dual-mode: detects fuse vs Algolia from config, dispatches to appropriate search function
- Result grouping, collapsing, breadcrumbs, keyboard shortcuts, copy-link all in `quarto-search.js`

### Dependency Injection (`website-search.ts`)
- `websiteSearchDependency()` — bundles JS files as format dependencies copied to `site_libs/`
- `websiteSearchIncludeInHeader()` — injects `<script id="quarto-search-options">` with serialized config
- `websiteSearchSassBundle()` — bundles SCSS
- Integration point: `website-navigation.ts` calls these during page rendering

### Configuration
- `_quarto.yml` → `website.search` with keys: `location`, `type`, `limit`, `collapse-after`, `copy-button`, `keyboard-shortcut`, `show-item-context`, `algolia`

### Breadcrumbs
Breadcrumbs are hierarchical navigation paths derived from the sidebar structure, showing a page's location in the site hierarchy (e.g., `["Guide", "Getting Started", "Installation"]`).

**Generation** (`website-search.ts` lines 239-275):
- `sidebarForHref()` finds the sidebar containing the current page
- `breadCrumbs()` walks the sidebar tree to build an ancestor path
- Optional `merge-navbar-crumbs` prepends the navbar section title
- Result is a `string[]` stored in `search.json` as the `crumbs` field

**Display** (`quarto-search.js`):
- Controlled by the `show-item-context` config option (`false` | `"parent"` | `"root"` | `"tree"`)
- `"tree"`: full path with " > " separator (e.g., "Guide > Getting Started > Installation")
- `"root"`: only the top-level item
- `"parent"`: only the immediate parent
- `false` (default): breadcrumbs not displayed in results

### Language / Internationalization
- Website language is configured via `lang` in `_quarto.yml` (default: `"en"`)
- Per-page override possible via document YAML frontmatter
- Stored in `format.metadata['lang']`, rendered into `<html lang="...">` by Pandoc
- The `language` key (separate from `lang`) controls UI string translations (e.g., "Search" button label)
- At index-generation time, language is accessible via `outputFile.format.metadata['lang']`

### Preview Behavior
During `quarto preview`, `updateSearchIndex()` is called with `incremental = true` — it reads the existing `search.json` and only updates entries for re-rendered files. For pagefind, we will simply skip indexing during preview; pagefind indexing only runs at the end of a full `quarto render`.

## Pagefind Architecture Summary

### Indexing
- Rust binary with a service mode, wrapped by a Node.js API
- Parses HTML files, extracts text, builds inverted word indexes
- Respects HTML attributes: `data-pagefind-body`, `data-pagefind-ignore`, `data-pagefind-meta`, `data-pagefind-filter`, `data-pagefind-weight`
- **Automatic language detection**: reads `<html lang="...">` from each page, selects appropriate stemmer, emits per-language WASM files
- Language-aware stemming (26 languages), Unicode normalization
- Node.js API: `createIndex()` → `index.addDirectory()` or `index.addHTMLFile()` → `index.writeFiles()`

### Deno Compatibility (Verified)
**The pagefind Node.js API works from Deno via `npm:pagefind` with no issues.** Tested:
- `import * as pagefind from "npm:pagefind"` — Deno auto-downloads pagefind and its platform-specific binary (`@pagefind/darwin-arm64`, etc.) via npm optional dependencies
- `createIndex()` → `addHTMLFile()` → `getFiles()` → `close()` all work
- `getFiles()` returns output files as byte arrays (can write to disk or inspect in-memory)
- No CLI shelling out needed — full programmatic control from TypeScript/Deno

### Output Bundle

Pagefind produces a directory of files. These are NOT pre-declared static assets — they are **build artifacts generated at index time** whose exact contents depend on the indexed pages and their languages.

**File categories:**

| Category | Files | Notes |
|----------|-------|-------|
| **Static** (same every build, baked into pagefind binary) | `pagefind.js` (~34KB), `pagefind-highlight.js` (~44KB), `pagefind-ui.js/css`, `pagefind-modular-ui.js/css`, `wasm.unknown.pagefind` (~53KB) | Identical for a given pagefind version |
| **Language WASM** (static per language, only emitted for detected languages) | `wasm.en.pagefind` (~56KB), `wasm.fr.pagefind`, etc. | One per language found in indexed HTML. Same bytes per pagefind version. |
| **Content-dependent** (hashed filenames) | `pagefind-entry.json`, `pagefind.{lang}_{hash}.pf_meta`, `fragment/{lang}_{hash}.pf_fragment`, `index/{lang}_{hash}.pf_index` | Vary with every index build. Compressed with gzip. |

**Key insight**: Only `pagefind.js` is a fixed entry point. Everything else — including which WASM files exist — depends on indexed content. This means pagefind output **cannot use Quarto's static dependency system** (which pre-declares fixed files to copy into `site_libs/`). Instead, pagefind's `writeFiles()` writes the entire bundle directly into the output directory as a post-render step.

**Example output** (from a 3-page test: 2 English, 1 French):
```
pagefind/
├── pagefind.js                          33,851 bytes  (static entry point)
├── pagefind-entry.json                     228 bytes  (content-dependent bootstrap)
├── pagefind-highlight.js                43,918 bytes  (static)
├── pagefind-ui.js                       84,597 bytes  (static, not needed if using Quarto UI)
├── pagefind-ui.css                      14,486 bytes  (static, not needed if using Quarto UI)
├── pagefind-modular-ui.js               14,634 bytes  (static, not needed)
├── pagefind-modular-ui.css               7,336 bytes  (static, not needed)
├── pagefind.en_9dac4d862c.pf_meta           91 bytes  (per-language metadata)
├── pagefind.fr_bf912047bc.pf_meta           80 bytes  (per-language metadata)
├── wasm.en.pagefind                     56,171 bytes  (language WASM)
├── wasm.fr.pagefind                     56,326 bytes  (language WASM)
├── wasm.unknown.pagefind                52,697 bytes  (fallback WASM)
├── fragment/en_5c4c663.pf_fragment         204 bytes  (per-page fragment)
├── fragment/en_d936a5f.pf_fragment         154 bytes
├── fragment/fr_6ad2b7e.pf_fragment         159 bytes
├── index/en_ffda487.pf_index               204 bytes  (word index chunk)
└── index/fr_c52414b.pf_index               128 bytes
```

### Client-Side Search
- WASM-based BM25 ranking, loads index chunks on demand
- Web Worker support (offloads search from main thread)
- API: `pagefind.search(term, {filters, sort})` → results with lazy `.data()` for fragments
- Results include `sub_results` (section-level matches with anchors), `excerpt` with `<mark>` tags, `meta`, `filters`

## Design Decisions

### Decision 1: Pagefind as a third search backend (not replacing fuse.js)

Add pagefind alongside fuse.js and Algolia. Users opt in via config:

```yaml
website:
  search:
    engine: pagefind  # new key, separate from UI type
```

Add a new `engine` key (values: `fuse`, `pagefind`, `algolia`) to separate the search engine choice from the UI type (`overlay` vs `textbox`). Default remains `fuse` for backward compatibility.

### Decision 2: Use pagefind's Node.js API via Deno npm specifier

Import `npm:pagefind` directly in Deno. This is the cleanest integration:
- No binary bundling — Deno's npm compat handles platform-specific binary download automatically
- Programmatic control — use `addDirectory()` to index the output directory
- No external tool installation required by users

The pagefind npm package works by spawning a Rust binary (resolved from `@pagefind/{platform}-{arch}` optional dependencies) as a subprocess and communicating via base64 JSON over stdin/stdout. Deno handles all of this transparently through its Node.js compatibility layer.

### Decision 3: Use Pagefind's JS API with Quarto's existing search UI

Keep the existing Autocomplete-based search UI. Add a `pagefindSearch()` function in `quarto-search.js` that calls `pagefind.search()` and transforms results to the format the existing UI expects. This preserves breadcrumbs, result collapsing, keyboard shortcuts, and copy-link.

### Decision 4: Output bundle goes directly into site output (not via dependency system)

Pagefind's output is a **build artifact written as a post-render step**, not a static dependency:
- Uses `projectOutputDir(context)` from `src/project/project-shared.ts` to resolve the correct output directory — this handles all cases: custom `output-dir` in `_quarto.yml`, `--output-dir` CLI flag, and project-type defaults (`_site` for websites, `_book` for books, `_manuscript` for manuscripts)
- `index.writeFiles({ outputPath: join(projectOutputDir(context), "pagefind") })` writes the entire bundle into the output directory
- This bypasses Quarto's `FormatDependency` system (which copies pre-declared static files into `site_libs/`) — necessary because pagefind's output is content-dependent (which files exist and their names depend on the indexed content and detected languages)
- The client-side `quarto-search.js` loads pagefind via dynamic `import()` of `pagefind/pagefind.js` relative to the site root, using the existing `quarto:offset` mechanism for correct path resolution

### Decision 5: Language detection

Pagefind auto-detects language from `<html lang="...">` in each indexed page. Since Quarto already renders this attribute from `format.metadata['lang']`, **no extra work is needed for basic language support**. Pagefind will:
- Detect the language per page
- Apply the correct stemmer
- Emit only the WASM files for languages actually present in the site

For advanced cases, we expose `forceLanguage` in the pagefind config to override auto-detection (useful for sites where `lang` isn't set consistently). We can read the site-wide default from `format.metadata['lang']` and pass it as a hint.

### Decision 6: HTML annotation strategy

Use `createIndex()` config options (`rootSelector`, `excludeSelectors`) rather than annotating HTML:
- `rootSelector: "main"` — indexes only main content (ignores nav, sidebar, footer)
- `excludeSelectors` — skips TOC, title block, scripts, styles

For breadcrumbs, inject a hidden element into each page's `<main>` before indexing:
```html
<meta data-pagefind-meta="crumbs" content="Guide||Getting Started||Installation">
```
Pagefind captures this as metadata. The client-side code splits on `||` to reconstruct the `crumbs` array.

For pages with `search: false`, inject `<body data-pagefind-ignore="all">` or handle by not including them in the index.

### Decision 7: Skip `search.json` when using pagefind

When `engine: pagefind`, skip `updateSearchIndex()` entirely. Pagefind builds its own binary index. No `search.json` is generated. During preview, pagefind indexing is also skipped.

## Implementation Plan

### Phase 1: Configuration & Schema

Add the `engine` config key and wire it through the schema/options pipeline. This phase produces no user-visible behavior change — fuse remains the default and the only active engine.

**Files:**
- `src/project/types/website/website-search.ts`
- `src/resources/schema/json-schemas.json` (regenerated via `dev-call build-artifacts`)

**Work items:**
- [x] Add `kEngine = "engine"` constant and `SearchEngine` type (`"fuse" | "pagefind" | "algolia"`) in `website-search.ts`
- [x] Add `engine` field to the `SearchOptions` interface
- [x] In `searchOptions()` (~line 430): parse `engine` from `searchConfig`, default to `"fuse"`, auto-detect `"algolia"` when `algolia` sub-config is present (backward compat)
- [x] In `websiteSearchIncludeInHeader()` (~line 604): serialize `engine` into the `<script id="quarto-search-options">` JSON so client-side code can read it — engine is already part of SearchOptions so it's serialized automatically
- [x] Add `engine` enum (`fuse`, `pagefind`, `algolia`) to the search schema object in `src/resources/schema/definitions.yml`
- [x] Add `pagefind` sub-object to the search schema with optional keys: `root-selector`, `exclude-selectors`, `force-language`, `ranking`
- [x] Run `package/dist/bin/quarto dev-call build-artifacts` to regenerate JSON schemas, Zod types, and TS type definitions
- [x] Also added: `websiteSearchDependency()` conditionally excludes `fuse.min.js` when engine is `pagefind` (Phase 5 partial)
- [x] Verified: test site renders successfully with `engine: pagefind` config, schema validates correctly

### Phase 2: Pagefind Indexing (Server-Side)

Wire up pagefind's Node.js API to run as a post-render step. After this phase, `quarto render` with `engine: pagefind` produces a `pagefind/` directory in the output.

**Files:**
- `src/project/types/website/website-search.ts` — new `runPagefindIndex()` function
- `src/project/types/website/website.ts` — conditional dispatch in `websitePostRender()` (~line 433)

**Work items:**
- [x] Add `"pagefind": "npm:/pagefind@1.3.0"` to `src/import_map.json` and rerun `./configure.sh`
- [x] Add static import `import * as pagefind from "pagefind"` (dynamic imports don't work with Quarto's Deno cached-only mode)
- [x] Add `runPagefindIndex(context, outputFiles)` function in `website-search.ts` with full createIndex → addDirectory → writeFiles → close pipeline
- [x] In `websitePostRender()` of `website.ts`, conditional dispatch: pagefind (non-incremental) vs fuse/algolia
- [x] Skip `search.json` generation when engine is pagefind
- [x] Verified: test site renders with `pagefind/` directory containing pagefind.js, pagefind-entry.json, WASM, index, and fragment files

### Phase 3: HTML Annotation (Breadcrumbs & Exclusions)

Before pagefind indexes, post-process rendered HTML files to inject metadata that pagefind will capture. This ensures breadcrumbs and per-page search exclusion work.

**Files:**
- `src/project/types/website/website-search.ts` — new `annotateHtmlForPagefind()` function

**Work items:**
- [x] Add `annotateHtmlForPagefind(context, outputFiles)` function that parses HTML, injects `data-pagefind-ignore` and breadcrumb meta
- [x] Uses same `search: false` / draft detection as `updateSearchIndex()`
- [x] Breadcrumbs computed with `sidebarForHref()` / `breadCrumbs()` including merge-navbar-crumbs support
- [x] Injected as `<meta data-pagefind-meta="crumbs:Crumb1||Crumb2">` as first child of `<main>`
- [x] Called from `runPagefindIndex()` before `addDirectory()`
- [x] Verified: `data-pagefind-ignore="all"` on excluded page body, breadcrumb meta on normal pages

### Phase 4: Client-Side Integration

Add pagefind as a search source in the existing Autocomplete UI. After this phase, search works end-to-end in the browser.

**Files:**
- `src/resources/projects/website/search/quarto-search.js`

**Work items:**
- [x] Add `pagefindSearch(query, limit)` — lazy-loads pagefind.js via dynamic import, passes ranking config
- [x] Add `transformPagefindResult(fragment, query)` — maps sub_results to `{ title, section, href, text, crumbs }` format
- [x] Rewrites `<mark>` to `<mark class='search-match'>` for consistent styling
- [x] Dispatch in `getItems()`: checks `engine === "pagefind"` before algolia/fuse paths
- [x] Verify: playwright end-to-end tests pass across Chromium, Firefox, WebKit (6 tests x 3 browsers = 18 passing)

### Phase 5: Dependency Management

Ensure the right JS files are bundled for each engine and pagefind's output files are not interfered with.

**Files:**
- `src/project/types/website/website-search.ts` — update `websiteSearchDependency()` (~line 646)

**Work items:**
- [x] `websiteSearchDependency()` excludes `fuse.min.js` when engine is `pagefind`
- [x] `autocomplete.umd.js` and `quarto-search.js` still included
- [x] `quarto-search.scss` unchanged (styling is engine-agnostic)
- [x] Verified: `_site/site_libs/quarto-search/` has only `autocomplete.umd.js` and `quarto-search.js`
- [ ] Optional: delete unused pagefind UI files after `writeFiles()` — deferred

### Phase 6: Testing & Validation

**Files:**
- `tests/docs/smoke-all/website/` — new test fixture
- `tests/smoke/` — new or extended test file

**Work items:**
- [x] Created test fixture: `tests/docs/smoke-all/website/pagefind-search/` with 3 pages (index, getting-started with sidebar, no-search with `search: false`)
- [x] Smoke test in `index.qmd` (inline `_quarto.tests` with `render-project: true`) asserts:
  - [x] `search-options` script tag exists
  - [x] `"engine": "pagefind"` in output HTML
  - [x] `_site/pagefind/pagefind.js` exists
  - Note: breadcrumb/pagefind-ignore assertions verified manually (not in inline tests since sub-file tests don't trigger project post-render)
- [x] Regression: llms-txt test (which uses default fuse search) passes
- [x] Manual testing: rendered quarto.org (387 pages), verified pagefind indexing succeeds
- [x] Fixed: pagefind functions were outside DOMContentLoaded handler (quartoSearchOptions scope bug)
- [x] Fixed: dynamic import() path resolution (relative to script → absolute URL via document.baseURI)
- [x] Playwright tests: `tests/integration/playwright/tests/html-search-pagefind.spec.ts` (6 tests, all browsers)

### Phase 7: Follow-up & Polish (Post-MVP)

Items that can be deferred past the initial working implementation.

- [ ] **Book support**: test with a Quarto book project; verify `rootSelector` handles book HTML structure (may need `"main > section:first-of-type"` or similar)
- [ ] **Pagefind-specific config pass-through**: expose `ranking` weights to client-side `pagefind.options()` call from YAML config
- [ ] **Pagefind UI alternative**: optionally support Pagefind's built-in `PagefindUI` for users who prefer it over Quarto's Autocomplete-based UI
- [ ] **Output cleanup**: delete unused pagefind UI assets after `writeFiles()` to save ~120KB
- [ ] **Preview mode**: investigate whether a stale pagefind index can be used during `quarto preview` (currently skipped entirely)
- [ ] **Incremental indexing**: pagefind doesn't support incremental indexing natively, but we could potentially use `addHTMLFile()` per-file for changed files and keep a cached index — likely complex, defer
- [ ] **Documentation**: add `engine: pagefind` to the Quarto website search docs on quarto.org

## Pagefind-Specific Configuration Options

Expose pagefind-specific tuning under the search config:

```yaml
website:
  search:
    engine: pagefind
    pagefind:
      root-selector: "main"                    # CSS selector for indexable content
      exclude-selectors:                        # Additional selectors to exclude
        - ".quarto-title-block"
      force-language: "en"                      # Override auto-detection
      ranking:                                  # BM25 ranking tuning (passed to client)
        page-length: 0.75
        term-frequency: 1.0
```

These are nice-to-have for the initial implementation. Sensible defaults (auto-detect language, index `<main>`, exclude nav/toc) will work for most sites.

## Open Questions

1. **Books**: Quarto books use a slightly different main content selector (`main > section:first-of-type`). Need to verify pagefind's `rootSelector` handles this correctly.

2. **Per-page search exclusion**: **Resolved.** Use `addDirectory()` + inject `data-pagefind-ignore="all"` on `<body>` during annotation (Phase 3). This keeps pagefind's own file discovery and is simpler than per-file `addHTMLFile()` calls.

3. **Import map integration**: **Resolved.** Add `"pagefind": "npm:/pagefind@1.3.0"` to `src/import_map.json`, then rerun `./configure.sh`.

4. **Pagefind UI as alternative**: Could also support Pagefind's built-in UI (`PagefindUI`) as a simpler option for users who don't need the full Quarto search UX. Deferred to Phase 7.

5. **Cleanup of pagefind UI files**: Pagefind emits `pagefind-ui.js`, `pagefind-ui.css`, `pagefind-modular-ui.js`, `pagefind-modular-ui.css` even when we only use the JS API. We may want to delete these from the output to save ~120KB. Deferred to Phase 7.

## File Change Summary

| File | Phase | Change |
|------|-------|--------|
| `src/project/types/website/website-search.ts` | 1-3, 5 | Engine config, `runPagefindIndex()`, `annotateHtmlForPagefind()`, dependency updates |
| `src/project/types/website/website.ts` | 2 | Conditional dispatch in `websitePostRender()`: pagefind vs fuse |
| `src/resources/projects/website/search/quarto-search.js` | 4 | `pagefindSearch()`, `transformPagefindResult()`, dispatch in `getSources()` |
| `src/resources/schema/` source files | 1 | Add `engine` enum and `pagefind` sub-object to search schema |
| `src/resources/types/zod/schema-types.ts` | 1 | Regenerated by `dev-call build-artifacts` |
| `src/resources/types/schema-types.ts` | 1 | Regenerated by `dev-call build-artifacts` |
| `src/import_map.json` | 2 | Possibly add pagefind mapping |
| `tests/docs/smoke-all/website/` | 6 | New test fixture with `engine: pagefind` |
| `tests/smoke/` | 6 | New smoke test for pagefind search |
