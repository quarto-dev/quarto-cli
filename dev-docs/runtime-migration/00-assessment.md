# Quarto after Deno: feasibility assessment and migration plan

**Status:** Proposed  
**Date:** 2026-10-14  
**Deciders:** Quarto core team (Posit)  
**Scope:** The `quarto-cli` TypeScript layer, its build tooling, tests, packaging, and the user-facing contracts that expose Deno.

## 1. Verdict

Moving Quarto off Deno is feasible, and Node.js is the right destination. Nothing in the codebase depends on a capability that only Deno provides. The two Deno-only features in use (Deno KV for two small caches, FFI for an optional native HTML parser) both have cheap replacements. Everything else maps onto Node built-ins or packages that already declare Node support.

The migration is large but mechanical, and it does not need to be a big-bang rewrite. Deno 2 runs `node:` built-ins and npm packages natively, so the codebase can be ported to Node APIs incrementally while still shipping on Deno, with the test suite green at every step. The runtime binary is swapped last.

Rough size: 6 to 9 engineer-months, spread over about 12 months. The first Node-based stable release is achievable before Deno's maintenance window closes in October 2027. If it slips, Quarto keeps working on the last pinned Deno release, because Quarto bundles its own runtime binary and never depends on a user-installed Deno.

**The Phase 0 spike has been run (section 10).** The unmodified `src/quarto.ts`, bundled with esbuild and given a ~250-line `Deno` shim, renders HTML, Typst PDF, DOCX, a website project and a Jupyter document on Node 22 with output identical to Deno, and the preview server with live reload works. Eight small code-level issues were found, none structural.

## 2. The situation (verified 2026-10-14)

- Cloudflare announced on 2026-10-09 that the Deno team is joining Cloudflare. The deal is about `celld` and self-hosted Workers, not about the Deno CLI.
- The Deno runtime gets monthly bug-fix and security releases for one year, then active development ends. The code stays open source and Deno "welcomes others who want to continue its development". No maintainer has stepped forward yet.
- Deno Deploy shuts down within six months. JSR keeps running and its infrastructure moves to Cloudflare.
- Nothing has been said about `deno.land/x`. Quarto still resolves Cliffy, deno_dom, puppeteer, xmlp, xml, semver, media_types, another_cookiejar, cache and events from `deno.land/x`, and about a dozen packages from `cdn.skypack.dev`, which is itself dormant. These are a near-term risk whatever runtime decision is made (see Phase 0).

Practical consequences for Quarto:

- After October 2027 the bundled Deno stops receiving V8 and TLS security fixes, and stops tracking new OS releases, code-signing requirements, and CPU targets.
- Maintaining a Deno fork is not realistic for the Quarto team. Deno is a large Rust codebase built on `rusty_v8`; keeping it current with V8 is a full-time job for people with that expertise.
- The decision is therefore not "if" but "to what, and how", with a hard deadline that is soft in practice because Quarto ships its own binary.

## 3. How Quarto depends on Deno today

### 3.1 Inventory

| Area | Size | Deno coupling |
|---|---|---|
| CLI TypeScript (`src/`, excluding vendor and resources) | 688 files, ~137k lines | 247 files call `Deno.*` directly (441 do not); ~1,000 `Deno.*` call sites (~2,200 including tests and build tooling) |
| Build tooling (`package/src`, `quarto-bld`) | ~7.4k lines | Written in Deno TS; uses `Deno.run`, `deno info`, `deno compile`, `deno install` |
| Tests (`tests/`) | 274 test files, ~40k lines | Custom harness over `Deno.test`; 142 files call `Deno.*`; 166 imports of `@std/testing/asserts` |
| Lua filters (`src/resources/filters`) | ~34k lines | None. Runs inside Pandoc. |
| External binaries (Pandoc, Typst, Dart Sass, esbuild, Chromium, TinyTeX) | n/a | None. Spawned as processes. |
| Browser bundles (preview JS, OJS runtime, YAML intelligence web worker) | n/a | Built with esbuild; one hand-patched `tree-sitter-deno.js` (200 KB) |

The headline numbers are large, but the distribution of the ~2,900 call sites is narrow. The top ten APIs account for about 70% of all uses and are all plain filesystem or environment calls with direct Node equivalents:

| `Deno.*` API | Uses | Node equivalent |
|---|---|---|
| `writeTextFileSync` | 344 | `fs.writeFileSync` |
| `readTextFileSync` | 283 | `fs.readFileSync(p, "utf8")` |
| `env.get/set` | 253 | `process.env` |
| `removeSync` | 183 | `fs.rmSync` |
| `statSync` | 108 | `fs.statSync` |
| `makeTempDirSync` | 103 | `fs.mkdtempSync` |
| `cwd` | 96 | `process.cwd` |
| `remove` | 80 | `fs.promises.rm` |
| `exit` | 65 | `process.exit` |
| `mkdirSync` / `copyFileSync` | 54 / 54 | `fs.mkdirSync` / `fs.copyFileSync` |
| `Command` (via `src/core/process.ts` and ~50 direct sites) | 51 | `child_process.spawn` |

### 3.2 An abstraction layer already exists

`src/deno_ral/` ("runtime abstraction layer") was created in 2024 because "Deno's stdlib changes too much and too fast". It wraps `@std/path`, `@std/fs`, `@std/log`, `@std/io`, `@std/encoding`, `@std/tar`, platform detection and `Deno.Command`, and is imported by 451 files. This is the natural seam to extend: the std-lib surface is already centralized, only the `Deno.*` namespace calls are not.

### 3.3 Deno-specific runtime features (the parts that are not a rename)

| Feature | Where | Replacement |
|---|---|---|
| `Deno.openKv` (unstable) | `src/core/cache/cache.ts` (project cache index), `src/core/sass/cache.ts` (Sass cache index) | Both store a small key → file-hash index. A JSON index file with atomic writes is sufficient; `node:sqlite` (release candidate since Node 25.7) or `better-sqlite3` if a real store is wanted. |
| `Deno.dlopen` FFI | `src/core/deno-dom.ts`, loads the native `deno_dom` plugin shipped per platform under `bin/tools/<arch>/deno_dom/` | Drop the native plugin. deno_dom's WASM backend is the fallback already and is declared Node-compatible on JSR. Measure parse time on large HTML outputs; if needed, consider `linkedom` or `parse5`. |
| `Deno.serve`, `Deno.upgradeWebSocket` | `src/core/http-server.ts`, `src/core/http-devserver.ts`, `src/command/preview/preview.ts`, `src/command/call/axe/cmd.ts` | `node:http` plus the `ws` package (Node has a built-in WebSocket client but no server). Bun has a native server if that route is taken. |
| `Deno.listen`, `Deno.connect`, `Deno.Conn` | `src/core/port.ts` (free-port probing), `src/execute/jupyter/jupyter-kernel.ts` (TCP to the kernel daemon) | `node:net` |
| `Deno.watchFs`, `Deno.FsEvent` | `src/core/quarto.ts`, `src/core/watch.ts`, `src/project/serve/watch.ts` | `fs.watch({recursive: true})` (supported on Linux since Node 20) or `@parcel/watcher` / `chokidar` |
| `Deno.addSignalListener`, `Deno.consoleSize`, `Deno.execPath`, `Deno.build`, `Deno.inspect`, `Deno.uid`, `Deno.permissions` | `src/core/main.ts`, `src/core/log.ts`, `src/deno_ral/platform.ts`, `src/tools/impl/tinytex.ts`, others | `process.on("SIGINT")`, `process.stdout.columns`, `process.execPath`, `process.platform`/`os.arch()`, `util.inspect`, `os.userInfo()`, plain `fs.access` |
| `import.meta.main` | `src/quarto.ts`, `quarto-latexmk.ts`, build scripts | Compare `import.meta.filename` with `process.argv[1]` |
| V8 flag `--enable-experimental-regexp-engine` | One `RegExp(..., "l")` in `src/project/types/website/util/discover-meta.ts` | Node accepts the same V8 flag, or drop the linear-time flag for that one regex. `--max-old-space-size` and friends pass through unchanged. |
| Monkey patches (`src/core/deno/monkey-patch.ts`) | `realPathSync` on Windows UNC paths, temp-file retry, `Deno.copy` shim for old deps | Fold into the runtime layer. |

### 3.4 Dependencies

| Current | Via | Node path |
|---|---|---|
| `@std/path`, `@std/semver`, `@std/yaml`, `@std/encoding`, `@std/async`, `@std/fmt`, `@std/datetime`, `@std/dotenv`, `@std/uuid`, `@std/streams`, `@std/tar`, `@std/log` | JSR | Most `@std` packages declare Node support and install with `npx jsr add`. Prefer `node:path`, `node:crypto`, `node:stream` where a built-in exists. |
| `@std/fs` (walk, expandGlob, copy, move, ensureDir, exists) | JSR | Uses `Deno.*` internally. Re-implement the handful of helpers in the runtime layer on `node:fs` (`fs.glob` exists in Node 22+). |
| `@std/testing/asserts` | JSR | `@std/assert` (Node-compatible) or `node:assert/strict`. 166 import sites, one specifier to rewrite. |
| Cliffy 1.0.0-rc.3 (command, prompt, table, ansi) | `deno.land/x`, 62 files | `@cliffy/command` 1.2.x on JSR declares Node, Deno and Bun support. Needs a spike to confirm the prompt module under Node. Fallbacks: `commander`, `citty`. |
| deno_dom 0.1.41 | `deno.land/x`, 60 files, ~1,900 DOM call sites | `@b-fuze/deno-dom` on JSR (WASM) declares Node support. Keeping the same DOM implementation avoids touching the HTML post-processing code at all. |
| puppeteer 9.0.2 port | `deno.land/x` | `puppeteer-core` from npm; the Chromium install tool stays. |
| zod, lodash, acorn, pdfjs-dist | npm | Unchanged. |
| js-yaml, dayjs, diff, slimdom, fontoxpath, scss-parser, ansi_up, moment-guess, @observablehq/parser, blueimp-md5, binary-search-bounds | `cdn.skypack.dev` | Same packages from npm. |
| xmlp, xml, another_cookiejar, media_types, cache, events | `deno.land/x` | `fast-xml-parser`, `tough-cookie`, `mime-types`; remove `cache` and `events`. |
| Hand-patched `tree-sitter-deno.js` | `src/core/lib/external` | Standard `web-tree-sitter` from npm. One less fork to carry. |

### 3.5 TypeScript, lint, format

- Node's TypeScript type stripping is stable (Node 24.12 and 25.2 onward, default on). Quarto already uses explicit `.ts` extensions in imports, which Node requires. Unsupported syntax in the codebase: 1 `enum`, 0 runtime `namespace`s, 36 constructor parameter properties, 0 decorators. Small cleanup. Distribution is an esbuild bundle (`quarto.js`) already, so type stripping only matters for dev mode.
- Bare import-map aliases (`path`, `fs/copy`, `cliffy/command/mod.ts`) have no native equivalent in Node. Rewrite them to npm package names or `package.json` `imports` subpath aliases (`#runtime/fs`). This is a one-time codemod.
- `deno check` → `tsc --noEmit` with `@types/node`. Removing the `deno.ns` lib from the type environment is the best migration guide: every remaining `Deno.*` use becomes a compile error.
- `deno lint` → `oxlint` or ESLint. `deno fmt` → `dprint`, which is the formatter inside `deno fmt`, so formatting churn is near zero.

### 3.6 Distribution and packaging

Quarto does not use `deno compile` for the CLI. It ships the `deno` binary under `bin/tools/<arch>/`, an esbuild bundle `bin/quarto.js`, and launcher scripts (`package/scripts/common/quarto`, `quarto.cmd`, plus a small Rust launcher for `quarto.exe` on Windows). The Node version is the same shape: ship the official Node binary for each platform and launch `node quarto.js`. No need for Node's Single Executable Applications feature, which is still at Stability 1.1.

`deno compile` is used once, for the `quarto-latexmk` (tinitex) sidecar binary. Replace with Bun's `--compile`, Node SEA, or drop the standalone binary and run it through the bundled Node.

Build tooling (`quarto-bld`, `configure.sh`, vendoring scripts, CI caches keyed on `deno_cache`) is Deno-based and needs porting too. It is small (7.4k lines).

## 4. What does not change

- Pandoc, the Lua filter pipeline (34k lines), Typst, Dart Sass, esbuild, Chromium, TinyTeX. The document-processing core is untouched.
- The user-visible CLI, project and document formats, extensions written in Lua, templates, themes.
- Browser-side JavaScript (preview client, OJS runtime, YAML intelligence for editors).
- `quarto-actions`, the VS Code and Positron extensions, and anything that shells out to `quarto`.

## 5. Options

### Option A: Node.js (recommended)

| Dimension | Assessment |
|---|---|
| Longevity | OpenJS Foundation project, multi-vendor, predictable LTS: Node 26 becomes Active LTS on 2026-10-28 and is maintained until April 2029. |
| Feature fit | Type stripping stable; `fetch`, `WebSocket` client, `AbortController`, streams, `node:test`, `node:sqlite` (RC), `fs.glob`, `fs.watch` recursive. Missing: WebSocket server (use `ws`), import maps (use `package.json` imports). |
| Ecosystem | Largest. Every dependency Quarto needs has a maintained npm package. |
| Migration cost | Highest line-count churn of the three, but mechanical. |
| Enterprise acceptance | Node binaries are already approved almost everywhere Quarto is deployed. |
| Team familiarity | High. |

### Option B: Bun

| Dimension | Assessment |
|---|---|
| Longevity | Owned by Anthropic since December 2025. Single-vendor runtime, which is exactly the exposure Quarto is leaving. (Disclosure: this assessment was written by Claude, an Anthropic model. Weigh that when reading this row.) |
| Feature fit | Closest drop-in for Deno's ergonomics: runs TS directly, `bun build --compile` with cross-compilation, built-in WebSocket server, `bun:sqlite`, `bun:ffi`, fast startup. Node-API compatible, so a Node-targeted codebase runs on it. |
| Ecosystem | npm. |
| Migration cost | Lower if Bun-specific APIs are used; same as Node if the Node API surface is targeted. |
| Risk | Reported maturity issues and an in-flight Rust rewrite in 2026. Windows support is younger than Node's. |

### Option C: Stay on Deno (pin or fork)

| Dimension | Assessment |
|---|---|
| Short term | Zero cost. Quarto bundles its own Deno, nothing breaks in October 2027. |
| Medium term | No security patches for V8 or the TLS stack, no new OS or CPU support, no code-signing updates. `deno.land/x` packages decay. A community fork may appear but cannot be counted on. |
| Fork ourselves | Not credible. Rust plus V8 integration expertise, and a continuous V8 upgrade treadmill. |
| Role | Bridge, not destination. The pinned Deno is the fallback that makes the schedule tolerant. |

### Option D: Rewrite in another language

Out of scope. 137k lines of TypeScript plus the engine and publishing integrations; years of work for no functional gain.

### Recommendation

Target the **Node API surface** (`node:` built-ins plus the WinterCG web APIs that already run everywhere), ship the **Node LTS binary**, and keep Bun as a packaging-time option that can be evaluated at the end without rewriting anything. Code written against `node:fs`, `node:child_process`, `node:http` and `node:net` runs on Node, on Bun, and on Deno 2 today. That last point is what makes an incremental migration possible.

## 6. Impact

### Users who write TypeScript scripts for Quarto (the main compatibility break)

`quarto run script.ts` and project `pre-render`/`post-render` `.ts` scripts run under the bundled Deno with `--allow-all` and a `stdlib/*` import map (`src/resources/deno_std/run_import_map.json`). Users have written against the `Deno` namespace and those imports for years, and this is documented on quarto.org. This is the one contract that cannot be swapped silently.

Proposed handling, in order:

1. Keep `.ts` scripts working on Node through Quarto's own loader: a Node resolve hook maps `stdlib/*` to modules bundled in `share/`, and a vendored Deno-namespace shim (`@deno/shim-deno` from the `dnt` project, or a trimmed copy) provides the common `Deno.*` filesystem and process calls with a one-time deprecation notice.
2. Offer `quarto install deno` through the existing tools mechanism (`src/tools/`, like TinyTeX and Chromium) so a project can opt into running scripts on a real Deno for as long as it wants.
3. Document the Node path (`process`, `node:fs`, npm imports) as the supported one and announce the deprecation one stable release before the switch.

### Engine extension authors (`quarto call build-ts-extension`, Quarto 1.9+)

Engines are bundled from TypeScript with a `deno.json`, loaded in-process with a dynamic `import()`, and receive a `QuartoAPI` object (`system`, `path`, `jupyter`, ...). The feature is young and the API was designed so engines do not need `Deno.*` directly. Impact: the build command moves to esbuild plus a `package.json`, `@quarto/types` gains a note that only the Quarto API and web standards are supported, and any engine using `Deno.*` must change. Low cost now; higher the longer this waits.

### Operators and CI

- `QUARTO_DENO`, `QUARTO_DENO_OPTIONS`, `QUARTO_DENO_V8_OPTIONS`, `QUARTO_DENO_EXTRA_OPTIONS`, `QUARTO_DENO_DOM` are set by some admins and CI configurations. Provide `QUARTO_NODE*` equivalents and keep the old names as aliases for one release.
- `quarto check` reports the runtime version; update.
- The launcher must sanitize `NODE_OPTIONS` and `NODE_PATH` from the user's environment so a user's Node setup cannot alter Quarto's bundled runtime, the same way `DENO_DIR` is pinned today.

### Packagers

RStudio and Positron bundle Quarto; conda-forge, Homebrew and Linux distributions package it. Swapping Deno for Node simplifies their lives: Node is already in every one of those ecosystems. Installer formats (deb, rpm, msi, pkg, tarball) keep their layout.

### Core team

- Dev loop: `node --strip-types` or `tsx` instead of `deno run --check`; `tsc` for type checks; `dprint` keeps formatting identical.
- Test suite: harness in `tests/test.ts` is a thin wrapper, with a single `Deno.test` call site, so moving to `node:test` or Vitest is contained. The 142 test files that call `Deno.*` directly go through the same codemod as `src/`.
- CI: cache keys and the `quarto-dev` composite action change; test timing files and GitHub Actions grouping are harness-level and survive.

## 7. Plan

Guiding rules for the whole plan:

- Every phase lands on `main` and ships on Deno until the final flip. No long-lived branch.
- A CI check forbids `Deno.` outside `src/runtime/` once Phase 1 completes, so the boundary cannot regress.
- The pinned Deno release is the safety net. If the flip is late, Quarto ships on the last Deno patch release and nothing is lost.

### Phase 0: Decide and de-risk (now to end of 2026, 2 to 3 weeks of effort)

1. Spike (one week, one engineer): run `quarto render` of the test documents on Node with a crude `Deno` shim. Confirm Cliffy's command and prompt modules, deno_dom WASM, Pandoc spawning with piped stdin, and the preview server under Node. Produce a go/no-go note.
2. Pin the Deno version and record the last-known-good release in `configuration`.
3. Vendor or replace everything pulled from `deno.land/x` and `cdn.skypack.dev` (section 3.4). This is needed regardless of the runtime decision and is the first thing that can break outside Quarto's control.
4. Announce the direction publicly with the deprecation timeline for Deno-specific user scripts.

Exit: written decision (this document, amended), spike results, dependency sources under Quarto's control.

### Phase 1: Close the runtime boundary (Q1 2027, 6 to 8 engineer-weeks)

1. Rename `src/deno_ral/` to `src/runtime/` and extend it to cover fs, env, process, exit, signals, net, http, watch, temp files, platform, console size, and a key-value index.
2. Codemod the ~2,200 `Deno.*` call sites in `src/`, `package/src` and `tests/` to the runtime layer (section 11 has the module-by-module plan). Most are one-to-one renames.
3. Replace Deno KV with a JSON index; drop the FFI plugin and its per-platform download; replace `tree-sitter-deno.js` with `web-tree-sitter`.
4. Fix the 37 syntax sites Node type stripping rejects; rewrite bare import-map aliases to `#runtime/*` and npm names.
5. Add the CI check that forbids `Deno.` outside `src/runtime/`.

Exit: full test suite green on Deno, `Deno.` appears only inside `src/runtime/`.

### Phase 2: Implement the runtime layer on Node APIs, still running on Deno (Q2 2027, 6 to 10 engineer-weeks)

1. Reimplement `src/runtime/` modules on `node:fs`, `node:child_process`, `node:http` plus `ws`, `node:net`, `node:os`. Deno 2's Node compatibility runs these, so the test suite keeps validating every change. Where Deno's compat layer is missing something, keep the Deno implementation behind the same interface until the flip.
2. Swap dependencies to their npm or JSR-on-npm forms (section 3.4). Introduce a `package.json` and a lockfile.
3. Port the test harness: assertions to `@std/assert` or `node:assert`, registration to an adapter that can target `Deno.test` now and `node:test` later.
4. Port `quarto-bld` and `configure.sh` to download Node and use esbuild directly.

Exit: `src/`, `package/src` and `tests/` contain no Deno-only code paths except the launch glue; test suite green on Deno.

### Phase 3: Flip the runtime (Q3 2027, 6 to 8 engineer-weeks)

1. Launchers (`quarto`, `quarto.cmd`, Rust `quarto.exe`) start `node bin/quarto.js` with the same V8 flags; `configure.sh` installs Node; `prepare-dist` bundles for the Node platform.
2. CI runs the full matrix (Linux, macOS, Windows, x64, arm64) on Node; keep the Deno matrix alive in parallel until parity, then remove it.
3. User-script compatibility: Node resolve hook for `stdlib/*`, vendored Deno shim with deprecation warning, `quarto install deno` tool.
4. Engine extension build moves to esbuild and `package.json`; `@quarto/types` documentation updated.
5. Installers, `quarto check`, environment variable aliases, docs on quarto.org.
6. Prerelease builds for at least one full prerelease cycle with the feature matrix (`dev-docs/feature-format-matrix`) and the Playwright suite run against them.

Exit: a Node-based prerelease passing the same test suite and feature matrix as the Deno build.

### Phase 4: Release and clean up (Q4 2027 onward)

1. First stable release on Node, with the user-script compatibility layer and a deprecation notice.
2. Remove the Deno CI matrix, `deno_cache` caching docs, `create-deno-config.ts`, `deno.jsonc`, and vendoring scripts.
3. One release later: remove the `Deno` shim for user scripts unless usage data argues for keeping it.
4. Optional: evaluate Bun as the shipped binary against startup time and installer size, now that the codebase is runtime-neutral.

### Schedule against the deadline

| Milestone | Target | Deno maintenance status |
|---|---|---|
| Decision, spike, dependency pinning | Dec 2026 | Monthly security releases |
| Boundary closed (Phase 1) | Mar 2027 | Monthly security releases |
| Runtime layer on Node APIs (Phase 2) | Jun 2027 | Monthly security releases |
| Node-based prerelease (Phase 3) | Sep 2027 | Monthly security releases |
| Node-based stable | late 2027 / early 2028 | Ends ~Oct 2027; Quarto pins the final release until the flip ships |

Quarto ships roughly two stable releases a year, so this is two release cycles: one that ships the boundary work on Deno, one that ships on Node.

## 8. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| A `deno.land/x` or skypack dependency disappears before the migration | Medium | Phase 0 vendoring, regardless of runtime choice. |
| Cliffy's prompt module does not behave under Node (raw TTY mode) | Medium | Phase 0 spike; fallback to `@inquirer/prompts` for the 28 prompt sites while keeping `@cliffy/command`. |
| deno_dom WASM is slower than the native plugin on large HTML outputs | Medium, low impact | Measure in Phase 1 on the largest test sites; HTML post-processing is a small share of render time. Fallback: `linkedom`. |
| Process-spawning differences (stdin chunking, signal handling, Windows quoting) surface as flaky tests | High, contained | `execProcess` is the single wrapper; port it first and run the smoke suite early. The current 4 KB stdin chunking hack exists because of a Deno quirk and can go. |
| Windows path edge cases (UNC, long paths) differ between runtimes | Medium | The existing `realPathSync` monkey patch documents the known cases; keep its tests. |
| Users' Deno-specific scripts break | Certain for some users | Compatibility shim, `quarto install deno`, one-release deprecation notice, migration guide. |
| Schedule slips past October 2027 | Medium | Pinned Deno keeps working; no user-facing cliff. Security exposure is limited to the local preview server and outbound HTTPS; document it. |
| Team bandwidth | High | The work is parallelizable by directory once the runtime layer interface is defined; outside contributors can take codemod chunks. |

## 9. Decisions needed from the team

1. Confirm Node as the target and "Node API surface, runtime-neutral code" as the rule.
2. Choose Node 26 LTS as the baseline (Active LTS from 2026-10-28, maintained to April 2029).
3. Decide the deprecation policy for Deno-specific `quarto run` scripts: shim plus `quarto install deno` (recommended), or hard break with a migration guide.
4. Pick the test runner (`node:test` keeps dependencies minimal; Vitest gives better watch mode and reporters).
5. Decide whether `quarto-latexmk` keeps shipping as a standalone binary.
6. Approve the Phase 0 spike and budget for Q1 2027.

## 10. Spike results (2026-10-14)

Goal: run the unmodified quarto-cli TypeScript on Node.js and see what breaks. No file under `src/` was changed. The spike lives in `.spike-node/` (tooling) and `spike-node-tests/` (documents and the Deno baseline output) at the repository root, both untracked and excluded from git. `.spike-node/README.md` explains how to rebuild and rerun it.

### Setup

- Node 22.22 (LTS) as installed in the sandbox. Deno 2.7.14, Pandoc 3.10, Dart Sass 1.101.0, Typst 0.15.1, typst-gather and esbuild downloaded by hand into `package/dist/bin/tools/`.
- Bundle: esbuild with a 100-line resolver plugin that applies `src/import_map.json` and maps `jsr:` to `@jsr/*` packages from npm.jsr.io, `npm:` and `cdn.skypack.dev` to npm, and `deno.land/x` to shallow GitHub clones at the pinned tags. Output: 1,210 modules, 5.5 MB, under one second to build. `import.meta.main` is defined as true.
- Shim: `@deno/shim-deno` 0.19.2 (110 members) plus hand-written `Deno.Command`, `Deno.openKv` (JSON file), `Deno.serve` (`node:http`), `Deno.upgradeWebSocket` (`ws`), `Deno.connect` (buffered `net.Socket`), a fake synchronous `Deno.listen`, temp-file fixes and a throwing `Deno.dlopen`. About 250 lines.
- Sandbox constraint: this session's proxy blocks `deno.land` and `cdn.skypack.dev`, so `configure.sh` cannot run here. That forced exactly the dependency re-sourcing the migration would need, and it also produced a Deno baseline: the same source running on Deno 2.7.14 with a remapped import map, used to diff outputs.

### What ran on Node

| Scenario | Result | Notes |
|---|---|---|
| `--version`, `--help`, `create project --no-prompt` | OK | Cliffy rc.3 command and prompt modules work on Node. |
| `quarto check` | OK up to Chromium | Pandoc, Dart Sass, Typst detected via spawned processes; stops at the stubbed puppeteer. |
| `render simple.qmd` (HTML, theme, TOC, callouts, crossrefs, citations, math) | OK, HTML identical to Deno | 2.35 s on Node vs 2.40 s on Deno. Sass compile and the KV-backed Sass cache work through the shim. |
| `render --to typst` and `--to docx` | OK | Typst and typst-gather spawned. |
| Website project (navbar, listing, search index) | OK, pages identical to Deno except file mtimes | 4.1 s on Node vs 4.3 s on Deno. |
| `preview` (HTTP, `quarto-preview.js`, websocket, file change → re-render → `render:start` pushed) | OK | Needed the fake `Deno.listen` (see findings). |
| Jupyter engine, Python cell plus inline expression | OK, output identical to Deno except random cell ids | 4.4 s on Node vs 5.3 s on Deno. |
| Jupyter kernel daemon over TCP, second render reuses it | OK after rewriting `Deno.connect` | 4.1 s then 2.7 s. |
| `inspect`, `pandoc --version`, `typst --version` | OK | |

Startup, five `--version` runs: 1.58 s total for the Node bundle, 1.97 s for Deno running the unbundled source with `--no-check`. Not a like-for-like comparison, but there is no startup penalty to worry about. Binary sizes: Node 123 MB, Deno 124 MB.

### Issues found (all small; this is the first slice of the Phase 1 backlog)

1. `src/core/port.ts` probes ports with a synchronous `Deno.listen`. Node can only bind asynchronously. Make `isPortAvailableSync` and `findOpenPort` async, and update the callers in preview and serve.
2. Two dynamic imports use `assert { type: "json" }` (`src/core/lib/yaml-intelligence/yaml-intelligence.ts:1211`, `parsing.ts:59`). Node 22 rejects `assert`; `with` works on both runtimes.
3. `src/format/html/format-html-shared.ts:133` iterates `Deno.readDirSync` for the bslib component Sass files and relies on the order. Node returns a different order, so eight CSS rules moved. Sort the entries; that also makes the Deno output deterministic across filesystems.
4. Cliffy rc.3 pins pre-1.0 `deno.land/std` URLs with old export names (`stripColor`, `encode`). The spike mapped them to std 0.224; moving to `@cliffy/command` 1.x on JSR, which declares Node support, removes the problem.
5. `src/execute/jupyter/jupyter-kernel.ts` routes messages larger than 1 KB through a temp file to work around a Deno `Conn` bug (issue 7737). On Node the socket write is plain; the workaround can go once the runtime layer exists.
6. `import.meta.main` has no Node equivalent; replace with an `import.meta.filename` versus `process.argv[1]` check or keep a bundler define.
7. The `deno.land/x` puppeteer port must become `puppeteer-core` from npm. It was stubbed in the spike, so Chromium-dependent features (mermaid, screenshots, `quarto check` tools) were not exercised.
8. `@deno/shim-deno` is stale (last release June 2024) and had two bugs that bit immediately (`makeTempFile*` treats the prefix as a directory, `Conn.read` fails with EAGAIN). Do not build on it; it was only useful for the spike. The plan's own `src/runtime/` layer stands.

### Not exercised

Windows and macOS, knitr and R, LaTeX PDF through TinyTeX, Chromium (mermaid, screenshots), publishing (network), extension install, `quarto run` TypeScript scripts, `build-ts-extension`, the Deno-based test harness, `quarto-bld` and installers, books, manuscripts (the `xml` package was stubbed), dashboards, OJS execution.

### What the spike changes in the plan

- Feasibility is confirmed with evidence rather than inference, and the first eight concrete fixes are known. The effort estimate stays at 6 to 9 engineer-months because the untested areas (test harness, build tooling, installers, Windows) are where the remaining work is, not the render path.
- Add a standing CI job early in Phase 1: build the Node bundle the way the spike does and run the smoke tests on it. Its failure list is a live, measurable backlog for the codemod, and it keeps the runtime boundary honest without waiting for Phase 3.
- Phase 0 item 1 (the spike) is done. Item 3 (vendoring `deno.land/x` and skypack) is confirmed as urgent: the spike could only run because those packages were re-sourced from GitHub tags and npm.

## 11. Runtime layer: what to refactor, module by module

This is the concrete version of Phase 1 and Phase 2. The principle is the one `src/deno_ral/` already follows for the standard library: application code imports Quarto's own module, never the runtime directly. Extending it to the `Deno` namespace lets the whole port happen on `main`, on Deno, one PR at a time, with the runtime binary swapped last.

### Three facts that make this tractable

- Quarto does not use `deno bundle` or `deno compile` for the CLI. `tools/deno-esbuild-bundle.ts` runs esbuild (the npm package) under Deno with the `@luca/esbuild-deno-loader` plugin, and the launchers run `deno run bin/quarto.js`. The spike's `build.mjs` is the same esbuild call with a different resolver. The only `deno compile` user is `compile-quarto-latexmk` (the `tinitex` sidecar), which is packaged independently and can keep its own schedule.
- Deno 2 runs `node:` built-ins. A module written against `node:fs` or `node:child_process` works on Deno today and on Node later, so the layer can be implemented once and tested on both runtimes before the flip.
- The `deno_ral` convention already exists and is enforced by habit in 451 files. The gap is the `Deno.*` namespace (about 1,000 call sites in `src/`, 240 in `package/src`, 840 in `tests/`) and 71 files that import std modules directly instead of through the layer.

### Where the call sites are

| Directory | `Deno.*` sites | Files |
|---|---|---|
| `src/core` | 337 | 82 |
| `src/command` | 266 | 59 |
| `src/resources` (TS tooling under resources) | 115 | 10 |
| `src/project` | 109 | 38 |
| `src/format` | 66 | 17 |
| `src/execute` | 56 | 9 |
| `src/tools` | 54 | 9 |
| `src/publish` | 43 | 15 |
| `src/extension`, `src/preview`, `src/quarto-core`, `src/config` | 41 | 11 |
| `package/src` (build tooling) | 240 | 40 |
| `tests` | 840 | 142 |

### Design rules for the layer

1. **Keep the directory name for now.** Renaming `src/deno_ral/` touches 451 import lines for no functional gain; do it in one mechanical PR at the flip if wanted.
2. **Plain filesystem and environment calls keep Deno's names** (`readTextFileSync`, `writeTextFileSync`, `statSync`, `removeSync`, `mkdirSync`, `copyFileSync`, `cwd`, `exit`, `env.get`). The codemod is then a prefix change plus an import, and reviewers can verify it by eye.
3. **Runtime-shaped APIs get Quarto's own interface**, not a copy of Deno's: process spawning, key-value store, HTTP server, TCP, file watching, signals, errors. These are the places where Node differs and where Deno-specific types leak into signatures today (45 sites: `Deno.MakeTempOptions`, `Deno.Conn`, `Deno.CommandOutput`, `Deno.Kv`, `Deno.FsEvent`, `Deno.FileInfo`, `Deno.ChildProcess`...).
4. **Error handling through predicates.** `isNotFound(e)`, `isAlreadyExists(e)`, `isPermissionDenied(e)`, `isAddrInUse(e)` replace `instanceof Deno.errors.X` (33 sites). The Node implementation maps `ENOENT`, `EEXIST`, `EACCES`, `EADDRINUSE`.
5. **No sync network calls in the interface.** Node cannot bind or connect synchronously. `findOpenPort` becomes async now, on Deno, so the callers are already correct at the flip.
6. **One implementation where possible.** Write each module on `node:` APIs and run it on Deno 2. Keep a Deno-specific branch only where Deno's compatibility layer falls short, behind the same interface.
7. **Each module ships with a unit test** that runs under the Deno harness today and under `node:test` after the flip. The module tests are the compatibility contract.

### Module plan

| Module (`src/deno_ral/`) | Status | Absorbs | Implementation notes |
|---|---|---|---|
| `fs.ts` | extend | `readTextFile[Sync]`, `readFile[Sync]`, `writeTextFile[Sync]`, `writeFile[Sync]`, `stat[Sync]`, `lstat[Sync]`, `mkdir[Sync]`, `remove[Sync]`, `rename[Sync]`, `copyFile[Sync]`, `readDir[Sync]`, `symlink[Sync]`, `readLink[Sync]`, `realPath[Sync]`, `chmod[Sync]`, `utime[Sync]`, `open`, `create`; own `FileInfo`, `DirEntry` types; error predicates. The `realPathSync` Windows monkey patch and the read-error path annotation move here. `walk`/`expandGlob` stay re-exported from `@std/fs` until the flip, then are reimplemented on `node:fs`. | About 1,300 call sites, almost all mechanical. `readDirSync` callers that depend on order get an explicit sort (one known case in `format-html-shared.ts`). |
| `temp.ts` | new | `makeTempDir[Sync]`, `makeTempFile[Sync]`, own `TempOptions` | Carries the retry loop from `core/deno/monkey-patch.ts`. `core/temp.ts` (`TempContext`) sits on top of it. |
| `env.ts` | new | `Deno.env.get/set/delete/toObject` (253 sites) | `process.env` on Node. Dotenv loading in `core/quarto.ts` keeps using it. |
| `process.ts` | extend | `Deno.Command` (51 sites, 16 outside `core/process.ts`), `Deno.run` (build tooling), `execPath`, `pid`, `args`, `exit`, `cwd`, `chdir`, `addSignalListener`, `kill`, `stdin/stdout/stderr` raw access, `isatty` | Own `SpawnOptions`, `ChildProcess` (stdin writer, stdout/stderr as `AsyncIterable<Uint8Array>`, `status` promise, `kill`), `ProcessResult` already exists in `core/process-types.ts`. Port `execProcess` first; then route the 16 direct `Deno.Command` sites through `execProcess` or the new `spawn`. Drop the 4 KB stdin chunking once off Deno. |
| `net.ts` | new | `Deno.connect`, `Deno.Conn`, `Deno.listen` (port probing) | Own `TcpConnection` (`read`, `write`, `close`). `findOpenPort`/`isPortAvailable` become async. Users: `core/port.ts`, `execute/jupyter/jupyter-kernel.ts`. The temp-file workaround for messages over 1 KB can be removed after the flip. |
| `http.ts` | new | `Deno.serve`, `Deno.upgradeWebSocket` | `serveHttp({ port, hostname, handler, signal, onListen })` returning `{ finished, shutdown }`; `upgradeWebSocket(req)` returning a browser-shaped socket. Users: `core/http-server.ts`, `core/http-devserver.ts`, `command/preview/preview.ts`, `command/call/axe/cmd.ts`. Node implementation: `node:http` plus `ws`. |
| `watch.ts` | new | `Deno.watchFs`, `Deno.FsEvent` | Own `FsEvent` type; `core/watch.ts` (polling watcher) and `project/serve/watch.ts` adopt it. Node: `fs.watch` recursive or `@parcel/watcher`. |
| `kv.ts` | new | `Deno.openKv`, `Deno.Kv` | `openKeyValueStore(path)` with `get`, `set`, `delete`, `list(prefix)`, `close`. Deno implementation wraps `Deno.Kv` today; the Node one is a JSON index or `node:sqlite`. Users: `core/cache/cache.ts`, `core/sass/cache.ts`. |
| `platform.ts` | extend | `Deno.build`, `Deno.version`, `Deno.uid`, `Deno.consoleSize`, `Deno.noColor`, `Deno.inspect` | Add `runtimeName()`/`runtimeVersion()` for `quarto check`, `consoleColumns()`, `inspect()`. |
| `main.ts` | new | `import.meta.main` (2 sites in `src`, more in `package/src`) | `isMainModule(import.meta)` comparing `import.meta.filename` to `process.argv[1]`; esbuild define at bundle time. |
| `permissions` | remove | `Deno.permissions.query` (1 site, `tools/impl/tinytex.ts`) | Replace with an `fs.access` check. |
| `ffi` | remove | `Deno.dlopen` (1 site, `core/deno-dom.ts`) | Drop the native deno_dom plugin and its per-platform download in `package/src/common/dependencies/deno_dom.ts`. |
| `colors.ts`, `semver.ts`, `base64` in `encoding.ts`, `flags.ts`, `asserts` (tests) | new or extend | the 71 files importing `fmt/colors` (27), `semver/mod.ts` (18), `encoding/base64` (12), `flags` (5), `io/*`, `fs/*`, `log`, `dotenv`, `crypto`, `async` directly | Same convention as today, enforced instead of assumed. `tests/asserts.ts` fronts the 166 `testing/asserts` imports. |

Dependency seams that already exist and need no new work: `core/deno-dom.ts` (single entry for deno_dom), `core/puppeteer.ts` (single entry for puppeteer), `deno_ral/log.ts`, `deno_ral/path.ts`, `deno_ral/tar.ts`. Cliffy is imported directly in 62 files; that is a dependency version change (`@cliffy/*` 1.x on JSR), not a runtime abstraction, and can stay as is.

### Order of work

Each step is a PR series that lands on `main` and ships on Deno. A CI check keeps the count of `Deno.` uses outside `src/deno_ral/` from going up (a ratchet: the allowed number is a committed baseline that only decreases).

1. **Boundary check in CI** (one day). A script counting `\bDeno\.` outside `src/deno_ral/` and direct std imports outside it, failing above the committed baseline. Later, a `deno lint` plugin can replace the grep.
2. **`process.ts`** (one week). Port `execProcess`, then the 16 direct `Deno.Command` sites, `exit`, `cwd`, `args`, `execPath`, signals. This is the highest-leverage module because every external tool call goes through it, and it is where Node differs most.
3. **`fs.ts` and `temp.ts` codemod** (one to two weeks). A `ts-morph` script run with `quarto run --dev` rewrites `Deno.<fsCall>(` to the layer function and adds the import; review by directory (`core`, `command`, `project`, `format`, `execute`, `publish`, `tools`, `extension`). Fold `core/deno/monkey-patch.ts` into the layer and delete it.
4. **`env.ts` codemod** (two days). Mechanical.
5. **Specialty modules** (two weeks): `net.ts` with async port probing, `http.ts` with the preview and dev server on it, `watch.ts`, `kv.ts`, `platform.ts`, `main.ts`; remove `permissions` and `ffi`; fix the two `assert { type: "json" }` imports and the `readDirSync` ordering.
6. **Types** (two days). Replace the 45 `Deno.*` type references in signatures with the layer's types.
7. **Std import seams** (two days). Route the 71 direct std imports through the layer; add `colors.ts`, `semver.ts`, `flags.ts`, `tests/asserts.ts`.
8. **`package/src` and `tests/`** (one to two weeks). Same codemod. The test harness's single `Deno.test` call goes behind a `tests/harness.ts` adapter; `package/src` drops `Deno.run` and `deno info` in favor of the layer and esbuild's metafile.
9. **Node implementations** (Phase 2, four to six weeks). Rewrite each module on `node:` APIs, running on Deno 2; keep the module unit tests green on both runtimes using the spike's bundle in a CI job.
10. **Flip** (Phase 3). Replace `tools/deno-esbuild-bundle.ts` with the plain esbuild build from the spike, point the launchers at Node, remove `deno.ns` from the type environment so the compiler finds any stragglers.

Steps 2 to 8 are the Phase 1 estimate of 6 to 8 engineer-weeks; the codemod steps are automated and the manual work concentrates in steps 2, 5 and 8.

### quarto-latexmk

`src/command/render/latexmk/quarto-latexmk.ts` shares the latexmk code with the CLI, so it becomes runtime-neutral through the same codemod. Only its packaging is Deno-specific: `compile-quarto-latexmk` calls `deno compile` to produce the `tinitex` binary. Three options, decidable later and independently of the CLI flip: keep building it with the last Deno release for a while (it is a small standalone tool with a low security surface), move it to Node's single-executable build or Bun's `--compile`, or ship it as a script run by the bundled Node. Nothing in the CLI plan waits on this choice.

## 12. Sources

Acquisition and Deno's future:
- [Deno is joining Cloudflare (deno.com)](https://deno.com/blog/cloudflare)
- [TechCrunch: Cloudflare acquires Deno](https://techcrunch.com/2026/10/10/cloudflare-acquires-deno-to-improve-its-workers-programming-model/)
- [Forbes: Cloudflare buys Deno](https://www.forbes.com/sites/janakirammsv/2026/10/10/cloudflare-buys-deno-to-run-its-workers-platform-on-your-own-servers/)
- [Quartz: one year of monthly releases, then development ends](https://qz.com/cloudflare-acquiring-deno-workers-platform-101226)
- [GIGAZINE: support ends one year after acquisition](https://gigazine.net/gsc_news/en/20261013-cloudflare-deno/)
- [Linuxiac: core development to end in 2027](https://linuxiac.com/?p=220895)

Node.js capabilities:
- [Node.js TypeScript support (type stripping stable)](https://nodejs.org/api/typescript.html)
- [node:sqlite (release candidate)](https://nodejs.org/api/sqlite.html)
- [Single executable applications (Stability 1.1)](https://nodejs.org/api/single-executable-applications.html)
- [Node.js WebSocket guide (client built in, no server)](https://nodejs.org/en/learn/getting-started/websocket)
- [Node 22 vs 24 LTS timeline](https://www.pkgpulse.com/guides/nodejs-22-vs-nodejs-24-2026)

Dependencies on Node:
- [@cliffy/command on JSR (Node, Deno, Bun)](https://jsr.io/@cliffy/command)
- [@b-fuze/deno-dom on JSR (Node support)](https://jsr.io/@b-fuze/deno-dom)
- [Using JSR with Node](https://jsr.io/docs/with/node)

Bun:
- [Bun single-file executables](https://bun.com/docs/bundler/executables)
- [The New Stack: developer concerns after the Anthropic acquisition](https://thenewstack.io/bun-developers-complaints-anthropic/)
