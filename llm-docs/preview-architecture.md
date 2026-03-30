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

## FileInformationCache and invalidateForFile

`FileInformationCacheMap` stores per-file cached data:

| Field | Content | Cost of re-computation |
|-------|---------|----------------------|
| `fullMarkdown` | Expanded markdown with includes | Re-reads file, re-expands includes |
| `includeMap` | Include source→target mappings | Recomputed with markdown |
| `codeCells` | Parsed code cells | Recomputed from markdown |
| `engine` | Execution engine instance | Re-determined |
| `target` | Execution target (includes `.quarto_ipynb` path) | Re-created by `target()` |
| `metadata` | YAML front matter | Recomputed from markdown |
| `brand` | Resolved `_brand.yml` data | Re-loaded from disk |

### invalidateForFile() (added for #14281)

Before each preview re-render, the cache entry for the changed file must be invalidated so fresh content is picked up. `invalidateForFile()` does two things:

1. Deletes any transient `.quarto_ipynb` file from disk (if the cached target is transient)
2. Removes the cache entry

Without step 1, the Jupyter engine's `target()` function sees the old file on disk and its collision-avoidance loop creates numbered variants (`_1`, `_2`, etc.) that accumulate.

### cleanupFileInformationCache()

Called at project cleanup (preview exit). Iterates ALL cache entries and removes transient files. This is the final cleanup — `invalidateForFile()` handles per-render cleanup.

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
| Project: single input changed | — | 1 (render() without pContext) |
| Project: multiple inputs changed | — | 0 (renderProject reuses cached) |
| Project: config file changed (HTML) | — | 1 (refreshProjectConfig) |

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
