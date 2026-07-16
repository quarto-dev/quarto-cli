# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quarto is an open-source scientific and technical publishing system built on Pandoc. The CLI is TypeScript/Deno with Lua filters for document processing.

- Latest stable version: <https://quarto.org/docs/download/_download.json>
- Latest prerelease version: <https://quarto.org/docs/download/_prerelease.json>

## Setup

```bash
./configure.sh    # Linux/macOS
./configure.cmd   # Windows
```

Downloads Deno + dependencies, runs `quarto-bld configure`, vendors TypeScript deps, and symlinks `quarto` into PATH. After this, run the dev build via `package/dist/bin/quarto` (Linux/macOS) or `package/dist/bin/quarto.cmd` (Windows).

**Key config files:**

- `configuration` — version numbers for all binary/JS dependencies (Deno, Pandoc, Dart Sass, …) and the `QUARTO_VERSION` field
- `deno.jsonc` — auto-generated (see `dev-docs/update-deno_jsonc.md`)
- `src/import_map.json` / `src/dev_import_map.json` — Deno import mappings (production / development)

## Building & Testing

```bash
package/src/quarto-bld configure                 # bootstrap
package/src/quarto-bld prepare                   # prepare distribution
package/dist/bin/quarto dev-call build-artifacts # regenerate schemas + editor tooling (.cmd on Windows)
```

Use `quarto-bld` for builds, not direct Deno commands. `dev-call build-artifacts` regenerates JSON schemas (`src/resources/schema/json-schemas.json`), Zod + TypeScript types (`src/resources/types/`), and editor tooling files (VSCode IntelliSense, YAML intelligence).

**Tests** live in `tests/` and require R, Python, and Julia. See `.claude/rules/testing/overview.md` for run commands, test types, dependencies, and debugging.

**Feature format matrix** (`dev-docs/feature-format-matrix/`) documents and tests feature support across output formats. Test documents live in `qmd-files/` subdirectories with quality ratings `0` (broken/partial), `1` (good), `2` (excellent) in format metadata. Runs on CI via `.github/workflows/test-ff-matrix.yml`.

## Architecture

Entry point is `src/quarto.ts`; commands register in `src/command/command.ts`, each implemented in `src/command/<name>/cmd.ts` (`render/`, `preview/`, `publish/`, `create/`, `add/`, `tools/`, `install/`, `check/`).

Core systems, each with a registration point used to extend it:

- **Projects** (`src/project/`) — types (book, website, manuscript, …) in `types/`, registered in `types/register.ts`
- **Formats** (`src/format/`) — handlers per output type; registry in `formats.ts`, common handling in `format-handlers.ts`, register new formats in `imports.ts`
- **Filters** (`src/resources/filters/`) — Lua filters over the Pandoc AST, chained from `main.lua`; run in pipeline order `quarto-pre/`, `crossref/`, `layout/`, `quarto-post/`, `quarto-finalize/`; custom AST nodes in `customnodes/`, shared helpers in `common/`
- **Execution engines** (`src/execute/`) — Jupyter, Knitr, Observable (Python/R/Julia/JS)
- **Resources** (`src/resources/`) — templates, bundled libraries, extensions, Pandoc datadir customizations
- **Preview** (`src/preview/`) — dev server with live reload
- **Publishing** (`src/publish/`) — platform publishers (Netlify, GitHub Pages, Confluence, …), account management, deployment logic
- **Extensions** (`src/extension/`) — filter/format/shortcode discovery, install, management

Packaging lives in `package/`; build orchestration in `package/src/quarto-bld` (TypeScript); platform packaging in `package/src/{linux,macos,windows}/`.

**Key paths:** dev binary `package/dist/bin/quarto[.cmd]`; Deno binary `package/dist/bin/tools/<arch>/deno`; distribution output `package/dist/`; vendored deps `src/vendor/`; Lua API TypeScript types `src/resources/lua-types/`.

## Development Patterns

- **TypeScript/Deno:** use Deno-native APIs (avoid Node.js APIs); imports must include the `.ts` extension; dependencies resolve via import maps; CLI parsing uses Cliffy.
- **Adding a command / project type / format:** create the implementation (`src/command/<name>/cmd.ts`; `src/project/types/<name>/` implementing the `ProjectType` interface; or `src/format/<name>/`) then register it (in `command.ts`, `project/types/register.ts`, or `format/imports.ts` respectively).
- **Lua filters:** run during Pandoc processing, use the `quarto` Lua module, share helpers in `filters/common/`. API docs: <https://quarto.org/docs/extensions/lua-api.html>
- **LaTeX error detection:** patterns in `src/command/render/latexmk/parse-error.ts` (inspired by TinyTeX's `regex.json`); daily workflow `.github/workflows/verify-tinytex-patterns.yml` checks for upstream updates. See `dev-docs/tinytex-pattern-maintenance.md`.
- **Debugging flaky tests:** methodology in `dev-docs/debugging-flaky-tests.md`.

## Conventions

- Main branch is `main`. Version is the `QUARTO_VERSION` field in the `configuration` file.
- **Changelog:** files at `news/changelog-{version}.md` (check `configuration` for the current `QUARTO_VERSION`). Full conventions in `.claude/rules/changelog.md`.
- Contributing / PR guidelines: `.github/CONTRIBUTING.md`.

## Documentation & Memory Files

- Docs: <https://quarto.org/llms.txt> (stable), <https://prerelease.quarto.org/llms.txt> (dev features). DeepWiki: <https://deepwiki.com/quarto-dev/quarto-cli>.
- `dev-docs/` — release/backport checklists, dependency-update procedures, internals guides, performance monitoring.
- `llm-docs/` — architectural deep dives, read on demand when a rule or task points to them.
- **Memory file layout:** `.claude/CLAUDE.md` always loaded (overview + essential commands); `.claude/rules/<feature>/*.md` loaded when their `paths:` frontmatter matches (feature conventions); `llm-docs/` read on demand (deep dives). Personal overrides go in gitignored `CLAUDE.local.md`. Setup + maintenance: `dev-docs/claude-code-setup.md`.
