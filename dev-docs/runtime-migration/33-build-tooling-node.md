# PR 33: The flip: the CLI runs on Node; Deno stays as a tool

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Quarto CLI (dev launchers, installed launchers, the Windows `quarto.exe` launcher, `quarto-bld`, `prepare-dist`) runs on a pinned official Node.js binary, while `configure` and `prepare-dist` keep downloading the pinned Deno into `bin/tools/<arch>/` as a *tool* for `quarto run` and `quarto call build-ts-extension` (until PRs 35, 36 and 37), `quarto install deno` provides that tool on installs that lack it, type checking moves to `tsc` in the same PR, and the runtime environment contract (proxy, CA store, `NODE_OPTIONS`, `QUARTO_DENO*`) is kept.
**Phase:** 3. **Depends on:** PR 32 (Node CI matrix required and green), PR 31 (`QUARTO_TEST_RUNTIME`, Node harness), PR 26 (`tools/node-bundle/`, root `package.json`), PR 27b (`platform.ts`/`env.ts`/`tar.ts`/`log.ts` on `node:`), PR 25 (boundary zero), PR 24 (`package/src` codemodded), PR 20 and 20b (no deno_dom FFI; `tree-sitter`, `graphviz-wasm.js`, `deno-cri` ported), PR 19 (`runtime()`, `isMainModule`), PR 00b (lockfile policy). Task 13 additionally depends on the Spike #2 outcome recorded in `SPIKES.md`. **Unblocks:** PR 34, 35, 36, 37.
**Branch:** `rt/33-build-tooling-node`.
**Suggested executor:** Opus. Shell, batch and Rust launchers on three platforms, an atomic and locked rebuild path used by parallel test buckets, an environment contract with user-visible warnings, and a first `tsc` run need judgement.
**Size:** L (about 50 files: 2 configure scripts, 5 launchers, `main.rs`, 7 `package/src` modules, 3 `tools/node-bundle` files, `tools/typecheck/`, `tsconfig.json`, 2 new `src/` modules, 3 edited `src/` modules, CI action and 2 workflows, VS Code config, 5 test files, docs).
**Ships on:** Node. This is the flip. The full suite runs on Node (the PR 32 matrix, `QUARTO_TEST_RUNTIME` now defaulting to `node`) with Deno present as a tool, and must stay green, including the boundary-ratchet workflow.

## Spec

### Context

Assessment sections 3.6 and 7 (Phase 3, step 1) and review findings S1, S5, S6 (`REVIEW-2026-10-15.md`), decision 1 (strategy C). Quarto ships its own runtime binary under `bin/tools/<arch>/`, a single-file esbuild bundle `bin/quarto.js`, and launchers (`package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, the Rust `quarto.exe` built from `package/launcher/src/main.rs`). This PR swaps the runtime under all of them at once, so no shipped launcher still spawns Deno for the CLI after it lands (the Windows MSI keeps working: the Rust launcher change is here, not in PR 34).

Deno does not disappear. Two code paths still spawn it until later PRs move them:

- `src/core/run/deno.ts:56` (`cmd: architectureToolsPath("deno")`): `quarto run` and project `pre-render`/`post-render` `.ts` scripts, and `quarto run --dev tools/*.ts` (which the boundary-ratchet workflow uses). PR 35 makes Node the default for these.
- `src/command/call/build-ts-extension/cmd.ts:257` (`Deno.env.get("QUARTO_DENO") || architectureToolsPath("deno")`): `deno bundle`. PR 36 moves it to esbuild.

So `configure.sh`, `configure.cmd`, `quarto-bld configure` and `prepare-dist` keep downloading the Deno version pinned in `configuration` (`DENO`, bumped to 2.9.x by PR 00a) into `bin/tools/<arch>/deno` exactly as today, and both call sites resolve Deno through one new function, `denoToolBinary()`, which also finds a Deno installed by the new `quarto install deno` (for packagers and users whose install has no bundled Deno). PR 37 stops downloading it.

What changes for callers:

- Developers run `./configure.sh` as before. It now also downloads Node 26 (`.tar.gz`/`.zip` from `nodejs.org`, checksum-verified) into `package/dist/bin/tools/<arch>/node`, and runs `npm ci` at the repository root. It no longer runs `package/scripts/vendoring/vendor.sh` (the CLI's dependencies come from npm now); it still runs `package/scripts/deno_std/download.sh` (the `quarto run` stdlib cache of the Deno tool, until PR 35).
- `package/dist/bin/quarto` runs `node` on `package/dist/bin/quarto-dev.mjs`, an esbuild bundle of `src/quarto.ts` rebuilt by `tools/node-bundle/ensure.mjs` when any of its inputs changed. `quarto-bld` runs `package/dist/bin/quarto-bld.mjs` the same way.
- `prepare-dist` bundles `bin/quarto.js` with `tools/node-bundle/build.mjs`, ships `bin/tools/<arch>/node` and (until PR 37) `bin/tools/<arch>/deno`.
- `tsc --noEmit` (`npm run typecheck`) replaces the dev launcher's `deno run --check` and `run-tests.sh`'s `deno test --check`, and runs in a new CI workflow.

Why dev mode runs a bundle and not `node src/quarto.ts`: after PR 02b the source has no `enum`, parameter properties or `<T>x` casts, so Node's type stripping could load it, and PR 31's `module.registerHooks` import-map hook already resolves the bare specifiers for tests. The bundle is kept for two reasons. (1) Dev runs the exact artifact that ships: the same esbuild transform, the same resolver, the same module order, so a bundling bug shows up in dev and not first in a release. (2) Startup: unbundled, every `quarto` invocation strips and resolves about 1,200 modules through a JavaScript hook; bundled, Node loads one file. The cost is a rebuild of about one second after an edit, paid once, plus an extra short `node` process per invocation for the staleness check (`ensure.mjs`, about 50 ms: Node start plus about 730 `stat` calls, 14 ms in the review's measurement). Executors record both numbers in the PR description (Task 2 step 7).

Review of 2026-10-16 (`REVIEW-2026-10-16.md` R18 and R04, triage bucket C row 33, decisions A6 and B4), addressed here: `ensure.mjs`'s build lock treated age as proof of a crashed builder. A `quarto` invocation stopped by a debugger, by system sleep or by a slow disk keeps its lock past 120 s while esbuild is still running; another invocation removed the lock and started its own build; the first could resume, rename its bundle over the newer one and remove the second's lock in an unconditional `finally`. The lock now follows PR 30's "Lock ownership" rule (Interfaces, below): an owner marker, a liveness probe before breaking, a release and a final rename that check the marker. `ensure.mjs` cannot import `src/deno_ral/kv.ts` (it runs before any bundle exists), so the rule is copied into it, not shared, and `bundle()` gains one optional input, `beforeCommit`, so that the bundle is renamed into place only while the lock is still held (mirrored in PR 26's builder contract). The 120 s age now only governs a lock whose owner cannot be read or probed. R04's part of the row (keep `banner` and `define`, emit `__filename` and `__dirname`) was already done by B4 in Task 2 Step 4 and is checked by the review checklist. The three lock cases of Task 2 Step 2 and `ensure.mjs` itself were run on Node 26.12.0 and 22.22 while correcting the plan (numbers in Task 2 Step 6); the Deno harness run of Step 6 is the check that Deno's `node:process` accepts `process.kill(pid, 0)`.

Verified facts this plan relies on:

- Node `v26.12.0` (2026-10-14) is the newest 26.x; Node 26 is Active LTS from 2026-10-28, Maintenance LTS from 2027-10-20, end of life 2029-04-30 (nodejs/Release `schedule.json`, checked 2026-10-16). Pin the newest `26.x.y` in `https://nodejs.org/dist/index.json` at execution time.
- `https://nodejs.org/dist/v26.12.0/SHASUMS256.txt` lists `.tar.gz` and `.tar.xz` for every POSIX target (`node-v26.12.0-linux-x64.tar.gz`, `-linux-arm64.tar.gz`, `-darwin-x64.tar.gz`, `-darwin-arm64.tar.gz`) and `node-v26.12.0-win-x64.zip` (checked 2026-10-15). This plan downloads `.tar.gz` everywhere on POSIX, so `xz` is not a prerequisite.
- Node rejects `--enable-experimental-regexp-engine` inside `NODE_OPTIONS` (`node: --enable-experimental-regexp-engine is not allowed in NODE_OPTIONS`, exit 9) but accepts it on the command line; `/a+/l.test("aaa")` is `true` with it (reproduced on Node 22.22.0). Quarto's own flags therefore always go on the command line.
- Any invalid flag in `NODE_OPTIONS` aborts Node before Quarto runs (`node: --bogus is not allowed in NODE_OPTIONS`, exit 9; reproduced). Hence the sanitising below.
- Node's `fetch` and `http` ignore `HTTP(S)_PROXY`/`NO_PROXY` unless started with `--use-env-proxy` (Stability 1.1 in Node 26; fact-check 2026-10-15). On Node 22.22.0 the flag prints `[UNDICI-EHPA] Warning: EnvHttpProxyAgent is experimental` to stderr; on Node v26.12.0 it prints nothing (`HTTP_PROXY=http://127.0.0.1:9 node --use-env-proxy -e "fetch(...)"`, measured 2026-10-16). Task 9 tests stderr on the pinned 26.x and adds `--disable-warning=UNDICI-EHPA` only if that warning still prints (`--disable-warning` is Stability 2 since Node 26.7).
- `--use-system-ca` replaces Deno's `DENO_TLS_CA_STORE=system,mozilla`; `NODE_EXTRA_CA_CERTS` keeps working and is not touched.
- An ESM `.js` file whose nearest `package.json` has no `"type"` prints `[MODULE_TYPELESS_PACKAGE_JSON] Warning: ... Reparsing as ES module` on stderr (reproduced). The root `package.json` from PR 26 has no `"type"` (README convention: Node tooling is `.mjs`). So dev bundles are `.mjs` (`quarto-dev.mjs`, `quarto-bld.mjs`), and Quarto's flags include `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` because Quarto also `import()`s ESM `.js` files it does not name: `src/resources/library/dayjs/locale/*.js` (`src/core/date.ts:164`), `src/resources/js/graphviz-wasm.js` (`src/core/handlers/dot.ts:61`) and third-party engine bundles (`src/execute/engine.ts:232`). Without any `package.json` above a file, Node detects ESM silently (reproduced), which is the installed layout; `prepare-dist` also writes `bin/package.json` (`{ "type": "module" }`) so `bin/quarto.js` is ESM even when an installer places Quarto under a directory with a `"type": "commonjs"` `package.json`.
- `node --no-enable-source-maps` after `--enable-source-maps` disables them (reproduced), so a developer can turn off dev source maps with `QUARTO_NODE_OPTIONS=--no-enable-source-maps` (they slow every `.stack` access).
- `toolsPath(binary)` in `src/core/resources.ts:39-46` reads `QUARTO_<BINARY>`, so `architectureToolsPath("node")` honours `QUARTO_NODE` and `architectureToolsPath("deno")` honours `QUARTO_DENO`.
- `@types/deno@2.7.0` (2026-05-16) and `@types/node@26.6.5` (2026-10-09) exist on npm (registry `time` fields, checked 2026-10-16); `typescript@5.9.3` and `7.0.2` exist (this plan pins 5.9.3, as PR 38 did).

Assumptions about earlier PRs (state them in the PR description if they differ):

- PR 26: `tools/node-bundle/build.mjs` (resolver plugin built on `tools/node-bundle/import-map.mjs`), `tools/node-bundle/deno-shim.mjs` (banner-imported), `tools/node-bundle/check-shim.mjs`, root `package.json` (no `"type"`, `esbuild`, `ws`, the `@jsr/*` packages), `package-lock.json`, `.npmrc` with `@jsr:registry=https://npm.jsr.io`.
- PR 02 extended by the Phase 0 rework: `tools/check-runtime-boundary.ts` has scopes `src`, `src-js`, `resources`, `tests`, `package/src`, each with a baseline in `tools/runtime-boundary-baseline.json`. PR 25, 20b and 27b brought `src` and `src-js` to zero; `resources` holds the rows of PR 25's runtime residue table that PR 35 and PR 36 own (scripts and a template that never load in the CLI process: 11 `Deno.` occurrences and 1 std file after PR 25). **Task 2 refuses to delete the shim unless `src` and `src-js` are zero.**
- PR 31: `tests/run-tests.sh`/`.ps1` honour `QUARTO_TEST_RUNTIME` (`deno` default, `node` opt-in); PR 32 runs the required matrix with `node` and a nightly Deno matrix.
- PR 24: `package/src` uses `src/deno_ral/` (`args()`, `exec`, `execPath()`, `env`, fs functions) and `isMainModule(import.meta)` in `bld.ts`.
- PR 20: `DENO_DOM` is gone from `configuration`, the launchers, `devconfig.ts` and `package/src/common/dependencies/`.
- PR 00b: `deno.lock` is committed; Deno commands in `configure.*` and CI use `--frozen`. After this PR the CLI no longer reads `deno.lock`; the Deno tool still does for `quarto run --dev`.
- PR 08 vocabulary: `exec`, `spawn` merge `env` over the inherited environment unless `clearEnv: true`.

### Scope

In:
- `configuration`: `NODE`. `package/src/common/dependencies/node.ts`; `archiveUrl` treats bucket `node` like `deno`.
- `configure.sh`, `configure.cmd`, `package/scripts/common/utils.sh`: download Node (and keep downloading Deno), `npm ci`, stop running `vendor.sh`/`vendor.cmd`; `QUARTO_NODE_VERSION` override.
- `tools/node-bundle/build.mjs` (exported `bundle()`, atomic output, input list), `tools/node-bundle/ensure.mjs` (staleness from the input list, lock), deletion of `tools/node-bundle/deno-shim.mjs` and the banner import.
- `package/src/quarto-bld`, `quarto-bld.cmd` on Node.
- `package/src/util/bundle.ts` (new); `prepare-dist.ts` ships Node and Deno, writes `bin/package.json`; `tools/deno-esbuild-bundle.ts` and `bundle()` in `package/src/util/deno.ts` deleted; `validate-bundle`'s prelude gains Node globals.
- `src/webui/quarto-preview/build.ts` becomes `build.mjs`; `package/src/common/previewjs.ts`.
- `src/core/devconfig.ts`: `node`, `deno`, `packageLock`.
- The Deno CLI dev utilities of PR 25's runtime residue table (rows 6, 9, 10): `package/src/common/cyclic-dependencies.ts` and `import-report/*` on the esbuild metafile, `report-bundle-async-cycles.ts` in-process, `types-from-schema.ts` without `deno fmt`, `extract-resources.ts` without `deno check` (Task 16).
- `src/core/runtime-env.ts` (new): restore `NODE_OPTIONS`/`NODE_PATH` for children; one-time warnings for Deno-era variables. Called from `src/quarto.ts`.
- Launchers: `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs`; `check-deno-in-use.cmd` becomes `check-node-in-use.cmd`.
- Deno as a tool: `src/tools/impl/deno-paths.ts`, `src/tools/impl/deno.ts` (`quarto install deno`), the two call sites, a `test-install.yml` job.
- Type checking: `tsconfig.json`, `tsconfig.paths.json` (generated), `tools/typecheck/gen-tsconfig-paths.mjs`, `npm run typecheck`, `.github/workflows/lint.yml` (typecheck job only; PR 38 adds lint and format).
- Conditional on Spike #2: the `QUARTO_RUNTIME=node|deno` switch in the three launchers.
- Signing lists (`package/src/macos/installer.ts`, `create-release.yml` `sign-files`), the `quarto-dev` CI action caches, `tests/run-tests.sh`/`.ps1` default runtime, `.vscode/launch.json`.
- Tests, changelog, `dev-docs/upgrade-dependencies.md`.

Out:
- Installer metadata, macOS entitlements for Node, platform minimums, `quarto check` runtime row, the environment contract table and its remaining tests, conda recipe (PR 34).
- `quarto run` `.ts` on Node (PR 35). `build-ts-extension` on esbuild (PR 36). Stopping the Deno download, removing `QUARTO_RUNTIME`, deleting `deno.jsonc`, `vendor.sh`, `deno_std`, `src/vendor_deps.ts`, the Deno test branch (PR 37). `tinitex` (PR 39 removes it).
- Linting and formatting (PR 38). PR 38 also removes `@types/deno`.
- `quarto-cli.code-workspace`: `deno.path` keeps pointing at `package/dist/bin/tools/deno`, which `configure.sh` still creates as a symlink to the Deno tool; PR 37 deletes the `deno.*` keys when it stops downloading Deno.

### Interfaces

```ts
// package/src/common/dependencies/node.ts
import { Dependency } from "./dependencies.ts";
type NodeOs = "windows" | "linux" | "darwin";
type NodeArch = "x86_64" | "aarch64";
/** Official Node.js release for Quarto's five platform/arch pairs (no Windows arm64, as with Deno). */
export function node(version: string): Dependency;
/** e.g. nodeArchiveName("v26.12.0", "linux", "x86_64") === "node-v26.12.0-linux-x64.tar.gz". */
export function nodeArchiveName(version: string, os: NodeOs, arch: NodeArch): string;
/** Directory inside the archive, e.g. "node-v26.12.0-linux-x64". */
export function nodeArchiveDir(version: string, os: NodeOs, arch: NodeArch): string;
```

```ts
// package/src/util/bundle.ts
import { Configuration } from "../common/config.ts";
/** Bundle src/quarto.ts into pkg-working/bin/quarto.js (no source map) with tools/node-bundle/build.mjs. Throws on failure. */
export async function bundleQuarto(config: Configuration): Promise<void>;
```

```js
// tools/node-bundle/build.mjs (the builder contract of PR 26, Interfaces: same inputs and both modes; this PR changes the body)
/**
 * Bundle one TypeScript entry for Node with the import-map resolver.
 * Writes <outfile>, <outfile>.map (when sourcemap), <outfile>.inputs.json
 * (the esbuild metafile's input files outside node_modules, as paths relative
 * to the repository root) and, when writeMeta, <outfile>.meta.json (the
 * metafile), each through a temp file + rename. Every bundle starts with the
 * interop prelude (require, __filename, __dirname), then `banner`.
 * `beforeCommit`, when given, is called once after esbuild returns (before
 * the first file is written) and once more between writing the bundle's
 * temporary file and renaming it into place; if it throws, the temporary
 * file is removed and the error propagates (ensure.mjs passes its lock's
 * assertHeld(), so a builder whose lock was broken never overwrites the
 * newer bundle).
 * @param {{ entry: string, outfile: string, sourcemap?: boolean, banner?: string[], define?: Record<string, string>, writeMeta?: boolean, beforeCommit?: () => void }} options
 * @returns {Promise<{ outfile: string, modules: number, bytes: number, ms: number, warnings: number }>}
 */
export async function bundle(options);
// CLI: node tools/node-bundle/build.mjs --entry <file.ts> --outfile <file> [--no-sourcemap] [--write-meta] [--check-shim]
// (the `shim` option and the deno-shim.mjs import are gone; `define` defaults to {}; `beforeCommit` is new and
// optional, PR 26's builder contract lists it; build-test.mjs's fixture mode is unchanged)
```

```js
// tools/node-bundle/ensure.mjs
// CLI: node tools/node-bundle/ensure.mjs --entry <file.ts> --outfile <file.mjs>
// Rebuilds through build.mjs's bundle() when <outfile> is missing, when
// <outfile>.inputs.json is missing, when any listed input is newer than
// <outfile> or deleted, or when src/import_map.json, package-lock.json or a
// tools/node-bundle/*.mjs file is newer. Takes the lock directory
// <outfile>.lock (mkdir) under the lock ownership rule below, re-checks
// after acquiring it, builds with bundle({ beforeCommit: lock.assertHeld }),
// gives up after 300 s naming the owner. Prints one line:
//   "bundle up to date" | "bundle up to date (built by another process)" |
//   "bundled <entry> -> <outfile> (<MB> MB, <n> modules, <ms> ms; reason: <reason>)"
```

**Lock ownership (PR 30's rule, copied).** `ensure.mjs` runs before any bundle exists, so it cannot import `src/deno_ral/kv.ts`; its `withLock()` copies the rule of PR 30, Interfaces, "Lock ownership", with the build's own numbers. The lock is the directory `<outfile>.lock`, taken with `mkdir`. As soon as `mkdir` succeeds the holder writes `<lock>/owner`, one JSON line `{ "pid", "host", "nonce" }` (`process.pid`, `os.hostname()`, 8 random bytes in hex); if that write fails the directory is removed and the error propagates. A waiter that finds the directory reads the marker and probes the owner with `process.kill(pid, 0)` when the host is its own: `ESRCH` means gone, success or `EPERM` means alive, anything else (another host, no marker yet, a runtime that refuses the probe) means unknown. A gone owner's lock is broken immediately; an unknown owner's lock is broken once its directory mtime is older than 120 s (a build takes about a second, a minute on a cold, slow machine); a live owner's lock is waited for at 100 ms intervals, whatever its age. Breaking renames the directory to `<lock>.stale.<pid>.<hex>` and removes it (the loser of the rename sees `ENOENT` and retries). `release()` reads the marker back and removes the directory only when it is still this acquisition's. `assertHeld()` does the same check and throws `Error("ensure.mjs: lost the lock …")`; it is passed to `bundle()` as `beforeCommit`, so a builder whose lock was broken and retaken fails before its first write, or between its temporary file and the rename, instead of overwriting the newer bundle; the temporary file is removed. After 300 s of waiting the acquisition throws `Error("ensure.mjs: timed out after 300000 ms waiting for <lock> held by pid <n> on <host>; delete it if no build is running")`. Nothing refreshes the directory's mtime while the lock is held. What this gives is best-effort exclusion over a recomputable artifact (decision A6): a lock from another host, or one whose owner the OS cannot report, is still broken by age alone.

```ts
// src/core/runtime-env.ts
/** [saved name, original name] pairs the launchers use. */
export const kSavedNodeEnv: ReadonlyArray<readonly [string, string]>;
/** Pure: what restoreSavedNodeEnv() would set and delete. */
export function savedNodeEnvChanges(environment: Record<string, string | undefined>): { set: Record<string, string>; remove: string[] };
/** Moves QUARTO_SAVED_NODE_OPTIONS/QUARTO_SAVED_NODE_PATH back to NODE_OPTIONS/NODE_PATH in this process's environment, so every child inherits the user's values. */
export function restoreSavedNodeEnv(): void;
/** Pure: warning texts for the Deno-era variables present in `environment` (empty when QUARTO_RUNTIME_ENV_WARNED=1). */
export function runtimeEnvWarnings(environment: Record<string, string | undefined>): string[];
/** Prints runtimeEnvWarnings() through warning() and sets QUARTO_RUNTIME_ENV_WARNED=1 so child quarto processes stay quiet. */
export function warnRuntimeEnvOnce(): void;
```

```ts
// src/tools/impl/deno-paths.ts (no imports from src/tools/tools.ts: it is imported by src/core/run/deno.ts)
export const kDenoToolVersion: string;          // equals DENO in `configuration` (unit test)
export function denoInstallDir(): string;        // quartoDataDir("deno")
export function installedDenoPath(): string;     // <installDir>/deno[.exe]
export function bundledDenoPath(): string;       // <binPath>/tools/<arch>/deno[.exe] (shipped until PR 37)
/** QUARTO_DENO (when it exists), else `quarto install deno`, else the bundled tool; undefined when none exists. */
export function denoToolBinary(): string | undefined;
/** denoToolBinary() or throws: "<purpose> needs Deno, which is not installed. Run 'quarto install deno'." */
export function requireDenoToolBinary(purpose: string): string;
```

```ts
// src/tools/impl/deno.ts
import { InstallableTool } from "../types.ts";
export const denoInstallable: InstallableTool;   // name "Deno"; installs kDenoToolVersion into denoInstallDir()
```

```ts
// src/core/devconfig.ts
export interface DevConfig {
  node: string; deno: string; pandoc: string; dartsass: string; esbuild: string; typst: string;
  script: string; importMap: string; packageLock: string;
}
export function createDevConfig(node: string, deno: string, pandoc: string, dartsass: string, esbuild: string, typst: string, scriptDir: string): DevConfig;
```

Launcher contract (dev shell launcher, installed shell launcher, `quarto.cmd`, `quarto.exe`):

| Variable | Behaviour after this PR |
|---|---|
| `QUARTO_NODE` | path of the Node binary; default `<bin>/tools/<arch>/node[.exe]` |
| `QUARTO_NODE_OPTIONS` | extra `node` flags, whitespace separated, appended after Quarto's flags (so they win) |
| `QUARTO_DENO` | **never** the CLI runtime. Still locates the Deno *tool* (`denoToolBinary()`). When set while `QUARTO_NODE` is unset, quarto.js warns once that it is ignored for the CLI |
| `QUARTO_DENO_OPTIONS`, `QUARTO_DENO_EXTRA_OPTIONS` | not passed to Node (they hold Deno flags such as `--allow-all`, `--reload`, `--v8-flags=`); quarto.js warns once |
| `QUARTO_DENO_V8_OPTIONS` | comma-separated V8 flags, each passed to Node after Quarto's flags; quarto.js warns once that it is deprecated in favour of `QUARTO_NODE_OPTIONS` |
| `QUARTO_DENO_DIR`, `QUARTO_DENO_DOM` | ignored by the CLI; quarto.js warns once |
| `NODE_OPTIONS`, `NODE_PATH` | moved to `QUARTO_SAVED_NODE_OPTIONS`/`QUARTO_SAVED_NODE_PATH` before Node starts (only when set); `restoreSavedNodeEnv()` puts them back into Quarto's process environment at startup, so knitr, Jupyter, scripts and user `node` children see the user's values |
| `QUARTO_RUNTIME` | conditional (Task 13): `node` (default) or `deno`. Independent of PR 35's `QUARTO_RUN_RUNTIME`; the four combinations and the executable each uses are the table "Dual-runtime combinations until PR 37" (after Task 13) |
| `QUARTO_TS_PROFILE` | adds `--inspect-brk` (unchanged) |
| `QUARTO_LAUNCHER_DEBUG` | `1`: print the final command line (and the `ensure.mjs` line in dev) to stderr |
| `DENO_DIR`, `DENO_TLS_CA_STORE`, `DENO_NO_UPDATE_CHECK` | no longer set for the CLI; the Deno tool call sites set `DENO_NO_UPDATE_CHECK=1` themselves |

Quarto's Node flags, in order: `--enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 --use-system-ca --use-env-proxy --disable-warning=MODULE_TYPELESS_PACKAGE_JSON`, then `--enable-source-maps` in dev mode, then the translated `QUARTO_DENO_V8_OPTIONS`, then `QUARTO_NODE_OPTIONS`. `--max-heap-size`, set by the Deno launchers, is dropped (`--max-old-space-size` is the documented Node flag; the spike rendered every test document without it).

`configure.sh` overrides (shell environment): `QUARTO_NODE_VERSION` (was proposed as `NODE_VERSION`, which collides with the `NODE_VERSION` that official `node:*` Docker images export without a `v`), `DENO_VERSION`, `PANDOC_VERSION`, `DART_SASS_VERSION`, `ESBUILD_VERSION`, `TYPST_VERSION` (unchanged).

### Files

- Create: `package/src/common/dependencies/node.ts`, `package/src/util/bundle.ts`, `tools/node-bundle/ensure.mjs`, `src/webui/quarto-preview/build.mjs`, `package/scripts/windows/check-node-in-use.cmd` (renamed), `src/core/runtime-env.ts`, `src/tools/impl/deno-paths.ts`, `src/tools/impl/deno.ts`, `tsconfig.json`, `tsconfig.paths.json`, `tools/typecheck/gen-tsconfig-paths.mjs`, `.github/workflows/lint.yml`, `.vscode/tasks.json`
- Test: `tests/unit/node-dependency.test.ts`, `tests/unit/node-bundle-ensure.test.ts`, `tests/unit/runtime-env.test.ts`, `tests/unit/tools/deno-tool.test.ts`, `tests/smoke/env/launcher-env.test.ts`
- Modify (Task 16): `package/src/common/import-report/deno-info.ts` (renamed `module-graph.ts`), `package/src/common/import-report/{explain-all-cycles,explain-import-chain,find-bad-imports,find-bad-types-constants,report-risky-files,report-bundle-async-cycles}.ts`, `report-bundle-async-cycles.md`, `package/src/common/cyclic-dependencies.ts`, `src/core/schema/types-from-schema.ts`, `src/command/dev-call/build-artifacts/cmd.ts`, `src/execute/ojs/extract-resources.ts`
- Modify: `configuration` (add `NODE` after `DENO`), `configure.sh`, `configure.cmd`, `package/scripts/common/utils.sh`, `tools/node-bundle/build.mjs`, `package/src/quarto-bld`, `package/src/quarto-bld.cmd`, `package/src/common/prepare-dist.ts`, `package/src/common/archive-binary-dependencies.ts:27-33`, `package/src/common/configure.ts:28-35,47,69-78`, `package/src/common/previewjs.ts`, `package/src/common/validate-bundle.ts`, `tools/bundle-bug-finder/_prelude.js:2`, `package/src/util/deno.ts:12-41`, `src/core/devconfig.ts`, `src/quarto.ts` (`quarto()` start), `src/core/run/deno.ts:56`, `src/command/call/build-ts-extension/cmd.ts:257-258`, `src/tools/tools.ts:32-38`, `src/command/install/cmd.ts` (example), `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs`, `package/src/macos/installer.ts:90-96`, `.github/workflows/create-release.yml:398`, `.github/workflows/actions/quarto-dev/action.yml:15-36`, `.github/workflows/test-install.yml`, `tests/run-tests.sh`, `tests/run-tests.ps1`, `.vscode/launch.json`, `package.json`, `package-lock.json`, `.gitignore`, `dev-docs/upgrade-dependencies.md`, `news/changelog-1.12.md`
- Delete: `tools/deno-esbuild-bundle.ts`, `tools/node-bundle/deno-shim.mjs`, `src/webui/quarto-preview/build.ts`, `src/webui/quarto-preview/deno.jsonc`, `package/scripts/windows/check-deno-in-use.cmd`

### Acceptance criteria

- `./configure.sh` (Linux x64/arm64, macOS x64/arm64) and `./configure.cmd` (Windows x64) produce `package/dist/bin/tools/<arch>/node[.exe]` reporting the `configuration` version, `package/dist/bin/tools/<arch>/deno[.exe]` reporting `DENO`, `package/dist/config/node-version`, a populated root `node_modules/`, and `src/resources/preview/quarto-preview.js`; no `package/dist/bin/deno_cache`.
- `package/dist/bin/quarto --version` prints `99.9.9`; `package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd` succeeds; `ps` during a render shows `node`, not `deno`.
- The whole suite passes on the three OSes with `QUARTO_TEST_RUNTIME` unset (Node). This includes `tests/smoke/run/run-script.test.ts`, `tests/smoke/run/stdlib-run-version.test.ts`, `tests/smoke/project/project-prepost.test.ts`, `tests/smoke/build-ts-extension/build-ts-extension.test.ts` and `tests/smoke/create/create.test.ts`, which pass **because they still run on the Deno tool** (`src/core/run/deno.ts`, `build-ts-extension/cmd.ts`), not because scripts run on Node.
- The boundary-ratchet workflow is green: `quarto run --dev tools/check-runtime-boundary.ts` runs on the Deno tool and reports unchanged counts.
- `npm run typecheck` exits 0 locally and in `.github/workflows/lint.yml`.
- Before merge (triage A3; the rule is PR 32's, "Deno in CI after PR 32"): one green `deno-nightly` run of `Node Tests` dispatched on this branch and `parity: OK` for Linux, macOS and Windows from the same run, both linked in the PR description. The Deno fallback (Task 13), when present, is not a substitute for that run.
- `tests/smoke/env/launcher-env.test.ts` passes on the three OSes: `NODE_OPTIONS=--bogus quarto --help` exits 0; a child process (`quarto run env.lua`) sees `NODE_OPTIONS` unchanged; `QUARTO_DENO_V8_OPTIONS=--stack-trace-limit=200` reaches `node`; `QUARTO_DENO_OPTIONS=--allow-all quarto --help` exits 0 and warns once.
- `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9` produces `bin/quarto.js`, `bin/package.json`, `bin/tools/<arch>/node`, `bin/tools/<arch>/deno`, no `node-dist`; `cd package/pkg-working/bin && ./quarto check` passes; `./quarto-bld validate-bundle` passes (`test-bundle.yml`).
- `cargo build --release --manifest-path package/launcher/Cargo.toml` succeeds; `create-release.yml` dispatched with `publish-release=false` is green on all platforms, including the MSI and `test-smokes-built.yml` on the Windows zip.
- `quarto install deno` on a layout without `bin/tools/<arch>/deno` installs `kDenoToolVersion` into the Quarto data dir and `quarto run` then finds it (`test-install.yml` job).
- `tools/node-bundle/deno-shim.mjs` does not exist and `grep -n "deno-shim" tools/node-bundle/*.mjs` prints nothing (the `--check-shim` scan stays as a report).
- No code path spawns the Deno CLI for `info`, `run`, `fmt`, `check` or `bundle` outside the two Deno-tool call sites: `rg -n '"(info|fmt|check|bundle)"' package/src src -g '*.ts' -g '!src/deno_ral/**'` prints no Deno subcommand argument, and `rg -ln 'requireDenoToolBinary|denoToolBinary' src -g '*.ts'` prints exactly `src/core/run/deno.ts`, `src/command/call/build-ts-extension/cmd.ts` and the two `src/tools/impl/deno*.ts` files. `cd package/src && ./quarto-bld cycle-dependencies -o "$(mktemp -d)/cycles.json"` writes the JSON on Node (Task 16).

## Plan

### Task 1: Pin Node and add the dependency module

**Files:**
- Modify: `configuration`
- Create: `package/src/common/dependencies/node.ts`
- Modify: `package/src/common/archive-binary-dependencies.ts:27-33`
- Test: `tests/unit/node-dependency.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * node-dependency.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals } from "../asserts.ts";
import {
  node,
  nodeArchiveDir,
  nodeArchiveName,
} from "../../package/src/common/dependencies/node.ts";
import { archiveUrl } from "../../package/src/common/archive-binary-dependencies.ts";

unitTest("node dependency - archive names match nodejs.org (.tar.gz on POSIX, no xz needed)", () => {
  assertEquals(nodeArchiveName("v26.12.0", "linux", "x86_64"), "node-v26.12.0-linux-x64.tar.gz");
  assertEquals(nodeArchiveName("v26.12.0", "linux", "aarch64"), "node-v26.12.0-linux-arm64.tar.gz");
  assertEquals(nodeArchiveName("v26.12.0", "darwin", "x86_64"), "node-v26.12.0-darwin-x64.tar.gz");
  assertEquals(nodeArchiveName("v26.12.0", "darwin", "aarch64"), "node-v26.12.0-darwin-arm64.tar.gz");
  assertEquals(nodeArchiveName("v26.12.0", "windows", "x86_64"), "node-v26.12.0-win-x64.zip");
  assertEquals(nodeArchiveDir("v26.12.0", "windows", "x86_64"), "node-v26.12.0-win-x64");
});

unitTest("node dependency - downloads from nodejs.org, not the S3 archive", () => {
  const dep = node("v26.12.0");
  assertEquals(dep.bucket, "node");
  const linux = dep.architectureDependencies["x86_64"]["linux"]!;
  assertEquals(archiveUrl(dep, linux), "https://nodejs.org/dist/v26.12.0/node-v26.12.0-linux-x64.tar.gz");
  const win = dep.architectureDependencies["x86_64"]["windows"]!;
  assertEquals(archiveUrl(dep, win), "https://nodejs.org/dist/v26.12.0/node-v26.12.0-win-x64.zip");
  assertEquals(dep.architectureDependencies["aarch64"]["windows"], undefined);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-dependency.test.ts`
Expected: FAIL, module `package/src/common/dependencies/node.ts` not found.

- [ ] **Step 3: Add `NODE` to `configuration`**

Insert directly after the `export DENO=...` line (keep that line: Deno is still downloaded as a tool):

```bash
# NODE is the JavaScript runtime of the Quarto CLI (official build from https://nodejs.org/dist/).
# DENO above is still downloaded as a tool for `quarto run` and `quarto call build-ts-extension`
# until the runtime migration's PR 37.
export NODE=v26.12.0
```

(`configuration` cannot carry comments on export lines; `store_win_configuration.bat` only reads `export ` lines, so `NODE` reaches `configure.cmd` as `!NODE!`.)

- [ ] **Step 4: Implement `node.ts`**

```ts
/*
 * node.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { Dependency } from "./dependencies.ts";
import { Configuration } from "../config.ts";
import { dirname, join } from "../../../../src/deno_ral/path.ts";
import {
  chmodSync,
  copyFileSync,
  ensureDirSync,
  existsSync,
  removeSync,
  safeMoveSync,
} from "../../../../src/deno_ral/fs.ts";
import { env } from "../../../../src/deno_ral/env.ts";
import { unzip } from "../../util/utils.ts";
import { unTar } from "../../util/tar.ts";

type NodeOs = "windows" | "linux" | "darwin";
type NodeArch = "x86_64" | "aarch64";

const kNodeArch: Record<NodeArch, string> = { x86_64: "x64", aarch64: "arm64" };
const kNodeOs: Record<NodeOs, string> = { windows: "win", linux: "linux", darwin: "darwin" };
const kNodeExt: Record<NodeOs, string> = { windows: "zip", linux: "tar.gz", darwin: "tar.gz" };

export function nodeArchiveDir(version: string, os: NodeOs, arch: NodeArch): string {
  return `node-${version}-${kNodeOs[os]}-${kNodeArch[arch]}`;
}

export function nodeArchiveName(version: string, os: NodeOs, arch: NodeArch): string {
  return `${nodeArchiveDir(version, os, arch)}.${kNodeExt[os]}`;
}

export function node(version: string): Dependency {
  const release = (os: NodeOs, arch: NodeArch) => ({
    filename: nodeArchiveName(version, os, arch),
    url: `https://nodejs.org/dist/${version}/`,
    configure: async (_config: Configuration, path: string) => {
      const vendor = env.get("QUARTO_VENDOR_BINARIES");
      if (vendor !== undefined && vendor !== "true") {
        return;
      }
      const toolsDir = dirname(path);
      const archDir = join(toolsDir, arch);
      ensureDirSync(archDir);
      if (os === "windows") {
        await unzip(path, toolsDir);
      } else {
        await unTar(path, toolsDir);
      }
      // keep the whole distribution as <arch>/node-dist (npm lives there;
      // configure puts it on PATH), and the bare binary as <arch>/node.
      // prepare-dist deletes node-dist before packaging.
      const extracted = join(toolsDir, nodeArchiveDir(version, os, arch));
      const dist = join(archDir, "node-dist");
      if (existsSync(dist)) {
        removeSync(dist, { recursive: true });
      }
      safeMoveSync(extracted, dist);
      const binary = os === "windows" ? "node.exe" : "node";
      const src = os === "windows" ? join(dist, binary) : join(dist, "bin", binary);
      const dest = join(archDir, binary);
      copyFileSync(src, dest);
      if (os !== "windows") {
        chmodSync(dest, 0o755);
      }
    },
  });

  return {
    name: "Node.js runtime",
    bucket: "node",
    version,
    architectureDependencies: {
      "x86_64": {
        "windows": release("windows", "x86_64"),
        "linux": release("linux", "x86_64"),
        "darwin": release("darwin", "x86_64"),
      },
      "aarch64": {
        "linux": release("linux", "aarch64"),
        "darwin": release("darwin", "aarch64"),
      },
    },
  };
}
```

Before writing the import of `unTar`, confirm the helper: `grep -n "export async function unTar" package/src/util/tar.ts`. If it does not exist, use `unzip`'s sibling in `package/src/util/utils.ts` that `dependencies/pandoc.ts` uses for `.tar.gz` (grep `tar.gz` in `package/src/common/dependencies/`), and keep that one import.

- [ ] **Step 5: `archiveUrl`**

Replace lines 27-33 of `package/src/common/archive-binary-dependencies.ts`:

```ts
  // Runtimes come from their official release sites, not the S3 mirror.
  if (dependency.bucket === "deno" || dependency.bucket === "node") {
    return platformDependency.url + platformDependency.filename;
  } else {
    return `${kBucketBaseUrl}/${dependency.bucket}/${dependency.version}/${platformDependency.filename}`;
  }
```

- [ ] **Step 6: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-dependency.test.ts`
Expected: `2 passed`.

- [ ] **Step 7: Commit**

```bash
git add configuration package/src/common/dependencies/node.ts package/src/common/archive-binary-dependencies.ts tests/unit/node-dependency.test.ts
git commit -m "build: pin Node 26 in configuration and add the node dependency"
```

### Task 2: `build.mjs` as a library, `ensure.mjs`, shim removal

**Files:**
- Modify: `tools/node-bundle/build.mjs`
- Create: `tools/node-bundle/ensure.mjs`
- Delete: `tools/node-bundle/deno-shim.mjs`
- Modify: `.gitignore`
- Test: `tests/unit/node-bundle-ensure.test.ts`

- [ ] **Step 1: Gate: the shim must be unused**

Run:
```bash
quarto run --dev tools/check-runtime-boundary.ts
node -e 'const b=require("./tools/runtime-boundary-baseline.json"); for (const s of ["src","src-js","resources"]) console.log(s, JSON.stringify(b[s] ?? b.scopes?.[s]))'
node tools/node-bundle/build.mjs --check-shim
```
Expected: the ratchet passes; the `src` and `src-js` baselines are zero; `resources` equals the value PR 25 recorded for the rows of its runtime residue table that PR 35 and PR 36 still own (`juice.ts`, `check-usage.ts`, `ast-diagram/main.ts`, the engine template: 11 `Deno.` occurrences, 1 std file; fewer if PR 35 or 36 landed first); `--check-shim` prints `0 missing`, and every member it still lists comes from third-party code guarded by `typeof Deno` (Cliffy's `@cliffy/internal/runtime/*`, `@std/fmt/colors`). The `resources` residue is not a shim concern: those `.ts` files run as separate programs (the script runtime, or a user's engine build), never in the CLI process, and `--check-shim` scans the `.js` resources the CLI does load. **Stop and report** if `src` or `src-js` is non-zero, if `resources` exceeds the residue-table value, or if any listed member comes from `src/` or `src/resources/`: PR 20b or 27b is incomplete, and removing the shim would break renders (review S1).

- [ ] **Step 2: Write the failing test**

```ts
/*
 * node-bundle-ensure.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assert, assertEquals, assertStringIncludes } from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import {
  existsSync,
  mkdirSync,
  readDirSync,
  readTextFileSync,
  removeSync,
  statSync,
  utimeSync,
  writeTextFileSync,
} from "../../src/deno_ral/fs.ts";
import { exec, pid, spawn } from "../../src/deno_ral/process.ts";
import { env } from "../../src/deno_ral/env.ts";
import { hostname } from "node:os"; // as PR 30's kv-json.test.ts does
import { architectureToolsPath } from "../../src/core/resources.ts";

const root = env.get("QUARTO_ROOT")!;
const ensure = join(root, "tools", "node-bundle", "ensure.mjs");
// the Node binary even when the harness itself runs on Deno (QUARTO_NODE honoured)
const nodeBin = architectureToolsPath("node");
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

async function runEnsure(entry: string, outfile: string) {
  const r = await exec(nodeBin, { args: [ensure, "--entry", entry, "--outfile", outfile], cwd: root });
  assert(r.success, dec(r.stderr));
  return dec(r.stdout).trim();
}

function touchLater(file: string, than: string) {
  const t = new Date(statSync(than).mtime!.getTime() + 5000);
  utimeSync(file, t, t);
}

// A lock directory held by `owner` (R18 cases). `ageMs` backdates its mtime.
function holdLock(outfile: string, owner: { pid: number; host: string } | null, ageMs: number) {
  const lock = outfile + ".lock";
  mkdirSync(lock, { recursive: true });
  if (owner) writeTextFileSync(join(lock, "owner"), JSON.stringify({ ...owner, nonce: "test" }));
  const t = new Date(Date.now() - ageMs);
  utimeSync(lock, t, t);
  return lock;
}

function fixture() {
  const dir = makeTempDirSync({ prefix: "ensure-test" });
  // a directory named "pandoc": the old skip-list design ignored it (review finding)
  mkdirSync(join(dir, "pandoc"));
  writeTextFileSync(join(dir, "pandoc", "dep.ts"), "export const v: number = 1;\n");
  writeTextFileSync(join(dir, "main.ts"), 'import { v } from "./pandoc/dep.ts";\nconsole.log("v=" + v);\n');
  return { dir, entry: join(dir, "main.ts"), dep: join(dir, "pandoc", "dep.ts"), outfile: join(dir, "out", "main.mjs") };
}

unitTest("ensure.mjs - builds when missing, skips when fresh, rebuilds when an input changes", async () => {
  const f = fixture();
  try {
    assertStringIncludes(await runEnsure(f.entry, f.outfile), "reason: missing");
    assert(existsSync(f.outfile + ".inputs.json"));
    assertEquals(await runEnsure(f.entry, f.outfile), "bundle up to date");
    writeTextFileSync(f.dep, "export const v: number = 2;\n");
    touchLater(f.dep, f.outfile);
    assertStringIncludes(await runEnsure(f.entry, f.outfile), "pandoc/dep.ts");
    const run = await exec(nodeBin, { args: [f.outfile] });
    assertEquals(dec(run.stdout).trim(), "v=2");
  } finally {
    removeSync(f.dir, { recursive: true });
  }
});

unitTest("ensure.mjs - a new import is picked up through the edited importer", async () => {
  const f = fixture();
  try {
    await runEnsure(f.entry, f.outfile);
    writeTextFileSync(join(f.dir, "extra.ts"), 'export const w = "w";\n');
    writeTextFileSync(f.entry, 'import { w } from "./extra.ts";\nconsole.log(w);\n');
    touchLater(f.entry, f.outfile);
    assertStringIncludes(await runEnsure(f.entry, f.outfile), "main.ts");
    assert(readTextFileSync(f.outfile + ".inputs.json").includes("extra.ts"));
  } finally {
    removeSync(f.dir, { recursive: true });
  }
});

unitTest("ensure.mjs - concurrent callers build once and never see a partial bundle", async () => {
  const f = fixture();
  try {
    const outs = await Promise.all([1, 2, 3, 4].map(() => runEnsure(f.entry, f.outfile)));
    assertEquals(outs.filter((o) => o.startsWith("bundled")).length, 1, outs.join("\n"));
    const run = await exec(nodeBin, { args: [f.outfile] });
    assertEquals(dec(run.stdout).trim(), "v=1");
    const leftovers = readDirSync(join(f.dir, "out")).map((e) => e.name)
      .filter((n) => n.endsWith(".tmp") || n.includes(".lock"));
    assertEquals(leftovers, []);
  } finally {
    removeSync(f.dir, { recursive: true });
  }
});

unitTest("ensure.mjs - R18: a live owner's lock is never broken by age", async () => {
  const f = fixture();
  try {
    // the test process holds the lock, as a builder stopped for ten minutes would
    const lock = holdLock(f.outfile, { pid: pid(), host: hostname() }, 600_000);
    const t0 = Date.now();
    const child = spawn(nodeBin, { args: [ensure, "--entry", f.entry, "--outfile", f.outfile], cwd: root, stdout: "piped", stderr: "piped" });
    await new Promise((r) => setTimeout(r, 1500));
    assert(existsSync(join(lock, "owner")), "the live owner's lock was broken");
    assert(!existsSync(f.outfile), "ensure.mjs built while the lock was held");
    removeSync(lock, { recursive: true }); // the owner releases
    const status = await child.status;
    const out = dec(await new Response(child.stdout!).bytes());
    assert(status.success, dec(await new Response(child.stderr!).bytes()));
    assertStringIncludes(out, "bundled");
    assert(Date.now() - t0 >= 1500);
  } finally {
    removeSync(f.dir, { recursive: true });
  }
});

unitTest("ensure.mjs - R18: a dead owner's lock is broken at once, an ownerless old lock by age", async () => {
  const f = fixture();
  try {
    const dead = spawn(nodeBin, { args: ["-e", "0"], stdout: "null", stderr: "null" });
    await dead.status; // a pid that has exited
    holdLock(f.outfile, { pid: dead.pid, host: hostname() }, 0);
    let t0 = Date.now();
    assertStringIncludes(await runEnsure(f.entry, f.outfile), "reason: missing");
    assert(Date.now() - t0 < 60_000, "a fresh lock of a dead pid was waited for");
    removeSync(f.outfile);
    holdLock(f.outfile, null, 600_000); // no marker: the owner is unknown, the age decides
    t0 = Date.now();
    assertStringIncludes(await runEnsure(f.entry, f.outfile), "reason: missing");
    assert(Date.now() - t0 < 60_000, "an ownerless old lock was waited for");
    const leftovers = readDirSync(join(f.dir, "out")).map((e) => e.name).filter((n) => n.includes(".lock"));
    assertEquals(leftovers, []);
  } finally {
    removeSync(f.dir, { recursive: true });
  }
});

unitTest("ensure.mjs - R18: a builder whose lock was broken and retaken writes nothing and releases nothing", async () => {
  const f = fixture();
  try {
    // QUARTO_ENSURE_TEST_PAUSE_MS makes the builder sleep inside the lock, before bundle();
    // meanwhile the test breaks its lock and takes it, as a second builder would after 120 s.
    const child = spawn(nodeBin, {
      args: [ensure, "--entry", f.entry, "--outfile", f.outfile],
      cwd: root,
      env: { QUARTO_ENSURE_TEST_PAUSE_MS: "2000" },
      stdout: "piped",
      stderr: "piped",
    });
    const lock = f.outfile + ".lock";
    while (!existsSync(join(lock, "owner"))) await new Promise((r) => setTimeout(r, 20));
    removeSync(lock, { recursive: true });
    holdLock(f.outfile, { pid: pid(), host: hostname() }, 0);
    const status = await child.status;
    assert(!status.success);
    assertStringIncludes(dec(await new Response(child.stderr!).bytes()), "lost the lock");
    assert(!existsSync(f.outfile), "the resumed builder wrote its bundle over the new owner's");
    assertEquals(readTextFileSync(join(lock, "owner")).includes('"nonce":"test"'), true, "the resumed builder removed the new owner's lock");
  } finally {
    removeSync(f.dir, { recursive: true });
  }
});
```

`QUARTO_ENSURE_TEST_PAUSE_MS` is read by `ensure.mjs` only to widen the window the third case needs (Step 5); it is not documented for users.

- [ ] **Step 3: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-bundle-ensure.test.ts`
Expected: FAIL, stderr `Cannot find module '.../tools/node-bundle/ensure.mjs'`.

- [ ] **Step 4: Refactor `build.mjs`**

Keep PR 26's imports, the resolver `plugin` and the `--check-shim` scan function, and keep the builder contract of PR 26 (Interfaces): the `banner`, `define` and `writeMeta` inputs stay, because `build-test.mjs` (fixture mode, kept by PR 32 for `tests/unit/ral/layer-script.ts`) passes `banner` and `define`, and Task 16 reads `<outfile>.meta.json`. Delete the `deno-shim.mjs` banner import and the `shim` option, and make `define` default to `{}` (PR 19's `isMainModule` relies on the real `import.meta`; the CLI bundle no longer defines `import.meta.main`). Replace everything after the `plugin` definition with:

```js
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Write through a temp file and rename, so a concurrent reader sees the old
// or the new file, never a partial one. Windows can refuse a rename while
// another process holds the target briefly: retry. `beforeRename` runs
// between the two steps; if it throws, the temp file is removed and nothing
// replaces `file` (ensure.mjs's lock check, below).
async function writeAtomic(file, contents, beforeRename) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents);
  try {
    beforeRename?.();
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      if (attempt >= 9 || !["EPERM", "EBUSY", "EACCES"].includes(e.code)) {
        fs.rmSync(tmp, { force: true });
        throw e;
      }
      await sleep(100);
    }
  }
}

// Interop prelude (builder contract, PR 26): the CommonJS globals that UMD glue
// bundled into the ES module reads when `process` exists (web-tree-sitter, PR 20b).
const kPrelude = [
  'import { createRequire as __quartoCreateRequire } from "node:module";',
  'import { fileURLToPath as __quartoFileURLToPath } from "node:url";',
  'import { dirname as __quartoDirname } from "node:path";',
  "const require = __quartoCreateRequire(import.meta.url);",
  "const __filename = __quartoFileURLToPath(import.meta.url);",
  "const __dirname = __quartoDirname(__filename);",
];

/**
 * @param {{ entry: string, outfile: string, sourcemap?: boolean, banner?: string[], define?: Record<string, string>, writeMeta?: boolean, beforeCommit?: () => void }} options
 */
export async function bundle(options) {
  const entry = path.resolve(options.entry);
  const outfile = path.resolve(options.outfile);
  const sourcemap = options.sourcemap ?? true;
  const banner = options.banner ?? [];
  const define = options.define ?? {};
  const writeMeta = options.writeMeta ?? false;
  const beforeCommit = options.beforeCommit; // ensure.mjs: the lock's assertHeld()
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  const t0 = Date.now();
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node26",
    outfile,
    write: false,
    sourcemap: sourcemap ? "linked" : false,
    metafile: true,
    logLevel: "warning",
    plugins: [plugin],
    define,
    banner: { js: [...banner, ...kPrelude].join("\n") },
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: true, verbatimModuleSyntax: true } },
  });
  // Input files the bundle depends on, for ensure.mjs. node_modules is covered
  // by package-lock.json; namespaced inputs ("ns:path") are not files.
  const inputs = Object.keys(result.metafile.inputs)
    .filter((p) => !p.includes("node_modules/") && !/^[a-z-]+:/.test(p))
    .map((p) => path.relative(root, path.resolve(root, p)).split(path.sep).join("/"))
    .sort();
  let js;
  let map;
  for (const f of result.outputFiles) {
    if (f.path.endsWith(".map")) map = f.contents;
    else js = f.text;
  }
  // tools/bundle-bug-finder runs eslint over the bundle (quarto-bld validate-bundle);
  // a dependency ships an inline "eslint-disable-next-line" that eslint would honour.
  js = js.replaceAll("eslint-disable-next-line", "");
  // Nothing has been written yet: a caller whose lock was lost while esbuild
  // ran stops here. The second check sits between the bundle's temp file and
  // its rename (Interfaces, "Lock ownership").
  beforeCommit?.();
  // map, metafile and input list first, the bundle last: its mtime is the freshness stamp
  if (map) await writeAtomic(outfile + ".map", map);
  if (writeMeta) await writeAtomic(outfile + ".meta.json", JSON.stringify(result.metafile));
  await writeAtomic(outfile + ".inputs.json", JSON.stringify(inputs, null, 1) + "\n");
  await writeAtomic(outfile, js, beforeCommit);
  return { outfile, modules: Object.keys(result.metafile.inputs).length, bytes: Buffer.byteLength(js), ms: Date.now() - t0, warnings: result.warnings.length };
}

function parseArgs(argv) {
  const opts = { sourcemap: true, checkShim: false, writeMeta: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--entry") opts.entry = argv[++i];
    else if (a === "--outfile") opts.outfile = argv[++i];
    else if (a === "--no-sourcemap") opts.sourcemap = false;
    else if (a === "--write-meta") opts.writeMeta = true;
    else if (a === "--check-shim") opts.checkShim = true;
    else throw new Error(`build.mjs: unknown argument ${a}`);
  }
  opts.entry ??= path.join(root, "src", "quarto.ts");
  opts.outfile ??= path.join(root, "tools", "node-bundle", "dist", "quarto.mjs");
  return opts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  const r = await bundle(opts);
  console.log(
    `bundled ${path.relative(root, path.resolve(opts.entry))} -> ${path.relative(root, path.resolve(opts.outfile))} (${(r.bytes / 1e6).toFixed(1)} MB, ${r.modules} modules, ${r.ms} ms)`,
  );
  if (opts.checkShim) {
    // PR 26's scan, unchanged: lists Deno.<member> references left in the bundle
    process.exitCode = checkShim(path.resolve(opts.outfile));
  }
}
```

`verbatimModuleSyntax: true` matches PR 02b's `deno.jsonc` setting (type-only imports are written `import type` and erased). If PR 26 named the scan function differently, keep its name in the last line. `build-test.mjs` needs no change: it passes `banner` and `define` and never passed `shim`; `beforeCommit` is optional and only `ensure.mjs` passes it (PR 26's builder contract has the row). Then:

```bash
git rm tools/node-bundle/deno-shim.mjs
grep -rn "deno-shim" tools package .github | grep -v runtime-migration
```
Expected: no output (fix any leftover reference, e.g. in `tools/node-bundle/quarto-node`, by deleting the line).

- [ ] **Step 5: Write `ensure.mjs`**

```js
// tools/node-bundle/ensure.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Rebuild a dev bundle when its inputs changed. Used by the dev launchers and
// quarto-bld on every invocation, possibly by several processes at once
// (tests/run-parallel-tests.ts runs test buckets in parallel and many tests
// spawn `quarto`), hence the lock and build.mjs's atomic writes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import { randomBytes } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kLockStaleMs = 120_000; // only for a lock whose owner cannot be probed
const kLockTimeoutMs = 300_000;
const kLockRetryMs = 100;

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--entry") opts.entry = path.resolve(argv[++i]);
    else if (argv[i] === "--outfile") opts.outfile = path.resolve(argv[++i]);
    else throw new Error(`ensure.mjs: unknown argument ${argv[i]}`);
  }
  if (!opts.entry || !opts.outfile) {
    throw new Error("usage: node tools/node-bundle/ensure.mjs --entry <file.ts> --outfile <file.mjs>");
  }
  return opts;
}

function mtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

// Files whose change can change any bundle: the import map, the lockfile, the bundler itself.
function globalInputs() {
  const files = [path.join(root, "src", "import_map.json"), path.join(root, "package-lock.json")];
  for (const f of fs.readdirSync(here)) {
    if (f.endsWith(".mjs")) files.push(path.join(here, f));
  }
  return files;
}

function staleReason(opts) {
  const built = mtime(opts.outfile);
  if (built === null) return "missing";
  let inputs;
  try {
    inputs = JSON.parse(fs.readFileSync(opts.outfile + ".inputs.json", "utf8"));
  } catch {
    return "no input list";
  }
  for (const f of globalInputs()) {
    const m = mtime(f);
    if (m !== null && m > built) return path.relative(root, f);
  }
  for (const rel of inputs) {
    const m = mtime(path.join(root, rel));
    if (m === null) return `${rel} (deleted)`;
    if (m > built) return rel;
  }
  return null;
}

// The lock ownership rule, copied from src/deno_ral/kv.ts (PR 30, Interfaces,
// "Lock ownership"; this file runs before any bundle exists and cannot import
// the layer). The lock directory holds one file, `owner` (pid, host, nonce),
// written as soon as mkdir succeeds. A waiter asks the OS whether the owner
// is alive (`process.kill(pid, 0)`): a dead owner's lock is broken at once; a
// live owner's lock is waited for, however old (a `quarto` stopped by a
// debugger or by system sleep still holds it); a lock whose owner cannot be
// checked (no marker yet, another host, kill refused) falls back to age and
// is broken after kLockStaleMs. Breaking is a rename (only one breaker wins;
// the others see ENOENT and retry). Releasing removes the directory only
// while `owner` still carries this acquisition's marker, and bundle() checks
// the same before its first write and before renaming the bundle into place
// (`beforeCommit`), so a builder that resumes after its lock was broken
// neither overwrites the newer bundle nor deletes the next owner's lock.
const kOwnerFile = "owner";

function readOwner(lockDir) {
  let raw;
  try {
    raw = fs.readFileSync(path.join(lockDir, kOwnerFile), "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return undefined; // not written yet, or the lock is gone
    throw e;
  }
  try {
    const o = JSON.parse(raw);
    if (typeof o?.pid === "number" && typeof o?.host === "string" && typeof o?.nonce === "string") {
      return { raw, owner: o };
    }
  } catch {
    // fall through
  }
  return { raw, owner: undefined };
}

// true: alive; false: no such process; undefined: cannot tell from here.
function ownerAlive(owner) {
  if (owner.host !== hostname()) return undefined;
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (e) {
    if (e.code === "ESRCH") return false;
    if (e.code === "EPERM") return true; // exists, owned by another user
    return undefined;
  }
}

function breakLock(lockDir) {
  const stale = `${lockDir}.stale.${process.pid}.${randomBytes(4).toString("hex")}`;
  try {
    fs.renameSync(lockDir, stale);
    fs.rmSync(stale, { recursive: true, force: true });
  } catch (e) {
    if (e.code !== "ENOENT") throw e; // another process broke it first
  }
}

async function acquireLock(lockDir) {
  const deadline = Date.now() + kLockTimeoutMs;
  let lastOwner;
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    const m = mtime(lockDir);
    if (m === null) continue; // released between mkdir and stat
    const marker = readOwner(lockDir);
    lastOwner = marker?.owner;
    const alive = lastOwner ? ownerAlive(lastOwner) : undefined;
    if (alive === false || (alive === undefined && Date.now() - m > kLockStaleMs)) {
      breakLock(lockDir);
      continue;
    }
    if (Date.now() > deadline) {
      const who = lastOwner ? `pid ${lastOwner.pid} on ${lastOwner.host}` : "an unknown process";
      throw new Error(
        `ensure.mjs: timed out after ${kLockTimeoutMs} ms waiting for ${lockDir} held by ${who}; delete it if no build is running`,
      );
    }
    await sleep(kLockRetryMs);
  }
  const raw = JSON.stringify({ pid: process.pid, host: hostname(), nonce: randomBytes(8).toString("hex") });
  try {
    fs.writeFileSync(path.join(lockDir, kOwnerFile), raw);
  } catch (e) {
    fs.rmSync(lockDir, { recursive: true, force: true });
    throw e;
  }
  const held = () => readOwner(lockDir)?.raw === raw;
  return {
    assertHeld() {
      if (!held()) throw new Error(`ensure.mjs: lost the lock ${lockDir}: it was broken and taken by another process`);
    },
    release() {
      if (held()) fs.rmSync(lockDir, { recursive: true, force: true });
    },
  };
}

async function withLock(lockDir, fn) {
  const lock = await acquireLock(lockDir);
  try {
    return await fn(lock);
  } finally {
    lock.release();
  }
}

const opts = parseArgs(process.argv.slice(2));
if (staleReason(opts) === null) {
  console.log("bundle up to date");
} else {
  fs.mkdirSync(path.dirname(opts.outfile), { recursive: true });
  await withLock(opts.outfile + ".lock", async (lock) => {
    const reason = staleReason(opts); // another process may have built it meanwhile
    if (reason === null) {
      console.log("bundle up to date (built by another process)");
      return;
    }
    // Test hook (node-bundle-ensure.test.ts, R18): widen the window in which a
    // waiter can break and take this lock, as a stopped process would.
    if (process.env.QUARTO_ENSURE_TEST_PAUSE_MS) await sleep(Number(process.env.QUARTO_ENSURE_TEST_PAUSE_MS));
    lock.assertHeld();
    const { bundle } = await import("./build.mjs"); // esbuild is loaded only when building
    const r = await bundle({ entry: opts.entry, outfile: opts.outfile, sourcemap: true, beforeCommit: () => lock.assertHeld() });
    console.log(
      `bundled ${path.relative(root, opts.entry)} -> ${path.relative(root, opts.outfile)} (${(r.bytes / 1e6).toFixed(1)} MB, ${r.modules} modules, ${r.ms} ms; reason: ${reason})`,
    );
  });
}
```

Add to `.gitignore` under `# generated javascript`:

```
package/dist/bin/*.mjs
package/dist/bin/*.mjs.map
package/dist/bin/*.inputs.json
```

(`package/dist` is already ignored as a whole on `main`: `grep -n "package/dist" .gitignore`; if it is, skip this edit.)

- [ ] **Step 6: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-bundle-ensure.test.ts`
Expected: `6 passed`. (The three R18 cases and `ensure.mjs` were run while correcting the plan, transliterated to `node:test` with `fixture()` in a temp directory, on Node 26.12.0 and 22.22, same numbers on both: four concurrent callers built once with no leftover; a 600 s old lock of a live pid was waited for until released (1.6 s), then built; a fresh lock of a dead pid was broken in 3 ms and an ownerless 600 s old lock in 1 ms; a builder paused inside the lock whose lock was broken and retaken exited 1 with `lost the lock`, wrote no bundle and left the new owner's marker in place.)

- [ ] **Step 7: Measure and record**

Run (after Task 9 wires the launcher; come back to this step then):
```bash
package/dist/bin/quarto --version >/dev/null   # dev --version does not run node
time (package/dist/bin/quarto --help >/dev/null)
time (node tools/node-bundle/ensure.mjs --entry src/quarto.ts --outfile package/dist/bin/quarto-dev.mjs)
touch src/core/path.ts && time (node tools/node-bundle/ensure.mjs --entry src/quarto.ts --outfile package/dist/bin/quarto-dev.mjs)
```
Expected: the fresh check prints `bundle up to date`; the rebuild prints `bundled ... reason: src/core/path.ts`. Put the three timings in the PR description.

- [ ] **Step 8: Commit**

```bash
git add tools/node-bundle tests/unit/node-bundle-ensure.test.ts .gitignore
git commit -m "build: bundle() with atomic writes and input list; ensure.mjs with lock; drop the Deno shim"
```

### Task 3: `configure.sh`, `configure.cmd`, `utils.sh`

**Files:**
- Modify: `package/scripts/common/utils.sh`, `configure.sh`, `configure.cmd`
- Rename: `package/scripts/windows/check-deno-in-use.cmd` -> `check-node-in-use.cmd`

- [ ] **Step 1: `utils.sh`: add the Node variables, keep the Deno ones**

Append to `package/scripts/common/utils.sh` (after the existing `DENOFILES`/`DENO_ARCH_DIR` block, which stays for the Deno tool):

```bash
# Node.js archive for this platform (https://nodejs.org/dist/$NODE/). .tar.gz
# rather than .tar.xz so that xz is not a prerequisite. NODE comes from
# `configuration`, sourced before this file by configure.sh; quarto-bld
# sources this file first, so the names are computed lazily by node_archive().
NODEURL=https://nodejs.org/dist
node_archive() {
  if [[ $OSTYPE == 'darwin'* ]]; then
    if [[ $DENO_ARCH_DIR == "aarch64" ]]; then echo "node-${NODE}-darwin-arm64.tar.gz"; else echo "node-${NODE}-darwin-x64.tar.gz"; fi
  else
    if [[ $DENO_ARCH_DIR == "aarch64" ]]; then echo "node-${NODE}-linux-arm64.tar.gz"; else echo "node-${NODE}-linux-x64.tar.gz"; fi
  fi
}
```

`DENO_ARCH_DIR` is the `tools/<arch>` directory name for both runtimes (`x86_64`/`aarch64`); PR 37 renames it to `ARCH_DIR` when the Deno variables go.

- [ ] **Step 2: `configure.sh`**

Replace the whole file:

```bash
#!/usr/bin/env bash
set -ex
source configuration

# Defaults are set in configuration file, but can be overridden here.
#  We can't put these overrides in the configuration file because it is parsed
#  very naively on windows. QUARTO_NODE_VERSION, not NODE_VERSION: official
#  node:* Docker images export NODE_VERSION (without the leading v).
export NODE=${QUARTO_NODE_VERSION=$NODE}
export DENO=${DENO_VERSION=$DENO}
export PANDOC=${PANDOC_VERSION=$PANDOC}
export DARTSASS=${DART_SASS_VERSION=$DARTSASS}
export ESBUILD=${ESBUILD_VERSION=$ESBUILD}
export TYPST=${TYPST_VERSION=$TYPST}

source package/scripts/common/utils.sh
source package/src/set_package_paths.sh

# Selects curl or wget based on availability and https support.
function download() {
	url=$1
	destination=$2

	if curl --version | grep -qF ' https '; then
	  curl --fail -L -o "$destination" "$url"
	else
	  wget -q -O "$destination" "$url"
	fi
}

# sha256 check of one file against nodejs.org's SHASUMS256.txt
function verify_sha256() {
  if command -v sha256sum > /dev/null; then
    grep " $1\$" SHASUMS256.txt | sha256sum -c -
  else
    grep " $1\$" SHASUMS256.txt | shasum -a 256 -c -
  fi
}

QUARTO_VENDOR_BINARIES=${QUARTO_VENDOR_BINARIES=true}

NODE_BIN=${QUARTO_NODE=$QUARTO_BIN_PATH/tools/$DENO_ARCH_DIR/node}
DENO_BIN=$QUARTO_BIN_PATH/tools/$DENO_ARCH_DIR/deno

if [[ "${QUARTO_VENDOR_BINARIES}" = "true" ]]; then
  NODE_ARCHIVE=$(node_archive)
  DENO_VERSION_NO_V=$(echo "$DENO" | sed 's/v//')
  NEED_NODE=false
  NEED_DENO=false
  if [[ (! -f "$NODE_BIN") || "$("$NODE_BIN" --version)" != "$NODE" ]]; then NEED_NODE=true; fi
  if [[ (! -f "$DENO_BIN") || $("$DENO_BIN" --version | grep "$DENO_VERSION_NO_V") == "" ]]; then NEED_DENO=true; fi

  if [[ "$NEED_NODE" = "true" || "$NEED_DENO" = "true" ]]; then
    # CI sets QUARTO_SKIP_DENO_CACHE_WIPE=1 so restored caches survive.
    if [ "${QUARTO_SKIP_DENO_CACHE_WIPE}" != "1" ]; then
      rm -rf "$QUARTO_DIST_PATH"
    fi
    mkdir -p "$QUARTO_BIN_PATH/tools/$DENO_ARCH_DIR" "$QUARTO_BIN_PATH/../config"
    pushd "$QUARTO_BIN_PATH/tools"

    echo "Bootstrapping Node.js $NODE..."
    download "$NODEURL/$NODE/$NODE_ARCHIVE" "$NODE_ARCHIVE"
    download "$NODEURL/$NODE/SHASUMS256.txt" SHASUMS256.txt
    verify_sha256 "$NODE_ARCHIVE"
    rm SHASUMS256.txt
    tar -xzf "$NODE_ARCHIVE"
    rm -rf "$DENO_ARCH_DIR/node-dist"
    mv "${NODE_ARCHIVE%.tar.gz}" "$DENO_ARCH_DIR/node-dist"
    cp "$DENO_ARCH_DIR/node-dist/bin/node" "$DENO_ARCH_DIR/node"
    chmod 755 "$DENO_ARCH_DIR/node"
    rm "$NODE_ARCHIVE"
    echo "$NODE" > "$QUARTO_BIN_PATH/../config/node-version"

    # Deno stays as a tool for `quarto run` and `quarto call build-ts-extension`
    # until the runtime migration's PR 37.
    echo "Bootstrapping Deno $DENO (tool)..."
    for DENOFILE in $DENOFILES; do
      download "$DENOURL/$DENO/$DENOFILE" "$DENOFILE"
      unzip -o "$DENOFILE"
      mv deno "$DENO_ARCH_DIR"
      rm "$DENOFILE"
    done
    # one quarto-cli.code-workspace for every arch (deno.path)
    ln -sf "$DENO_ARCH_DIR/deno" deno
    echo "$DENO" > "$QUARTO_BIN_PATH/../config/deno-version"

    popd
  fi
  export QUARTO_NODE=$QUARTO_BIN_PATH/tools/$DENO_ARCH_DIR/node
  # npm from the downloaded distribution (its shebang resolves `node` on PATH)
  export PATH="$QUARTO_BIN_PATH/tools/$DENO_ARCH_DIR/node-dist/bin:$PATH"
else
  if [ -z "$QUARTO_NODE" ]; then
    echo "QUARTO_NODE is not set. Allow QUARTO_VENDOR_BINARIES or set QUARTO_NODE to the path of a node binary."
    exit 1
  fi
  if ! command -v npm > /dev/null; then
    echo "npm not found on PATH. QUARTO_VENDOR_BINARIES=false requires npm from the same Node installation as QUARTO_NODE."
    exit 1
  fi
  if [ -z "$QUARTO_DENO" ]; then
    echo "QUARTO_DENO is not set: \`quarto run\` .ts scripts and \`quarto call build-ts-extension\` will need \`quarto install deno\`."
  fi
fi

# Neither the build nor npm should see the user's Node settings.
unset NODE_OPTIONS NODE_PATH

echo "Installing TypeScript dependencies (npm ci)"
npm ci --no-audit --no-fund

echo "Downloading Deno Stdlib (for quarto run scripts on the Deno tool)"
QUARTO_DENO="$DENO_BIN" "${QUARTO_PACKAGE_PATH}/scripts/deno_std/download.sh"

pushd "$QUARTO_PACKAGE_PATH/src/"
./quarto-bld configure --log-level info
popd

if ! quarto_loc="$(type -p quarto)" || [[ -z $quarto_loc ]]; then
  echo "Quarto symlink doesn't appear to be configured."
else
  quarto --version
fi
```

With `QUARTO_VENDOR_BINARIES=false` and `QUARTO_DENO` unset, `download.sh` cannot run; guard that line with `if [ -x "${QUARTO_DENO:-$DENO_BIN}" ]; then ... fi` and use `${QUARTO_DENO:-$DENO_BIN}` as the value. The `DENO_CANARY_COMMIT` upgrade block of the old file is dropped (Deno is a pinned tool now).

- [ ] **Step 3: `configure.cmd`**

Replace the `if "%QUARTO_VENDOR_BINARIES%" == "true" (` block and everything after it with:

```bat
SET "DENO_ARCH_DIR=x86_64"
SET "NODE_ARCHIVE_DIR=node-!NODE!-win-x64"
SET "NODE_ARCHIVE=!NODE_ARCHIVE_DIR!.zip"
IF DEFINED QUARTO_NODE_VERSION SET "NODE=!QUARTO_NODE_VERSION!"

if "%QUARTO_VENDOR_BINARIES%" == "true" (

  IF NOT "!QUARTO_SKIP_DENO_CACHE_WIPE!"=="1" (
    REM Windows: refuse to delete package/dist while node.exe or deno.exe runs from it
    call package\scripts\windows\check-node-in-use.cmd "!QUARTO_DIST_PATH!"
    if "!ERRORLEVEL!"=="1" exit /B 1

    echo Removing package/dist/ directory...
    RMDIR /S /Q "!QUARTO_DIST_PATH!" 2>NUL
    if exist "!QUARTO_DIST_PATH!" (
      echo Error: Could not delete package/dist/ directory. Close applications using it and run configure.cmd again.
      exit /B 1
    )
  )

  IF NOT EXIST "!QUARTO_BIN_PATH!\tools\!DENO_ARCH_DIR!" MKDIR "!QUARTO_BIN_PATH!\tools\!DENO_ARCH_DIR!"
  IF NOT EXIST "!QUARTO_BIN_PATH!\..\config" MKDIR "!QUARTO_BIN_PATH!\..\config"
  PUSHD "!QUARTO_BIN_PATH!\tools"

  ECHO Bootstrapping Node.js !NODE!...
  CURL --fail -L "https://nodejs.org/dist/!NODE!/!NODE_ARCHIVE!" -o "!NODE_ARCHIVE!"
  REM Windows 10 1803+ ships bsdtar as System32\tar; it extracts .zip. Absolute
  REM path in case Git for Windows' GNU tar is first on PATH.
  %WINDIR%\System32\tar -xf "!NODE_ARCHIVE!"
  IF ERRORLEVEL 1 (
    ECHO tar failed; trying to unzip...
    unzip -o "!NODE_ARCHIVE!"
  )
  IF ERRORLEVEL 1 (
    ECHO Unable to decompress !NODE_ARCHIVE!
    exit /B 1
  )
  DEL "!NODE_ARCHIVE!"
  IF EXIST "!DENO_ARCH_DIR!\node-dist" RMDIR /S /Q "!DENO_ARCH_DIR!\node-dist"
  MOVE "!NODE_ARCHIVE_DIR!" "!DENO_ARCH_DIR!\node-dist" > NUL
  COPY /Y "!DENO_ARCH_DIR!\node-dist\node.exe" "!DENO_ARCH_DIR!\node.exe" > NUL
  ECHO !NODE!> "!QUARTO_BIN_PATH!\..\config\node-version"

  ECHO Bootstrapping Deno !DENO! ^(tool^)...
  PUSHD !DENO_ARCH_DIR!
  SET "DENO_FILE=deno-x86_64-pc-windows-msvc.zip"
  CURL --fail -L "https://github.com/denoland/deno/releases/download/!DENO!/!DENO_FILE!" -o "!DENO_FILE!"
  %WINDIR%\System32\tar -xf "!DENO_FILE!"
  IF ERRORLEVEL 1 (
    ECHO Unable to decompress !DENO_FILE!
    exit /B 1
  )
  DEL "!DENO_FILE!"
  POPD
  ECHO !DENO!> "!QUARTO_BIN_PATH!\..\config\deno-version"

  SET "QUARTO_NODE=!QUARTO_BIN_PATH!\tools\!DENO_ARCH_DIR!\node.exe"
  SET "DENO_TOOL=!QUARTO_BIN_PATH!\tools\!DENO_ARCH_DIR!\deno.exe"
  SET "PATH=!QUARTO_BIN_PATH!\tools\!DENO_ARCH_DIR!\node-dist;!PATH!"
  POPD
) ELSE (
  IF NOT DEFINED QUARTO_NODE (
    ECHO QUARTO_NODE is not set. Allow QUARTO_VENDOR_BINARIES or set QUARTO_NODE to the path of node.exe.
    EXIT /B 1
  )
  SET "DENO_TOOL=!QUARTO_DENO!"
)

SET "NODE_OPTIONS="
SET "NODE_PATH="

ECHO Installing TypeScript dependencies (npm ci)
CALL npm ci --no-audit --no-fund
IF ERRORLEVEL 1 EXIT /B 1

IF DEFINED DENO_TOOL (
  ECHO Downloading Deno Stdlib ^(for quarto run scripts on the Deno tool^)
  SET "QUARTO_DENO=!DENO_TOOL!"
  CALL !QUARTO_PACKAGE_PATH!\scripts\deno_std\download.bat
)

PUSHD !QUARTO_PACKAGE_PATH!\src
ECHO Configuring Quarto from !cd!
CALL .\quarto-bld.cmd configure --log-level info
IF ERRORLEVEL 1 EXIT /B 1
POPD

IF EXIST !QUARTO_BIN_PATH!\quarto.cmd (
  CALL "!QUARTO_BIN_PATH!\quarto" --version
)

ECHO NOTE: To use quarto please use quarto.cmd (located in this folder) or add the following path to your PATH
ECHO !QUARTO_BIN_PATH!

endlocal & set QUARTO_BIN_DEV=%QUARTO_BIN_PATH%

GOTO :eof
```

The `QUARTO_DENO_DIR`/`DENO_DIR` block, the `vendor.cmd` call and `SET QUARTO_DENO_EXTRA_OPTIONS=--reload` are gone (they configured the CLI's Deno; `--reload` would now be passed to nothing).

- [ ] **Step 4: `check-node-in-use.cmd`**

```bash
git mv package/scripts/windows/check-deno-in-use.cmd package/scripts/windows/check-node-in-use.cmd
grep -n -i "deno" package/scripts/windows/check-node-in-use.cmd
```

Edit every listed line so the script checks both `node.exe` and `deno.exe` processes whose path is under the given directory: duplicate the `Get-Process -Name deno` PowerShell query as `Get-Process -Name node,deno` (one query, both names), rename `DENO_CHECK_PATH` to `RUNTIME_CHECK_PATH`, and change the user-facing texts to `Node.js or Deno is running from this directory` / `Please close Node.js and Deno processes` / `Node.js/Deno processes from this directory:`.
Run: `grep -n -i "deno" package/scripts/windows/check-node-in-use.cmd`
Expected: only the `-Name node,deno` line and the three message lines.

- [ ] **Step 5: Run `./configure.sh`** (after Task 4; `quarto-bld configure` needs it)

Run: `./configure.sh 2>&1 | tail -15; ls package/dist/bin/tools/x86_64/; cat package/dist/config/node-version package/dist/config/deno-version; ls package/dist/bin/deno_cache`
Expected: ends with `99.9.9`; the tools dir lists `node`, `node-dist/`, `deno`, `pandoc`, `dart-sass/`, `esbuild`, `typst`, `typst-gather`; the two version files print the `configuration` values; `ls ... deno_cache` fails with `No such file or directory`.
Then: `QUARTO_NODE_VERSION=v26.12.0 NODE_VERSION=26.12.0 ./configure.sh 2>&1 | grep -c "Bootstrapping Node.js v26.12.0"` prints `1` or `0` (0 when nothing needed downloading), never a 404.

- [ ] **Step 6: Commit**

```bash
git add configure.sh configure.cmd package/scripts/common/utils.sh package/scripts/windows/check-node-in-use.cmd
git commit -m "build: configure downloads Node and keeps Deno as a tool; npm ci replaces vendoring"
```

### Task 4: `quarto-bld` on Node

**Files:**
- Modify: `package/src/quarto-bld`, `package/src/quarto-bld.cmd`

- [ ] **Step 1: `quarto-bld`**

```bash
#!/usr/bin/env bash
set -e

export SCRIPT_PATH=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

source "${SCRIPT_PATH}/../scripts/common/utils.sh"
source "${SCRIPT_PATH}/../../configuration"
source "${SCRIPT_PATH}/set_package_paths.sh"

if [ -z "$QUARTO_NODE" ]; then
  export QUARTO_NODE=$SCRIPT_PATH/../dist/bin/tools/$DENO_ARCH_DIR/node
fi
# Tasks that still drive Deno (deno_std download, compile-quarto-latexmk until PR 39) find the tool here.
if [ -z "$QUARTO_DENO" ]; then
  export QUARTO_DENO=$SCRIPT_PATH/../dist/bin/tools/$DENO_ARCH_DIR/deno
fi

export RUST_BACKTRACE=full
# The build never inherits the user's Node settings (no restore needed: quarto-bld spawns build tools only).
unset NODE_OPTIONS NODE_PATH

# bld.ts imports src/ through src/import_map.json, which Node cannot read, so
# it is bundled first; ensure.mjs rebuilds only when an input changed.
BLD_BUNDLE="$SCRIPT_PATH/../dist/bin/quarto-bld.mjs"
"$QUARTO_NODE" "$QUARTO_ROOT/tools/node-bundle/ensure.mjs" --entry "$SCRIPT_PATH/bld.ts" --outfile "$BLD_BUNDLE" > /dev/null

# --enable-experimental-regexp-engine is required for /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
exec "$QUARTO_NODE" --enable-experimental-regexp-engine --stack-trace-limit=100 --use-system-ca --use-env-proxy --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --enable-source-maps "$BLD_BUNDLE" "$@"
```

`QUARTO_ROOT` comes from `set_package_paths.sh` (`grep -n QUARTO_ROOT package/src/set_package_paths.sh`).

- [ ] **Step 2: `quarto-bld.cmd`**

```bat
@ECHO OFF

if NOT DEFINED WIN_CONFIG_TRANSLATED call %~dp0\store_win_configuration.bat
call %~dp0\..\..\win_configuration.bat

if NOT DEFINED QUARTO_NODE (
  SET "QUARTO_NODE=%~dp0\..\dist\bin\tools\x86_64\node.exe"
)
if NOT DEFINED QUARTO_DENO (
  SET "QUARTO_DENO=%~dp0\..\dist\bin\tools\x86_64\deno.exe"
)
SET "RUST_BACKTRACE=full"
SET "NODE_OPTIONS="
SET "NODE_PATH="

SET "BLD_BUNDLE=%~dp0\..\dist\bin\quarto-bld.mjs"
"%QUARTO_NODE%" "%QUARTO_ROOT%tools\node-bundle\ensure.mjs" --entry "%~dp0\bld.ts" --outfile "%BLD_BUNDLE%" > NUL
IF ERRORLEVEL 1 EXIT /B 1

REM --enable-experimental-regexp-engine is required for /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
"%QUARTO_NODE%" --enable-experimental-regexp-engine --stack-trace-limit=100 --use-system-ca --use-env-proxy --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --enable-source-maps "%BLD_BUNDLE%" %*
```

(`QUARTO_ROOT` from `win_configuration.bat` ends with a backslash.)

- [ ] **Step 3: Verify**

Run: `cd package/src && ./quarto-bld --help | head -20 && ls ../dist/bin/quarto-bld.mjs ../dist/bin/quarto-bld.mjs.map ../dist/bin/quarto-bld.mjs.inputs.json`
Expected: the Cliffy help listing `configure`, `prepare-dist`, `validate-bundle`; the three files exist.

- [ ] **Step 4: Commit**

```bash
git add package/src/quarto-bld package/src/quarto-bld.cmd
git commit -m "build: quarto-bld bundles bld.ts and runs it on Node"
```

### Task 5: `prepare-dist` ships Node and the Deno tool; `validate-bundle` on Node globals

**Files:**
- Create: `package/src/util/bundle.ts`
- Modify: `package/src/util/deno.ts:12-41`, `package/src/common/prepare-dist.ts`, `package/src/common/validate-bundle.ts`, `tools/bundle-bug-finder/_prelude.js:2`
- Delete: `tools/deno-esbuild-bundle.ts`

- [ ] **Step 1: `bundle.ts`**

```ts
/*
 * bundle.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { exec, execPath } from "../../../src/deno_ral/process.ts";
import { info } from "../../../src/deno_ral/log.ts";
import { Configuration } from "../common/config.ts";

// Bundle src/quarto.ts for the distribution on the Node that runs quarto-bld.
export async function bundleQuarto(config: Configuration) {
  const entry = join(config.directoryInfo.src, "quarto.ts");
  const outfile = join(config.directoryInfo.pkgWorking.bin, "quarto.js");
  const build = join(config.directoryInfo.root, "tools", "node-bundle", "build.mjs");
  const result = await exec(execPath(), {
    args: [build, "--entry", entry, "--outfile", outfile, "--no-sourcemap"],
    cwd: config.directoryInfo.root,
    stdout: "piped",
    stderr: "inherit",
  });
  if (!result.success) {
    throw new Error(`Failure to bundle ${entry} (exit ${result.code})`);
  }
  info(new TextDecoder().decode(result.stdout).trim());
}
```

- [ ] **Step 2: `util/deno.ts`, the old bundler**

Delete lines 12-41 of `package/src/util/deno.ts` (the `// TODO in we only use the bundler ...` comment and `bundle()`). `compile`, `install`, `updateDenoPath` stay for `compile-quarto-latexmk.ts` unless PR 39 already deleted them (then delete the file: `git rm package/src/util/deno.ts`). Then:

```bash
git rm tools/deno-esbuild-bundle.ts
grep -rn "deno-esbuild-bundle\|util/deno.ts\"" package .github tools | grep -v runtime-migration
```
Expected: at most `compile-quarto-latexmk.ts` importing `compile, install, updateDenoPath`.

- [ ] **Step 3: `prepare-dist.ts`**

- Import: replace `import { bundle } from "../util/deno.ts";` with `import { bundleQuarto } from "../util/bundle.ts";`; add `import { node } from "./dependencies/node.ts";` next to the `deno` import; add `env` from `../../../src/deno_ral/env.ts` and `removeSync`, `writeTextFileSync` to the `fs.ts` import.
- Replace the `// Download Deno` block with:

```ts
  // Download Node (the CLI runtime) and Deno (a tool for `quarto run` and
  // `quarto call build-ts-extension` until the runtime migration's PR 37)
  const nodeVersion = env.get("NODE");
  if (!nodeVersion) {
    throw new Error("NODE is not defined in the environment (source `configuration`)");
  }
  await configArchDependency(node(nodeVersion), targetDir, config);
  const denoVersion = env.get("DENO");
  if (denoVersion) {
    await configArchDependency(deno(denoVersion), targetDir, config);
  }
```

- After the `kDependencies` loop add:

```ts
  // npm, headers and docs are only needed at configure time
  for (const arch of ["x86_64", "aarch64"]) {
    const nodeDist = join(targetDir, arch, "node-dist");
    if (existsSync(nodeDist)) {
      info(`Removing ${nodeDist}`);
      removeSync(nodeDist, { recursive: true });
    }
  }
```

- Replace the `// Create the deno bundle` block (`info("\nCreating Deno Bundle")` ... `await bundle(config);`) with:

```ts
  info("\nCreating Node bundle");
  await bundleQuarto(config);
  // bin/quarto.js is ESM: make that explicit, whatever package.json an
  // installer happens to place above bin/ (a "type": "commonjs" one would
  // otherwise make Node parse the bundle as CommonJS)
  writeTextFileSync(
    join(config.directoryInfo.pkgWorking.bin, "package.json"),
    '{ "type": "module" }\n',
  );
  info("");
```

`buildQuartoPreviewJs(config.directoryInfo.src, undefined, true)` becomes `buildQuartoPreviewJs(config.directoryInfo.src, true)` (Task 6 drops the unused `denoDir` parameter).

- [ ] **Step 4: `validate-bundle` sees Node globals**

`tools/bundle-bug-finder/_prelude.js` line 2 (`/*global Deno, globalThis, console, ...`): append `, process, require, module, exports, __dirname, __filename, setImmediate, clearImmediate, queueMicrotask, structuredClone, MessageChannel, MessagePort, BroadcastChannel, navigator` to the list, and change the line-1 comment to `/* definitions which exist in Node's (and Deno's) global scope and are ok for us to ignore */`. `require` is defined by the bundle banner (`const require = __createRequire(import.meta.url)`), but esbuild's own `__require` shim references the free `require` too.

In `package/src/common/validate-bundle.ts` replace `args: ["install"]` with `args: ["install", "--no-audit", "--no-fund"]` (npm is on PATH from `configure`).

Run: `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 --log-level info 2>&1 | tail -8 && ./quarto-bld validate-bundle`
Expected: `bundled src/quarto.ts -> package/pkg-working/bin/quarto.js (...)`; `validate-bundle` ends with `TEST: OK`. If eslint reports `no-undef` for another global, add it to the prelude list (each addition named in the PR description).

- [ ] **Step 5: Verify the layout**

Run: `ls package/pkg-working/bin package/pkg-working/bin/tools/x86_64`
Expected: `bin` has `quarto`, `quarto.js`, `package.json`, `tools`; the arch dir has `node`, `deno`, `pandoc`, `esbuild`, `dart-sass`, `typst`, no `node-dist`. On macOS both `tools/x86_64` and `tools/aarch64` have `node` and `deno`.

- [ ] **Step 6: Commit**

```bash
git add package/src/util package/src/common/prepare-dist.ts package/src/common/validate-bundle.ts tools/bundle-bug-finder/_prelude.js
git commit -m "build: prepare-dist bundles for Node, ships node and the deno tool; validate-bundle knows Node globals"
```

### Task 6: `quarto-preview.js` build on Node

**Files:**
- Create: `src/webui/quarto-preview/build.mjs`
- Delete: `src/webui/quarto-preview/build.ts`, `src/webui/quarto-preview/deno.jsonc`
- Modify: `package/src/common/previewjs.ts`, `package/src/common/configure.ts:28-35,47`

- [ ] **Step 1: `build.mjs`**

```js
// build.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Build src/resources/preview/quarto-preview.js with vite when a tracked file
// in this directory is newer than the generated file (or --force is given).
// Invoked by package/src/common/previewjs.ts on the bundled Node.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const kQuartoPreviewJs = "../../resources/preview/quarto-preview.js";
let jsBuildTime = 0;
try {
  jsBuildTime = fs.statSync(kQuartoPreviewJs).mtimeMs;
} catch {
  jsBuildTime = 0;
}

const changedSinceBuild = () => {
  let stdout;
  try {
    stdout = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  } catch {
    return true; // no git: rebuild
  }
  return stdout.split("\n").filter((l) => l.length > 0).some((file) => {
    try {
      return fs.statSync(file).mtimeMs > jsBuildTime;
    } catch {
      return false; // listed but deleted
    }
  });
};

if (!process.argv.includes("--force") && !changedSinceBuild()) {
  console.log("No changes to quarto-preview.js, skipping build");
  process.exit(0);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (args) => {
  console.log(`Running: npm ${args.join(" ")}`);
  const r = spawnSync(npm, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error("Command failed");
    process.exit(r.status ?? 1);
  }
};
run(["ci", "--no-audit", "--no-fund"]);
run(["run", "build"]);
```

- [ ] **Step 2: `previewjs.ts`**

```ts
/*
 * previewjs.ts
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { join } from "../../../src/deno_ral/path.ts";
import { execPath, execSync } from "../../../src/deno_ral/process.ts";

// Build src/resources/preview/quarto-preview.js with the Node running
// quarto-bld. npm must be on PATH (configure puts tools/<arch>/node-dist there).
export function buildQuartoPreviewJs(srcDir: string, force?: boolean) {
  const args = [join(quartoPreviewJsDir(srcDir), "build.mjs")];
  if (force) {
    args.push("--force");
  }
  return execSync(execPath(), {
    args,
    cwd: quartoPreviewJsDir(srcDir),
    stdout: "inherit",
    stderr: "inherit",
  });
}

export function quartoPreviewJsDir(srcDir: string) {
  return join(srcDir, "webui", "quarto-preview");
}
```

`configure.ts:47` keeps `buildQuartoPreviewJs(config.directoryInfo.src)`. Replace its npm check (lines 28-35) with:

```ts
  // npm builds quarto-preview.js. configure.sh/configure.cmd put the bundled
  // Node's npm on PATH; with QUARTO_VENDOR_BINARIES=false the caller provides it.
  if ((await which("npm")) === undefined) {
    throw new Error(
      "npm not found on PATH. Run ./configure.sh (or configure.cmd), which adds the bundled Node's npm to PATH.",
    );
  }
```

- [ ] **Step 3: Delete the Deno build script, verify, commit**

```bash
git rm src/webui/quarto-preview/build.ts src/webui/quarto-preview/deno.jsonc
rm -f src/resources/preview/quarto-preview.js && (cd package/src && ./quarto-bld configure --log-level info 2>&1 | grep -E "Running: npm|skipping")
ls src/resources/preview/quarto-preview.js
git add src/webui/quarto-preview/build.mjs package/src/common/previewjs.ts package/src/common/configure.ts package/src/common/prepare-dist.ts
git commit -m "build: quarto-preview.js builds on Node"
```
Expected: `Running: npm ci ...`, `Running: npm run build`; the file exists.

### Task 7: Dev config records Node, Deno and the npm lockfile

**Files:**
- Modify: `src/core/devconfig.ts`, `package/src/common/configure.ts:69-78`

- [ ] **Step 1: `devconfig.ts`**

Replace the `DevConfig` interface and `createDevConfig` with:

```ts
export interface DevConfig {
  node: string;
  deno: string; // the Deno tool (quarto run, build-ts-extension) until PR 37
  pandoc: string;
  dartsass: string;
  esbuild: string;
  typst: string;
  script: string;
  importMap: string;
  packageLock: string;
}

export function createDevConfig(
  node: string,
  deno: string,
  pandoc: string,
  dartsass: string,
  esbuild: string,
  typst: string,
  scriptDir: string,
): DevConfig {
  const scriptPath = join(scriptDir, "quarto" + (isWindows ? ".cmd" : ""));
  const srcDir = env.get("QUARTO_SRC_PATH") ||
    join(quartoConfig.sharePath(), "../../src");
  return {
    node,
    deno,
    pandoc,
    dartsass,
    esbuild,
    typst,
    script: md5HashSync(readTextFileSync(scriptPath)),
    importMap: md5HashSync(readTextFileSync(join(srcDir, "import_map.json"))),
    packageLock: md5HashSync(readTextFileSync(join(srcDir, "..", "package-lock.json"))),
  };
}
```

In `readSourceDevConfig` pass `readConfig("NODE"), readConfig("DENO"), ...` in that order. `devConfigsEqual` compares the nine fields (`a.node === b.node && a.deno === b.deno && ... && a.packageLock === b.packageLock`). In `reconfigureReason`, the first branch becomes `if (installed === null || installed.node !== source.node) return versionMessage("Node.js", source.node);`, followed by `else if (installed.deno !== source.deno) return versionMessage("Deno (tool)", source.deno);`, and a last branch `else if (installed.packageLock !== source.packageLock) return "install updated npm dependencies";`. The Windows comment "because deno.exe is running" becomes "because node.exe is running".

- [ ] **Step 2: `configure.ts`**

Replace lines 69-78 with:

```ts
  const devConfig = createDevConfig(
    env.get("NODE") || "",
    env.get("DENO") || "",
    env.get("PANDOC") || "",
    env.get("DARTSASS") || "",
    env.get("ESBUILD") || "",
    env.get("TYPST") || "",
    config.directoryInfo.bin,
  );
```

- [ ] **Step 3: Verify and commit**

Run: `cd package/src && ./quarto-bld configure --log-level info > /dev/null && node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync("../dist/config/dev-config","utf8"))).join(","))'`
Expected: `node,deno,pandoc,dartsass,esbuild,typst,script,importMap,packageLock`.

```bash
git add src/core/devconfig.ts package/src/common/configure.ts
git commit -m "build: dev config records Node, the Deno tool and package-lock.json"
```

### Task 8: `runtime-env.ts`: restore the user's Node settings for children; Deno-era warnings

**Files:**
- Create: `src/core/runtime-env.ts`
- Modify: `src/quarto.ts` (`quarto()`)
- Test: `tests/unit/runtime-env.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * runtime-env.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals, assertStringIncludes } from "../asserts.ts";
import { runtimeEnvWarnings, savedNodeEnvChanges } from "../../src/core/runtime-env.ts";

unitTest("runtime-env - saved NODE_* values move back, absent ones stay absent", () => {
  assertEquals(
    savedNodeEnvChanges({ QUARTO_SAVED_NODE_OPTIONS: "--max-old-space-size=123", PATH: "/bin" }),
    { set: { NODE_OPTIONS: "--max-old-space-size=123" }, remove: ["QUARTO_SAVED_NODE_OPTIONS"] },
  );
  assertEquals(
    savedNodeEnvChanges({ QUARTO_SAVED_NODE_PATH: "" }),
    { set: { NODE_PATH: "" }, remove: ["QUARTO_SAVED_NODE_PATH"] },
  );
  assertEquals(savedNodeEnvChanges({ PATH: "/bin" }), { set: {}, remove: [] });
});

unitTest("runtime-env - nothing to say without Deno-era variables", () => {
  assertEquals(runtimeEnvWarnings({ QUARTO_NODE: "/x/node", PATH: "/bin" }), []);
});

unitTest("runtime-env - QUARTO_DENO is never an alias; silent once QUARTO_NODE is set", () => {
  const w = runtimeEnvWarnings({ QUARTO_DENO: "/opt/deno" });
  assertEquals(w.length, 1);
  assertStringIncludes(w[0], "QUARTO_DENO is ignored by the Quarto CLI");
  assertStringIncludes(w[0], "quarto run");
  assertEquals(runtimeEnvWarnings({ QUARTO_DENO: "/opt/deno", QUARTO_NODE: "/opt/node" }), []);
});

unitTest("runtime-env - Deno flag variables are ignored, V8 flags are translated", () => {
  const w = runtimeEnvWarnings({
    QUARTO_DENO_OPTIONS: "--allow-all",
    QUARTO_DENO_EXTRA_OPTIONS: "--reload",
    QUARTO_DENO_V8_OPTIONS: "--stack-trace-limit=200,--max-old-space-size=4096",
    QUARTO_DENO_DIR: "/tmp/d",
  });
  assertEquals(w.length, 4);
  assertStringIncludes(w[0], "QUARTO_DENO_OPTIONS is ignored");
  assertStringIncludes(w[1], "QUARTO_DENO_EXTRA_OPTIONS is ignored");
  assertStringIncludes(w[2], 'QUARTO_NODE_OPTIONS="--stack-trace-limit=200 --max-old-space-size=4096"');
  assertStringIncludes(w[3], "QUARTO_DENO_DIR is ignored");
});

unitTest("runtime-env - empty values and an already-warned process stay quiet", () => {
  assertEquals(runtimeEnvWarnings({ QUARTO_DENO_OPTIONS: "" }), []);
  assertEquals(runtimeEnvWarnings({ QUARTO_DENO_OPTIONS: "--x", QUARTO_RUNTIME_ENV_WARNED: "1" }), []);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/runtime-env.test.ts`
Expected: FAIL, module `src/core/runtime-env.ts` not found.

- [ ] **Step 3: Implement**

```ts
/*
 * runtime-env.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Environment contract of the Node runtime. The launchers move the user's
 * NODE_OPTIONS/NODE_PATH aside so they cannot change Quarto's own Node process
 * (an invalid flag would abort it, --require would inject code); this module
 * puts them back so that every child (knitr, Jupyter, scripts, user `node`)
 * sees them. It also warns once about Deno-era variables the CLI no longer reads.
 */

import { env } from "../deno_ral/env.ts";
import { warning } from "../deno_ral/log.ts";

export const kSavedNodeEnv: ReadonlyArray<readonly [string, string]> = [
  ["QUARTO_SAVED_NODE_OPTIONS", "NODE_OPTIONS"],
  ["QUARTO_SAVED_NODE_PATH", "NODE_PATH"],
];

const kWarnedMarker = "QUARTO_RUNTIME_ENV_WARNED";
const kDocsUrl = "https://quarto.org/docs/advanced/environment-vars.html";

export function savedNodeEnvChanges(
  environment: Record<string, string | undefined>,
): { set: Record<string, string>; remove: string[] } {
  const set: Record<string, string> = {};
  const remove: string[] = [];
  for (const [saved, original] of kSavedNodeEnv) {
    const value = environment[saved];
    if (value !== undefined) {
      set[original] = value;
      remove.push(saved);
    }
  }
  return { set, remove };
}

export function restoreSavedNodeEnv() {
  const { set, remove } = savedNodeEnvChanges(env.toObject());
  for (const [name, value] of Object.entries(set)) {
    env.set(name, value);
  }
  for (const name of remove) {
    env.delete(name);
  }
}

export function runtimeEnvWarnings(
  environment: Record<string, string | undefined>,
): string[] {
  if (environment[kWarnedMarker] === "1") {
    return [];
  }
  const isSet = (name: string) => (environment[name] ?? "") !== "";
  const messages: string[] = [];
  if (isSet("QUARTO_DENO") && !isSet("QUARTO_NODE")) {
    messages.push(
      `QUARTO_DENO is ignored by the Quarto CLI, which now runs on Node.js (set QUARTO_NODE to choose the Node.js binary). ` +
        `QUARTO_DENO is still used to find Deno for \`quarto run\` scripts and \`quarto call build-ts-extension\`. See ${kDocsUrl}`,
    );
  }
  for (const name of ["QUARTO_DENO_OPTIONS", "QUARTO_DENO_EXTRA_OPTIONS"]) {
    if (isSet(name)) {
      messages.push(
        `${name} is ignored: it holds Deno flags, which Node.js does not accept. ` +
          `Put Node.js flags (including V8 flags such as --stack-trace-limit=200) in QUARTO_NODE_OPTIONS. See ${kDocsUrl}`,
      );
    }
  }
  if (isSet("QUARTO_DENO_V8_OPTIONS")) {
    const flags = environment["QUARTO_DENO_V8_OPTIONS"]!.split(",").filter((f) => f.length > 0).join(" ");
    messages.push(
      `QUARTO_DENO_V8_OPTIONS is deprecated; its flags are passed to Node.js for now. ` +
        `Use QUARTO_NODE_OPTIONS="${flags}" instead. See ${kDocsUrl}`,
    );
  }
  for (const name of ["QUARTO_DENO_DIR", "QUARTO_DENO_DOM"]) {
    if (isSet(name)) {
      messages.push(`${name} is ignored: the Quarto CLI runs on Node.js and has no equivalent setting. See ${kDocsUrl}`);
    }
  }
  return messages;
}

export function warnRuntimeEnvOnce() {
  for (const message of runtimeEnvWarnings(env.toObject())) {
    warning(message);
  }
  // children (quarto preview -> quarto render, quarto run) inherit the marker
  env.set(kWarnedMarker, "1");
}
```

- [ ] **Step 4: Call it**

In `src/quarto.ts`, import `{ restoreSavedNodeEnv, warnRuntimeEnvOnce } from "./core/runtime-env.ts"` and make these the first two statements of `export async function quarto(...)`, before `await checkReconfiguration();`:

```ts
  restoreSavedNodeEnv();
  warnRuntimeEnvOnce();
```

(`mainRunner` has initialised the logger before it calls `quarto`, so `warning()` goes to the configured log.)

- [ ] **Step 5: Run the test and commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/runtime-env.test.ts`
Expected: `5 passed`.

```bash
git add src/core/runtime-env.ts src/quarto.ts tests/unit/runtime-env.test.ts
git commit -m "runtime: restore NODE_OPTIONS/NODE_PATH for children; warn once about Deno-era variables"
```

### Task 9: Shell and batch launchers run Node

**Files:**
- Modify: `package/scripts/common/quarto` (from line 34 to the end), `package/scripts/windows/quarto.cmd` (whole file)
- Test: `tests/smoke/env/launcher-env.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
/*
 * launcher-env.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { removeSync, writeTextFileSync } from "../../../src/deno_ral/fs.ts";
import { assert, assertEquals, assertStringIncludes } from "../../asserts.ts";
import { execProcess } from "../../../src/core/process.ts";
import { quartoDevCmd } from "../../utils.ts";
import { quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import { unitTest } from "../../test.ts";

const dir = makeTempDirSync({ prefix: "launcher-env" });
writeTextFileSync(join(dir, "env.lua"), 'print(os.getenv("NODE_OPTIONS") or "<unset>")\n');

async function quarto(args: string[], env: Record<string, string>) {
  const r = await execProcess(
    { cmd: quartoDevCmd(), args, cwd: dir, stdout: "piped", stderr: "piped", ...quartoSpawnEnvOptions(env) },
    undefined, undefined, undefined, true,
  );
  return { code: r.code, out: (r.stdout ?? "").replaceAll("\r", ""), err: (r.stderr ?? "").replaceAll("\r", "") };
}

unitTest("launcher - an invalid NODE_OPTIONS does not reach Quarto's own Node", async () => {
  const r = await quarto(["--help"], { NODE_OPTIONS: "--bogus" });
  assertEquals(r.code, 0, r.err);
});

unitTest("launcher - children see the user's NODE_OPTIONS unchanged", async () => {
  const r = await quarto(["run", "env.lua"], { NODE_OPTIONS: "--max-old-space-size=123" });
  assertEquals(r.code, 0, r.err);
  assertEquals(r.out.trim(), "--max-old-space-size=123");
});

unitTest("launcher - QUARTO_DENO_V8_OPTIONS reaches node, with one deprecation warning", async () => {
  const r = await quarto(["--help"], { QUARTO_DENO_V8_OPTIONS: "--stack-trace-limit=200", QUARTO_LAUNCHER_DEBUG: "1" });
  assertEquals(r.code, 0, r.err);
  assertStringIncludes(r.err, "--stack-trace-limit=200");
  assertEquals((r.err.match(/QUARTO_DENO_V8_OPTIONS is deprecated/g) ?? []).length, 1);
});

unitTest("launcher - Deno flag variables are ignored with a warning", async () => {
  const r = await quarto(["--help"], { QUARTO_DENO_OPTIONS: "--allow-all", QUARTO_DENO_EXTRA_OPTIONS: "--reload" });
  assertEquals(r.code, 0, r.err);
  assertStringIncludes(r.err, "QUARTO_DENO_OPTIONS is ignored");
  assertStringIncludes(r.err, "QUARTO_DENO_EXTRA_OPTIONS is ignored");
});

unitTest("launcher - no stderr noise with a proxy configured", async () => {
  const r = await quarto(["--help"], { HTTPS_PROXY: "http://127.0.0.1:9", HTTP_PROXY: "http://127.0.0.1:9" });
  assertEquals(r.code, 0);
  assertEquals(r.err, "");
}, { teardown: () => { removeSync(dir, { recursive: true }); return Promise.resolve(); } });
```

`quarto run env.lua` uses the Lua run handler (pandoc), so the child is not Node: the test observes exactly what a knitr or Jupyter child would inherit.

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts`
Expected: the `QUARTO_DENO_V8_OPTIONS` and `Deno flag variables` tests fail (no warnings, no `QUARTO_LAUNCHER_DEBUG` output on the Deno launcher). The `NODE_OPTIONS` tests already pass on Deno (Deno does not read `NODE_OPTIONS`); they guard the Node launcher written next.

- [ ] **Step 3: Rewrite `package/scripts/common/quarto` from line 34 to the end**

```bash
QUARTO_SRC_PATH="$QUARTO_ROOT/src"
DEV_PATH=$QUARTO_SRC_PATH/quarto.ts

if [ -f "$DEV_PATH" ]; then
  QUARTO_DEV_MODE=true
  if [ "$1" == "--version" ] || [ "$1" == "-v" ]; then
    if [ "$QUARTO_FORCE_VERSION" != "" ]; then
      echo $QUARTO_FORCE_VERSION
      exit 0
    fi
    echo "99.9.9"
    exit 0
  fi

  export QUARTO_BIN_PATH=$SCRIPT_PATH
  export QUARTO_SHARE_PATH="${QUARTO_SHARE_PATH=$QUARTO_SRC_PATH/resources/}"
  if [ -z ${QUARTO_DEBUG+x} ]; then
    export QUARTO_DEBUG=true
  fi

  # Reconfigure when configuration pins another Node or Deno than the one installed
  QUARTO_DIST_CONFIG=$QUARTO_BIN_PATH/../config
  mkdir -p "$QUARTO_DIST_CONFIG"
  for RT in NODE DENO; do
    RT_FILE="$QUARTO_DIST_CONFIG/$(echo $RT | tr '[:upper:]' '[:lower:]')-version"
    RT_SOURCE="`(cd "$QUARTO_ROOT" && source ./configuration && eval echo \\$$RT)`"
    if [ -f "$RT_FILE" ]; then
      RT_INSTALLED=$(echo `cat "$RT_FILE"`)
      if [ "${RT_SOURCE}" != "${RT_INSTALLED}" ]; then
        (cd "$QUARTO_ROOT" && ./configure.sh)
        echo ""
        printf "\\033[0;31mQuarto required reconfiguration to install ${RT}. Had ${RT_INSTALLED}, needed ${RT_SOURCE}. Please try command again.\\033[0m\n\n"
        exit 1
      fi
    fi
  done

  # A caller can point node at another bundle (e.g. a test build)
  if [ -z ${QUARTO_TARGET+x} ]; then
    QUARTO_TARGET=$QUARTO_BIN_PATH/quarto-dev.mjs
  fi
  QUARTO_NODE_DEV_OPTIONS="--enable-source-maps"
else
  QUARTO_TARGET=${SCRIPT_PATH}/quarto.js
  export QUARTO_BIN_PATH=$SCRIPT_PATH
  QUARTO_NODE_DEV_OPTIONS=""

  # If Quarto is bundled into an `.app` file, it will be looking for the
  # share directory over in the resources folder.
  if [ -z "${QUARTO_SHARE_PATH+x}" ]; then
    if [[ $SCRIPT_PATH == *"/Contents/MacOS/quarto/bin" ]]; then
      export QUARTO_SHARE_PATH="`cd "$SCRIPT_PATH/../../../Resources/quarto/share";pwd`"
    elif [[ $SCRIPT_PATH == *"/usr/local/bin/quarto" ]]; then
      export QUARTO_SHARE_PATH="`cd "$SCRIPT_PATH/../../share/quarto";pwd`"
    else
      export QUARTO_SHARE_PATH="`cd "$SCRIPT_PATH/../share";pwd`"
    fi
  fi

  if [ "$1" == "--version" ] || [ "$1" == "-v" ]; then
    if [ "$QUARTO_FORCE_VERSION" != "" ]; then
      echo $QUARTO_FORCE_VERSION
      exit 0
    fi
    echo `cat "$QUARTO_SHARE_PATH/version"`
    exit 0
  fi
fi

if [ "$1" == "--paths" ]; then
  echo "$QUARTO_BIN_PATH"
  echo "$QUARTO_SHARE_PATH"
  exit 0
fi

# <<< lines 129-164 of the current file (the ARCH_DIR detection: darwin
#     sysctl/uname branch, linux uname -m branch) go here verbatim >>>

# --- Node runtime -----------------------------------------------------------
# QUARTO_DENO is not an alias: it names a Deno binary (the `quarto run` tool).
if [ "$QUARTO_NODE" == "" ]; then
  QUARTO_NODE="${SCRIPT_PATH}/tools/${ARCH_DIR}/node"
fi
export QUARTO_NODE

# The user's NODE_OPTIONS/NODE_PATH must not change Quarto's own Node (an
# invalid flag aborts it). They are moved aside here and put back for child
# processes by src/core/runtime-env.ts (restoreSavedNodeEnv).
if [ -n "${NODE_OPTIONS+x}" ]; then
  export QUARTO_SAVED_NODE_OPTIONS="$NODE_OPTIONS"
  unset NODE_OPTIONS
fi
if [ -n "${NODE_PATH+x}" ]; then
  export QUARTO_SAVED_NODE_PATH="$NODE_PATH"
  unset NODE_PATH
fi

# Quarto's own flags (command line: Node refuses some of them in NODE_OPTIONS).
# --enable-experimental-regexp-engine: /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
# --use-system-ca: replaces DENO_TLS_CA_STORE=system,mozilla (NODE_EXTRA_CA_CERTS still works)
# --use-env-proxy: fetch/http honour HTTP(S)_PROXY and NO_PROXY, as Deno did
# --disable-warning=MODULE_TYPELESS_PACKAGE_JSON: Quarto import()s ESM .js files
#   (dayjs locales, graphviz-wasm.js, engine bundles) under package.json files it does not own
QUARTO_NODE_FLAGS="--enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 --use-system-ca --use-env-proxy --disable-warning=MODULE_TYPELESS_PACKAGE_JSON ${QUARTO_NODE_DEV_OPTIONS}"
# Deno-era V8 flags (comma separated) are passed through; quarto.js warns that
# the variable is deprecated. QUARTO_DENO_OPTIONS/_EXTRA_OPTIONS hold Deno flags
# and are never passed to node.
if [ "$QUARTO_DENO_V8_OPTIONS" != "" ]; then
  QUARTO_NODE_FLAGS="${QUARTO_NODE_FLAGS} ${QUARTO_DENO_V8_OPTIONS//,/ }"
fi
if [ "$QUARTO_TS_PROFILE" != "" ]; then
  QUARTO_NODE_FLAGS="--inspect-brk ${QUARTO_NODE_FLAGS}"
  export QUARTO_TS_PROFILE=true
fi

if [ "$QUARTO_DEV_MODE" == true ]; then
  ENSURE_LOG=$("${QUARTO_NODE}" "${QUARTO_ROOT}/tools/node-bundle/ensure.mjs" --entry "${DEV_PATH}" --outfile "${QUARTO_TARGET}") || exit 1
  if [ "$QUARTO_LAUNCHER_DEBUG" == "1" ]; then
    echo "$ENSURE_LOG" >&2
  fi
fi
if [ "$QUARTO_LAUNCHER_DEBUG" == "1" ]; then
  echo "${QUARTO_NODE} ${QUARTO_NODE_FLAGS} ${QUARTO_NODE_OPTIONS} ${QUARTO_TARGET} $*" >&2
fi

exec "${QUARTO_NODE}" ${QUARTO_NODE_FLAGS} ${QUARTO_NODE_OPTIONS} "${QUARTO_TARGET}" "$@"
```

The old `QUARTO_DENO_DOM`/`DENO_DOM_PLUGIN` block is gone with PR 20; `QUARTO_ACTION`, `QUARTO_IMPORT_MAP_ARG`, `QUARTO_CACHE_OPTIONS`, `QUARTO_NO_TYPECHECK`, `DENO_DIR` are gone (Node has one way to run a file; type checking is `npm run typecheck`, Task 12). Then: `grep -rn "QUARTO_ACTION\|QUARTO_NO_TYPECHECK" . --include=*.sh --include=*.ps1 --include=*.yml --include=*.md | grep -v runtime-migration` and remove each hit outside `news/`.

- [ ] **Step 4: Rewrite `package/scripts/windows/quarto.cmd`**

```bat
@ECHO OFF

SETLOCAL ENABLEDELAYEDEXPANSION

SET "SCRIPT_PATH=%~dp0"
SET DEV_PATH=..\..\..

for %%i in ("%~dp0\%DEV_PATH%") do SET "QUARTO_ROOT=%%~fi"
SET "QUARTO_TS_PATH=!QUARTO_ROOT!\src\quarto.ts"

IF EXIST "!QUARTO_TS_PATH!" (
	set QUARTO_DEV_MODE=true
	IF "%1"=="--version" GOTO devversion
	IF "%1"=="-v" GOTO devversion

	call !QUARTO_ROOT!\win_configuration.bat
	set QUARTO_SHARE_PATH=!QUARTO_ROOT!\src\resources
	IF NOT DEFINED QUARTO_TARGET SET "QUARTO_TARGET=!QUARTO_BIN_PATH!\quarto-dev.mjs"
	IF NOT DEFINED QUARTO_DEBUG SET QUARTO_DEBUG=true

	for %%i in ("!SCRIPT_PATH!..\config\node-version") do SET "NODE_VERSION_FILE=%%~fi"
	if exist "!NODE_VERSION_FILE!" (
		set /p NODE_INSTALLED_VERSION=<"!NODE_VERSION_FILE!"
		if NOT "!NODE!"=="!NODE_INSTALLED_VERSION!" (
			echo Quarto requires reconfiguration to install Node.js !NODE! ^(installed: !NODE_INSTALLED_VERSION!^). Please run configure.cmd.
			exit /b 1
		)
	)
	for %%i in ("!SCRIPT_PATH!..\config\deno-version") do SET "DENO_VERSION_FILE=%%~fi"
	if exist "!DENO_VERSION_FILE!" (
		set /p DENO_INSTALLED_VERSION=<"!DENO_VERSION_FILE!"
		if NOT "!DENO!"=="!DENO_INSTALLED_VERSION!" (
			echo Quarto requires reconfiguration to install Deno !DENO! ^(tool; installed: !DENO_INSTALLED_VERSION!^). Please run configure.cmd.
			exit /b 1
		)
	)
	SET "QUARTO_NODE_DEV_OPTIONS=--enable-source-maps"
) ELSE (
	IF NOT DEFINED QUARTO_SHARE_PATH (
		for %%i in ("!SCRIPT_PATH!\..\share") do SET "QUARTO_SHARE_PATH=%%~fi"
	)
	IF "%1"=="--version" GOTO distversion
	IF "%1"=="-v" GOTO distversion
	SET "QUARTO_TARGET=%SCRIPT_PATH%\quarto.js"
	SET "QUARTO_BIN_PATH=%SCRIPT_PATH%"
	SET "QUARTO_NODE_DEV_OPTIONS="
)

IF "%1"=="--paths" (
	ECHO !QUARTO_BIN_PATH!
	ECHO !QUARTO_SHARE_PATH!
	GOTO end
)

SET NO_COLOR=TRUE

REM QUARTO_DENO is not an alias: it names a Deno binary (the quarto run tool).
IF NOT DEFINED QUARTO_NODE SET "QUARTO_NODE=!SCRIPT_PATH!\tools\x86_64\node.exe"

REM Move the user's NODE_OPTIONS/NODE_PATH aside; src/core/runtime-env.ts restores them for children.
IF DEFINED NODE_OPTIONS (
	SET "QUARTO_SAVED_NODE_OPTIONS=!NODE_OPTIONS!"
	SET "NODE_OPTIONS="
)
IF DEFINED NODE_PATH (
	SET "QUARTO_SAVED_NODE_PATH=!NODE_PATH!"
	SET "NODE_PATH="
)

REM --enable-experimental-regexp-engine is required for /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
SET "QUARTO_NODE_FLAGS=--enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 --use-system-ca --use-env-proxy --disable-warning=MODULE_TYPELESS_PACKAGE_JSON !QUARTO_NODE_DEV_OPTIONS!"
IF DEFINED QUARTO_DENO_V8_OPTIONS SET "QUARTO_NODE_FLAGS=!QUARTO_NODE_FLAGS! !QUARTO_DENO_V8_OPTIONS:,= !"
IF DEFINED QUARTO_TS_PROFILE (
	SET "QUARTO_NODE_FLAGS=--inspect-brk !QUARTO_NODE_FLAGS!"
	SET "QUARTO_TS_PROFILE=true"
)

IF DEFINED QUARTO_DEV_MODE (
	"!QUARTO_NODE!" "!QUARTO_ROOT!\tools\node-bundle\ensure.mjs" --entry "!QUARTO_TS_PATH!" --outfile "!QUARTO_TARGET!" > NUL
	IF ERRORLEVEL 1 exit /b 1
)
IF "!QUARTO_LAUNCHER_DEBUG!"=="1" ECHO "!QUARTO_NODE!" !QUARTO_NODE_FLAGS! !QUARTO_NODE_OPTIONS! "!QUARTO_TARGET!" %* 1>&2

"!QUARTO_NODE!" !QUARTO_NODE_FLAGS! !QUARTO_NODE_OPTIONS! "!QUARTO_TARGET!" %*
GOTO end

:devversion
IF DEFINED QUARTO_FORCE_VERSION (ECHO !QUARTO_FORCE_VERSION!) ELSE (ECHO 99.9.9)
GOTO end

:distversion
IF DEFINED QUARTO_FORCE_VERSION (ECHO !QUARTO_FORCE_VERSION!) ELSE (TYPE "!QUARTO_SHARE_PATH!\version")
GOTO end

:end
```

The old `quarto.cmd` re-ran `configure.cmd` itself on a version change; running configure while `node.exe` from `package/dist` is executing this script is exactly what `check-node-in-use.cmd` refuses, so the new script prints the instruction instead (the same message `devconfig.ts` prints on Windows).

- [ ] **Step 5: `--use-env-proxy` stderr on the pinned Node**

Run: `HTTPS_PROXY=http://127.0.0.1:9 package/dist/bin/quarto --help 2>&1 >/dev/null | head -3`
Expected: no output (none on v26.12.0 in the sandbox, 2026-10-16). If it prints `[UNDICI-EHPA] Warning: EnvHttpProxyAgent is experimental`, add `--disable-warning=UNDICI-EHPA` after `--use-env-proxy` in both launchers here, in `quarto-bld`/`quarto-bld.cmd` (Task 4) and in `main.rs` (Task 10), and say so in the PR description.

- [ ] **Step 6: Run the tests**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts unit/runtime-env.test.ts
cd .. && package/dist/bin/quarto --version && package/dist/bin/quarto --paths && package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd
```
Expected: `10 passed`; `99.9.9`; two paths; the render writes `issue-3847.html`.

- [ ] **Step 7: Commit**

```bash
git add package/scripts/common/quarto package/scripts/windows/quarto.cmd tests/smoke/env/launcher-env.test.ts
git commit -m "build: dev and installed launchers run Node; NODE_* moved aside; Deno flag variables not passed"
```

### Task 10: Rust launcher (`quarto.exe`) runs Node

**Files:**
- Modify: `package/launcher/src/main.rs`

- [ ] **Step 1: Replace `main.rs`**

Keep `path_from_env`, `share_dir_from_bin_dir` and `arch_string` unchanged. Replace `main()`, `deno_dir()` and the `DENO_DOM_LIB` constants with:

```rust
use std::process::Command;
use std::{env, ffi::OsString, fs, path::Path, path::PathBuf};

fn main() {
    // compute executable path (resolving symlinks)
    let mut exe_file: PathBuf = env::current_exe().expect("failed to get exe path");
    let exe_metadata = fs::symlink_metadata(exe_file.as_path())
        .expect("failed to get symlink metadata for exe path");
    if exe_metadata.is_symlink() {
        exe_file =
            fs::read_link(exe_file.as_path()).expect("failed to canonicalize executable path");
    }

    let bin_dir = exe_file
        .parent()
        .expect("failed to get executable parent")
        .to_path_buf();
    let mut share_dir = path_from_env("QUARTO_SHARE_PATH");
    if share_dir.as_os_str().is_empty() {
        share_dir = share_dir_from_bin_dir(&bin_dir);
    }
    let js_file = bin_dir.join(Path::new("quarto.js"));

    let args: Vec<OsString> = env::args_os().skip(1).collect();
    if args.is_empty() {
        std::process::exit(0);
    }
    if &args[0] == "--version" || &args[0] == "-v" {
        let version = fs::read_to_string(share_dir.join("version")).expect("failed to read version");
        println!("{}", version);
        std::process::exit(0);
    }
    if &args[0] == "--paths" {
        println!("{}\n{}", bin_dir.display(), share_dir.display());
        std::process::exit(0);
    }

    // QUARTO_NODE chooses the Node binary. QUARTO_DENO is not an alias: it
    // names the Deno tool used by `quarto run`.
    let mut node_file = path_from_env("QUARTO_NODE");
    if node_file.as_os_str().is_empty() {
        node_file = bin_dir.join("tools").join(arch_dir()).join(NODE_BINARY);
    }

    // Quarto's own flags; see package/scripts/common/quarto for the reasons.
    let mut node_args: Vec<OsString> = [
        "--enable-experimental-regexp-engine",
        "--max-old-space-size=8192",
        "--stack-trace-limit=100",
        "--use-system-ca",
        "--use-env-proxy",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    ]
    .iter()
    .map(OsString::from)
    .collect();
    // Deno-era V8 flags (comma separated): passed through, quarto.js warns.
    if let Ok(v8) = env::var("QUARTO_DENO_V8_OPTIONS") {
        node_args.extend(v8.split(',').filter(|s| !s.is_empty()).map(OsString::from));
    }
    if env::var_os("QUARTO_TS_PROFILE").is_some() {
        node_args.insert(0, OsString::from("--inspect-brk"));
    }
    if let Ok(extra) = env::var("QUARTO_NODE_OPTIONS") {
        node_args.extend(extra.split_whitespace().map(OsString::from));
    }
    node_args.push(js_file.into_os_string());
    node_args.extend(args);

    let mut cmd = Command::new(&node_file);
    cmd.args(&node_args)
        .env("QUARTO_NODE", &node_file)
        .env("QUARTO_BIN_PATH", &bin_dir)
        .env("QUARTO_SHARE_PATH", &share_dir);
    // The user's NODE_OPTIONS/NODE_PATH must not change Quarto's own Node; they
    // are restored for children by src/core/runtime-env.ts.
    for (original, saved) in [
        ("NODE_OPTIONS", "QUARTO_SAVED_NODE_OPTIONS"),
        ("NODE_PATH", "QUARTO_SAVED_NODE_PATH"),
    ] {
        if let Some(value) = env::var_os(original) {
            cmd.env(saved, value).env_remove(original);
        }
    }
    #[cfg(target_os = "windows")]
    cmd.env("NO_COLOR", "TRUE");

    let mut child = cmd.spawn().expect("failed to run node");
    let status = child.wait().expect("failed to wait on node");
    if status.success() {
        std::process::exit(0)
    } else {
        match status.code() {
            Some(code) => std::process::exit(code),
            // errors reaping the status code have been observed
            // (see https://github.com/quarto-dev/quarto-cli/issues/2296)
            None => std::process::exit(0),
        }
    }
}

// tools/<arch> directory holding the runtimes. Windows builds are x64 only.
fn arch_dir() -> &'static str {
    if cfg!(target_os = "windows") {
        return "x86_64";
    }
    let arch = arch_string();
    if arch.starts_with("Darwin arm64") || arch.starts_with("Linux aarch64") {
        "aarch64"
    } else {
        "x86_64"
    }
}

#[cfg(target_os = "windows")]
const NODE_BINARY: &str = "node.exe";

#[cfg(not(target_os = "windows"))]
const NODE_BINARY: &str = "node";
```

The `use std::str::FromStr;` import goes away (no longer used).

- [ ] **Step 2: Build and run it against a prepared distribution**

Run:
```bash
cargo build --release --manifest-path package/launcher/Cargo.toml
cp package/launcher/target/release/quarto package/pkg-working/bin/quarto-launcher
package/pkg-working/bin/quarto-launcher --paths
NODE_OPTIONS=--bogus QUARTO_DENO_V8_OPTIONS=--stack-trace-limit=50 package/pkg-working/bin/quarto-launcher check versions 2>&1 | head -5
rm package/pkg-working/bin/quarto-launcher
```
Expected: two paths; `check versions` runs (no `--bogus` abort) and prints the `QUARTO_DENO_V8_OPTIONS is deprecated` warning first.

- [ ] **Step 3: Commit**

```bash
git add package/launcher/src/main.rs
git commit -m "launcher: quarto.exe spawns node with Quarto's flags; NODE_* moved aside"
```

### Task 11: Deno as a tool: `denoToolBinary()` and `quarto install deno`

**Files:**
- Create: `src/tools/impl/deno-paths.ts`, `src/tools/impl/deno.ts`
- Modify: `src/core/run/deno.ts:56`, `src/command/call/build-ts-extension/cmd.ts:257-258`, `src/tools/tools.ts:32-38`, `src/command/install/cmd.ts`, `.github/workflows/test-install.yml`
- Test: `tests/unit/tools/deno-tool.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * deno-tool.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assertEquals } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { readTextFileSync } from "../../../src/deno_ral/fs.ts";
import { env } from "../../../src/deno_ral/env.ts";
import { installableTools } from "../../../src/tools/tools.ts";
import { kDenoToolVersion } from "../../../src/tools/impl/deno-paths.ts";

unitTest("deno tool - pinned version equals DENO in configuration", () => {
  const text = readTextFileSync(join(env.get("QUARTO_ROOT")!, "configuration"));
  const m = text.match(/^export DENO=(\S+)$/m);
  assertEquals(kDenoToolVersion, m?.[1]);
});

unitTest("deno tool - installable as `quarto install deno`", () => {
  assertEquals(installableTools().includes("deno"), true);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/deno-tool.test.ts`
Expected: FAIL, module `src/tools/impl/deno-paths.ts` not found.

- [ ] **Step 3: `deno-paths.ts`**

```ts
/*
 * deno-paths.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Where the Deno *tool* is (Quarto itself runs on Node.js). Kept free of
 * imports from src/tools/tools.ts so that src/core/run/deno.ts and
 * build-ts-extension can import it without an import cycle.
 */

import { existsSync } from "../../deno_ral/fs.ts";
import { join } from "../../deno_ral/path.ts";
import { arch, isWindows } from "../../deno_ral/platform.ts";
import { env } from "../../deno_ral/env.ts";
import { warnOnce } from "../../core/log.ts";
import { quartoDataDir } from "../../core/appdirs.ts";
import { quartoConfig } from "../../core/quarto.ts";

// Same value as DENO in `configuration` (tests/unit/tools/deno-tool.test.ts).
export const kDenoToolVersion = "v2.9.7";

const kDenoExe = isWindows ? "deno.exe" : "deno";

export function denoInstallDir(): string {
  return quartoDataDir("deno");
}

export function installedDenoPath(): string {
  return join(denoInstallDir(), kDenoExe);
}

export function bundledDenoPath(): string {
  return join(quartoConfig.binPath(), "tools", isWindows ? "x86_64" : arch, kDenoExe);
}

export function denoToolBinary(): string | undefined {
  const fromEnv = env.get("QUARTO_DENO");
  if (fromEnv) {
    if (existsSync(fromEnv)) {
      return fromEnv;
    }
    warnOnce(`QUARTO_DENO is set to ${fromEnv}, which does not exist; looking for another Deno`);
  }
  for (const candidate of [installedDenoPath(), bundledDenoPath()]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function requireDenoToolBinary(purpose: string): string {
  const deno = denoToolBinary();
  if (deno === undefined) {
    throw new Error(`${purpose} needs Deno, which is not installed. Run 'quarto install deno'.`);
  }
  return deno;
}
```

Write the actual `DENO` value from `configuration` (after PR 00a) into `kDenoToolVersion`; the test fails otherwise.

- [ ] **Step 4: `deno.ts` (the installable tool)**

```ts
/*
 * deno.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * `quarto install deno`: the Deno tool for `quarto run` scripts and
 * `quarto call build-ts-extension`, at the version Quarto is tested with.
 */

import { chmodSync, ensureDirSync, existsSync, readFileSync, readTextFileSync, safeRemoveSync, writeTextFileSync } from "../../deno_ral/fs.ts";
import { basename, join } from "../../deno_ral/path.ts";
import { arch, isWindows, os as platformOs } from "../../deno_ral/platform.ts";
import { unzip } from "../../core/zip.ts";
import { InstallableTool, InstallContext, kUpdatePath, PackageInfo, RemotePackageInfo } from "../types.ts";
import { createToolSymlink, removeToolSymlink } from "../tools.ts";
import { denoInstallDir, installedDenoPath, kDenoToolVersion } from "./deno-paths.ts";

const kVersionFileName = "version";

function denoTarget(): string {
  const cpu = arch === "aarch64" ? "aarch64" : "x86_64";
  if (platformOs === "windows") return "x86_64-pc-windows-msvc";
  if (platformOs === "darwin") return `${cpu}-apple-darwin`;
  return `${cpu}-unknown-linux-gnu`;
}

async function installed() {
  return existsSync(installedDenoPath());
}

async function installedVersion(): Promise<string | undefined> {
  const file = join(denoInstallDir(), kVersionFileName);
  return existsSync(file) ? readTextFileSync(file).trim() : undefined;
}

// Pinned, not "latest": user scripts and the stdlib import map are tested
// against this version, and Deno's development ends in 2027.
async function latestRelease(): Promise<RemotePackageInfo> {
  const asset = `deno-${denoTarget()}.zip`;
  const base = `https://github.com/denoland/deno/releases/download/${kDenoToolVersion}`;
  return {
    url: `https://github.com/denoland/deno/releases/tag/${kDenoToolVersion}`,
    version: kDenoToolVersion,
    assets: [
      { name: asset, url: `${base}/${asset}` },
      { name: `${asset}.sha256sum`, url: `${base}/${asset}.sha256sum` },
    ],
  };
}

async function preparePackage(context: InstallContext): Promise<PackageInfo> {
  const release = await latestRelease();
  const [zip, sum] = release.assets;
  const filePath = join(context.workingDir, zip.name);
  const sumPath = join(context.workingDir, sum.name);
  await context.download(`Deno ${release.version}`, zip.url, filePath);
  await context.download(`Deno ${release.version} checksum`, sum.url, sumPath);
  const expected = readTextFileSync(sumPath).trim().split(/\s+/)[0].toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", readFileSync(filePath));
  const actual = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${zip.name}: expected ${expected}, got ${actual}`);
  }
  return { filePath, version: release.version };
}

async function install(pkgInfo: PackageInfo, context: InstallContext) {
  const dir = denoInstallDir();
  ensureDirSync(dir);
  await context.withSpinner({ message: `Unzipping ${basename(pkgInfo.filePath)}` }, async () => {
    const r = await unzip(pkgInfo.filePath, dir);
    if (!r.success) {
      throw new Error(`Failed to extract ${basename(pkgInfo.filePath)}\n${r.stderr}`);
    }
  });
  if (!isWindows) {
    chmodSync(installedDenoPath(), 0o755);
  }
  writeTextFileSync(join(dir, kVersionFileName), pkgInfo.version);
}

async function afterInstall(context: InstallContext) {
  if (context.flags[kUpdatePath]) {
    await context.withSpinner({ message: "Updating PATH" }, async () => {
      await createToolSymlink(installedDenoPath(), "deno", context);
    });
    return isWindows;
  }
  return false;
}

async function uninstall(context: InstallContext) {
  if (context.flags[kUpdatePath]) {
    await removeToolSymlink("deno");
  }
  await context.withSpinner({ message: "Removing Deno" }, async () => {
    if (existsSync(denoInstallDir())) {
      safeRemoveSync(denoInstallDir(), { recursive: true });
    }
  });
}

export const denoInstallable: InstallableTool = {
  name: "Deno",
  prereqs: [],
  installed,
  installDir: async () => (await installed()) ? denoInstallDir() : undefined,
  binDir: async () => (await installed()) ? denoInstallDir() : undefined,
  installedVersion,
  latestRelease,
  preparePackage,
  install,
  afterInstall,
  uninstall,
};
```

`crypto.subtle` is a web-standard global on Node and Deno; the checksum file is Deno's own `<asset>.sha256sum` release asset (`<hex>  <name>`, verified for v2.9.7).

- [ ] **Step 5: Register; switch the two call sites**

`src/tools/tools.ts` lines 32-38: add `deno: denoInstallable,` after `verapdf` and `import { denoInstallable } from "./impl/deno.ts";` with the other `impl` imports. `src/command/install/cmd.ts`: after the existing examples add

```ts
  .example(
    "Install Deno for `quarto run` scripts and engine extension builds",
    "quarto install deno",
  )
```

`src/core/run/deno.ts:56`: `cmd: architectureToolsPath("deno"),` becomes `cmd: requireDenoToolBinary("Running a TypeScript script"),`, and the `env` object of that `execProcess` call gains `DENO_NO_UPDATE_CHECK: "1"` (the CLI launcher no longer exports it). Import `requireDenoToolBinary` from `../../tools/impl/deno-paths.ts`; drop `architectureToolsPath` from the `resources.ts` import if unused.

`src/command/call/build-ts-extension/cmd.ts:257-258`: `const denoBinary = env.get("QUARTO_DENO") || architectureToolsPath("deno");` (PR 14 codemodded the `Deno.env.get`) becomes `const denoBinary = requireDenoToolBinary("quarto call build-ts-extension");`, importing it from `../../../tools/impl/deno-paths.ts`. `denoToolBinary()` already honours `QUARTO_DENO`.

- [ ] **Step 6: `test-install.yml` job**

Append to `.github/workflows/test-install.yml` (and add `"src/core/run/**"` to both `paths:` lists):

```yaml
  install-deno-tool:
    name: quarto install deno (${{ matrix.os }})
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v6
      - uses: ./.github/workflows/actions/quarto-dev
      - name: Hide the bundled Deno tool, install it with quarto
        shell: bash
        run: |
          rm -f package/dist/bin/tools/*/deno package/dist/bin/tools/*/deno.exe package/dist/bin/tools/deno
          quarto install deno --no-prompt
          printf 'console.log("deno-tool-ok", typeof Deno.version.deno);\n' > s.ts
          out=$(quarto run s.ts); echo "$out"; echo "$out" | grep -q "deno-tool-ok string"
          quarto uninstall deno --no-prompt
          if quarto run s.ts; then echo "expected failure without Deno"; exit 1; fi
```

- [ ] **Step 7: Run and commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/deno-tool.test.ts $(find smoke/run/ -name '*.test.ts') smoke/build-ts-extension/build-ts-extension.test.ts smoke/project/project-prepost.test.ts`
Expected: all pass (the scripts and the extension build run on the bundled Deno tool).

```bash
git add src/tools src/core/run/deno.ts src/command/call/build-ts-extension/cmd.ts src/command/install/cmd.ts .github/workflows/test-install.yml tests/unit/tools/deno-tool.test.ts
git commit -m "tools: quarto install deno; quarto run and build-ts-extension find Deno through denoToolBinary()"
```

### Task 12: Type checking with `tsc`

**Files:**
- Create: `tools/typecheck/gen-tsconfig-paths.mjs`, `tsconfig.json`, `tsconfig.paths.json`, `.github/workflows/lint.yml`
- Modify: `package.json`, `package-lock.json`, `tests/run-tests.sh` (line 232's `--check`)

- [ ] **Step 1: Dependencies and script**

```bash
npm install --save-dev --save-exact typescript@5.9.3 @types/node@26.6.5 @types/deno@2.7.0
```

Add to `package.json` `scripts`: `"typecheck": "node tools/typecheck/gen-tsconfig-paths.mjs --check && tsc -p tsconfig.json"`.

`@types/deno` is temporary: `src/deno_ral/` may keep a Deno branch per module until PR 37, and `src/deno_ral/platform.ts`'s `runtime()` names `Deno`. PR 38 removes it. Since types are global, `Deno.*` type-checks everywhere; the boundary ratchet (not `tsc`) keeps it out of the rest of `src/`.

- [ ] **Step 2: The `paths` generator**

```js
// tools/typecheck/gen-tsconfig-paths.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Generate tsconfig.paths.json from src/import_map.json so tsc resolves the
// bare names the bundler resolves. --check exits 1 when the committed file is stale.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsrToNpm, npmSpec } from "../node-bundle/import-map.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const imports = JSON.parse(fs.readFileSync(path.join(root, "src", "import_map.json"), "utf8")).imports;
const out = path.join(root, "tsconfig.paths.json");

function packagePath(target) {
  if (target.startsWith("jsr:")) return `node_modules/${jsrToNpm(target)}`;
  if (target.startsWith("npm:")) return `node_modules/${npmSpec(target)}`;
  if (target.startsWith("./") || target.startsWith("../")) return path.posix.join("src", target);
  throw new Error(`src/import_map.json target not supported for tsc: ${target}`);
}

const paths = {};
for (const [key, target] of Object.entries(imports)) {
  const p = packagePath(target);
  if (key.endsWith("/")) {
    paths[`${key}*`] = [`${p.replace(/\/$/, "")}/*`];
  } else {
    paths[key] = [p];
  }
}
const json = JSON.stringify(
  { "//": "generated by tools/typecheck/gen-tsconfig-paths.mjs from src/import_map.json; do not edit", compilerOptions: { paths } },
  null,
  2,
) + "\n";

if (process.argv.includes("--check")) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  if (current !== json) {
    console.error("tsconfig.paths.json is out of date: run node tools/typecheck/gen-tsconfig-paths.mjs");
    process.exit(1);
  }
  console.log("tsconfig.paths.json up to date");
} else {
  fs.writeFileSync(out, json);
  console.log(`wrote tsconfig.paths.json (${Object.keys(paths).length} entries)`);
}
```

`jsrToNpm` and `npmSpec` are the PR 26 exports of `tools/node-bundle/import-map.mjs` (template vocabulary). If `jsrToNpm` returns the package name without the subpath, append the subpath (`target.split("/").slice(3).join("/")` after the `@scope/name@ver` part) in `packagePath`; the first `tsc` run in step 4 tells (`TS2307` on a subpath import).

- [ ] **Step 3: `tsconfig.json`**

```json
{
  "extends": "./tsconfig.paths.json",
  "compilerOptions": {
    "noEmit": true,
    "strict": true,
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "useDefineForClassFields": true,
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["node", "deno"],
    "skipLibCheck": true,
    "noErrorTruncation": true
  },
  "files": ["src/quarto.ts", "package/src/bld.ts"],
  "include": ["tests/**/*.test.ts", "tests/*.ts"],
  "exclude": ["node_modules", "tests/integration/playwright", "tests/.venv"]
}
```

`files` reproduces what `deno run --check src/quarto.ts` checked (the import graph of the CLI) plus `quarto-bld`; `include` reproduces `deno test --check` (test files and their graph). `tools/*.ts` scripts are not included: they are outside the ratchet, several still call the Deno API, and `deno run` never type-checked them either. `noErrorTruncation` comes from `deno.jsonc`. `verbatimModuleSyntax` matches PR 02b.

- [ ] **Step 4: First run and triage**

```bash
node tools/typecheck/gen-tsconfig-paths.mjs
npx tsc -p tsconfig.json > /tmp/tsc.txt 2>&1; grep -c "error TS" /tmp/tsc.txt
grep -oE "error TS[0-9]+" /tmp/tsc.txt | sort | uniq -c | sort -rn | head
```

Resolve in this order, re-running after each class:
1. `TS2307` (cannot find module): a `paths` gap; fix the generator, never `@ts-ignore`.
2. Conflicts between `@types/deno` and `lib.dom`/`@types/node` (`TS2300` duplicate identifier, `TS2403`): if `skipLibCheck` does not silence them, drop `"deno"` from `types` and add `src/deno_ral/deno-types.d.ts` declaring only the `Deno` members `grep -rhoE "Deno\.[a-zA-Z.]+" src/deno_ral | sort -u` lists, as `declare namespace Deno { ... }` with the signatures copied from `@types/deno`; PR 38 deletes that file instead of the package.
3. `Uint8Array<ArrayBufferLike>` vs `Uint8Array` (Node 22+ types): fix at the `src/deno_ral/` boundary (`new Uint8Array(buf)`), not with casts at call sites.
4. `ReadableStream` DOM vs `node:stream/web`: cast once inside `src/deno_ral/process.ts`.
5. Anything else that Deno's checker accepted: fix the code. A file-level `// @ts-nocheck` is allowed only in `tests/` with an issue number in the comment, and the PR lists those files.

Stop condition: `npx tsc -p tsconfig.json` prints nothing. **If the first run reports more than 300 errors, stop and report** the class histogram: that means the Phase 2 code never type-checked against Node's types, which is a Phase 2 defect to fix before the flip. Record the first and final counts in the PR description.

- [ ] **Step 5: Drop `--check` from the Deno test branch**

`tests/run-tests.sh:232` passes `--check` to `deno test`; the Node branch of PR 31 does not type-check. Leave the Deno branch untouched (it is the nightly matrix until PR 37) and add `npm run typecheck` to the local workflow in `tests/README.md` ("Type checking" paragraph: run `npm run typecheck` from the repository root; CI runs it in `lint.yml`).

- [ ] **Step 6: CI workflow**

`.github/workflows/lint.yml`:

```yaml
name: Lint, Format, Typecheck
on:
  workflow_dispatch:
  pull_request:
    branches: [main]
    paths-ignore:
      - ".claude/**"
      - "news/**"
  push:
    branches: [main]
    paths-ignore:
      - ".claude/**"
      - "news/**"

concurrency:
  group: lint-${{ github.ref }}
  cancel-in-progress: true

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Node version from configuration
        id: node
        shell: bash
        run: |
          source ./configuration
          echo "version=${NODE#v}" >> "$GITHUB_OUTPUT"
      - uses: actions/setup-node@v6
        with:
          node-version: ${{ steps.node.outputs.version }}
          cache: npm
      - run: npm ci --no-audit --no-fund
      - name: tsc
        run: npm run typecheck
```

PR 38 adds `lint` and `format` steps to this job.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.paths.json tools/typecheck .github/workflows/lint.yml tests/README.md
git commit -m "tooling: tsc --noEmit with @types/node replaces deno check"
git add -A src tests package tools && git commit -m "types: fix errors surfaced by tsc" || true
```

### Task 13 (conditional on Spike #2): `QUARTO_RUNTIME=node|deno`

Run this task only if `dev-docs/runtime-migration/SPIKES.md` records that Spike #2 passed (the `node:` bundle runs on Deno 2.9: render, preview websocket, `fs.watch`, process groups). Otherwise skip it and write "Task 13 skipped: Spike #2 failed (<one line from SPIKES.md>)" in the PR description; nothing else in this plan depends on it.

**Files:**
- Modify: `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs`, `tests/smoke/env/launcher-env.test.ts`

- [ ] **Step 1: Failing test**

Append to `tests/smoke/env/launcher-env.test.ts`:

```ts
unitTest("launcher - QUARTO_RUNTIME=deno runs the same bundle on the Deno tool", async () => {
  const r = await quarto(["--help"], { QUARTO_RUNTIME: "deno", QUARTO_LAUNCHER_DEBUG: "1" });
  assertEquals(r.code, 0, r.err);
  assert(/deno(\.exe)?"? run /.test(r.err), r.err);
});

unitTest("launcher - an unknown QUARTO_RUNTIME is an error", async () => {
  const r = await quarto(["--help"], { QUARTO_RUNTIME: "bun" });
  assertEquals(r.code, 1);
  assertStringIncludes(r.err, "QUARTO_RUNTIME must be node or deno");
});
```

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts` -> the two new tests fail.

- [ ] **Step 2: Shell launcher branch**

In `package/scripts/common/quarto`, directly before the `# --- Node runtime ---` block:

```bash
# Dual-runtime window (one prerelease cycle, removed by PR 37): the same
# node:-API bundle on the Deno tool, for users whose scripts or extensions
# still need Deno (Risks and rollback, rule 3), not a fix for Quarto defects.
case "${QUARTO_RUNTIME:-node}" in
  node) ;;
  deno)
    QUARTO_DENO_TOOL="${SCRIPT_PATH}/tools/${ARCH_DIR}/deno"
    if [ "$QUARTO_DEV_MODE" == true ]; then
      "${QUARTO_NODE:-${SCRIPT_PATH}/tools/${ARCH_DIR}/node}" "${QUARTO_ROOT}/tools/node-bundle/ensure.mjs" --entry "${DEV_PATH}" --outfile "${QUARTO_TARGET}" > /dev/null || exit 1
    fi
    export DENO_NO_UPDATE_CHECK=1
    export DENO_TLS_CA_STORE=system,mozilla
    QUARTO_DENO_RUN="run --allow-all --no-config --no-lock --v8-flags=--enable-experimental-regexp-engine,--max-old-space-size=8192,--stack-trace-limit=100"
    if [ "$QUARTO_LAUNCHER_DEBUG" == "1" ]; then
      echo "${QUARTO_DENO_TOOL} ${QUARTO_DENO_RUN} ${QUARTO_TARGET} $*" >&2
    fi
    exec "${QUARTO_DENO_TOOL}" ${QUARTO_DENO_RUN} "${QUARTO_TARGET}" "$@"
    ;;
  *)
    echo "QUARTO_RUNTIME must be node or deno (got '${QUARTO_RUNTIME}')" >&2
    exit 1
    ;;
esac
```

No `--unstable-kv`: since PR 30 `src/deno_ral/kv.ts` has one JSON backend on both runtimes and nothing in the bundle calls `Deno.openKv` (`grep -c openKv tools/node-bundle/dist/quarto.mjs` prints `0`; the flag would be refused by a future Deno that drops the unstable API).

- [ ] **Step 3: `quarto.cmd` branch**

Before `REM QUARTO_DENO is not an alias`:

```bat
IF NOT DEFINED QUARTO_RUNTIME SET "QUARTO_RUNTIME=node"
IF "!QUARTO_RUNTIME!"=="deno" (
	IF DEFINED QUARTO_DEV_MODE (
		"!SCRIPT_PATH!\tools\x86_64\node.exe" "!QUARTO_ROOT!\tools\node-bundle\ensure.mjs" --entry "!QUARTO_TS_PATH!" --outfile "!QUARTO_TARGET!" > NUL
		IF ERRORLEVEL 1 exit /b 1
	)
	SET "DENO_NO_UPDATE_CHECK=1"
	SET "DENO_TLS_CA_STORE=system,mozilla"
	SET "QUARTO_DENO_RUN=run --allow-all --no-config --no-lock --v8-flags=--enable-experimental-regexp-engine,--max-old-space-size=8192,--stack-trace-limit=100"
	IF "!QUARTO_LAUNCHER_DEBUG!"=="1" ECHO "!SCRIPT_PATH!\tools\x86_64\deno.exe" !QUARTO_DENO_RUN! "!QUARTO_TARGET!" %* 1>&2
	"!SCRIPT_PATH!\tools\x86_64\deno.exe" !QUARTO_DENO_RUN! "!QUARTO_TARGET!" %*
	GOTO end
)
IF NOT "!QUARTO_RUNTIME!"=="node" (
	ECHO QUARTO_RUNTIME must be node or deno ^(got '!QUARTO_RUNTIME!'^) 1>&2
	exit /b 1
)
```

- [ ] **Step 4: `main.rs` branch**

In `main()`, after the `--paths` handling:

```rust
    // Dual-runtime window (removed by PR 37).
    match env::var("QUARTO_RUNTIME").unwrap_or_else(|_| String::from("node")).as_str() {
        "node" => {}
        "deno" => {
            let deno_file = bin_dir.join("tools").join(arch_dir()).join(DENO_BINARY);
            let mut child = Command::new(&deno_file)
                .args([
                    "run", "--allow-all", "--no-config", "--no-lock",
                    "--v8-flags=--enable-experimental-regexp-engine,--max-old-space-size=8192,--stack-trace-limit=100",
                ])
                .arg(&js_file)
                .args(&args)
                .env("QUARTO_BIN_PATH", &bin_dir)
                .env("QUARTO_SHARE_PATH", &share_dir)
                .env("DENO_NO_UPDATE_CHECK", "1")
                .env("DENO_TLS_CA_STORE", "system,mozilla")
                .spawn()
                .expect("failed to run deno");
            let status = child.wait().expect("failed to wait on deno");
            std::process::exit(status.code().unwrap_or(0));
        }
        other => {
            eprintln!("QUARTO_RUNTIME must be node or deno (got '{}')", other);
            std::process::exit(1);
        }
    }
```

and the constants:

```rust
#[cfg(target_os = "windows")]
const DENO_BINARY: &str = "deno.exe";

#[cfg(not(target_os = "windows"))]
const DENO_BINARY: &str = "deno";
```

- [ ] **Step 5: Run and commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts && cargo build --release --manifest-path package/launcher/Cargo.toml`
Expected: all launcher tests pass; the launcher builds. Then `QUARTO_RUNTIME=deno package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd` renders.

```bash
git add package/scripts/common/quarto package/scripts/windows/quarto.cmd package/launcher/src/main.rs tests/smoke/env/launcher-env.test.ts
git commit -m "launcher: QUARTO_RUNTIME=deno runs the bundle on the Deno tool (dual-runtime window)"
```

## Dual-runtime combinations until PR 37

Two switches exist during the window, and they are independent: `QUARTO_RUNTIME` picks what runs the CLI (Task 13, only if Spike #2 passed; one prerelease cycle, closed by PR 37), `QUARTO_RUN_RUNTIME` / `project.script-runtime` picks what runs `quarto run` and project `pre-render`/`post-render` scripts (PR 35). The CLI's own executable is never the answer to "which Node runs this child": under `QUARTO_RUNTIME=deno`, `execPath()` is the Deno tool, and passing it Node flags (`--require`, a `tsc` path) fails exactly when a user has fallen back to Deno (review R08). This table is the one statement of the supported combinations; PRs 35, 36 and 37 refer to it.

| CLI (`QUARTO_RUNTIME`) | Scripts (`QUARTO_RUN_RUNTIME`) | CLI executable | Script executable | Supported | Validated by |
|---|---|---|---|---|---|
| `node` (default) | `node` (default) | `QUARTO_NODE`, else `<bin>/tools/<arch>/node[.exe]` (launchers, Task 9/10; they export `QUARTO_NODE` to the CLI process) | `architectureToolsPath("node")`: the same binary, since `QUARTO_NODE` is set | 1.12 onwards; the only combination left after PR 37 | PR 35 `tests/smoke/run/run-script-node.test.ts`, `tests/smoke/project/project-prepost.test.ts`; the required Node checks (PR 32) |
| `node` | `deno` | same | `requireDenoToolBinary()`: `QUARTO_DENO`, else `quarto install deno`, else the bundled tool (Task 11) | 1.12 onwards; bundled tool until PR 37, installed tool after | PR 35 `run-script-node.test.ts` (`QUARTO_RUN_RUNTIME=deno` case), `project-script-runtime.test.ts`; `test-install.yml` after PR 37 |
| `deno` (Task 13) | `node` | `<bin>/tools/<arch>/deno[.exe]` running the same `node:`-API bundle (Task 13) | `architectureToolsPath("node")` (`QUARTO_NODE`, else the bundled Node). **Never `execPath()`**, which is Deno here | the Task 13 window only (one prerelease cycle); removed by PR 37 | PR 35 Verification: the `dual-runtime-smoke` job (PR 32 Task 5) renders a project with a `pre-render` `.ts` script under both script runtimes |
| `deno` | `deno` | same | `requireDenoToolBinary()` | same window | same |

Other Node children of the CLI (not scripts) follow the first column only: `quarto call build-ts-extension --check` runs `tsc` on `architectureToolsPath("node")` (PR 36), whatever `QUARTO_RUNTIME` is.

**Rule for code that spawns a runtime (owned here; PR 28 documents it on `execPath()`, `_TEMPLATE.md` carries the comment):**

- `src/` code that spawns **Node** uses `architectureToolsPath("node")` (`toolsPath()` honours `QUARTO_NODE`, falls back to the bundled binary that `configure`/`prepare-dist` place in `tools/<arch>/`). It never uses `execPath()`.
- `src/` code that spawns **Deno** uses `requireDenoToolBinary(purpose)` (Task 11); never `architectureToolsPath("deno")` (the tool may be installed, not bundled) and never `execPath()`.
- `execPath()` is the executable running the current process and nothing more: Node under `QUARTO_RUNTIME=node`, the Deno tool under `QUARTO_RUNTIME=deno`. Its legitimate callers are `package/src` (`quarto-bld` is always Node after Task 4: `bundleQuarto()`, `buildQuartoPreviewJs()`, PR 35's `buildRunStdlib()`) and `tests/` helpers that spawn "the runtime running this test" and pick the arguments by `runtime().name` (PR 19 `runFixture`, PR 26 `layerScriptCommand`, PR 28's batch-file test, PR 31's Node-only harness).

Audit of the `execPath()` callers in `src/` after this PR (the grep below pins it):

| Caller | Plan | Spawns | Executable | Outcome |
|---|---|---|---|---|
| `runOnNode()` in `src/core/run/typescript.ts` | PR 35 Task 4 | a user script on Node (`--require register.cjs`) | `architectureToolsPath("node")` (was `execPath()`: R08) | corrected in PR 35 |
| `typeCheck()` in `src/command/call/build-ts-extension/cmd.ts` | PR 36 Task 1 | `node_modules/typescript/bin/tsc` | `architectureToolsPath("node")` (was `execPath()`) | corrected in PR 36 |
| `src/core/run/deno.ts`, `build-ts-extension` legacy `deno.json` path | Task 11 | the Deno tool | `requireDenoToolBinary()` | already right |
| `src/command/dev-call/make-ast-diagram/cmd.ts` (`execPath() run …`) | PR 35 Task 6 | `ast-diagram/main.ts` | goes through the run handler | spawn deleted |
| `src/core/schema/types-from-schema.ts` (`deno fmt`), `src/execute/ojs/extract-resources.ts` (`deno check`) | Task 16 | the Deno CLI | none | spawn deleted |
| `tests/unit/node-bundle-ensure.test.ts` (Task 2: `nodeBin`, "even when the harness itself runs on Deno"), PR 35's `runNodeScript` test helper | Task 2, PR 35 Task 1 | Node | `architectureToolsPath("node")` | already right (the model for the rule) |

Acceptance (this PR): `rg -n 'execPath\(\)' src -g '*.ts' -g '!src/deno_ral/**'` prints exactly `src/command/dev-call/make-ast-diagram/cmd.ts` (PR 35 Task 6 removes it). After PR 36 it prints nothing, and PRs 35 and 36 each pin their half.

### Task 14: Signing lists, CI caches, test runner default, editor config

**Files:**
- Modify: `package/src/macos/installer.ts:90-96`, `.github/workflows/create-release.yml:398`, `.github/workflows/actions/quarto-dev/action.yml:15-36`, `tests/run-tests.sh`, `tests/run-tests.ps1`, `.vscode/launch.json`
- Create: `.vscode/tasks.json`

- [ ] **Step 1: macOS signing**

In `package/src/macos/installer.ts`, inside the `["aarch64", "x86_64"].forEach` loop, keep the existing `deno` entry (the tool ships until PR 37) and add before it:

```ts
      // Node's V8 JIT needs allow-jit and allow-unsigned-executable-memory,
      // which entitlements.plist grants. PR 34 gives node its own plist.
      signWithEntitlements.push(join(
        config.directoryInfo.pkgWorking.bin,
        "tools",
        arch,
        "node",
      ));
```

Also add `join(config.directoryInfo.pkgWorking.bin, "package.json")` to `signWithoutEntitlements` next to `quarto.js` (every file in the payload is signed today; a plain JSON file is signed the same way `quarto.js` is).

- [ ] **Step 2: Windows signing**

In `.github/workflows/create-release.yml` `sign-files` `paths` (line 398 area), add `./package/pkg-working/bin/tools/x86_64/node.exe` above the `deno.exe` line and keep `deno.exe`; delete the `deno_dom/plugin.dll` line if PR 20 left it.

- [ ] **Step 3: CI caches**

In `.github/workflows/actions/quarto-dev/action.yml`, keep the "Cache deno std deps" step (the Deno tool still uses `src/resources/deno_std/cache`) and replace the "Cache Deno development cache" step (lines 15-21) with:

```yaml
    - name: Cache npm downloads
      uses: actions/cache@v5
      with:
        path: ~/.npm
        key: ${{ runner.os }}-${{ runner.arch }}-npm-v1-${{ hashFiles('package-lock.json', 'src/webui/quarto-preview/package-lock.json') }}
        restore-keys: |
          ${{ runner.os }}-${{ runner.arch }}-npm-v1-
```

Keep `QUARTO_SKIP_DENO_CACHE_WIPE: "1"` on both configure steps (it now protects the restored caches from `rm -rf package/dist`). On the first Windows run, check that the cache step reports a non-zero size; if not, change `path` to `${{ runner.os == 'Windows' && '~\AppData\Local\npm-cache' || '~/.npm' }}`.

- [ ] **Step 4: Test runner defaults to Node**

In `tests/run-tests.sh` and `tests/run-tests.ps1`, change PR 31's default of `QUARTO_TEST_RUNTIME` from `deno` to `node`. The Deno branch stays usable (Deno is still in `bin/tools`) and is what PR 32's nightly Deno matrix sets explicitly.

- [ ] **Step 5: `.vscode/launch.json` and `.vscode/tasks.json`**

Replace the "Launch Deno" configuration with:

```json
    {
      "name": "Launch Quarto (Node, dev bundle)",
      "request": "launch",
      "type": "node",
      "args": ["serve"],
      "cwd": "${workspaceFolder}/../quarto-demo",
      "runtimeExecutable": "${workspaceFolder}/package/dist/bin/tools/x86_64/node",
      "runtimeArgs": [
        "--enable-source-maps",
        "--enable-experimental-regexp-engine",
        "--max-old-space-size=8192",
        "--stack-trace-limit=100",
        "--use-system-ca",
        "--use-env-proxy",
        "--inspect-brk",
        "${workspaceFolder}/package/dist/bin/quarto-dev.mjs"
      ],
      "preLaunchTask": "quarto: ensure dev bundle",
      "env": {
        "QUARTO_BIN_PATH": "${workspaceFolder}/package/dist/bin",
        "QUARTO_SHARE_PATH": "${workspaceFolder}/src/resources",
        "QUARTO_ROOT": "${workspaceFolder}",
        "QUARTO_DEBUG": "true"
      },
      "osx": { "runtimeExecutable": "${workspaceFolder}/package/dist/bin/tools/aarch64/node" },
      "windows": { "runtimeExecutable": "${workspaceFolder}\\package\\dist\\bin\\tools\\x86_64\\node.exe" }
    },
```

(Intel Macs edit `osx.runtimeExecutable` to `x86_64` locally.) Leave the "Run Quarto test" configuration to PR 31's harness entry (if PR 31 changed it, keep its version). Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "quarto: ensure dev bundle",
      "type": "shell",
      "command": "node",
      "args": [
        "${workspaceFolder}/tools/node-bundle/ensure.mjs",
        "--entry", "${workspaceFolder}/src/quarto.ts",
        "--outfile", "${workspaceFolder}/package/dist/bin/quarto-dev.mjs"
      ],
      "problemMatcher": []
    }
  ]
}
```

`quarto-cli.code-workspace` is not changed: `deno.path` (`./package/dist/bin/tools/deno`) still exists (Task 3 keeps the symlink).

- [ ] **Step 6: Commit**

```bash
git add package/src/macos/installer.ts .github/workflows/create-release.yml .github/workflows/actions/quarto-dev/action.yml tests/run-tests.sh tests/run-tests.ps1 .vscode/launch.json .vscode/tasks.json
git commit -m "build: sign node; npm cache in CI; tests default to Node; VS Code launches the Node bundle"
```

### Task 15: Changelog and dev-docs

**Files:**
- Modify: `news/changelog-1.12.md`, `dev-docs/upgrade-dependencies.md`

(The changelog also carries the two user-visible lines of Task 16: OJS TypeScript imports are no longer type-checked, and generated type files are unformatted until PR 38.)

- [ ] **Step 1: Changelog**

Decision 2 ships Node in 1.12. Under `## Dependencies` of `news/changelog-1.12.md` (create the file with the sections `.claude/rules/changelog.md` prescribes if it does not exist):

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): Quarto now runs on Node.js v26.12.0 instead of Deno. Deno is still bundled as a tool for `quarto run` TypeScript scripts and `quarto call build-ts-extension`; `quarto install deno` installs it where it is missing.
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): Environment variables: `QUARTO_NODE` chooses the Node.js binary and `QUARTO_NODE_OPTIONS` adds Node.js flags. `QUARTO_DENO` no longer selects the CLI runtime (it still locates the Deno tool). `QUARTO_DENO_OPTIONS`, `QUARTO_DENO_EXTRA_OPTIONS`, `QUARTO_DENO_DIR` and `QUARTO_DENO_DOM` are ignored with a warning; `QUARTO_DENO_V8_OPTIONS` still works with a deprecation warning. `NODE_OPTIONS` and `NODE_PATH` do not affect Quarto itself but are passed on to the processes Quarto starts. `HTTP_PROXY`, `HTTPS_PROXY` and `NO_PROXY` keep working.
```

Replace `NNNNN` once the PR is open.

- [ ] **Step 2: `dev-docs/upgrade-dependencies.md`**

Add a `## Upgrade Node.js` section before `## Upgrade deno` (keep the Deno section: the tool is upgraded the same way until PR 37, and the `kDenoToolVersion` constant in `src/tools/impl/deno-paths.ts` must change with `DENO`):

```markdown
## Upgrade Node.js

- Pick the newest release of the current LTS line at <https://nodejs.org/dist/index.json>.
- Update `NODE` in `configuration` (developers can try another version without editing it: `QUARTO_NODE_VERSION=v26.x.y ./configure.sh`).
- Update the pinned version in `src/command/check/check.ts` (`quarto check --strict`; `tests/smoke/check/check-versions-no-mismatch.test.ts` fails on a mismatch).
- Run `./configure.sh` / `./configure.cmd`; the dev launcher also notices `package/dist/config/node-version` differs from `configuration`.
- Dispatch `create-release.yml` without publishing before merging: the Node binary is signed and notarized like every other bundled binary.
```

In the Deno section add one line: `- Update kDenoToolVersion in src/tools/impl/deno-paths.ts (tests/unit/tools/deno-tool.test.ts checks it).`

- [ ] **Step 3: Commit**

```bash
git add news/changelog-1.12.md dev-docs/upgrade-dependencies.md
git commit -m "docs: changelog and upgrade notes for the Node runtime"
```

### Task 16: Deno CLI dev utilities: port or retire (PR 25 runtime residue table, rows 6, 9, 10)

Until this task, `quarto-bld cycle-dependencies`, the `package/src/common/import-report/*` scripts and `report-bundle-async-cycles.ts` spawn the Deno CLI (`deno info --json`, `deno run`), and two `src/` sites spawn the CLI's own executable with a Deno subcommand (`deno fmt` in `types-from-schema.ts`, `deno check` in `extract-resources.ts`). After the flip `execPath()` is Node, so each needs a port or a retirement before this PR merges (PR 24 kept them on purpose; the dispositions are recorded under Decisions needed, 4 and 5).

**Files:**
- Rename: `package/src/common/import-report/deno-info.ts` -> `module-graph.ts`
- Modify: `package/src/common/import-report/{explain-all-cycles,explain-import-chain,find-bad-imports,find-bad-types-constants,report-risky-files,report-bundle-async-cycles}.ts`, `report-bundle-async-cycles.md`, `package/src/common/cyclic-dependencies.ts`, `package.json`, `package-lock.json`, `src/core/schema/types-from-schema.ts`, `src/command/dev-call/build-artifacts/cmd.ts`, `src/execute/ojs/extract-resources.ts`, `news/changelog-1.12.md`

- [ ] **Step 1: The module graph comes from the esbuild metafile**

`tools/node-bundle/build.mjs`'s `bundle()` keeps PR 26's `writeMeta` option (the builder contract in `26-node-build-job.md`, Interfaces): with `--write-meta` the CLI writes the esbuild metafile as `<outfile>.meta.json`. `module-graph.ts` exports `getModuleGraph(entry: string): Promise<DependencyGraph>`: it runs `exec(execPath(), { args: [<root>/tools/node-bundle/build.mjs, "--entry", entry, "--outfile", join(tmp, "graph.mjs"), "--no-sourcemap", "--write-meta"] })` in a temp directory, reads `graph.mjs.meta.json`, and returns `Record<fileUrl, fileUrl[]>` built from `metafile.inputs[path].imports[].path` (paths relative to the repository root, turned into `file://` URLs with `toFileUrl(join(root, path))`; `external: true` imports and `node_modules` inputs are kept as edges so the reports still show third-party packages). `DenoInfoJSON`, `getDenoInfo` and the `deno info` field names (`specifier`, `dependencies[].code`) are deleted; `moduleGraph(info)` becomes `moduleGraph(graph)` with the same return shape (`{ graph, errors }`, `errors` always empty: esbuild fails the build on an unresolved import, which `getModuleGraph` turns into a thrown `Error` naming the importer). The five importers of `deno-info.ts` change their import and nothing else; `cyclic-dependencies.ts` `loadModules()` returns `getModuleGraph(join(config.directoryInfo.src, "quarto.ts"))` and loses the `QUARTO_DENO` lookup and the `--unstable` flag.

- [ ] **Step 2: `report-bundle-async-cycles.ts` runs in-process**

Factor the body of `explain-all-cycles.ts` into an exported `writeCycles(entryPoint: string, options: { simplify?: string[]; toon?: string; graph?: string })` that the script's `import.meta.main`/`isMainModule` block calls; `report-bundle-async-cycles.ts` `generateCycles()` calls it directly instead of spawning `deno run … explain-all-cycles.ts`. Its `npm:acorn@8.14.0`, `npm:acorn-walk@8.3.4` and `npm:javascript-lp-solver` imports become bare `acorn`, `acorn-walk`, `javascript-lp-solver`, pinned exactly in the root `package.json` `devDependencies` (`npm install --save-dev --save-exact acorn@8.14.0 acorn-walk@8.3.4 javascript-lp-solver@<current>`); PR 26's bundler and PR 31's import-map hook resolve bare names from `node_modules`. Update `report-bundle-async-cycles.md`'s "Tool location" and invocation lines (`quarto run --dev …` is unchanged as a command; it runs on the Deno tool until PR 35 and on Node after, and this script no longer spawns anything).

- [ ] **Step 3: `types-from-schema.ts`: no `deno fmt`**

Delete `fmtSource()` and its call in `src/command/dev-call/build-artifacts/cmd.ts` (the generated `src/resources/types/*.ts` are written as the generator emits them; PR 38's `dprint fmt` formats them and `dprint check` keeps them formatted). Run `package/dist/bin/quarto dev-call build-artifacts` once and commit the regenerated files: the diff is whitespace only (`git diff --stat src/resources/types` and a `git diff -w --stat` that is empty).

- [ ] **Step 4: `extract-resources.ts`: no `deno check`**

Delete the `deno check` block (the `Deno.execPath()`/`execPath()` spawn with `"check"`, the `conf/deno-ts-compile.jsonc` and `conf/jsx-import-map.json` arguments, the TS7026 guidance for denoland/deno#14723) and keep the esbuild compile that follows it: a TypeScript import of an `{ojs}` cell is bundled without a type check, and a syntax error surfaces as esbuild's error. Delete `src/resources/conf/deno-ts-compile.jsonc` and `jsx-import-map.json` if nothing else reads them (`rg -n 'deno-ts-compile|jsx-import-map' src package`).

- [ ] **Step 5: Verify**

Run:
```bash
cd package/src && ./quarto-bld cycle-dependencies -o "$(mktemp -d)/cycles.json" && cd ../..
package/dist/bin/quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts
package/dist/bin/quarto run --dev package/src/common/import-report/report-bundle-async-cycles.ts
rg -n '"(info|fmt|check|bundle)"' package/src src -g '*.ts' -g '!src/deno_ral/**'
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/ojs/ -name '*.test.ts')
```
Expected: `cycles.json` written with the same top-level shape as PR 24 recorded; `find-bad-imports` exits 0; the async-cycles report prints without spawning (`ps` during the run shows no `deno` child); the `rg` prints no Deno subcommand argument; the OJS smoke tests pass, including the documents with a TypeScript import (`rg -l '\.tsx?"' tests/docs/ojs tests/docs/smoke-all/ojs`).

- [ ] **Step 6: Commit**

```bash
git add package/src package.json package-lock.json src/core/schema/types-from-schema.ts src/command/dev-call/build-artifacts/cmd.ts src/execute/ojs/extract-resources.ts src/resources/types src/resources/conf news/changelog-1.12.md
git commit -m "build: dev utilities off the Deno CLI (esbuild metafile graph; no deno fmt/check)"
```

## Verification

Before opening the PR (Linux or macOS; the three-OS run is CI):

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-dependency.test.ts unit/node-bundle-ensure.test.ts unit/runtime-env.test.ts unit/tools/deno-tool.test.ts smoke/env/launcher-env.test.ts`: all pass.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/run/ -name '*.test.ts') smoke/project/project-prepost.test.ts smoke/build-ts-extension/build-ts-extension.test.ts smoke/create/create.test.ts $(find smoke/check/ -name '*.test.ts')`: all pass. `smoke/run/run-script.test.ts` and `stdlib-run-version.test.ts` pass because `quarto run` still uses the Deno tool; that is expected, not evidence that scripts run on Node (PR 35).
- `quarto run --dev tools/check-runtime-boundary.ts`: counts unchanged (the Deno tool runs it).
- `npm run typecheck`: exit 0.
- `rg -n 'execPath\(\)' src -g '*.ts' -g '!src/deno_ral/**'` prints exactly `src/command/dev-call/make-ast-diagram/cmd.ts` ("Dual-runtime combinations until PR 37"; PR 35 Task 6 removes that one).
- `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ./quarto-bld validate-bundle && (cd ../pkg-working/bin && ./quarto check)`.
- Fresh clone: `git clone … && ./configure.sh && package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd`.
- Concurrent rebuild, the way `tests/run-parallel-tests.ts` runs buckets (`Promise.all` over `./run-tests.sh` processes, line 259): `cd tests && rm -f ../package/dist/bin/quarto-dev.mjs && for i in 1 2 3 4; do QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts & done; wait`: all four pass, and `ls ../package/dist/bin/*.tmp ../package/dist/bin/*.lock*` finds nothing. (`./run-parallel-tests.sh` itself runs through `quarto run`, i.e. the Deno tool, until PR 35.)
- Lock ownership by hand (Linux or macOS): `L=package/dist/bin/quarto-dev.mjs.lock; mkdir $L && echo "{\"pid\":$$,\"host\":\"$(hostname)\",\"nonce\":\"x\"}" > $L/owner && touch -d '10 minutes ago' $L`, then `touch src/core/path.ts && package/dist/bin/quarto --help` in a second shell: it waits (the shell holding the lock is alive, however old the lock); `rm -r $L` in the first shell: the second finishes with `bundled … reason: src/core/path.ts`. Then `mkdir $L && echo '{"pid":999999,"host":"'$(hostname)'","nonce":"x"}' > $L/owner && package/dist/bin/quarto --help`: the dead owner's lock is broken at once and no `*.lock*` is left.
- Push and let every workflow run: `test-smokes.yml` (Node default), the PR 32 Node matrix, the nightly Deno matrix (`workflow_dispatch` it once; its run URL and the `parity: OK` lines go in the PR description, the A3 merge condition in Acceptance), `test-bundle.yml`, `test-install.yml`, `lint.yml`, the boundary-ratchet workflow, `test-quarto-latexmk.yml` (unless PR 39 already removed it). Dispatch `create-release.yml` with `publish-release=false`: all jobs green, including the Windows MSI and zip, and `test-smokes-built.yml` on the artifacts.

## Review checklist

- [ ] `configure.*` and `prepare-dist` download **both** Node and Deno; no code path runs the CLI on Deno unless `QUARTO_RUNTIME=deno` (Task 13).
- [ ] `QUARTO_DENO` is never used as the Node binary anywhere (`grep -n QUARTO_DENO package/scripts package/launcher package/src/quarto-bld*`: only the Deno-tool lines).
- [ ] `NODE_OPTIONS`/`NODE_PATH` are moved to `QUARTO_SAVED_*` only when set, in all three launchers; `restoreSavedNodeEnv()` is the first statement of `quarto()`.
- [ ] Quarto's flags are identical in the shell launcher, `quarto.cmd`, `main.rs` and `quarto-bld*` (`--enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 --use-system-ca --use-env-proxy --disable-warning=MODULE_TYPELESS_PACKAGE_JSON`).
- [ ] `ensure.mjs` decides staleness from `<outfile>.inputs.json` (no directory walk, no skip list), takes the lock under the lock ownership rule (owner marker, `process.kill(pid, 0)` probe, break by rename, release only while the marker matches, the 120 s age only for an unprobeable owner, the timeout naming the owner), re-checks under it; `bundle()` writes JS last through temp + rename and calls `beforeCommit` before its first write and before that rename, keeps the `banner`/`define`/`writeMeta` inputs of PR 26's builder contract, and emits the three-global interop prelude (R04: `require`, `__filename`, `__dirname`); `build-test.mjs` is unchanged and `node tools/node-bundle/build-test.mjs --script tests/unit/ral/fixtures/exit-pipe-child.ts` still bundles.
- [ ] Dev bundles are `.mjs`; `bin/package.json` is written by `prepare-dist` and signed on macOS.
- [ ] The shim is deleted only after the Task 2 gate passed; the PR description lists the Deno members third-party code still references (guarded).
- [ ] `denoToolBinary()` resolution order: `QUARTO_DENO`, installed tool, bundled tool; `src/core/run/deno.ts` and `build-ts-extension` use it.
- [ ] `tsconfig.json` covers the CLI graph, `bld.ts` and tests; no `@ts-ignore` added; first and last `tsc` counts in the description.
- [ ] Task 13 present only if `SPIKES.md` says Spike #2 passed. The table "Dual-runtime combinations until PR 37" matches the launchers and Task 11: the launchers export `QUARTO_NODE`, so `architectureToolsPath("node")` names the CLI's Node; `execPath()` has no caller in `src/` outside `make-ast-diagram` (Verification grep).
- [ ] Task 16: `module-graph.ts` reads the esbuild metafile, no `deno info`/`deno run`/`deno fmt`/`deno check` spawn remains, the three acorn/lp-solver packages are exact `devDependencies`, and the two changelog lines are present; every row of PR 25's runtime residue table owned by this PR (6, 7, 8, 9, 10) is closed.

## Risks and rollback

- **A Phase 2 gap surfaces only at the flip** (a `Deno.*` call in code outside the ratchet's scopes). Symptom: `ReferenceError: Deno is not defined` in a render. Task 2's gate and the PR 32 matrix (which ran the bundle with the shim) narrow it; the dual-runtime switch (Task 13), when present, is the user-side workaround: `QUARTO_RUNTIME=deno`.
- **`npm ci` needs registry.npmjs.org and npm.jsr.io at configure time.** npm honours `HTTPS_PROXY`; corporate CAs need `npm config set cafile`. Developer-only (users never run npm).
- **Installer size:** the installers carry Node and Deno until PR 37 (about +120 MB per arch on macOS universal). Accepted by decision 1.
- **`--use-env-proxy` changes behaviour for users who set `HTTPS_PROXY` but relied on Quarto ignoring it** (Deno honoured it, so this restores pre-flip behaviour, not a change). `NO_PROXY` is honoured.
- **Lock left by a crashed or stopped rebuild.** `ensure.mjs` breaks a lock whose owner pid is gone as soon as it sees it, and one whose owner it cannot probe (no marker, another host) after 120 s; a live owner's lock is waited for up to 300 s, then the error names its pid, and a developer can delete `package/dist/bin/quarto-dev.mjs.lock`. The exclusion is best-effort (decision A6): a lock from another host is still broken by age alone, and a builder that lost its lock fails its write rather than overwriting the newer bundle.
- **Windows rename of the bundle while another `quarto` reads it.** libuv opens files with `FILE_SHARE_DELETE`, so the rename succeeds; `writeAtomic` retries 10 times on `EPERM`/`EBUSY` otherwise.
- **`tsc` finds many errors the first time.** Bounded by the stop condition in Task 12 step 4.
- **Rollback:** revert the PR. Every Phase 2 change still works on Deno (the PR 32 nightly Deno matrix proves it), `configure` then runs the Deno launchers again; no data format changed (`dev-config` is regenerated by `configure`).

**Rollout and rollback after the flip (owned by this plan; PR 34, PR 37 and `README.md` refer here).** `REVIEW-2026-10-16.md` decision 3, triage A4. A switch is not a rollback plan, because `QUARTO_RUNTIME=deno` (Task 13) runs the same ported layer, bundler output and launchers on the Deno tool: a defect in `src/deno_ral/`, in `tools/node-bundle/` or in a launcher is present on both sides of the switch. Hence four rules:

1. **Soak.** 1.12 prereleases ship on Node for at least one full prerelease cycle (00-assessment section 7, Phase 3 step 6) before promotion to stable; 1.11 stays the stable release for the whole soak. Promotion needs: the feature-format matrix and the Playwright suite green on the Node prerelease, the PR 32 parity report `OK` on the three OSes, PR 34's `quarto check` evidence on every supported installer, and no open P1 in the layer, the bundler or the launchers.
2. **Revert is the default for a P1 in the layer.** A defect in `src/deno_ral/`, the bundle or a launcher found during the soak is fixed forward when the fix is small and otherwise reverted PR by PR (each Phase 2 and Phase 3 PR stays revertable on its own: that is why PR 34 is separate and why PR 37 waits). The switch never counts as the fix of such a defect.
3. **The switch is for users, for scripts and extensions only.** `QUARTO_RUNTIME=deno` (when Spike #2 made Task 13 possible) and `QUARTO_RUN_RUNTIME=deno` / `script-runtime` (PR 35) exist for user-side breakage: a `quarto run` script, a project hook or an engine extension that depended on Deno. They are documented on the migration page for that purpose and nowhere as a workaround for Quarto's own defects.
4. **Returning to 1.11.** A prerelease user blocked by a Node-only defect goes back to the 1.11 stable installer, which keeps working for the whole soak and the first 1.12 stable cycle; the release notes of every 1.12 prerelease say so in one line. Caches are version-keyed (PRs 18 and 30), so going back loses nothing.

## Decisions needed

1. **Dist bundle name.** Kept as `bin/quarto.js` plus `bin/package.json` instead of renaming to `quarto.mjs`, because external tools may reference `bin/quarto.js` and the rename buys nothing once `bin/package.json` exists. Change only if a packager objects to a `package.json` in `bin/`.
2. **`QUARTO_DENO` warning when `QUARTO_NODE` is set.** The plan stays silent then (conda and other packagers set both during the transition: Node for the CLI, Deno for the tool). The alternative, warning whenever `QUARTO_DENO` is set, would print on every conda run until PR 37.
3. Not changed because the review's concern no longer applies: "`quarto-cli.code-workspace` `deno.path` points at a deleted binary". `configure.sh` keeps the `tools/deno` symlink until PR 37, which removes the `deno.*` keys.
4. **`deno fmt` of generated types (residue row 9).** Options: (a) keep formatting through the Deno tool (`requireDenoToolBinary`) until PR 38, which breaks `dev-call build-artifacts` on a checkout without the tool and ties a `src/` command to it; (b) drop the format step now and let PR 38's dprint format the generated files; (c) bring dprint forward into this PR. Recommendation and plan: (b); the one-time whitespace diff of `src/resources/types/` is committed in Task 16 step 3.
5. **`deno check` of OJS TypeScript imports (residue row 10).** Options: (a) type-check with `tsc` from the user's project, which Quarto cannot assume exists; (b) drop the type check and rely on the esbuild compile that already follows it; (c) keep `deno check` through the Deno tool, which would make a render feature depend on an optional tool. Recommendation and plan: (b), with a changelog line; an `{ojs}` cell importing TypeScript with a type error renders (as the browser would run it) instead of failing the render.
