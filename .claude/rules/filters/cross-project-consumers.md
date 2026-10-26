---
paths:
  - "src/resources/filters/**"
  - "package/src/common/prepare-dist.ts"
  - "package/src/common/package-filters.ts"
---

# Filters Consumed by Other Projects (do not delete without checking)

Some Lua filters in `src/resources/filters/` are invoked **standalone** (as bare
`pandoc --lua-filter` / `--defaults` passes, outside Quarto's `render` pipeline)
by **other repositories** that ship or embed Quarto. "Nothing in quarto-cli
references this file" is therefore **not** sufficient proof that a filter is dead
code. Always run the checklist below before removing or renaming anything under
`src/resources/filters/`.

## Cross-project consumers

Both consumers build the crossref/xref index used for visual-editor autocomplete
by calling `pandoc` directly against Quarto's installed share tree
(`QUARTO_SHARE_PATH`), loading these filters:

- `filters/quarto-init/quarto-init.lua`
- `filters/crossref/crossref.lua`
- `filters/qmd-reader.lua` (used as the `--from` reader when present)

with `QUARTO_FILTER_PARAMS` set to `{ "crossref-index-file": ..., "crossref-input-type": "qmd" }`.

| Consumer | File | What it does |
|----------|------|--------------|
| Visual editor (`quarto-dev/quarto`) | `packages/editor-server/src/core/xref.ts` (`indexSourceFile`) | Writes a `defaults.yml` listing `quarto-init.lua` + `crossref.lua`, runs pandoc to emit `index.json`. |
| RStudio (`rstudio/rstudio`) | `src/cpp/session/modules/quarto/SessionQuartoXRefs.cpp` | Same defaults + filters, from the C++ side. |

The visual editor also bundles its **own** unrelated filters
(`parser.lua`, `sourcepos.lua`, `heading-ids.lua` in `editor-server`) — those are
not ours and are not relevant here.

## Why "no in-repo reference" is not enough

The installer does **not** ship `src/resources/filters/` verbatim. In
`package/src/common/prepare-dist.ts`:

1. The copied `share/filters` source tree is **deleted** (`pathsToClean`).
2. `inlineFilters()` rebuilds `share/filters` from a **fixed list**
   (`filtersToInline`: `main, pagebreak, quarto-init, crossref, customwriter,
   qmd-reader, llms, leveloneanalysis`) plus the `modules/` directory.
   `buildFilter` (`package-filters.ts`) inlines every `-- [import]` into one
   self-contained file.

So the shipped `crossref/crossref.lua` is already a **standalone, fully-inlined**
bundle — the build auto-generates the standalone crossref filter from
`crossref.lua`. A hand-maintained "standalone" duplicate is redundant. Anything
**not** in the inline list (and not under `modules/`) is never shipped and cannot
be a cross-project dependency via the share path.

## Removal checklist

Before deleting/renaming a filter under `src/resources/filters/`:

1. Is it in the `filtersToInline` list (or reachable via `modules/`) in
   `prepare-dist.ts`? If **not**, it was never shipped — confirm it is also unused
   at render time before removing.
2. Is it (or its basename) referenced by `quarto-dev/quarto` or
   `rstudio/rstudio`? Grep both for the basename and for `filters/<dir>/<name>`.
   See `dev-docs/cross-project-dependencies.md`.
3. A GitHub-wide code search for the basename catches extension-ecosystem usage.

Precedent: `crossref-standalone.lua` and `quarto-pre/quarto-pre.lua` were removed
after confirming (a) neither was in the inline list, so neither was ever shipped,
and (b) both consumers use `crossref.lua`/`quarto-init.lua`, not the removed files.
