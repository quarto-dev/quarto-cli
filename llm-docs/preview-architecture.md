---
main_commit: 16257efdc
analyzed_date: 2026-06-15
key_files:
  - src/command/preview/cmd.ts
  - src/command/preview/preview.ts
  - src/project/serve/serve.ts
  - src/project/serve/watch.ts
  - src/project/project-shared.ts
  - src/project/types.ts
  - src/execute/jupyter/jupyter.ts
  - src/execute/engine.ts
---

# Preview Architecture

How `quarto preview` works, from CLI entry through rendering and file watching.

## Entry Points

- `src/command/preview/cmd.ts` — CLI command handler, routing logic
- `src/command/preview/preview.ts` — Single-file preview lifecycle
- `src/project/serve/serve.ts` — Project preview via `serveProject()`
- `src/project/serve/watch.ts` — Project file watcher

## cmd.ts Branching (5 Paths)

The command handler in `cmd.ts` determines which preview mode to use. The key variables `file` and `projectTarget` are mutated as a state machine to route between paths.

```
quarto preview [input]
       │
       ▼
   isFile(input)?
   ├── YES ──► Create ProjectContext, detect format
   │           ├── Shiny? ──► previewShiny() / serve() ──► EXIT (Path C)
   │           ├── Serveable project, file NOT in inputs?
   │           │   └── .md + external previewer ──► file = project.dir (Path B1)
   │           ├── Serveable project, file IN inputs?
   │           │   └── HTML/serve output ──► renderProject() then file = project.dir (Path B2)
   │           └── None of above ──► file stays as-is (Path A)
   │
   └── NO (directory) ──► straight to isDirectory check (Path D)
       │
       ▼
   isDirectory(file)?  ← file may have been mutated above
   ├── YES ──► serveProject(projectTarget, ...) ← projectTarget may be ProjectContext
   └── NO  ──► preview(file, ..., project)      ← single-file preview
```

### Path details

| Path | Input | Condition | `file` mutated? | Terminal action |
|------|-------|-----------|-----------------|-----------------|
| A | file | Not in serveable project | No | `preview()` |
| B1 | file | `.md` not in project inputs + external previewer | `file = project.dir` | `serveProject()` |
| B2 | file | In project inputs, HTML/serve output | `file = project.dir` | `serveProject()` (after pre-render) |
| C | file | Shiny document | N/A (exits early) | `previewShiny()`/`serve()` |
| D | directory | User passed directory or cwd | N/A (isFile skipped) | `serveProject()` |

The `file` mutation pattern (`file = project.dir`) is intentional design by JJ Allaire (2022, commit `5508ace5bd`). It converts a single-file preview into a project preview when the file lives in a serveable project, so the browser gets full project navigation.

`projectTarget` (`string | ProjectContext`) carries the context to `serveProject()`, which accepts both types. When it receives a string, it resolves the project itself.

## Single-File Preview Lifecycle (Path A)

### Context creation

`cmd.ts` creates a `ProjectContext` for format detection (routing decisions). This context is passed to `preview()` via the `pProject` parameter to avoid creating a duplicate.

```typescript
// cmd.ts creates context for routing
project = (await projectContext(dirname(file), nbContext)) ||
  (await singleFileProjectContext(file, nbContext));

// preview() reuses it
export async function preview(
  file, flags, pandocArgs, options,
  pProject?: ProjectContext,  // reused from cmd.ts
)
```

This mirrors `render()`'s `pContext` pattern in `render-shared.ts`.

### Startup sequence

1. `preview()` receives or creates `ProjectContext`
2. `previewFormat()` determines output format (calls `renderFormats()` if `--to` not specified)
3. `renderForPreview()` does the initial render
4. `createChangeHandler()` sets up file watchers
5. HTTP dev server starts

### Re-render on file change

When the watched source file changes:

1. `createChangeHandler` triggers the `render` closure
2. `renderForPreview()` is called with the **same** `project` from the closure
3. `invalidateForFile(file)` cleans up the transient notebook and removes the cache entry
4. `render()` runs with the project context, which creates a fresh target/notebook
5. Browser reloads

The project context persists across all re-renders. Only the per-file cache entry is invalidated.

## Render Request Compatibility Check

The HTTP dev server receives explicit render requests from the IDE/extension on every preview-triggered render. Before serving one, `previewRenderRequestIsCompatible(request, project, format)` (in `src/command/preview/preview.ts`) decides whether the running preview process can satisfy the new request or whether the extension must restart it.

| `request.format` | Resolution path | Cache consulted? |
|------------------|-----------------|------------------|
| Pinned by caller | Compare directly with `flags.to` | No (`previewFormat` short-circuits) |
| Undefined        | Resolve via `previewFormat → renderFormats → fileExecutionEngineAndTarget` | Yes (`fileInformationCache`) |

Mismatch → 404, extension restarts the process with the new format. Match → 200, in-process re-render proceeds via the file-watcher path described above.

### Stale-cache hazard (#14533)

Cache invalidation runs inside `renderForPreview` — *after* the compatibility check has returned its answer. So a frontmatter `format:` edit since the previous render was not visible to the compatibility check: it read the old format from cache, returned 200, then `renderForPreview` invalidated and re-populated the cache for the next request. The bug surfaced as "format change detected on second request, not first".

Fix: invalidate `fileInformationCache` for `request.path` at the top of `previewRenderRequestIsCompatible`, but only when `request.format === undefined` **and** no render is currently in flight (`HttpDevServerRenderMonitor.isRendering()` is false). When the caller pins the format, `previewFormat` short-circuits before consulting the cache; invalidation would just churn transient `.quarto_ipynb` cleanup unnecessarily.

The in-flight gate avoids a race: `invalidateForFile` calls `safeRemoveSync` on the cached `target.input`, which is the transient `.quarto_ipynb` that an in-flight render is writing or reading. On Windows this throws (file lock); on Linux it orphans the inode. Since the in-flight render's own `renderForPreview` already invalidated and repopulated the cache at its start, the cache reflects the in-flight render's view until it completes. A frontmatter edit made during the in-flight window is picked up on the next compatibility check after the render finishes.

`HttpDevServerRenderMonitor.isRendering()` is **counter-based**, not a single-timestamp flag. `submitRender` (`src/project/serve/render.ts`) calls `onRenderStart` synchronously at queue time, but `onRenderStop` only fires when each render's outer promise resolves. With two queued renders, a single-timestamp tracker would clear the gate when render A finishes even though render B is still queued or running. The counter increments on every start and decrements on every stop; `isRendering()` returns true while at least one render is outstanding.

For unchanged frontmatter, `previewFormat` repopulates the cache with the same value and the compatibility verdict is identical — only the cache lookup runs again. Cost: one cache re-read per IDE-driven render request, no functional change.

## Project Preview Re-render Path (Paths B/D)

Project preview (website/book) does NOT go through `renderForPreview()`. A single
source edit produces **two** Pandoc invocations from two different call sites, and
they share state in a way that caused #10392.

1. **Watcher invocation** (`watch.ts`, `watchProject()`). The file watcher fires on
   the edit. The single-input branch calls `render(inputs[0], …)` **without**
   passing `pContext`, so a fresh `ProjectContext` (empty `fileInformationCache`) is
   built inside `render()`. `projectResolveFullMarkdownForFile` reads source from
   disk — this invocation sees the edit. It writes the correct HTML.

2. **HTTP-handler invocation** (`serve.ts`). The watcher signals reload, the browser
   refetches, and the serve handler calls `renderProject(watcher.project(), …,
   [inputFile])`. `watcher.project()` is the **persistent** context whose
   `fileInformationCache.fullMarkdown` was populated at preview startup. Before the
   #10392 fix this invocation read pre-edit expanded markdown from that cache and
   overwrote invocation #1's fresh HTML with stale content.

```
edit saved
   │
   ▼
watch.ts ── render(input)         ── fresh ctx, reads disk  ──► correct HTML  (#1)
   │
   ▼ (reload signal → browser refetch)
serve.ts ── renderProject(watcher.project(), [input])
                   │
                   └─ persistent ctx, cached fullMarkdown ──► STALE HTML overwrites (#2)
```

### The #10392 fix (two layers)

1. **Surgical** — `watch.ts` invalidates the persistent context's cache for each
   changed input before rendering:

   ```typescript
   for (const input of inputs) {
     project.fileInformationCache?.invalidateForFile(input);
   }
   ```

   This runs **inside** the `submitRender()` callback so it is serialized on the
   render queue. `invalidateForFile` may delete a transient `.quarto_ipynb`; running
   it outside the queue could race a concurrent in-flight render still reading that
   notebook. Invalidation drops the WHOLE entry (`metadata`, `codeCells`, `engine`,
   `target`, `fullMarkdown`), so it covers more than the freshness guard alone.

2. **Defense-in-depth** — the `fullMarkdown` mtime+size guard (above). Even if a
   future caller forgets to invalidate, invocation #2 re-reads on the mtime/size
   mismatch. The two layers are complementary, not redundant: the guard refreshes
   only `fullMarkdown`; `invalidateForFile` refreshes all fields.

### Out of scope for #10392

The freshness guard fingerprints the edited input file itself. It does NOT detect
edits to a file's non-input dependencies, because the input's own mtime/size is
unchanged:

- `{{< include >}}`d files — the includer's cache is not invalidated when the
  includee changes (tracked in #2795).
- `template-partials:` files (tracked in #14561).

These need a dependency→consumer map in the watch list, not a per-file stat.

## FileInformationCache and invalidateForFile

`FileInformationCacheMap` stores per-file cached data:

| Field | Content | Cost of re-computation |
|-------|---------|----------------------|
| `fullMarkdown` | Expanded markdown with includes | Re-reads file, re-expands includes |
| `sourceMtime` | Source file mtime (ms) when `fullMarkdown` was cached | Stat of source file |
| `sourceSize` | Source file byte size when `fullMarkdown` was cached | Stat of source file |
| `includeMap` | Include source→target mappings | Recomputed with markdown |
| `codeCells` | Parsed code cells | Recomputed from markdown |
| `engine` | Execution engine instance | Re-determined |
| `target` | Execution target (includes `.quarto_ipynb` path) | Re-created by `target()` |
| `metadata` | YAML front matter | Recomputed from markdown |
| `brand` | Per-file brand resolved from the file's frontmatter `brand:` | Re-loaded from disk |

The `brand` row here is the **per-file** resolution (`resolveBrand(fileName)`), keyed
on the file's own frontmatter `brand:` and invalidated each re-render by
`invalidateForFile`. It is distinct from the project-level `project.brandCache`
(see "Project-lifetime caches"), which is the cache that went stale in #14593.

### fullMarkdown freshness guard (added for #10392)

`projectResolveFullMarkdownForFile()` (`project-shared.ts`) no longer trusts a
populated `fullMarkdown` unconditionally. It stats the source file on every call
and returns the cached value only when both `sourceMtime` and `sourceSize` match
the current file. On any mismatch (or if the stat fails) it re-reads and
re-expands, then stores the new mtime+size alongside the result.

Size is checked alongside mtime to catch an edit that lands within a single
mtime tick on a coarse-resolution filesystem (FAT32 ~2 s, some network mounts)
while still changing the byte count.

This is defense-in-depth for the project-preview path (below), where a
persistent context's cache is reused across renders and a caller may forget to
invalidate. The guard refreshes only `fullMarkdown`; stale `metadata`,
`codeCells`, `engine`, or `target` still require an explicit `invalidateForFile()`.

### invalidateForFile() (added for #14281)

Before each preview re-render, the cache entry for the changed file must be invalidated so fresh content is picked up. `invalidateForFile()` does two things:

1. Deletes any transient `.quarto_ipynb` file from disk (if the cached target is transient)
2. Removes the cache entry

Without step 1, the Jupyter engine's `target()` function sees the old file on disk and its collision-avoidance loop creates numbered variants (`_1`, `_2`, etc.) that accumulate.

### cleanupFileInformationCache()

Called at project cleanup (preview exit). Delegates to `invalidateForFile()` for each cache entry, removing all transient files and clearing the cache. This is the final cleanup — `invalidateForFile()` handles per-render cleanup for individual files.

## Project-lifetime caches (outside `fileInformationCache`)

Two render-affecting caches hang directly off `ProjectContext` (`src/project/types.ts`),
**not** inside the per-file `fileInformationCache`:

| Field | Content | Lifetime |
|-------|---------|----------|
| `brandCache` | Project-level brand resolved from `_brand.yml` candidates | Write-once |
| `outputNameIndex` | Map of output name → input file + format | Write-once |

Both are populated on first use and read forever after. Nothing in the preview
re-render path clears them — only a full context rebuild does
(`refreshProjectConfig` in `watch.ts` replaces the whole `ProjectContext` when a
config file changes). The per-file `invalidateForFile` does **not** touch them.

### `brandCache` staleness (#14593)

`projectResolveBrand` (`project-shared.ts`, the `fileName === undefined` branch)
populated `project.brandCache` on first resolve and early-returned it forever. In
a long-lived preview context a `_brand.yml` added or removed mid-session was
ignored until the process restarted. RStudio's "Render" button runs
`quarto preview --no-watch-inputs` over the same persistent context, so it
observed the same stale brand.

Unlike a source edit, the render-request path carries **no change signal**: the
input `.qmd` is unchanged, and the watcher does not watch `_brand.yml` (a
separate watcher-coverage issue). Active invalidation has nothing to hook onto. The only
place that can notice the brand file appearing/disappearing is **at resolve time,
by checking the filesystem** — so the fix is a passive staleness guard inside
`projectResolveBrand`, mirroring the `fullMarkdown` mtime+size guard.

The guard derives a *source-state token* over the candidate brand paths the
resolver already consults (the four `_brand.{yml,yaml}` / `_brand/_brand.{yml,yaml}`
defaults under `project.dir`, or the `brand:` string path, or the `{light,dark}`
paths) — combining each file's existence + mtime + size into one comparable
string. The cache is reused only when the freshly-computed token matches; on any
mismatch (add, remove, or content edit) the brand is re-resolved and the new
token stored. Format-independent, since `projectResolveBrand` takes no format
argument — typst and HTML are both covered.

## Transient Notebook Lifecycle (.quarto_ipynb)

When rendering a `.qmd` with a Jupyter kernel, the engine creates a transient `.ipynb` notebook:

1. `target()` in `jupyter.ts` generates the path: `{stem}.quarto_ipynb`
2. If the file already exists, a collision-avoidance loop appends `_1`, `_2`, etc.
3. The target is marked `data: { transient: true }`
4. `execute()` runs the notebook through Jupyter
5. `cleanupNotebook()` flips `transient = false` if `keep-ipynb: true`
6. At preview exit, `cleanupFileInformationCache()` deletes files where `transient = true`

## Context Computation Count (Summary)

| Scenario | Startup computations | Per-change |
|----------|---------------------|------------|
| Single file, no project | 1 (cmd.ts, passed to preview) | 0 (cached project reused) |
| Single file in serveable project | 1 (cmd.ts, passed to serveProject) | See project rows |
| Project directory | 1 (serve.ts) | See project rows |
| Project: single input changed | — | 1 (watcher render() without pContext) + 0 (serve.ts HTTP-handler renderProject reuses persistent ctx) |
| Project: multiple inputs changed | — | 0 new (watcher renderProject reuses cached) |
| Project: config file changed (HTML) | — | 1 (refreshProjectConfig) |

The single-input row's `+ 0` reflects two render invocations but only one new
context computation: the watcher render builds a fresh context, while the
HTTP-handler render reuses the persistent one (0 new computations). Both
invocations must still produce fresh output — see "Project Preview Re-render
Path" for the #10392 stale-cache interaction between them.

## Key Files

| File | Purpose |
|------|---------|
| `src/command/preview/cmd.ts` | CLI handler, routing state machine |
| `src/command/preview/preview.ts` | Single-file preview lifecycle, `renderForPreview()`, `previewFormat()` |
| `src/project/serve/serve.ts` | `serveProject()` — project preview server |
| `src/project/serve/watch.ts` | `watchProject()` — file watcher, `refreshProjectConfig()` |
| `src/command/render/render-shared.ts` | `render()` — accepts optional `pContext` |
| `src/command/render/render-contexts.ts` | `renderContexts()`, `renderFormats()` — calls `fileExecutionEngineAndTarget()` |
| `src/execute/engine.ts` | `fileExecutionEngineAndTarget()` — caching wrapper |
| `src/execute/jupyter/jupyter.ts` | `target()` — creates `.quarto_ipynb`, collision-avoidance loop |
| `src/project/project-shared.ts` | `FileInformationCacheMap`, `invalidateForFile()`, `cleanupFileInformationCache()` |
| `src/project/types/single-file/single-file.ts` | `singleFileProjectContext()` — creates minimal context |
