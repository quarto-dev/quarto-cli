---
main_commit: e768e5c2d
analyzed_date: 2026-05-06
key_files:
  - src/command/render/render-shared.ts
  - src/project/project-context.ts
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
| 2026-05 (1.9.x) | this PR | extend synthetic-project trigger to `pContext.isSingleFile` (closes the regression for preview) |

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
| `src/project/project-context.ts` | `projectContext(force=true)` walks dir → synthetic project; `projectContextForDirectory()` is the wrapper |
| `src/project/types/single-file/single-file.ts` | `singleFileProjectContext()` — minimal context, `isSingleFile: true` |
| `src/project/types.ts` | `ProjectContext.isSingleFile` discriminator |
| `src/command/preview/preview.ts` | Pre-creates project context, passes as `pContext` to `render()` |
| `src/command/preview/preview-shiny.ts` | Shiny preview path; also goes through `renderForPreview` so the same `render()` flow applies |
