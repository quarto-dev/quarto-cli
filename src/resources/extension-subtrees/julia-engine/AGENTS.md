# quarto-julia-engine

This repo contains the Julia execution engine for Quarto. The engine was originally built directly into quarto-cli but has since been refactored into an extension-style engine, moved into this separate repo, and is pulled into quarto-cli via a git subtree at `src/resources/extension-subtrees/julia-engine/`.

The engine extension requires a compatible version of quarto (>= 1.9.0). If work involves changes to the engine–quarto interface, you'll also need a corresponding dev build of quarto-cli with matching changes.

## Repo structure

- `_extensions/julia-engine/` — the actual extension (contains `_extension.yml` and the bundled `julia-engine.js`)
- `src/` — TypeScript source for the engine (`julia-engine.ts`, `constants.ts`). Changes here must be bundled into `_extensions/julia-engine/julia-engine.js` to take effect.
- `_quarto.yml` — makes the repo root a quarto project so rendering picks up the extension from `_extensions/`

## Building

After editing the TypeScript source in `src/`, rebuild the bundled JS:

```sh
quarto call build-ts-extension src/julia-engine.ts
```

This bundles `src/julia-engine.ts` into `_extensions/julia-engine/julia-engine.js`.

## Testing locally

### Quick: render in this repo

Create or edit a `.qmd` file in the repo root with `engine: julia` and render it:

```sh
quarto render some-file.qmd
```

Since this directory is a quarto project with the extension in `_extensions/`, quarto discovers and uses the engine from here.

### Full: run quarto-cli's tests

To test with quarto-cli's own test suite, push the current state into the subtree in a local quarto-cli clone:

```sh
cd /path/to/quarto-cli
git subtree pull --prefix=src/resources/extension-subtrees/julia-engine /path/to/quarto-julia-engine <branch> --squash
```

Then run quarto-cli's tests as usual.
