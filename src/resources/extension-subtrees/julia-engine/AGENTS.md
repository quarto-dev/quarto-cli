# quarto-julia-engine

This repo contains the Julia execution engine for Quarto. The engine was originally built directly into quarto-cli but has since been refactored into an extension-style engine, moved into this separate repo, and is pulled into quarto-cli via a git subtree at `src/resources/extension-subtrees/julia-engine/`.

The engine extension requires a compatible version of quarto (>= 1.9.0). If work involves changes to the engine–quarto interface, you'll also need a corresponding dev build of quarto-cli with matching changes.

## Repo structure

- `_extensions/julia-engine/` — the actual extension (contains `_extension.yml`, the bundled `julia-engine.js`, and Julia resource files like `Project.toml`, `*.jl`)
- `src/` — TypeScript source for the engine (`julia-engine.ts`, `constants.ts`). Changes here must be bundled into `_extensions/julia-engine/julia-engine.js` to take effect.
- `_quarto.yml` — makes the repo root a quarto project so rendering picks up the extension from `_extensions/`
- `tests/` — self-contained test suite (see Testing below)

## Building

After editing the TypeScript source in `src/`, rebuild the bundled JS:

```sh
quarto call build-ts-extension src/julia-engine.ts
```

This bundles `src/julia-engine.ts` into `_extensions/julia-engine/julia-engine.js`. CI verifies the bundled JS matches the TS source.

## Testing

Tests are self-contained Deno tests using `jsr:` imports — no import map or quarto internals needed. `tests/docs/` contains `.qmd` files and quarto projects that the `.test.ts` files in `tests/smoke/` render and verify. These directories mirror quarto-cli's `tests/docs/` and `tests/smoke/` structure and are intended to be merged into those directories when quarto-cli runs its own CI (since this extension is a fixed part of quarto-cli via git subtree).

### Running tests locally

The test runner uses the deno bundled with quarto (to avoid version mismatches):

```sh
# With quarto on PATH:
tests/run-tests.sh

# With explicit quarto path:
QUARTO=/path/to/quarto tests/run-tests.sh

# Run a specific test file:
tests/run-tests.sh smoke/julia-engine/render.test.ts
```

### Quick: render in this repo

Create or edit a `.qmd` file in the repo root (e.g. in `scratch/`) with `engine: julia` and render it:

```sh
quarto render scratch/test.qmd
```

Since this directory is a quarto project with the extension in `_extensions/`, quarto discovers and uses the engine from here.

## CI

CI runs on all three platforms (Linux, macOS, Windows) against a pinned quarto-cli revision (see `QUARTO_CLI_REV` in `.github/workflows/ci.yml`). It:

1. Configures quarto from the pinned rev
2. Verifies the bundled JS is up to date with the TS source
3. Runs the full test suite

When bumping `QUARTO_CLI_REV`, use the full commit hash annotated with the version tag for clarity (e.g. `abc123 # v1.9.35`).

## Changelog

Every PR with user-facing or otherwise meaningful changes must include an update to `CHANGELOG.md` (enforced by CI). Add entries under the `## Unreleased` section. Use the `skip-changelog` label to bypass the check for PRs that don't need an entry (e.g. internal cleanups, CI, or docs changes).
