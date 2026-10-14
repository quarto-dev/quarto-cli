# Node runtime spike for quarto-cli

Spike (2026-10-14) answering: can the unmodified `src/quarto.ts` run on Node.js?
Nothing under `src/` was changed. Everything here is throwaway tooling and is
excluded from git via `.git/info/exclude`.

## What is here

| Path | Purpose |
|---|---|
| `build.mjs` | esbuild bundler. Resolves the Deno import map (`src/import_map.json`): `jsr:` → `@jsr/*` packages from npm.jsr.io, `npm:` → npm, `cdn.skypack.dev` → npm, `deno.land/x` → local GitHub clones in `vendor/`, `deno.land/std@0.x` → pinned 0.224 JSR packages. Defines `import.meta.main` as true. |
| `deno-shim.js` | `globalThis.Deno` for Node: `@deno/shim-deno` 0.19.2 plus `Deno.Command`, `Deno.openKv` (JSON file), `Deno.serve` (`node:http`), `Deno.upgradeWebSocket` (`ws`), `Deno.listen` (fake, see findings), temp-file fixes, `Deno.dlopen` (throws). |
| `quarto-node` | Launcher: sets `QUARTO_BIN_PATH`/`QUARTO_SHARE_PATH` and runs `node dist/quarto.js`. |
| `vendor/` | Shallow clones at the pinned tags: cliffy v1.0.0-rc.3, deno_dom v0.1.41, xmlp, another_cookiejar, semver, media_types (deno.land is blocked by this sandbox's proxy; GitHub is not). |
| `stubs/` | Stubs for puppeteer, xml (MECA), cache, events (→ `node:events`). |
| `deno-baseline/` | Import map that lets the unmodified source run on the pinned Deno 2.7.14 with the same local clones, used to diff outputs between runtimes. |
| `../spike-node-tests/` | Test documents and projects, plus the Deno-baseline outputs under `deno-out/`. |

## Reproduce

```bash
cd .spike-node
npm install                 # npm + JSR (see .npmrc)
node build.mjs              # -> dist/quarto.js (5.5 MB, ~1200 modules, <1 s)
./quarto-node render ../spike-node-tests/simple.qmd
./quarto-node preview ../spike-node-tests/preview/simple.qmd --no-browser --port 4321
```

Binaries (Deno, Pandoc 3.10, Dart Sass, Typst, typst-gather, esbuild) were downloaded
by hand into `package/dist/bin/tools/x86_64/` because `configure.sh` needs deno.land.

Deno baseline:

```bash
DENO_DIR=.spike-node/deno-baseline/deno_cache QUARTO_BIN_PATH=$PWD/package/dist/bin \
QUARTO_SHARE_PATH=$PWD/src/resources QUARTO_DEBUG=false XDG_CACHE_HOME=.spike-node/deno-baseline/cache \
package/dist/bin/tools/x86_64/deno run --no-check --unstable-kv --unstable-ffi --allow-all --no-config --no-lock \
  --import-map=$PWD/.spike-node/deno-baseline/import_map.json src/quarto.ts render <file>
```

## Results

See the "Spike results" section of the assessment document.
