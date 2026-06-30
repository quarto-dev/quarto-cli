---
main_commit: b08c41a26
analyzed_date: 2026-06-30
key_files:
  - src/command/render/render-shared.ts
  - src/command/render/project.ts
  - src/project/project-context.ts
  - src/project/project-shared.ts
  - src/project/types/single-file/single-file.ts
  - src/project/types.ts
  - src/command/preview/preview.ts
  - src/command/preview/preview-shiny.ts
---

# Synthetic Project Context (`--output-dir` without `_quarto.yml`)

How `quarto render foo.qmd --output-dir baz/` and `quarto preview foo.qmd
--output-dir baz/` work in a directory without `_quarto.yml`.

## What it is

`projectContextForDirectory()` (in `src/project/project-context.ts`) wraps
`projectContext(path, ctx, opts, /*force*/ true)`. When `force` is true,
`projectContext` walks the directory and produces a `ProjectContext` even
when no `_quarto.yml` is present — the resulting context has
`config: { project: {} }`, `files.input` populated, and `isSingleFile: false`.

This is the **synthetic project** mechanism. It exists to allow the
project-only flag `--output-dir` to function on free-floating files.

## Why two single-file mechanisms exist

`singleFileProjectContext()` (in `src/project/types/single-file/single-file.ts`)
also produces a `ProjectContext` for a single file. They are not duplicates:

| Mechanism | Purpose | `config` | `files.input` | `isSingleFile` |
|-----------|---------|----------|---------------|----------------|
| `singleFileProjectContext` | Default fallback for single-file renders, extension support | `{ project: {} }` (1.9+) | `[]` | `true` |
| `projectContextForDirectory` | Synthetic project for `--output-dir` without `_quarto.yml` | `{ project: {} }` (walked) | `[walked .qmd files]` | `false` |

The shapes diverged for historical reasons:

- `singleFileProjectContext` got `config` populated in 1.9 (Gordon, commit
  `1f94440b8`) so extensions can contribute metadata to single-file renders.
  This was for **extensions**, not `--output-dir`.
- `projectContextForDirectory` predates that (1.4, JJ, commit `71b4df65f`)
  and is purpose-built for the `--output-dir` use case.

## When the synthetic project is used in `render-shared.ts`

`render()` chooses between mechanisms in this order:

```typescript
let context = pContext || (await projectContext(path, nbContext, options));

// Promote to synthetic project when --output-dir is used and we don't
// have a real project (or the caller pre-passed only a single-file context).
if (options.flags?.outputDir && (!context || context.isSingleFile)) {
  context = await projectContextForDirectory(path, nbContext, options);
  options.forceClean = options.flags.clean !== false;
}

// Otherwise, fall back to single-file context.
if (!context) {
  context = await singleFileProjectContext(path, nbContext, options);
}
```

The `context.isSingleFile` arm covers the preview path (`preview.ts`
pre-creates a `singleFileProjectContext` and passes it as `pContext`).
Without the `isSingleFile` arm, the synthetic-project trigger is skipped
and the path falls through to `validateDocumentRenderFlags`, which throws
`The --output-dir flag can only be used when rendering projects.` —
regression behind `quarto-dev/quarto-cli#14489`.

## How `--output-dir` reaches `hasProjectOutputDir`

A common misread: "a single-file render has no output dir, so the output-dir
cleaning condition in `renderProject` can't fire." It can — because the CLI
`--output-dir` flag is **written into the project config**, so the synthetic
project genuinely carries an output dir.

`hasProjectOutputDir(context)` is just:

```typescript
// src/project/project-shared.ts:104-105
export function hasProjectOutputDir(context: ProjectContext): boolean {
  return !!context.config?.project[kProjectOutputDir];   // "output-dir"
}
```

and `projectContext` injects the flag into that config:

```typescript
// src/project/project-context.ts:276-278
if (flags?.outputDir) {
  projectConfig.project[kProjectOutputDir] = flags.outputDir;
}
```

(The single-file context constructor at `project-context.ts:522` likewise sets
`[kProjectOutputDir]: flags?.outputDir`.)

So for `quarto render foo.qmd --output-dir baz/`, the synthetic project's
`config.project["output-dir"]` is `"baz"` → `hasProjectOutputDir(context)` is
**true** → the gate in `renderProject`'s cleaning condition passes.

`hasProjectOutputDir` therefore does **not** distinguish single-file from real
projects — it only means "an output dir is configured." Both have one when
`--output-dir` (or `_quarto.yml` `output-dir:`) is set. The actual safe/unsafe
discriminator for *cleaning* is `cleanOutputDir` (project-type ownership), not
`hasProjectOutputDir`.

### Codepath: which single-file render reaches the condition

| Invocation | Context used | `isSingleFile` | Pipeline | Reaches clean condition? |
|---|---|---|---|---|
| `render foo.qmd` (no `--output-dir`) | `singleFileProjectContext` | `true` | `renderFiles` | **No** (and no output dir anyway) |
| `render foo.qmd --output-dir baz/` | `projectContextForDirectory` (synthetic) | `false` | `renderProject` | **Yes** (`hasProjectOutputDir` true) |

The `--output-dir` single-file render is **not** a `singleFileProjectContext`
— `render-shared` promotes it to the synthetic project (`isSingleFile:false`),
which is exactly why it enters `renderProject` and hits the output-dir cleaning
condition.

## `forceClean` and `.quarto` cleanup

When the synthetic project is created, `options.forceClean` is set:

```typescript
options.forceClean = options.flags.clean !== false;
```

This signals `project.ts` cleanup logic to remove the temporary `.quarto`
scratch directory at the end of the render (#9745, #13625). On Windows,
file handles must close before the directory is removed; the project
context's `cleanup()` is called first.

For the preview path, `forceClean=true` is set on every re-render's
`RenderOptions`. This means `.quarto` is recreated and cleaned each
re-render. Sub-optimal for perf but correct behaviorally.

### `forceClean` and output-directory cleaning (#13623)

History matters here: `forceClean` was **born in 1.4** (commit `71b4df65f`)
for ONE job — cleaning the **output directory** for single-file `--output-dir`
renders. JJ's comment, "force clean as `--output-dir` implies fully overwrite
the target", wired it into `renderProject()`'s output-dir cleaning condition,
which read:

```typescript
if (
  projectRenderConfig.behavior.renderAll && hasProjectOutputDir(context) &&
  (projectRenderConfig.options.forceClean ||                  // <- removed (#13623)
    (projectRenderConfig.options.flags?.clean == true) &&
      (projType.cleanOutputDir === true))
) { /* safeRemoveDirSync(realOutputDir, realProjectDir) */ }
```

The `.quarto` scratch-cleanup role (the section above) was added **later**
(commit `70e69d62e`, 2024) and reused the same flag. So `forceClean` ended up
driving two cleanups — the original output-dir wipe and the later scratch
removal — but the output-dir wipe came first, not the scratch cleanup.

`projectRenderConfig.options` is the **same `RenderOptions` reference** that
`render-shared.ts` set `forceClean` on (`computeProjectRenderConfig` returns
`inputs.options` verbatim; `renderProject` passes its `pOptions` parameter
straight through). So `quarto render foo.qmd --output-dir baz/` with no
`_quarto.yml` reached this condition with `forceClean === true` and wiped any
pre-existing contents of `baz/`.

Why that is a bug: the single-file synthetic project resolves to the
**default** project type, which does NOT set `cleanOutputDir` — a real
`_quarto.yml` default project with `output-dir:` preserves files. The
output-dir wipe reused whole-directory cleaning that is only safe for project
types owning their output dir (website/book/manuscript → `_site`/`_book`). A
user-supplied `--output-dir` for a single file is arbitrary and may hold
unrelated files, so wiping it is silent data loss (#13623). The cleaning was
deliberate in 2023; the loss of *unrelated* files was an unforeseen
consequence of the analogy to quarto-owned project dirs.

Fix: `forceClean` was removed from the output-dir condition (extracted into
`shouldCleanProjectOutputDir`), so the output dir is cleaned **only** when a
project type opts in via `cleanOutputDir` together with `--clean`. Single-file
`--output-dir` now matches the default project type and preserves files.
`forceClean`'s `.quarto` scratch-cleanup role is unaffected.

## `validateDocumentRenderFlags` — the original gate

```typescript
function validateDocumentRenderFlags(flags?: RenderFlags) {
  if (flags) {
    const projectOnly = {
      "--output-dir": flags.outputDir,
      "--site-url": flags.siteUrl,
    };
    for (const arg of Object.keys(projectOnly)) {
      if (projectOnly[arg]) {
        throw new Error(
          `The ${arg} flag can only be used when rendering projects.`,
        );
      }
    }
  }
}
```

Originally `--output-dir` was strictly project-only and this was the
gate. The synthetic-project mechanism is the deliberate back-door for
`--output-dir`; `--site-url` has no back-door so the gate still applies.

## Key history

| Date | Commit | Change |
|------|--------|--------|
| 2023-11 (1.4) | `71b4df65f` | JJ: support `--output-dir` for single-file renders via synthetic project |
| 2025-08 (1.9) | `1f94440b8` | Gordon: `singleFileProjectContext` gets `config = { project: {} }` for extensions (unrelated to `--output-dir`) |
| 2025-09 (1.9) | `017349c6f` | Gordon: extensible engine architecture foundation |
| 2025-12 (1.9) | `77633b39a` | Carlos: preview pre-creates project context — introduced the regression |
| 2026-01 (1.9.37) | `c3384a5ff` | Christophe: restore synthetic-project creation for the `pContext === null` path (only partially fixed the regression) |
| 2026-05 (1.9.x) | `e768e5c2d` | extend synthetic-project trigger to `pContext.isSingleFile` (closes the regression for preview) |
| 2026-06 (1.10) | this PR | drop `forceClean ||` from the output-dir cleaning condition so single-file `--output-dir` stops wiping pre-existing files (#13623) |

## Related test surface

- `tests/smoke/render/render-output-dir.test.ts` — covers the render
  path (`pContext` null + `--output-dir`).
- `tests/unit/render-shared-output-dir.test.ts` — covers the preview
  pattern (`pContext = singleFileProjectContext`, `--output-dir`).
- Manual fixtures: `tests/docs/manual/preview/` (matrix entries
  describing reproductions).

## Key files

| File | Purpose |
|------|---------|
| `src/command/render/render-shared.ts` | `render()` — chooses synthetic vs single-file vs full project |
| `src/project/project-context.ts` | `projectContext(force=true)` walks dir → synthetic project; `projectContextForDirectory()` is the wrapper; injects `--output-dir` flag into `config.project["output-dir"]` |
| `src/project/project-shared.ts` | `hasProjectOutputDir()` / `projectOutputDir()` — read `config.project["output-dir"]` |
| `src/project/types/single-file/single-file.ts` | `singleFileProjectContext()` — minimal context, `isSingleFile: true` |
| `src/project/types.ts` | `ProjectContext.isSingleFile` discriminator |
| `src/command/preview/preview.ts` | Pre-creates project context, passes as `pContext` to `render()` |
| `src/command/preview/preview-shiny.ts` | Shiny preview path; also goes through `renderForPreview` so the same `render()` flow applies |
