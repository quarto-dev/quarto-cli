# Runtime migration: moving quarto-cli off Deno

This directory holds the decision record, the spike that validated it, the
review that reshaped the plans, and one implementation plan per pull request,
in the order the PRs should land.

**New to this work?** Read `HANDOFF.md` first; its "Start here" section gives
the reading order. This README is the execution index.

- `00-assessment.md`: the assessment and decision record (situation, options,
  impact, phased plan, spike results, module-by-module refactoring plan), with
  an errata section dated 2026-10-15. Read sections 10 and 11 before any plan.
- `REVIEW-2026-10-15.md`: the principal review of the first draft of the plans
  (structural findings S1–S13, per-plan defects, the landing strategy, the
  decisions taken in its section 6). The plans below are the reworked version.
- `REVIEW-2026-10-16.md`: the Codex review of the reworked plans (R01–R21 and
  eleven open decisions). `TRIAGE-2026-10-16.md` verifies each finding and
  splits the follow-up into decisions (A, taken), a reconciliation pass (B,
  landed on 2026-10-16; the commit per item is listed in the triage) and
  local plan corrections (C, not yet applied: the plans its table names
  still carry their C-row defects).
- `SPIKES.md`: the two time-boxed spikes that sit inside Phase 2 (Spike #2 on
  Deno's Node compatibility and the dual-runtime window; Spike V on the test
  runner). Their outcomes set constants in PRs 28, 29, 31, 33 and 37.
- `spike/`: the throwaway tooling that ran the unmodified CLI on Node 22. It is
  the reference for PR 26.
- `_TEMPLATE.md`: plan structure and the normative shared vocabulary for
  `src/deno_ral/`; every plan uses these names and signatures.
- `NN-*.md`: one plan per PR. Each is self-contained: spec, files, tasks with
  checkbox steps, verification commands, review checklist, risks, and a
  suggested executor (Opus or Sonnet) with a size estimate.
- `HANDOFF.md`: start here; state of the work and the reading order.
  `braid-seed.sh`: optional strand seeding.

## Ground rules that every PR follows

1. Every PR lands on `main` one at a time and ships on Deno until PR 33. The
   full existing test suite is the gate; from PR 26 a real-Node job runs the
   layer's unit tests per PR with a known-failures list that may only shrink;
   PR 32 makes the bucketed Node matrix required.
2. Application code never calls `Deno.*` and never imports the standard
   library directly, except the runtime-neutral import-map seams the std
   boundary rule allow-lists (`async`, `crypto`, `datetime`, `streams`, `io/*`,
   `log` other than `log/file-handler`, `fmt/printf`, `dotenv/stringify`; the
   rule is in `02-runtime-boundary-check.md`, the module inventory behind it in
   `22-std-import-seams.md`); everything else imports `src/deno_ral/`. PR 02
   adds a CI ratchet with five scopes (`src`, `src-js`, `resources`,
   `package/src`, `tests`) whose counts can only go down.
3. Runtime-shaped APIs (process, HTTP, TCP, watch, key-value, errors) get
   Quarto's own interface. Plain filesystem and environment calls keep Deno's
   names so the codemods are mechanical and reversible (`--reverse`).
4. No synchronous network calls in any interface.
5. Each `deno_ral` module ships with a contract test under `tests/unit/ral/`;
   those tests are the compatibility contract for the Node implementations
   and run on real Node from PR 26 on.
6. The flip (PR 33) switches the CLI to Node but keeps Deno downloaded as a
   tool for `quarto run` and `build-ts-extension` until PRs 35 and 36 move
   them; PR 37 stops downloading it. Every Phase 3 PR is green and revertible
   on its own. If Spike #2 passes, one prerelease cycle ships both runtimes
   behind `QUARTO_RUNTIME=node|deno`.
7. Plans are executed with `superpowers:subagent-driven-development` (or
   `superpowers:executing-plans`), in a worktree, one PR per branch, reviewed
   on their own. Codemod PRs are generated from fresh `main` and merged the
   same day; a conflict is resolved by resetting the file and re-running the
   codemod, never by hand.

## Decisions and conventions

Decided on 2026-10-15 (`REVIEW-2026-10-15.md` section 6); later plans assume
them. Change them in the plan that decides them, not downstream.

- Releases: 1.11 ships the boundary work on Deno and the `quarto run`
  deprecation notice (PR 00c); Phase 1 codemods land before the `v1.11`
  branch is cut; 1.12 ships on Node; PR 37 targets 1.13. Backports to `v1.10`
  and older use the codemod's `--reverse` mode (step added to
  `dev-docs/checklist-backport-a-pr.md` by PR 37).
- Pins: Deno `v2.9.x` (PR 00a; newest 2.9 at execution), Node `v26.12.0` or
  newer 26.x, CI on Node 26, `@cliffy/*` 1.3.1 (PR 06), `@b-fuze/deno-dom`
  0.1.56 on WASM with a `parseHtml`-time gate of at most 2× the native plugin
  (PRs 05, 20), `ws` 8.22 (PR 29), `web-tree-sitter` 0.20.2 (PR 20b).
- Lockfile: `deno.lock` is committed and used with `--frozen` by configure, CI,
  the dev launchers and the bundle (PR 00b); every import-map edit is followed
  by `package/scripts/vendoring/update-lock.sh` and committed with the lock.
  The bundle gate (cold `DENO_DIR`, `--cached-only`, external-specifier grep,
  five renders, three OSes) runs from PR 00b.
- Posit Connect keeps a cookie jar (tough-cookie, PR 04). Puppeteer launch
  helpers and the `chromium` tool are deleted, not ported (PR 07).
- `tinitex` is rewritten in Rust as a separate project; PR 39 only removes the
  `deno compile` build.
- Julia engine: ported upstream by PumasAI (milestone J); the subtree is pulled
  before PR 32; no in-tree edit.
- Test runner: `node:test` or Vitest, decided by Spike V before PR 31 executes.
- Node bundle and tooling: `tools/node-bundle/dist/quarto.mjs`; all Node tooling
  and the shim are `.mjs`; the root `package.json` has no `"type": "module"`;
  dev bundles are `package/dist/bin/quarto-dev.mjs` and `quarto-bld.mjs`; dist
  keeps `bin/quarto.js` plus a `bin/package.json` with `"type": "module"`.
- Node flags set by the launchers (PR 33): `--enable-experimental-regexp-engine
  --max-old-space-size=8192 --stack-trace-limit=100 --use-system-ca
  --use-env-proxy --disable-warning=MODULE_TYPELESS_PACKAGE_JSON`.
- Environment contract (PR 33/34): `QUARTO_NODE`, `QUARTO_NODE_OPTIONS`,
  `QUARTO_NODE_VERSION`; `NODE_OPTIONS`/`NODE_PATH` are saved into
  `QUARTO_SAVED_*` for Quarto's own process and restored for children;
  `QUARTO_DENO*` are ignored or translated with a one-time warning and
  `QUARTO_DENO` is never aliased to the Node binary; `QUARTO_RUN_RUNTIME=deno`
  or the project key `script-runtime` selects the Deno tool for `.ts` scripts
  (PR 35); `QUARTO_RUN_DENO_NOTICE=0` silences the notice (PR 00c, 35).
- Store names: project cache `index`, Sass cache `sass-index`; the backend
  picks the file (`<name>.kv` for PR 18's `Deno.openKv` backend, which
  Quarto 1.11 ships; `<name>.json` for PR 30's JSON backend, the only one on
  both runtimes from PR 30 on) so Quarto versions on different backends never
  share a file (PRs 18, 30).
- `src/deno_ral/` keeps its name. `src/core/puppeteer.ts` keeps its name.
- Ratchet exclusions for the `src` scope (`kSrcExclusions`, PR 02):
  `src/deno_ral/`, `src/vendor/`, `src/resources/extension-subtrees/`,
  `src/resources/scripts/`, `src/resources/create/`,
  `src/webui/quarto-preview/build.ts` (allow-listed until PR 33). PR 25 adds an
  explicit allow-list with reasons for the standalone scripts.
- Landing order inside Phase 1: 02 → 02b → 08 → 22 → 10–13 → 14, with 09
  before 10. `tests/asserts.ts` lands in PR 02; tests written by PRs 09 and
  later use the layer, never raw `Deno.*`.
- Migration page for script authors: `https://quarto.org/docs/projects/scripts-deno-to-node.html`
  (PRs 00c, 35; created in quarto-web).
- `tests/run-tests.sh` accepts files only, never directories: plans write
  `$(find unit/ral -name '*.test.ts')`.

## Shared rules and tables

Each rule or table below is written once, in the plan that owns it, and the
other plans refer to it by file and section (reconciliation pass of
2026-10-16, bucket B of `TRIAGE-2026-10-16.md`). Change it in its owner.

- The std boundary rule and `kStdAllowListed`: PR 02, Context (PR 22's
  inventory table is the source; PR 25, this README and `_TEMPLATE.md` refer
  to it).
- The runtime residue table (every `Deno.*` or Deno CLI use kept after
  Phase 1, with its runtime, owner PR, removal PR and gate): PR 25, Context
  (PRs 24, 33, 35, 36, 37 and 39 refer to it).
- The `deno_ral` vocabulary (env key validation, `exit` draining, the KV file
  rule, `execPath()`): `_TEMPLATE.md`, "Shared vocabulary".
- The builder contract (`bundle()` inputs, CLI and fixture modes, the interop
  prelude): PR 26, Interfaces (PRs 20b, 31, 32 and 33 refer to it).
- The resolver scope rule (the import map applies to Quarto's own imports
  only; an import from inside `node_modules` resolves as Node would,
  relative to its importer; mapped targets from the root, unmapped bare
  names from the importer): PR 26, Interfaces, "Resolver scope" (PR 31's
  import-map hook and vitest plugin state the same rule; PR 33 keeps the
  plugin).
- The open-flag rule (`openFlagBits()`: numeric `node:fs` flags from Deno's
  independent options, `O_CREAT` iff `create`, `O_TRUNC` iff `truncate`,
  `O_APPEND` iff `append`, nothing implied; `writeTextFile` opens with
  `truncate: !append`) and the one-descriptor-owner rule for `FsFile`: PR 27,
  Interfaces, "Open flags" and "One descriptor owner" (PR 35's shim copies
  the flag rule; triage row 35).
- The CI graph after Deno removal (events, OSes, bucket generation, required
  check names): PR 37, Context (PR 32 refers to it).
- Spike V scheduling and its inconclusive outcome: `SPIKES.md`, Spike V
  (after PR 30; PRs 31 and 32 refer to it).
- The Windows coverage table (which POSIX process and preview assertions
  have a Windows equivalent, through which mechanism, and which have none):
  PR 14b, Context, "Windows coverage" (PRs 28 and 34 refer to it).
- The supported migration surface matrix, the "not available on Node" table,
  the version rule for `npm:`/`jsr:` specifiers and the governing-lockfile
  table: PR 35, Spec, "Supported migration surface" (PRs 00c, 34, 36 and 37
  refer to it).
- The dual-runtime combinations table (CLI runtime × script runtime until
  PR 37, with the executable each uses) and the rule that `src/` spawns Node
  on `architectureToolsPath("node")` and Deno on `requireDenoToolBinary()`,
  never on `execPath()`: PR 33, "Dual-runtime combinations until PR 37"
  (PRs 28, 35, 36, 37 and `_TEMPLATE.md` refer to it).

## How to execute a plan

```bash
git checkout main && git pull
git checkout -b <branch-named-in-the-plan>
# open the plan, work the checkboxes top to bottom, commit at each commit step
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent <test files named in the plan>
```

Each plan names the tests it adds and the existing tests it must keep green.
When a plan says "Decision needed", the options and a recommendation are in the
plan; pick one in the PR description. A plan that says "decided by Spike #2"
or "decided by Spike V" waits for the outcome recorded in `SPIKES.md`.

## The sequence

Status values: `planned`, `in progress`, `merged`. Update this table as PRs land.

### Phase 0: de-risk dependencies (PR 02 first, then 00a → 00b, then 03–06 in parallel, then 07)

| PR | Plan | What | Depends on | Executor | Size | Status |
|---|---|---|---|---|---|---|
| 02 | [02-runtime-boundary-check.md](02-runtime-boundary-check.md) | CI ratchet counting `Deno.*` and direct std imports in five scopes (`src`, `src-js`, `resources`, `package/src`, `tests`); `tests/asserts.ts`; lands first | none | Sonnet | S | planned |
| 00a | [00a-deno-bump.md](00a-deno-bump.md) | Deno 2.7.14 → newest 2.9.x everywhere the version appears | 02 | Sonnet | S | planned |
| 00b | [00b-lockfile-and-bundle-gate.md](00b-lockfile-and-bundle-gate.md) | Committed `deno.lock` with `--frozen` (six entrypoints); `tools/check-test-imports.ts` keeps the unlocked tests inside that graph; three-OS bundle gate (cold cache, external-specifier grep, five renders) | 02, 00a | Opus | M | planned |
| 00c | [00c-quarto-run-deprecation-notice.md](00c-quarto-run-deprecation-notice.md) | One-time notice when `quarto run` or a pre/post-render `.ts` script runs on Deno; `QUARTO_RUN_DENO_NOTICE=0` | 02 | Sonnet | S | planned |
| 01 | [01-quick-fixes-from-spike.md](01-quick-fixes-from-spike.md) | `assert`→`with` on two JSON imports; deterministic bslib Sass ordering | 02 | Sonnet | S | planned |
| 03 | [03-deps-skypack-to-npm.md](03-deps-skypack-to-npm.md) | Replace every `cdn.skypack.dev` import-map entry with `npm:`; CommonJS bundling proof | 02, 00b | Sonnet | M | planned |
| 04 | [04-deps-deno-land-x-small.md](04-deps-deno-land-x-small.md) | Replace semver, media_types, xmlp, xml, cache, events; cookie jar on tough-cookie | 02, 00b | Opus | M | planned |
| 05 | [05-deps-deno-dom-jsr.md](05-deps-deno-dom-jsr.md) | deno_dom from `deno.land/x` to `jsr:@b-fuze/deno-dom` 0.1.56; `parseHtml` timing baseline on the native plugin | 02, 00b | Opus | M | planned |
| 06 | [06-deps-cliffy-jsr.md](06-deps-cliffy-jsr.md) | Cliffy 1.0.0-rc.3 to `@cliffy/*` 1.3.1 (62 files) with a table-driven argv characterisation | 02, 00b | Opus | L | planned |
| 07 | [07-remove-puppeteer-and-chromium-tool.md](07-remove-puppeteer-and-chromium-tool.md) | Delete the unused puppeteer launch helpers and the deprecated `chromium` tool; std-redirect cleanup; Phase 0 exit check (`rg 'deno\.land\|skypack'` empty outside the allow-list) | 02, 00b, 03–06 | Opus | M | planned |

### Phase 1: close the runtime boundary (ships on Deno)

| PR | Plan | What | Depends on | Executor | Size | Status |
|---|---|---|---|---|---|---|
| 02b | [02b-node-compatible-ts-syntax.md](02b-node-compatible-ts-syntax.md) | `verbatimModuleSyntax`; `import type` codemod (2,067 specifiers in 504 files); enums, parameter properties and `<T>` casts rewritten; `check-ts-syntax.mjs` in CI | 02 | Opus | L | planned |
| 08 | [08-ral-process.md](08-ral-process.md) | `deno_ral/process.ts`: spawn/exec interface with `detached`, `killProcess` (group on POSIX, `taskkill /T` tree on Windows), flushing `exit`, `execProcess` on it, 16 direct `Deno.Command` sites, exit/cwd/args/execPath/signals/stdio | 02 | Opus | L | planned |
| 39 | [39-remove-quarto-latexmk-compile.md](39-remove-quarto-latexmk-compile.md) | Remove the `tinitex` `deno compile` build and the standalone entry (Rust rewrite replaces it); before PR 25, whose zero needs the files gone | 08 | Sonnet | S | planned |
| 09 | [09-ral-fs-and-temp-layer.md](09-ral-fs-and-temp-layer.md) | `deno_ral/fs.ts`, `temp.ts`, `errors.ts` API (`canonicalPathSync`, retyped `FileInfo`), unit tests, and the idempotent ts-morph codemod with `--reverse` | 02 | Opus | M | planned |
| 22 | [22-std-import-seams.md](22-std-import-seams.md) | `colors.ts`, `flags.ts`, base64 seams; table of std modules with internal `Deno.*` and their owner (PR 20b) | 04, 08 | Sonnet | S | planned |
| 10 | [10-codemod-fs-core.md](10-codemod-fs-core.md) | Run the fs/temp codemod on `src/core`, `src/quarto-core`, `src/config` (56 files) | 09, 08, 22 | Sonnet | L | planned |
| 11 | [11-codemod-fs-command.md](11-codemod-fs-command.md) | Codemod on `src/command` (43 files) | 09, 08, 22 | Sonnet | L | planned |
| 12 | [12-codemod-fs-project-format.md](12-codemod-fs-project-format.md) | Codemod on `src/project`, `src/format` (51 files) | 09, 08, 22 | Sonnet | L | planned |
| 13 | [13-codemod-fs-rest.md](13-codemod-fs-rest.md) | Codemod on `src/execute`, `src/publish`, `src/tools`, `src/extension`, `src/preview`, TS under `src/resources` (35 files) | 09, 08, 22 | Sonnet | M | planned |
| 14 | [14-ral-env.md](14-ral-env.md) | `deno_ral/env.ts` and codemod of all `Deno.env` uses in `src/` (58 files) | 02, 10–13 | Sonnet | L | planned |
| 14b | [14b-coverage-first.md](14b-coverage-first.md) | Tests before the rewrites: preview reload end-to-end (document and website project, three OSes), Jupyter daemon reuse, `inspect` through a pipe, process-group kill (POSIX) and `taskkill /T` tree kill (Windows) | 02, 08, 09 | Opus | S | planned |
| 15 | [15-ral-net-async-ports.md](15-ral-net-async-ports.md) | `deno_ral/net.ts`; async port probing; Jupyter kernel transport; Shiny control server on localhost | 08, 09, 14b | Opus | M | planned |
| 16 | [16-ral-http.md](16-ral-http.md) | `deno_ral/http.ts` with `listening`; preview server, dev server, axe server on it | 15, 08, 14b | Opus | M | planned |
| 17 | [17-ral-watch.md](17-ral-watch.md) | `deno_ral/watch.ts`; polling watcher and serve watcher on it | 09, 14b | Sonnet | S | planned |
| 18 | [18-ral-kv.md](18-ral-kv.md) | `deno_ral/kv.ts` with backend-named stores and cross-process contract; project cache and Sass cache on it | 09, 08 | Opus | S | planned |
| 19 | [19-ral-platform-main-permissions.md](19-ral-platform-main-permissions.md) | `platform.ts` with real `runtime()` detection, `main.ts`, `Deno.permissions` → warning-only probe, version/consoleSize/inspect/uid | 08, 09 | Sonnet | S | planned |
| 20 | [20-remove-deno-dom-ffi.md](20-remove-deno-dom-ffi.md) | Drop the native deno_dom plugin from code, packaging, launchers, conda, docs; gated on `tools/parsehtml-gate.sh` (≤ 2× native, three OSes) | 05, 00b, 14, 02 | Opus | M | planned |
| 20b | [20b-hidden-deno-uses.md](20b-hidden-deno-uses.md) | `tree-sitter-deno.js` → `web-tree-sitter`; `graphviz-wasm.js`; deno-cri JS; `onFileRead` hook for `metrics.ts`; own `FileHandler`; dotenv parser | 02, 08, 09, 14 | Opus | M | planned |
| 23 | [23-codemod-tests.md](23-codemod-tests.md) | Codemod `tests/`; `tests/harness.ts` adapter around `Deno.test`; assertions through `tests/asserts.ts` | 02, 08, 09, 14, 19, 22 | Opus | L | planned |
| 24 | [24-codemod-package-src.md](24-codemod-package-src.md) | Codemod `package/src`; `Deno.run` → `exec`; remaining Deno CLI calls listed for PR 33 | 02, 08, 09, 14, 19, 22 | Sonnet | M | planned |
| 25 | [25-boundary-zero-and-monkey-patch-removal.md](25-boundary-zero-and-monkey-patch-removal.md) | Delete `core/deno/monkey-patch.ts` and `original-real-path.ts`; types sweep (former PR 21); comment sweep; standalone-script allow-list; hidden-dependency inventory and the runtime residue table (owners and gates for every remaining `Deno.*` or Deno CLI use); ratchet to zero and required | 04, 07, 08–20, 20b, 22–24, 39 | Sonnet | M | planned |
| J | milestone, no plan | Julia engine ported upstream by PumasAI against the PR 08/09 engine API; subtree pulled; Julia entries leave the PR 32 allowlist | 08, 09, upstream | maintainer | – | planned |

### Phase 2: Node implementations, still running on Deno

| PR | Plan | What | Depends on | Executor | Size | Status |
|---|---|---|---|---|---|---|
| 26 | [26-node-build-job.md](26-node-build-job.md) | Node bundler (import map scoped to first-party importers) and `.mjs` shim from `spike/`, root `package.json`, `check-shim.mjs` over bundle and resources, real-Node run of `tests/unit/ral` per PR with `known-failures.json`, render job | 01, 03–07, 20b, 23 | Opus | M | planned |
| S2 | [SPIKES.md](SPIKES.md) | Spike #2 (one week): `node:` bundle on Deno 2.9, `node:http`+`ws` upgrade, `fs.watch`, process groups and `.bat` quoting, Cliffy prompts on Node, `--use-env-proxy` | 26 | Opus | – | planned |
| 27 | [27-ral-fs-on-node-apis.md](27-ral-fs-on-node-apis.md) | `fs.ts`/`temp.ts`/`errors.ts` on `node:fs`; `canonicalPathSync` on `realpathSync.native`; `walk`/`expandGlob` without `@std/fs`; the open-flag rule (`openFlagBits`) and the one-owner `FsFile` | 20b, 25, 26, S2 | Opus | L | planned |
| 27b | [27b-ral-platform-env-tar-log-on-node.md](27b-ral-platform-env-tar-log-on-node.md) | `platform.ts`, `env.ts`, `tar.ts`, `log.ts` FileHandler on `node:` | 14, 19, 20b, 25, 26, 27 | Sonnet | S | planned |
| 28 | [28-ral-process-on-node-apis.md](28-ral-process-on-node-apis.md) | `process.ts` on `node:child_process`; BatBadBut-safe batch quoting; draining `exit`; `taskkill /T` | 14b, 25, 26, 27b, S2 | Opus | M | planned |
| 29 | [29-ral-net-http-watch-on-node-apis.md](29-ral-net-http-watch-on-node-apis.md) | `net.ts`, `http.ts` (with `ws`), `watch.ts` (recreated-root and polling fallback) on Node APIs | 14b, 25, 26, 27b, S2 | Opus | M | planned |
| 30 | [30-ral-kv-on-node.md](30-ral-kv-on-node.md) | `kv.ts` on a locked JSON file (`<name>.json`), per-key merge, both runtimes | 18, 25, 26, 27b | Opus | S | planned |
| SV | [SPIKES.md](SPIKES.md) | Spike V (two days): Vitest vs `node:test` on ten files after the layer is on `node:` APIs; decision rule with an inconclusive outcome | 27, 27b, 28, 29, 30 | Opus | – | planned |
| 31 | [31-test-harness-on-node.md](31-test-harness-on-node.md) | `tests/harness.ts` on the chosen runner; `run-tests-node.sh`; `run-parallel-tests.mjs`; `testArgs()`; per-file timeout and forced exit | 02b, 23, 26, 27–30, SV | Opus | L | planned |
| 32 | [32-node-ci-required.md](32-node-ci-required.md) | Bucketed Node matrix (Linux, Windows per PR; macOS nightly) required; prerequisite-aware parity; allowlist empty except Julia until J; Deno matrix to nightly plus `deno-sanity` | 14b, 27, 27b, 28–31, J | Opus | M | planned |

### Phase 3: flip the runtime, then remove Deno

| PR | Plan | What | Depends on | Executor | Size | Status |
|---|---|---|---|---|---|---|
| 33 | [33-build-tooling-node.md](33-build-tooling-node.md) | CLI launchers (shell, batch, Rust) run Node; Deno kept as a tool; `quarto install deno`; `quarto-bld` and `prepare-dist` on Node; `tsc`; environment contract; `ensure.mjs` dev bundles; Deno CLI dev utilities off `deno info`/`fmt`/`check`; `QUARTO_RUNTIME` if S2 passes, with the dual-runtime combinations table | 32, 00b, 20b | Opus | L | planned |
| 34 | [34-installers-and-check.md](34-installers-and-check.md) | Installers ship Node with Node's entitlements and OS minimums; `quarto check` Node row; conda; the 17-row runtime contract table with tests; docs | 33 | Opus | M | planned |
| 35 | [35-user-scripts-compat.md](35-user-scripts-compat.md) | `.ts` scripts run on Node by default (per-file esbuild compile, on-demand `Deno` shim, 34 `stdlib/*` bundles); `QUARTO_RUN_RUNTIME` / `script-runtime` selects the Deno tool; the supported migration surface matrix and the version rule; `juice.ts` and `ast-diagram` on Node APIs | 33, 31, 00c | Opus | L | planned |
| 36 | [36-build-ts-extension-node.md](36-build-ts-extension-node.md) | `build-ts-extension` on esbuild with the default import map served on Node (`log`/`fs` as `@quarto/std-*` packages from PR 35's builder); warning for prebuilt engines that reference `Deno.` | 33, 35 | Opus | M | planned |
| 37 | [37-ci-switch-and-deno-removal.md](37-ci-switch-and-deno-removal.md) | Stop downloading Deno; remove `QUARTO_RUNTIME`, the nightly Deno matrix, vendoring, `deno.jsonc`, `deno_std`, `deno.lock`; backport checklist step; dev-docs updates | 33–36, 39 | Sonnet | M | planned |
| 38 | [38-lint-format-typecheck-tooling.md](38-lint-format-typecheck-tooling.md) | `dprint` (Deno-parity config) and `oxlint` (61 matching rules) on `src/`; drop `@types/deno` | 37 | Sonnet | M | planned |

## Dependency graph

```
02 ──┬─ 00a ─ 00b ─┬─ 03 ─┐
     ├─ 00c        ├─ 04 ─┤
     ├─ 01         ├─ 05 ─┼─ 07 ──────────────────┐        (Phase 0)
     ├─ 02b        └─ 06 ─┘                       │
     ├─ 08 ─┬─ 22 ─┬─ 10 11 12 13 ─ 14 ─┐         │
     │      │      │                    │         │
     ├─ 09 ─┤      ├─ 23  24            │         │
     │      ├─ 14b ─┬─ 15 ─ 16          │         │        (Phase 1)
     │      ├─ 17   ├─ 18   19          │         │
     │      ├─ 20b ─┘       05 ─ 20     │         │
     │      ├─ 39 (latexmk build)       │         │
     │      └─ J (Julia upstream)       │         │
     └──────────────── 25 <─────────────┴─────────┘
                        │
       01 03–07 20b 23 ─ 26 ─ S2 ─── 27 ─ 27b ─── 28 29 30 ─┬─ SV ─ 31 ─┐
                                                            │           │      (Phase 2)
                                              14b, J ───────┴─────────── 32
                                                            │
                                                   00b 20b ─┤
                                                            │
                                            33 ─ 34  35 ─ 36 │      (Phase 3)
                                                     └─ 37 ─ 38
```

Edges that cross phases: 05 → 20 (timing baseline); 20b → 26, 27, 33 (shim
members, tree-sitter in the bundle); 14b → 28, 29, 32 (the end-to-end gates);
02b → 31, 35 (type-only imports); 00b → 33 (bundle gate); 00c → 35 (notice);
S2 → 33 and 37 (`QUARTO_RUNTIME`); J → 32 (allowlist); 39 → 25 (zero needs the
`deno compile` files gone) and 37. Every remaining `Deno.*` or Deno CLI use
after Phase 1 has an owner and a gate in PR 25's runtime residue table.

## Progress metric

The PR 02 ratchet prints the current counts. Baseline as measured by the
reworked PR 02 script (2026-10-15, `main` at `b86f98d`):

| Scope | `Deno.*` sites | Direct std imports (files) |
|---|---|---|
| `src` (`.ts` outside `kSrcExclusions`) | 992 | 49 |
| `src-js` (`.js` under `src/`, excluding `src/resources`) | 7 | 0 |
| `resources` (runtime-loaded `src/resources/**`) | 10 | 1 |
| `package/src` | 240 | 3 |
| `tests` (excluding `tests/docs`) | 814 | 165 |

The std column counts files with a direct std import that the std boundary
rule does not allow-list (PR 02); 13 `src` files and 1 `package/src` file
import allow-listed seams only and are not counted. Zero in `src`, `src-js`
and `package/src`, and an explicit allow-list for `resources`, is the exit
criterion of Phase 1 (PR 25). `tests` reaches zero in PR 23.
