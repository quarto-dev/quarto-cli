# Runtime migration: moving quarto-cli off Deno

This directory holds the decision record, the spike that validated it, and one
implementation plan per pull request, in the order the PRs should land.

- `00-assessment.md`: the assessment and decision record (situation, options,
  impact, phased plan, spike results, module-by-module refactoring plan). Read
  sections 10 and 11 before any plan below.
- `spike/`: the throwaway tooling that ran the unmodified CLI on Node 22
  (esbuild bundler with an import-map resolver, a `Deno` global shim, test
  documents). It is the reference for PR 26 and the rollback evidence that the
  render path is runtime-neutral already.
- `NN-*.md`: one plan per PR. Each is self-contained: spec, files, tasks with
  checkbox steps, verification commands, review checklist, risks, and a
  suggested executor (Opus or Sonnet) with a size estimate.

## Ground rules that every PR follows

1. Every PR lands on `main` and ships on Deno. The full existing test suite is
   the gate until PR 32 makes the Node matrix required.
2. Application code never calls `Deno.*` or imports the standard library
   directly; it imports `src/deno_ral/`. PR 02 adds a CI ratchet so the count of
   violations can only go down.
3. Runtime-shaped APIs (process, HTTP, TCP, watch, key-value, errors) get
   Quarto's own interface. Plain filesystem and environment calls keep Deno's
   names so the codemods are mechanical.
4. No synchronous network calls in any interface (Node cannot bind or connect
   synchronously).
5. Each `deno_ral` module ships with a unit test under `tests/unit/deno-ral/`;
   those tests are the compatibility contract for the Node implementations.
6. Plans are executed with `superpowers:subagent-driven-development` (or
   `superpowers:executing-plans`), in a worktree, one PR per branch, and
   reviewed on their own.

## How to execute a plan

```bash
git checkout main && git pull
git checkout -b <branch-named-in-the-plan>
# open the plan, work the checkboxes top to bottom, commit at each commit step
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent <tests named in the plan>
```

Each plan names the tests it adds and the existing tests it must keep green.
When a plan says "Decision needed", the options and a recommendation are in the
plan; pick one in the PR description.

## The sequence

Status values: `planned`, `in progress`, `merged`. Update this table as PRs land.

### Phase 0: de-risk dependencies (can start now, mostly independent)

| PR | Plan | What | Depends on | Executor | Size | Status |
|---|---|---|---|---|---|---|
| 01 | [01-quick-fixes-from-spike.md](01-quick-fixes-from-spike.md) | `assert`→`with` on two JSON imports; deterministic bslib Sass ordering | none | Sonnet | S | planned |
| 02 | [02-runtime-boundary-check.md](02-runtime-boundary-check.md) | CI ratchet counting `Deno.*` and direct std imports outside `src/deno_ral/` | none | Sonnet | S | planned |
| 03 | [03-deps-skypack-to-npm.md](03-deps-skypack-to-npm.md) | Replace every `cdn.skypack.dev` import-map entry with `npm:` | none | Sonnet | M | planned |
| 04 | [04-deps-deno-land-x-small.md](04-deps-deno-land-x-small.md) | Replace semver, media_types, xmlp, xml, another_cookiejar, cache, events | none | Opus | M | planned |
| 05 | [05-deps-deno-dom-jsr.md](05-deps-deno-dom-jsr.md) | deno_dom from `deno.land/x` to `jsr:@b-fuze/deno-dom` | none | Opus | M | planned |
| 06 | [06-deps-cliffy-jsr.md](06-deps-cliffy-jsr.md) | Cliffy 1.0.0-rc.3 to `@cliffy/*` 1.x on JSR (62 files) | none | Opus | L | planned |
| 07 | [07-deps-puppeteer-core.md](07-deps-puppeteer-core.md) | `deno.land/x/puppeteer` port to npm `puppeteer-core` | none | Opus | M | planned |

### Phase 1: close the runtime boundary (ships on Deno)

| PR | Plan | What | Depends on | Executor | Size | Status |
|---|---|---|---|---|---|---|
| 08 | [08-ral-process.md](08-ral-process.md) | `deno_ral/process.ts`: spawn/exec interface, `execProcess` on it, 16 direct `Deno.Command` sites, exit/cwd/args/execPath/signals/stdio | 02 | Opus | L | planned |
| 09 | [09-ral-fs-and-temp-layer.md](09-ral-fs-and-temp-layer.md) | `deno_ral/fs.ts` and `deno_ral/temp.ts` API, error predicates, unit tests, and the ts-morph codemod script (no callers moved yet) | 02 | Opus | M | planned |
| 10 | [10-codemod-fs-core.md](10-codemod-fs-core.md) | Run the fs/temp codemod on `src/core`, `src/quarto-core`, `src/config` | 09 | Sonnet | M | planned |
| 11 | [11-codemod-fs-command.md](11-codemod-fs-command.md) | Codemod on `src/command` | 09 | Sonnet | M | planned |
| 12 | [12-codemod-fs-project-format.md](12-codemod-fs-project-format.md) | Codemod on `src/project`, `src/format` | 09 | Sonnet | M | planned |
| 13 | [13-codemod-fs-rest.md](13-codemod-fs-rest.md) | Codemod on `src/execute`, `src/publish`, `src/tools`, `src/extension`, `src/preview`, TS under `src/resources` | 09 | Sonnet | M | planned |
| 14 | [14-ral-env.md](14-ral-env.md) | `deno_ral/env.ts` and codemod of all `Deno.env` uses in `src/` | 02 | Sonnet | M | planned |
| 15 | [15-ral-net-async-ports.md](15-ral-net-async-ports.md) | `deno_ral/net.ts`; async port probing; Jupyter kernel transport on it | 08 | Opus | M | planned |
| 16 | [16-ral-http.md](16-ral-http.md) | `deno_ral/http.ts`; preview server, dev server, axe server on it | 15 | Opus | M | planned |
| 17 | [17-ral-watch.md](17-ral-watch.md) | `deno_ral/watch.ts`; polling watcher and serve watcher on it | 09 | Sonnet | S | planned |
| 18 | [18-ral-kv.md](18-ral-kv.md) | `deno_ral/kv.ts`; project cache and Sass cache on it | 09 | Opus | S | planned |
| 19 | [19-ral-platform-main-permissions.md](19-ral-platform-main-permissions.md) | `platform.ts` extension, `main.ts` for `import.meta.main`, remove `Deno.permissions`, version/consoleSize/inspect/uid | 08 | Sonnet | S | planned |
| 20 | [20-remove-deno-dom-ffi.md](20-remove-deno-dom-ffi.md) | Drop `Deno.dlopen` and the native deno_dom plugin from code, packaging and launchers | 05 | Opus | M | planned |
| 21 | [21-ral-types-sweep.md](21-ral-types-sweep.md) | Replace the remaining `Deno.*` type references in signatures | 08, 09, 15, 17, 18 | Sonnet | S | planned |
| 22 | [22-std-import-seams.md](22-std-import-seams.md) | Route direct std imports (`fmt/colors`, `semver`, `flags`, `encoding/base64`, `io/*`, `fs/*`) through `deno_ral`; `tests/asserts.ts` | 04 | Sonnet | M | planned |
| 23 | [23-codemod-tests.md](23-codemod-tests.md) | Codemod `tests/` (840 sites); `tests/harness.ts` adapter around `Deno.test` | 09, 14, 22 | Opus | L | planned |
| 24 | [24-codemod-package-src.md](24-codemod-package-src.md) | Codemod `package/src` (240 sites); drop `Deno.run` and `deno info` | 09, 14 | Sonnet | M | planned |
| 25 | [25-boundary-zero-and-monkey-patch-removal.md](25-boundary-zero-and-monkey-patch-removal.md) | Delete `core/deno/monkey-patch.ts`, set the ratchet to zero, make it a hard failure | 10–24 | Sonnet | S | planned |

### Phase 2: Node implementations, still running on Deno

| PR | Plan | What | Depends on | Executor | Size | Status |
|---|---|---|---|---|---|---|
| 26 | [26-node-build-job.md](26-node-build-job.md) | Commit the Node bundler (from `spike/`), root `package.json`, and an allowed-failure CI job rendering smoke documents on Node | 03–07 | Opus | M | planned |
| 27 | [27-ral-fs-on-node-apis.md](27-ral-fs-on-node-apis.md) | Reimplement `fs.ts`/`temp.ts` on `node:fs`; `walk`/`expandGlob` without `@std/fs` | 25 | Opus | L | planned |
| 28 | [28-ral-process-on-node-apis.md](28-ral-process-on-node-apis.md) | Reimplement `process.ts` on `node:child_process` | 25 | Opus | M | planned |
| 29 | [29-ral-net-http-watch-on-node-apis.md](29-ral-net-http-watch-on-node-apis.md) | Reimplement `net.ts`, `http.ts` (with `ws`), `watch.ts` on Node APIs | 25 | Opus | M | planned |
| 30 | [30-ral-kv-on-node.md](30-ral-kv-on-node.md) | `kv.ts` on a JSON index (or `node:sqlite`); cache version bump | 25 | Sonnet | S | planned |
| 31 | [31-test-harness-on-node.md](31-test-harness-on-node.md) | `tests/harness.ts` on `node:test`; `run-tests` entry for Node; assertions | 26, 23 | Opus | L | planned |
| 32 | [32-node-ci-required.md](32-node-ci-required.md) | Node matrix (Linux, macOS, Windows) required; parity criteria | 27–31 | Sonnet | S | planned |

### Phase 3: flip the runtime and remove Deno

| PR | Plan | What | Depends on | Executor | Size | Status |
|---|---|---|---|---|---|---|
| 33 | [33-build-tooling-node.md](33-build-tooling-node.md) | `configure.sh` installs Node; `quarto-bld` and `prepare-dist` on Node with plain esbuild; dev launchers run Node | 32 | Opus | L | planned |
| 34 | [34-installers-and-check.md](34-installers-and-check.md) | Installers ship Node; Rust launcher; `quarto check` runtime row; `QUARTO_NODE*` env aliases; docs | 33 | Opus | M | planned |
| 35 | [35-user-scripts-compat.md](35-user-scripts-compat.md) | `quarto run` `.ts` on Node: `stdlib/*` resolve hook, Deno shim with deprecation, `quarto install deno` | 33 | Opus | L | planned |
| 36 | [36-build-ts-extension-node.md](36-build-ts-extension-node.md) | `build-ts-extension` on esbuild and `package.json`; `@quarto/types` guidance | 33 | Opus | M | planned |
| 37 | [37-ci-switch-and-deno-removal.md](37-ci-switch-and-deno-removal.md) | All workflows on Node; remove Deno caches, vendoring, `deno.jsonc`, `deno_std`; dev-docs updates | 33–36 | Sonnet | M | planned |
| 38 | [38-lint-format-typecheck-tooling.md](38-lint-format-typecheck-tooling.md) | `dprint`, `oxlint` or ESLint, `tsc` with `@types/node`; remove `deno.ns` | 37 | Sonnet | M | planned |
| 39 | [39-quarto-latexmk-packaging.md](39-quarto-latexmk-packaging.md) | Decide and implement how `tinitex` is built without `deno compile` | 33 | Sonnet | S | planned |

## Dependency graph

```
01  02  03  04  05  06  07            (Phase 0, parallel)
     |   \   \   |   |   |
     |    \   \  20  22  |
     v     \   \         |
    08 ------> 09 -----> 26 <---------+
    |  \       |  \
    15  19     10 11 12 13 14  17 18
    |              \  |  |  /   |  |
    16              23  24     21
     \               \  /      /
      +--------> 25 <---------+
                  |
          27 28 29 30 31
                  |
                 32
                  |
          33 -> 34 35 36 39
                  |
                 37 -> 38
```

## Progress metric

The PR 02 ratchet prints the current counts. Baseline at the time of writing
(2026-10-14, `main` at b86f98d):

| Scope | `Deno.*` sites | Direct std imports (files) |
|---|---|---|
| `src/` outside `src/deno_ral/` | 1,079 | 71 |
| `package/src` | 240 | (included above) |
| `tests/` | 840 | 166 (`testing/asserts`) |

Zero in `src/` and `package/src` is the exit criterion of Phase 1 (PR 25).
