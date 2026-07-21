# Cross-Project Dependencies

Other Posit repositories embed or ship Quarto and reach directly into
quarto-cli's installed resources and commands. These couplings are **not**
visible from within quarto-cli — nothing here references the consumer — so a
change that looks internal can break the visual editor or RStudio. This file
records the known touch-points so they can be checked before changing the
surfaces involved.

The two consumers are:

- **`quarto-dev/quarto`** — the visual editor / VS Code + Positron tooling
  monorepo (`packages/editor-server`, `packages/quarto-core`, `apps/lsp`, ...).
- **`rstudio/rstudio`** — the RStudio IDE (visual editor backend in
  `src/cpp/session/modules/`).

> When you change one of the surfaces below, grep the consumer repo(s) for the
> path/basename and coordinate a companion change if needed.

## 1. Standalone crossref/xref filter invocation

To power visual-editor cross-reference autocomplete, both consumers run `pandoc`
directly against Quarto's installed share tree (`QUARTO_SHARE_PATH`) with a
`--defaults` file that loads these filters standalone (outside `quarto render`):

- `filters/quarto-init/quarto-init.lua`
- `filters/crossref/crossref.lua`
- `filters/qmd-reader.lua` (used as `--from` when present)

Environment: `QUARTO_FILTER_PARAMS` = `{ "crossref-index-file": "index.json",
"crossref-input-type": "qmd" }`, `QUARTO_SHARE_PATH` = the resource path.

| Consumer | File |
|----------|------|
| `quarto-dev/quarto` | `packages/editor-server/src/core/xref.ts` (`indexSourceFile`) |
| `rstudio/rstudio` | `src/cpp/session/modules/quarto/SessionQuartoXRefs.cpp` |

**Contract:** the names/relative paths of these filters, their filter-params
protocol, and the `index.json` output shape are a de-facto public API. Renaming,
removing, or moving any of them, or dropping them from the packaging inline list
(see below), breaks both consumers. See
`.claude/rules/filters/cross-project-consumers.md`.

## 2. What actually ships in `share/filters`

`src/resources/filters/` is **not** shipped verbatim. `package/src/common/prepare-dist.ts`
deletes the copied `share/filters` and rebuilds it via `inlineFilters()` from a
fixed list (`filtersToInline`) plus the `modules/` directory; `buildFilter`
(`package-filters.ts`) inlines each `-- [import]` into one self-contained file.
A filter that is **not** in the inline list and **not** under `modules/` is never
installed, so it cannot be a cross-project dependency via the share path — but it
also means "grep finds no reference" does not prove a *shipped* filter is unused.

## 3. Editor support commands

`quarto-core` / the editor tooling also shell out to `quarto` subcommands
(e.g. `quarto editor-support crossref`, implemented in
`src/command/editor-support/crossref.ts`). Changing the CLI surface or output
format of editor-support commands is a cross-project change.

## Checklist when touching a shared surface

1. Identify which consumer(s) use it (tables above).
2. Grep the consumer repo for the path/basename and the CLI/protocol shape.
3. For filters: confirm inline-list membership in `prepare-dist.ts`.
4. Coordinate a companion PR in the consumer if the contract changes.

## History

- Removing `crossref-standalone.lua` and `quarto-pre/quarto-pre.lua`: verified
  safe because neither was in the packaging inline list (never shipped) and both
  consumers load `crossref.lua`/`quarto-init.lua`, not the removed files. This
  doc and the scoped rule were written as part of that investigation so the check
  does not have to be re-derived.
