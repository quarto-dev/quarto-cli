# PR 26: Node bundle tooling, `deno_ral` unit tests on real Node per PR, and an allowed-failure render job

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the throwaway spike in `dev-docs/runtime-migration/spike/` into maintained tooling (`tools/node-bundle/`, a root `package.json`), run the `deno_ral` unit tests on real Node 26 on every pull request against a committed known-failures list that may only shrink, and render smoke documents on Node in an allowed-failure job, so Phase 2 PRs are measured on Node and not only on Deno's compatibility layer.
**Phase:** 2. **Depends on:** PR 01 (deterministic bslib Sass ordering: without it two renders never diff clean), PR 03, 04, 05, 06, 07 (every import-map value is `jsr:` or `npm:`), PR 23 (`tests/harness.ts` registers through `Deno.test({...})`, the call the Node adapter implements; the layer tests live in `tests/unit/ral/`). **Unblocks:** Spike #2 (`SPIKES.md`), PR 27, 27b, 28, 29, 30, 31, 32.
**Branch:** `rt/26-node-build-job`.
**Suggested executor:** Opus. The resolver, the shim inventory, the test adapter and the known-failures ratchet need judgement about what the bundle and the tests really reference; the rest is mechanical.
**Size:** M (17 new files, 3 modified; nothing under `src/`).
**Ships on:** Deno; nothing under `src/` changes. Node: the new `node-unit` job (Linux and Windows) is **not** `continue-on-error` and is the per-PR real-Node signal; the `node-render` job is `continue-on-error: true` until PR 32.

## Spec

### Context

Assessment section 10 ("What the spike changes in the plan") asks for a standing CI job early: build the Node bundle the way the spike does, run smoke documents on it, and use its failure list as the backlog for Phase 1 and 2. The 2026-10-15 review (S3) adds that green Deno CI in Phase 2 proves only that Deno's `node:` compatibility layer runs the code: Deno's `node:http` sits on `Deno.serve`, its `fs.watch` on Deno's watcher, and PR 28's stdin/stdout deadlock passes on Deno and fails on Node. The fix it asks for is in this PR: run the `deno_ral` unit tests on real Node on every pull request (bundling each test file, which sidesteps the type-only-import problem S2 until PR 02b and PR 31), with a committed list of known Node failures that can only shrink.

The spike proved the approach but is not maintainable: it hard-codes `/home/user/quarto-cli`, resolves `deno.land/x` packages to local git clones, carries stubs for packages PR 04–07 replace, and sits on `@deno/shim-deno` 0.19.2, which has had no release since 2026-03 and had two bugs that bit immediately (`makeTempFile*` treats the prefix as a directory; `Conn.read` fails with EAGAIN). After PR 03–07, every import-map value is `jsr:` or `npm:`, so the resolver only needs the import map plus the `jsr:` → `@jsr/<scope>__<name>` rewrite and `node:` externals, applied to Quarto's own imports only: an import from inside `node_modules` is left to esbuild's Node resolution (the "Resolver scope" rule in Interfaces), so a package's own `path` import never becomes Quarto's `@std/path` alias and nested package versions stay nested.

Review findings on the earlier draft of this plan, all addressed here: `node --test tools/node-bundle/` fails (Node treats a directory argument as a module; a glob is used); the shim's eager `Readable.toWeb(process.stdin)` keeps a process with a piped stdin alive forever (made lazy); `deno-shim.js` under a typeless root `package.json` warns `MODULE_TYPELESS_PACKAGE_JSON` on every run (renamed `.mjs`); `readDirSync`/`readDir` wrapped generators in `wrapSync`, so ENOENT was thrown at iteration and never mapped (eager read, mapped); the render diff included `.quarto/project-cache` (SQLite on Deno, JSON on Node) and absolute paths, so "identical" was unreachable (`-x .quarto` and `normalize-html.mjs --root`); PR 01 was missing from the dependencies; CI used Node 22 against the Node 26 convention; `--check-shim` matched only top-level `Deno.x` in the bundle and missed `Deno?.x`, nested members (`Deno.stdin.read`) and the runtime-loaded JavaScript under `src/resources/` (`graphviz-wasm.js`, `julia-engine.js`).

**Decision: the shim is Quarto's own, temporary scaffolding.** `tools/node-bundle/deno-shim.mjs` does not depend on `@deno/shim-deno`. It implements only the `Deno.*` members the bundle and the runtime-loaded resources reference (`check-shim.mjs` fails the build when one is missing), it is a no-op when the real `Deno` global exists (so the same bundle runs on Deno, Spike #2 (a)), and it shrinks as PR 27–30 and 27b move each `deno_ral` module onto `node:` APIs. **Each of those PRs deletes the members it makes unused**: `node tools/node-bundle/build.mjs --check-shim` prints them under `unused`, and the PR's review checklist requires the list to be empty. PR 33 decides the shim's end (members still needed by `julia-engine.js` until the subtree pull, decision 7, and by `@cliffy/prompt` if Spike #2 (e) finds the unguarded `Deno.permissions` reachable). Justification: (a) a stale third-party shim would be a production dependency of the dev bundle for the whole of Phase 2 and would need patching anyway; (b) writing the members ourselves is the first draft of the layer bodies PR 27–30 ship; (c) a shim that only grows smaller is a progress metric.

**Decision: real-Node unit tests per PR, by bundling each test file.** `tools/node-bundle/build-test.mjs` bundles one test file with the same resolver and banner as the CLI bundle plus a 60-line `node:test` adapter (`tools/node-bundle/node-test-adapter.mjs`) that implements `Deno.test` (the only call `tests/harness.ts` makes) on `node:test`. Bundling avoids type stripping entirely (esbuild elides type-only imports), so this works before PR 02b and independently of PR 31's runner choice. `tools/node-bundle/run-unit-on-node.mjs` runs each bundle with `node --test`, collects JUnit per file and compares the failures with `tools/node-bundle/known-failures.json`: an unlisted failure fails the job, a listed test that passes fails the job until it is removed from the list, and an entry added relative to the base branch fails the job unless the PR carries the `node-known-failures-grow` label. Caveat (documented in the adapter): inside a bundle `import.meta.url` is the bundle's URL, so a test that locates fixtures through `import.meta.url` fails on Node here and is listed; PR 31 runs tests unbundled.

**Decision: where Node-only dependencies live.** `ws` (needed by the shim now and by `src/deno_ral/http.ts` from PR 29) and `esbuild` (the bundler) are `devDependencies` in the root `package.json`. `dependencies` is the exact mirror of `src/import_map.json` and is checked by `tools/node-bundle/check-deps.mjs`. PR 29 adds `"ws": "npm:ws@8.22.0"` to the import map and moves `ws` into `dependencies`.

**Decision: no `"type": "module"` in the root `package.json`.** The repository contains many `.js` files (`src/resources/**`, `tools/**`) that are not ESM for Node; a root `"type": "module"` would change how Node parses every one of them. All Node tooling, the shim and every bundle use the `.mjs` extension (`tools/node-bundle/dist/quarto.mjs`, `tools/node-bundle/dist/tests/**/*.test.mjs`).

**Decision: Node 26 in CI.** Every workflow step that installs Node uses `actions/setup-node@v6` with `node-version: 26` (README convention: pin `v26.12.0` or newer 26.x). `package.json` declares `"engines": { "node": ">=26" }`.

### Scope

In:
- `tools/node-bundle/import-map.mjs` (shared resolver), `build.mjs` (exports `bundle()`), `check-shim.mjs`, `deno-shim.mjs`, `node-test-adapter.mjs`, `build-test.mjs`, `run-unit-on-node.mjs`, `junit.mjs`, `known-failures.json`, `quarto-node` launcher, `check-deps.mjs`, `normalize-html.mjs`, and `*.test.mjs` unit tests for the tooling.
- Root `package.json`, `package-lock.json`, `.npmrc`; `.gitignore` entries.
- `.github/workflows/test-node-bundle.yml`: `node-unit` (Linux, Windows; not allowed to fail) and `node-render` (Linux; `continue-on-error: true`).
- `dev-docs/runtime-migration/node-bundle.md` (usage note).
- `dev-docs/runtime-migration/spike/README.md`: one paragraph pointing at the new tooling.

Out:
- Any change under `src/` (the bundle must run the unmodified sources). Under `tests/`, only the helper `tests/unit/ral/layer-script.ts`.
- Running the whole test suite on Node, macOS jobs, making jobs required (PR 31, PR 32).
- Removing the spike directory (it stays as the historical record).
- `quarto-bld`/`prepare-dist` on Node (PR 33).

### Interfaces

`tools/node-bundle/import-map.mjs` (ESM, no dependencies):

```js
/** Loads src/import_map.json and returns { imports, keys } (keys sorted longest first). */
export function loadImportMap(root: string): { imports: Record<string, string>; keys: string[] };
/** Applies the import map to a specifier (prefix entries ending in "/" and exact entries). Returns the input unchanged when nothing matches. */
export function applyImportMap(spec: string, map: { imports: Record<string, string>; keys: string[] }): string;
/** "jsr:@std/path@1.0.8/join" -> "@jsr/std__path/join". Throws on a malformed spec. */
export function jsrToNpm(spec: string): string;
/** "npm:/lodash@4.17.21/debounce.js" -> "lodash/debounce.js". Throws on a malformed spec. */
export function npmSpec(spec: string): string;
/** Parses a jsr:/npm: value into { name, version, subpath } where name is the npm package name ("@jsr/std__path" or "lodash"). */
export function packageOf(value: string): { name: string; version: string; subpath: string };
/** Resolves a bare specifier to an npm specifier, or returns { external: true } for node: builtins. `mapped` is true when an import-map entry matched (the target is then installed by the root package.json), false for a bare name the map does not know (a devDependency such as esbuild or ws). Throws Error("unmapped remote import <spec> -> <mapped>") for any remaining https:// value. */
export function resolveBare(spec: string, map): { target: string; mapped: boolean } | { external: true };
/** package.json `dependencies` derived from the import map (one version per package). */
export function dependenciesFromImportMap(map): Record<string, string>;
```

`tools/node-bundle/build.mjs`:

```js
/** Bundles `entry` for Node with esbuild and the import-map resolver.
 *  banner: extra JS lines placed after the shim import and before the interop prelude (default: none).
 *  shim: false omits the shim import (default true).
 *  define: esbuild defines (default { "import.meta.main": "true" }; test bundles replace import.meta).
 *  sourcemap: write outfile + ".map" (default true).
 *  writeMeta: also write the esbuild metafile as outfile + ".meta.json" and the import-map
 *    resolutions as outfile + ".resolved.json" (default false).
 *  Every bundle starts with the interop prelude (require, __filename, __dirname; see the contract below). */
export async function bundle(options: {
  entry: string; outfile: string; banner?: string[]; shim?: boolean; writeMeta?: boolean; define?: Record<string, string>; sourcemap?: boolean;
}): Promise<{ outfile: string; modules: number; bytes: number; ms: number; warnings: number }>;
/** `import "<path of file relative to outfile>";` for banners. */
export function importLine(outfile: string, file: string): string;
```

CLI: `node tools/node-bundle/build.mjs [--entry src/quarto.ts] [--out tools/node-bundle/dist/quarto.mjs] [--check-shim] [--write-meta] [--no-sourcemap]`. `--check-shim` runs `check-shim.mjs` on the written bundle and exits with its status.

**Resolver scope (owned by this plan; PR 31's import-map hook and vitest plugin state the same rule, PR 33 keeps this plugin).** The import map is Quarto's, not its dependencies', so the `deno-import-map` plugin decides by importer first and by specifier second:

| Import | Resolution |
|---|---|
| Any import whose importer is under a `node_modules` directory (`/[\\/]node_modules[\\/]/` on the importer path) | left to esbuild's Node resolution relative to the importing package: nested versions under `<pkg>/node_modules/`, package `exports`, bare built-ins (`path`, `fs`) externalised by `platform: "node"`. The import map is never consulted, so a dependency's `path` is Node's, not `@std/path`. |
| Relative, absolute and `file:` specifiers from first-party code | left to esbuild. |
| `node:` built-ins from first-party code | external. |
| A bare specifier from first-party code that an import-map entry matches (`resolveBare` → `mapped: true`: `path`, `fs/walk`, `zod`, …) | the npm target is resolved from the repository root (`resolveDir: root`), because Task 2 installs every import-map package in the root `node_modules`; the resolved file then enters ordinary resolution: its own imports have a `node_modules` importer and take the first row. Recorded in `<outfile>.resolved.json`. |
| A bare specifier from first-party code that no entry matches (`mapped: false`: `esbuild`, `ws`, a `devDependency`) | resolved from the importer's directory (`resolveDir: args.resolveDir`), as Node would; for a file under the repository this reaches the root `node_modules` by the usual walk. |

A first-party bare built-in without the `node:` prefix therefore still takes the import map (`path` → `@std/path`), as it does on Deno; only packages are exempt. The build-time check is `tools/node-bundle/build.test.mjs` (Task 3): a fixture with a root `inner@1`, a `dep` that nests `inner@2` and imports bare `path` must bundle with `inner@2` and without `@jsr/std__path`. This is the bundled counterpart of PR 31's unbundled loader rule, so the bundled execution graph and the unbundled test graph resolve packages the same way.

**The builder contract (owned by this plan; PRs 20b, 31, 32 and 33 refer here).** One `bundle()` serves every bundle in the repository, in two modes that differ only in their inputs:

| Input | CLI mode (`build.mjs` CLI; PR 33: `ensure.mjs` dev bundles, `bundleQuarto()` for `bin/quarto.js`, Task 16's module graph) | Fixture mode (`bundleTest()` in `build-test.mjs`: one test file, or a layer script with `--script`; used by `run-unit-on-node.mjs` until PR 32 and by `tests/unit/ral/layer-script.ts` from PR 26 on) |
|---|---|---|
| `entry`, `outfile` | `src/quarto.ts` (or `--entry`), `tools/node-bundle/dist/quarto.mjs` (or `--out`); PR 33: `package/dist/bin/quarto-dev.mjs`, `quarto-bld.mjs`, `package/pkg-working/bin/quarto.js` | the test file, `tools/node-bundle/dist/tests/<relative path>.mjs` |
| interop prelude (always, not an option) | `import { createRequire } from "node:module"; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);` (the three CommonJS globals `web-tree-sitter`'s UMD glue reads when `process` exists, PR 20b; `tools/deno-esbuild-bundle.ts` defines the same three for the Deno bundle until PR 33 deletes it) | same |
| `banner` | none | `importLine(outfile, node-test-adapter.mjs)` (test files only), the `__quartoImportMeta` object, `globalThis.__QUARTO_TEST_ORIGIN__ = <file URL>` (test files only) |
| `define` | `{ "import.meta.main": "true" }` while `src/quarto.ts` guards `main()` on it; `{}` once PR 19's `isMainModule` reads the real `import.meta` (PR 33 makes `{}` the default) | `{ "import.meta": "__quartoImportMeta" }` so `isMainModule` is false inside a test bundle and `src/quarto.ts` never starts the CLI |
| `shim` | `true` (the `deno-shim.mjs` import first) until PR 33 deletes the shim and the option; no caller passes it | same default; no caller passes it |
| `sourcemap` | `true`; PR 33's `prepare-dist` passes `false` (`--no-sourcemap`) | `true` |
| `writeMeta` | `--write-meta` on the CLI (`<outfile>.meta.json`, `<outfile>.resolved.json`); PR 33 Task 16 reads `<outfile>.meta.json` for the module graph | `false` |
| `beforeCommit` (PR 33 adds it, optional) | `ensure.mjs` passes its lock's `assertHeld()`: called once after esbuild returns, before the first write, and once between the bundle's temporary file and its rename, so a builder whose lock was broken and retaken fails instead of overwriting the newer bundle (PR 33 Interfaces, "Lock ownership"; triage row 33); the other CLI callers pass nothing | none |

Lifecycle: this PR defines the function and both modes; PRs 27, 27b, 28, 29 and 30 only shrink the shim; PR 31 adds nothing to it (tests run unbundled on the import-map hook; `layer-script.ts` keeps fixture mode for spawned layer scripts); PR 32 deletes `run-unit-on-node.mjs` and `known-failures.json` but keeps `build-test.mjs` and `node-test-adapter.mjs` for fixture mode; PR 33 rewrites the body (atomic temp-file writes, `<outfile>.inputs.json` for `ensure.mjs`, the `sourcemap` option, the optional `beforeCommit` hook, the shim import and `shim` option removed, `define` defaulting to `{}`) and keeps every other input and both modes, so `bundleTest()` is unchanged by the flip. A change to an input is made here first and mirrored in PR 33's Task 2 step 4; a new caller names its mode in its plan.

`tools/node-bundle/check-shim.mjs`: `node tools/node-bundle/check-shim.mjs [--bundle tools/node-bundle/dist/quarto.mjs] [--resources src/resources]`. Collects every `Deno.<a>` and `Deno.<a>.<b>` reference, including the optional-chaining forms `Deno?.<a>` and `Deno.<a>?.<b>`, from the bundle and from every `*.js`/`*.mjs` file under the resources directory (runtime-loaded code the bundle never sees: today `src/resources/js/graphviz-wasm.js` and `src/resources/extension-subtrees/julia-engine/_extensions/julia-engine/julia-engine.js`), skipping `src/resources/editor/` (editor tooling bundles that run in VS Code or a browser worker, never in the CLI process). It imports the shim in a Node process to read the members it defines (first level, and the second level of object members such as `stdin`, `errors`, `build`). Prints `shim: <N> members referenced, <M> missing, <U> unused`, then the missing list (with the files that reference each), then the unused list. Exits 1 when `M > 0`. `kIgnoredReferences` (a set in the file, empty at creation) holds false positives from string literals, each with a comment.

```js
/** Every Deno member path referenced in `source`: "readTextFileSync", "stdin.read", "errors.NotFound". */
export function referencedMembers(source: string): Set<string>;
/** Member paths defined by tools/node-bundle/deno-shim.mjs (first level, and second level of plain-object members). */
export async function definedMembers(): Promise<Set<string>>;
```

`tools/node-bundle/deno-shim.mjs`: sets `globalThis.Deno` to a `node:`-backed object **only when no `Deno` global exists**; on Deno it does nothing.

`tools/node-bundle/node-test-adapter.mjs`: on Node (the shim is active), defines `Deno.test(definition)` and `Deno.test(name, fn)` on `node:test`: `ignore` → `skip`, `only` → `only`, `fn(t)` receives `{ name, origin, step(name | def, fn?) }` where `origin` is `globalThis.__QUARTO_TEST_ORIGIN__` (the source test file's `file://` URL, set by the bundle banner) and `step` maps to `t.test` and resolves `false` when the step was ignored or failed; `sanitizeOps`/`sanitizeResources`/`sanitizeExit` are ignored.

`tools/node-bundle/build-test.mjs`: `node tools/node-bundle/build-test.mjs [--script] [--out-dir tools/node-bundle/dist/tests] <file.ts>...` bundles each file to `<out-dir>/<path relative to the repository root with .ts replaced by .mjs>`. Without `--script` the banner adds the origin and the adapter; with `--script` (a helper process a test spawns) it adds only the shim. Exports `bundleTest(file, { script, outDir }): Promise<string>` (the output path).

`tests/unit/ral/layer-script.ts` (not a test file; no `.test.ts` suffix):

```ts
/** Command line that runs `fixture` (a .ts script importing src/deno_ral/ through relative paths and
 *  import-map names) with the current runtime. Deno: `deno run --allow-all --no-config
 *  --import-map=<repo>/src/import_map.json <fixture> ...args`. Node: bundles it with
 *  `tools/node-bundle/build-test.mjs --script` and returns `node <bundle> ...args`.
 *  Tests run with cwd = tests/ (run-tests.sh and run-unit-on-node.mjs both do). */
export function layerScriptCommand(fixture: string, args?: string[]): Promise<{ cmd: string; args: string[] }>;
```

`tools/node-bundle/junit.mjs`:

```js
/** Outcomes of the JUnit XML written by `deno test --junit-path`, `node --test --test-reporter=junit` and Vitest.
 *  A case is identified by file and name (R14: two files may register the same name); the file comes from the
 *  case's file attribute (node:test on Node 26), a file-looking classname (Deno) or the enclosing file suite
 *  (Vitest), "" when the report has none (Node 22's reporter). The name sets stay for callers that know the
 *  file (run-unit-on-node.mjs runs one file per report). */
export function parseJUnit(xml: string): {
  passed: Set<string>; failed: Set<string>; skipped: Set<string>;
  cases: { file: string; name: string; outcome: "passed" | "failed" | "skipped" }[];
};
export function normalizeTestFile(p: string): string;   // "./smoke\\a.test.ts", "<root>/tests/smoke/a.test.ts" → "smoke/a.test.ts"
export const caseId: (c: { file: string; name: string }) => string;   // "<file> :: <name>", the parity identity (PR 32)
```

CLI: `node tools/node-bundle/junit.mjs summary <file.xml>...` prints `<file>: passed N, failed M, skipped K` per file.

`tools/node-bundle/run-unit-on-node.mjs`: `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json [--base <git-ref>] [--allow-growth] [--write] <file-or-dir>...`. For each `*.test.ts` (directories are searched recursively): bundle with `bundleTest`, run `node --test --test-force-exit --test-timeout=300000 --test-reporter=dot --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=<tmp>.xml <bundle>` with `cwd` = `tests/` and the `quarto-node` environment, parse the JUnit. A bundle that fails to build or a run that produces no JUnit counts as the whole file failing (`"*"`). Then, for the current OS key (`linux`, `macos`, `windows`):

- a failing test not listed → `new Node failure: <file> > <name>` (exit 1);
- a listed test that passed → `now passes on Node, remove it from known-failures.json: <file> > <name>` (exit 1);
- a listed test that did not run (renamed or deleted) → `stale known-failures entry: <file> > <name>` (exit 1);
- with `--base <ref>`: an entry present now but not in `git show <ref>:tools/node-bundle/known-failures.json` → `known-failures.json grew: <file> > <name>` (exit 1) unless `--allow-growth`;
- `--write` rewrites the current OS's section with the observed failures and exits 0 (used to create the file and when shrinking it).

`tools/node-bundle/known-failures.json`:

```json
{
  "$comment": "Node failures of the deno_ral unit tests, per OS. May only shrink (PR 26, run-unit-on-node.mjs). Values: a list of test names, or \"*\" for the whole file.",
  "linux": { "tests/unit/ral/<file>.test.ts": ["<test name as in the JUnit report>"] },
  "macos": {},
  "windows": {}
}
```

`tools/node-bundle/normalize-html.mjs`: `node tools/node-bundle/normalize-html.mjs [--root <abs-dir>] <dir>...` rewrites every `.html`, `.css`, `.js`, `.json`, `.xml`, `.md` and `.tex` file under each `<dir>` in place, and renames files whose names carry a hash:

| Pattern | Placeholder |
|---|---|
| `<abs-dir>` given with `--root`, in its native form, with forward slashes, JSON-escaped (`\\`), and as a `file://` URL | `@ROOT@` |
| 32 and 40 hex-digit hashes (Sass cache, bootstrap and library file names) | `HASH` |
| ` id="<8 hex>"` Jupyter cell ids, and `cell-<8 hex>` | ` id="CELLID"`, `cell-CELLID` |
| ISO-8601 timestamps | `TIMESTAMP` |

Nothing else is rewritten, so a remaining difference is a real one. The caller excludes `.quarto/` from the diff (`diff -r -x .quarto`), because the project cache index is a different file format per runtime by design (PR 30).

`tools/node-bundle/quarto-node`: bash launcher. Resolves the repository root from its own location, exports `QUARTO_BIN_PATH=$ROOT/package/dist/bin`, `QUARTO_SHARE_PATH=$ROOT/src/resources`, runs `node --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 $ROOT/tools/node-bundle/dist/quarto.mjs "$@"`. Honours `QUARTO_NODE` (path to a node binary, default `node`).

### Files

- Create: `tools/node-bundle/import-map.mjs`, `tools/node-bundle/check-deps.mjs`, `tools/node-bundle/check-deps.test.mjs`
- Create: `tools/node-bundle/build.mjs`, `tools/node-bundle/build.test.mjs`, `tools/node-bundle/check-shim.mjs`, `tools/node-bundle/check-shim.test.mjs`
- Create: `tools/node-bundle/deno-shim.mjs`
- Create: `tools/node-bundle/node-test-adapter.mjs`, `tools/node-bundle/build-test.mjs`, `tools/node-bundle/junit.mjs`, `tools/node-bundle/junit.test.mjs`, `tools/node-bundle/run-unit-on-node.mjs`, `tools/node-bundle/known-failures.json`
- Create: `tools/node-bundle/quarto-node` (executable bit set), `tools/node-bundle/normalize-html.mjs`, `tools/node-bundle/normalize-html.test.mjs`
- Create: `tests/unit/ral/layer-script.ts` (helper for layer tests that spawn a script importing `src/deno_ral/`; used by PR 28 and PR 30)
- Create: `package.json`, `package-lock.json`, `.npmrc`
- Create: `.github/workflows/test-node-bundle.yml`
- Create: `dev-docs/runtime-migration/node-bundle.md`
- Modify: `.gitignore` (add `/node_modules` and `/tools/node-bundle/dist`)
- Modify: `dev-docs/runtime-migration/spike/README.md` (pointer paragraph at the top)
- Modify: `dev-docs/runtime-migration/README.md` (PR 26 status → `merged` at the end)

### Acceptance criteria

- `npm ci && node tools/node-bundle/build.mjs --check-shim` exits 0 on a clean checkout with Node 26 and prints `bundled src/quarto.ts -> tools/node-bundle/dist/quarto.mjs (...)` followed by `shim: N members referenced, 0 missing, U unused`; `head -c 600 tools/node-bundle/dist/quarto.mjs` shows the interop prelude defining `require`, `__filename` and `__dirname`.
- `node --test "tools/node-bundle/*.test.mjs"` passes, `build.test.mjs` included: a package's nested dependency version survives bundling and its bare `path` import stays the Node built-in (the resolver scope rule, Interfaces).
- `tools/node-bundle/quarto-node --version` prints `99.9.9`; `sleep 10 | timeout 5 tools/node-bundle/quarto-node --version` exits 0 (lazy stdin; an eager stdin stream makes `timeout` kill it).
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` exits 0 on Linux, and its JUnit-derived tally is printed per file.
- `tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd` produces `simple.html`; after `normalize-html.mjs --root`, `diff -r -x .quarto` against the Deno render of the same file is empty.
- `node tools/node-bundle/check-deps.mjs` exits 0; editing one version in `src/import_map.json` makes it exit 1 with a one-line explanation per difference.
- The workflow runs on pull requests; `node-unit` has no `continue-on-error`, `node-render` has `continue-on-error: true` and uploads `node-render-diff`.
- No file under `src/` changes (`git diff --stat main -- src/` is empty).

## Plan

### Task 1: Resolver module with tests

**Files:**
- Create: `tools/node-bundle/import-map.mjs`
- Create: `tools/node-bundle/check-deps.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tools/node-bundle/check-deps.test.mjs
// Copyright (C) 2026 Posit Software, PBC
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyImportMap, jsrToNpm, npmSpec, packageOf, resolveBare, dependenciesFromImportMap } from "./import-map.mjs";

const map = {
  imports: {
    "path": "jsr:@std/path@1.0.8",
    "fs/": "jsr:/@std/fs@1.0.16/",
    "lodash/": "npm:/lodash@4.17.21/",
    "zod": "npm:/zod@3.24.4",
    "stale": "https://deno.land/x/stale@1.0.0/mod.ts",
  },
};
map.keys = Object.keys(map.imports).sort((a, b) => b.length - a.length);

test("applyImportMap handles exact and prefix entries", () => {
  assert.equal(applyImportMap("path", map), "jsr:@std/path@1.0.8");
  assert.equal(applyImportMap("fs/walk", map), "jsr:/@std/fs@1.0.16/walk");
  assert.equal(applyImportMap("lodash/debounce.js", map), "npm:/lodash@4.17.21/debounce.js");
  assert.equal(applyImportMap("./local.ts", map), "./local.ts");
});

test("jsrToNpm and npmSpec rewrite specifiers", () => {
  assert.equal(jsrToNpm("jsr:@std/path@1.0.8"), "@jsr/std__path");
  assert.equal(jsrToNpm("jsr:/@std/fs@1.0.16/walk"), "@jsr/std__fs/walk");
  assert.equal(npmSpec("npm:/lodash@4.17.21/debounce.js"), "lodash/debounce.js");
  assert.equal(npmSpec("npm:@b-fuze/deno-dom@0.1.49"), "@b-fuze/deno-dom");
  assert.throws(() => jsrToNpm("jsr:nope"), /bad jsr spec/);
});

test("packageOf extracts name, version and subpath", () => {
  assert.deepEqual(packageOf("jsr:/@std/fs@1.0.16/"), { name: "@jsr/std__fs", version: "1.0.16", subpath: "/" });
  assert.deepEqual(packageOf("npm:/zod@3.24.4"), { name: "zod", version: "3.24.4", subpath: "" });
});

test("resolveBare externalises node: and rejects https:", () => {
  assert.deepEqual(resolveBare("node:fs", map), { external: true });
  assert.deepEqual(resolveBare("zod", map), { target: "zod", mapped: true });
  assert.deepEqual(resolveBare("fs/walk", map), { target: "@jsr/std__fs/walk", mapped: true });
  assert.deepEqual(resolveBare("esbuild", map), { target: "esbuild", mapped: false });
  assert.throws(() => resolveBare("stale", map), /unmapped remote import stale -> https:\/\/deno\.land/);
});

test("dependenciesFromImportMap collapses subpaths and keeps one version per package", () => {
  assert.deepEqual(dependenciesFromImportMap(map), {
    "@jsr/std__fs": "1.0.16",
    "@jsr/std__path": "1.0.8",
    "lodash": "4.17.21",
    "zod": "3.24.4",
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tools/node-bundle/check-deps.test.mjs`
Expected: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../tools/node-bundle/import-map.mjs'`

- [ ] **Step 3: Implement**

```js
// tools/node-bundle/import-map.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Resolves Deno import-map specifiers (src/import_map.json) to npm package
// specifiers for the Node bundle, the dependency drift check and the Node
// test loader hook. After PR 03-07 every import-map value is `jsr:` or `npm:`.
import fs from "node:fs";
import path from "node:path";

export function loadImportMap(root) {
  const file = path.join(root, "src", "import_map.json");
  const imports = JSON.parse(fs.readFileSync(file, "utf8")).imports;
  const keys = Object.keys(imports).sort((a, b) => b.length - a.length);
  return { imports, keys };
}

export function applyImportMap(spec, map) {
  for (const k of map.keys) {
    if (k.endsWith("/")) {
      if (spec.startsWith(k)) return map.imports[k] + spec.slice(k.length);
    } else if (spec === k) {
      return map.imports[k];
    }
  }
  return spec;
}

const kJsr = /^jsr:\/?@([^/]+)\/([^@/]+)@([^/]+)(\/.*)?$/;
const kNpm = /^npm:\/?((?:@[^/]+\/)?[^@/]+)@([^/]+)(\/.*)?$/;

export function jsrToNpm(spec) {
  const m = spec.match(kJsr);
  if (!m) throw new Error("bad jsr spec " + spec);
  return `@jsr/${m[1]}__${m[2]}${m[4] ?? ""}`;
}

export function npmSpec(spec) {
  const m = spec.match(kNpm);
  if (!m) throw new Error("bad npm spec " + spec);
  return m[1] + (m[3] ?? "");
}

export function packageOf(value) {
  let m = value.match(kJsr);
  if (m) return { name: `@jsr/${m[1]}__${m[2]}`, version: m[3], subpath: m[4] ?? "" };
  m = value.match(kNpm);
  if (m) return { name: m[1], version: m[2], subpath: m[3] ?? "" };
  throw new Error("not a jsr:/npm: value: " + value);
}

export function resolveBare(spec, map) {
  if (spec.startsWith("node:")) return { external: true };
  const mapped = applyImportMap(spec, map);
  if (mapped.startsWith("jsr:")) return { target: jsrToNpm(mapped), mapped: true };
  if (mapped.startsWith("npm:")) return { target: npmSpec(mapped), mapped: true };
  if (/^https?:\/\//.test(mapped)) {
    throw new Error(
      `unmapped remote import ${spec} -> ${mapped}. Every import-map value must be jsr: or npm: (see dev-docs/runtime-migration/03-deps-skypack-to-npm.md).`,
    );
  }
  // No entry matched: a bare name the import map does not know (a devDependency
  // such as esbuild or ws). The caller resolves it from the importer, as Node would.
  return { target: mapped, mapped: mapped !== spec };
}

export function dependenciesFromImportMap(map) {
  const deps = {};
  for (const value of Object.values(map.imports)) {
    if (!/^(jsr|npm):/.test(value)) continue;
    const { name, version } = packageOf(value);
    if (deps[name] && deps[name] !== version) {
      throw new Error(`import map pins ${name} at both ${deps[name]} and ${version}`);
    }
    deps[name] = version;
  }
  return Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tools/node-bundle/check-deps.test.mjs`
Expected: `# pass 5` and `# fail 0` (the `resolveBare` test has three `mapped` assertions).

- [ ] **Step 5: Commit**

```bash
git add tools/node-bundle/import-map.mjs tools/node-bundle/check-deps.test.mjs
git commit -m "Add import-map resolver for the Node bundle tooling"
```

### Task 2: Root package.json, lockfile and the drift check

**Files:**
- Create: `tools/node-bundle/check-deps.mjs`
- Create: `package.json`, `package-lock.json`, `.npmrc`
- Modify: `.gitignore`

- [ ] **Step 1: Write the drift check**

```js
// tools/node-bundle/check-deps.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// package.json `dependencies` must mirror src/import_map.json exactly.
// `devDependencies` (esbuild, ws until PR 29) are Node-only and not checked.
// Usage: node tools/node-bundle/check-deps.mjs [--write]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dependenciesFromImportMap, loadImportMap } from "./import-map.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const expected = dependenciesFromImportMap(loadImportMap(root));
const actual = pkg.dependencies ?? {};

const problems = [];
for (const [name, version] of Object.entries(expected)) {
  if (!(name in actual)) problems.push(`missing in package.json: "${name}": "${version}"`);
  else if (actual[name] !== version) problems.push(`version drift: ${name} is ${actual[name]} in package.json, ${version} in src/import_map.json`);
}
for (const name of Object.keys(actual)) {
  if (!(name in expected)) problems.push(`not in src/import_map.json: ${name} (move it to devDependencies or add an import-map entry)`);
}

if (process.argv.includes("--write")) {
  pkg.dependencies = expected;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`wrote ${Object.keys(expected).length} dependencies to package.json; run 'npm install' to update package-lock.json`);
  process.exit(0);
}
if (problems.length) {
  console.error("package.json dependencies drift from src/import_map.json:");
  for (const p of problems) console.error("  " + p);
  console.error("Fix: node tools/node-bundle/check-deps.mjs --write && npm install");
  process.exit(1);
}
console.log(`package.json dependencies match src/import_map.json (${Object.keys(expected).length} packages)`);
```

- [ ] **Step 2: Create the package files**

```json
// package.json (dependencies are generated in the next step; keep devDependencies by hand)
{
  "name": "quarto-cli",
  "private": true,
  "description": "Node bundle tooling for quarto-cli (dev-docs/runtime-migration/node-bundle.md). dependencies mirrors src/import_map.json; devDependencies are Node-only.",
  "engines": { "node": ">=26" },
  "scripts": {
    "bundle": "node tools/node-bundle/build.mjs --check-shim",
    "check-deps": "node tools/node-bundle/check-deps.mjs",
    "test:tooling": "node --test \"tools/node-bundle/*.test.mjs\"",
    "test:unit-on-node": "node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/"
  },
  "dependencies": {},
  "devDependencies": {
    "esbuild": "0.28.1",
    "ws": "8.22.0"
  }
}
```

```ini
# .npmrc
@jsr:registry=https://npm.jsr.io
```

Append to `.gitignore`:

```
# Node bundle tooling (tools/node-bundle/)
/node_modules
/tools/node-bundle/dist
```

- [ ] **Step 3: Generate dependencies and the lockfile**

Run:
```bash
node tools/node-bundle/check-deps.mjs --write
npm install
node tools/node-bundle/check-deps.mjs
```
Expected: the first command prints `wrote N dependencies to package.json`; `npm install` creates `package-lock.json` and `node_modules/@jsr/...`; the third prints `package.json dependencies match src/import_map.json (N packages)`. N is the number of distinct packages in the import map after PR 03–07 (around 35). If `npm install` reports a 404 for an `@jsr/*` package, the import-map version does not exist on JSR: fix the import map in a follow-up to the dependency PR, not here.

- [ ] **Step 4: Verify the check fails on drift**

Run:
```bash
sed -i.bak 's/"zod": "npm:\/zod@3.24.4"/"zod": "npm:\/zod@3.24.5"/' src/import_map.json
node tools/node-bundle/check-deps.mjs; echo "exit=$?"
mv src/import_map.json.bak src/import_map.json
```
Expected: `version drift: zod is 3.24.4 in package.json, 3.24.5 in src/import_map.json` and `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .npmrc .gitignore tools/node-bundle/check-deps.mjs
git commit -m "Add root package.json mirroring src/import_map.json with a drift check"
```

### Task 3: The bundler and the shim check

**Files:**
- Create: `tools/node-bundle/build.mjs`, `tools/node-bundle/build.test.mjs`
- Create: `tools/node-bundle/check-shim.mjs`
- Create: `tools/node-bundle/check-shim.test.mjs`

- [ ] **Step 1: Write the failing test for the reference scanner**

```js
// tools/node-bundle/check-shim.test.mjs
// Copyright (C) 2026 Posit Software, PBC
import { test } from "node:test";
import assert from "node:assert/strict";
import { referencedMembers } from "./check-shim.mjs";

test("referencedMembers finds plain, optional-chained and nested references", () => {
  const src = [
    "Deno.readTextFileSync(p);",
    "const v = Deno?.version?.deno;",
    "await Deno.stdin.read(buf);",
    "if (x instanceof Deno.errors.NotFound) {}",
    "globalThis.Deno.build.os;",
    "const notDeno = MyDeno.foo; const d = Denominator.bar;",
  ].join("\n");
  assert.deepEqual([...referencedMembers(src)].sort(), [
    "build", "build.os", "errors", "errors.NotFound", "readTextFileSync", "stdin", "stdin.read", "version", "version.deno",
  ]);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tools/node-bundle/check-shim.test.mjs`
Expected: `ERR_MODULE_NOT_FOUND` for `./check-shim.mjs`.

- [ ] **Step 3: Write the bundler**

```js
// tools/node-bundle/build.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Bundles a TypeScript entry for Node with esbuild, resolving the Deno import
// map to npm / JSR-on-npm packages. The CLI bundle and the test bundles
// (build-test.mjs) share this function. Usage:
//   node tools/node-bundle/build.mjs [--entry src/quarto.ts] [--out tools/node-bundle/dist/quarto.mjs] [--check-shim]
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadImportMap, resolveBare } from "./import-map.mjs";

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, "..", "..");
export const shimPath = path.join(here, "deno-shim.mjs");

/** `import "<relative path from outfile to file>";` */
export function importLine(outfile, file) {
  let rel = path.relative(path.dirname(outfile), file).split(path.sep).join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return `import ${JSON.stringify(rel)};`;
}

export async function bundle({ entry, outfile, banner = [], shim = true, writeMeta = false, define = { "import.meta.main": "true" }, sourcemap = true }) {
  const map = loadImportMap(root);
  const resolved = new Map();
  const plugin = {
    name: "deno-import-map",
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.kind === "entry-point" || args.pluginData === "remapped") return;
        // Resolver scope (Interfaces): the import map is Quarto's, not its
        // dependencies'. Anything imported from inside node_modules is left to
        // esbuild's Node resolution relative to the importing package (nested
        // versions, package exports, bare built-ins such as "path").
        if (/[\\/]node_modules[\\/]/.test(args.importer)) return;
        const spec = args.path;
        if (spec.startsWith("./") || spec.startsWith("../") || path.isAbsolute(spec) || spec.startsWith("file:")) return;
        let r;
        try {
          r = resolveBare(spec, map);
        } catch (e) {
          return { errors: [{ text: `${e.message} (from ${args.importer})` }] };
        }
        if (r.external) return { path: spec, external: true };
        if (r.mapped) resolved.set(spec, r.target);
        // A mapped package is installed by the root package.json (Task 2), so it
        // resolves from the root; an unmapped bare name (esbuild, ws, a
        // devDependency) resolves from the importer's directory, as Node would.
        const res = await build.resolve(r.target, { kind: args.kind, resolveDir: r.mapped ? root : args.resolveDir, pluginData: "remapped" });
        if (res.errors.length) {
          return { errors: res.errors.map((e) => ({ ...e, text: `${e.text} (mapping ${spec} -> ${r.target} from ${args.importer}; run npm ci)` })) };
        }
        return { path: res.path, external: res.external };
      });
    },
  };
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  const lines = [];
  if (shim) lines.push(importLine(outfile, shimPath));
  lines.push(...banner);
  // Interop prelude (builder contract): the CommonJS globals that UMD glue
  // bundled into this ES module reads when `process` exists (web-tree-sitter, PR 20b).
  lines.push(
    `import { createRequire as __quartoCreateRequire } from "node:module";`,
    `import { fileURLToPath as __quartoFileURLToPath } from "node:url";`,
    `import { dirname as __quartoDirname } from "node:path";`,
    `const require = __quartoCreateRequire(import.meta.url);`,
    `const __filename = __quartoFileURLToPath(import.meta.url);`,
    `const __dirname = __quartoDirname(__filename);`,
  );
  const t0 = Date.now();
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node26",
    outfile,
    sourcemap,
    logLevel: "warning",
    plugins: [plugin],
    // CLI bundle: src/quarto.ts guards main() on import.meta.main until PR 19
    // (isMainModule). In a single-file bundle every inlined module sees the
    // bundle's import.meta, so any other guarded module would run too: only
    // src/quarto.ts may use the guard (_TEMPLATE.md, main.ts). Test bundles
    // override import.meta entirely (build-test.mjs).
    define,
    banner: { js: lines.join("\n") },
    metafile: true,
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: true, verbatimModuleSyntax: false } },
  });
  if (writeMeta) {
    fs.writeFileSync(outfile + ".meta.json", JSON.stringify(result.metafile));
    fs.writeFileSync(outfile + ".resolved.json", JSON.stringify(Object.fromEntries(resolved), null, 2));
  }
  return {
    outfile,
    modules: Object.keys(result.metafile.inputs).length,
    bytes: fs.statSync(outfile).size,
    ms: Date.now() - t0,
    warnings: result.warnings.length,
  };
}

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i === -1 ? def : process.argv[i + 1];
}

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  const entry = path.resolve(root, arg("--entry", "src/quarto.ts"));
  const outfile = path.resolve(root, arg("--out", "tools/node-bundle/dist/quarto.mjs"));
  const r = await bundle({ entry, outfile, writeMeta: process.argv.includes("--write-meta"), sourcemap: !process.argv.includes("--no-sourcemap") });
  console.log(
    `bundled ${path.relative(root, entry)} -> ${path.relative(root, outfile)} (${(r.bytes / 1e6).toFixed(1)} MB, ${r.modules} modules, ${r.ms} ms, ${r.warnings} warnings)`,
  );
  if (process.argv.includes("--check-shim")) {
    const c = spawnSync(process.execPath, [path.join(here, "check-shim.mjs"), "--bundle", outfile], { stdio: "inherit" });
    process.exit(c.status ?? 1);
  }
}
```

- [ ] **Step 4: Write the shim check**

```js
// tools/node-bundle/check-shim.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Compares the Deno members referenced by the Node bundle AND by the
// runtime-loaded JavaScript under src/resources (graphviz-wasm.js,
// julia-engine.js: never seen by the bundler) with the members
// tools/node-bundle/deno-shim.mjs defines. Missing -> exit 1. Unused members
// are printed: the Phase 2 PR that made them unused deletes them.
// Usage: node tools/node-bundle/check-shim.mjs [--bundle tools/node-bundle/dist/quarto.mjs] [--resources src/resources]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

// False positives (a "Deno.x" inside a string literal that is never
// evaluated). One line per entry, each with the file and reason.
const kIgnoredReferences = new Set([]);

const kRef = /(?<![\w$.])(?:globalThis\s*\.\s*)?Deno\s*\??\.\s*([A-Za-z_$][\w$]*)(?:\s*\??\.\s*([A-Za-z_$][\w$]*))?/g;

export function referencedMembers(source) {
  const out = new Set();
  // `globalThis.Deno.x` is preceded by "." so the lookbehind skips it; scan it separately.
  const normalized = source.replace(/globalThis\s*\.\s*Deno\b/g, " Deno");
  for (const m of normalized.matchAll(kRef)) {
    out.add(m[1]);
    if (m[2]) out.add(`${m[1]}.${m[2]}`);
  }
  return out;
}

export async function definedMembers() {
  const shim = (await import(pathToFileURL(path.join(here, "deno-shim.mjs")).href)).default;
  const out = new Set();
  for (const [k, v] of Object.entries(Object.getOwnPropertyDescriptors(shim))) {
    out.add(k);
    const value = v.value;
    if (value && typeof value === "object") {
      for (const sub of Object.getOwnPropertyNames(value)) out.add(`${k}.${sub}`);
    }
  }
  return out;
}

// Not loaded by the CLI: editor tooling bundles that run in VS Code or a
// browser worker (src/resources/editor/tools/vs-code.mjs, yaml/web-worker.js).
const kSkipResourceDirs = new Set([path.join(root, "src", "resources", "editor")]);

function* jsFiles(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.name === "node_modules") continue;
    const full = path.join(dir, d.name);
    if (kSkipResourceDirs.has(full)) continue;
    if (d.isDirectory()) yield* jsFiles(full);
    else if (/\.(m?js)$/.test(d.name)) yield full;
  }
}

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i === -1 ? def : process.argv[i + 1];
}

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  const bundlePath = path.resolve(root, arg("--bundle", "tools/node-bundle/dist/quarto.mjs"));
  const resources = path.resolve(root, arg("--resources", "src/resources"));
  const where = new Map(); // member -> Set of files
  const add = (file, src) => {
    for (const m of referencedMembers(src)) {
      if (kIgnoredReferences.has(m)) continue;
      if (!where.has(m)) where.set(m, new Set());
      where.get(m).add(path.relative(root, file));
    }
  };
  add(bundlePath, fs.readFileSync(bundlePath, "utf8"));
  for (const f of jsFiles(resources)) add(f, fs.readFileSync(f, "utf8"));
  const defined = await definedMembers();
  // A nested reference counts as missing only when its parent is a defined plain object.
  const missing = [...where.keys()].filter((m) => {
    if (!m.includes(".")) return !defined.has(m);
    const parent = m.split(".")[0];
    const parentIsObject = [...defined].some((d) => d.startsWith(parent + "."));
    return defined.has(parent) && parentIsObject && !defined.has(m);
  }).sort();
  const topLevelUsed = new Set([...where.keys()].map((m) => m.split(".")[0]));
  const unused = [...defined].filter((m) => !m.includes(".") && !topLevelUsed.has(m)).sort();
  console.log(`shim: ${where.size} members referenced, ${missing.length} missing, ${unused.length} unused`);
  if (missing.length) {
    console.error("Deno members referenced but not defined in tools/node-bundle/deno-shim.mjs:");
    for (const m of missing) console.error(`  ${m}  (${[...where.get(m)].slice(0, 3).join(", ")})`);
  }
  if (unused.length) {
    console.log("defined in the shim but referenced nowhere (delete them in the PR that made them unused):");
    for (const m of unused) console.log(`  ${m}`);
  }
  process.exit(missing.length ? 1 : 0);
}
```

- [ ] **Step 5: Write the resolver-scope test**

The fixture is the one R03 of `REVIEW-2026-10-16.md` asks for: two versions of a transitive dependency and a dependency importing bare `path`. It lives in a temp directory with its own `node_modules`, so it needs no package from the repository; `bundle()` still loads `src/import_map.json` from the repository root, which is what makes bare `path` a trap.

```js
// tools/node-bundle/build.test.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Resolver scope (26-node-build-job.md, Interfaces): the import map applies
// to Quarto's own imports only; packages resolve as Node would, relative to
// their importer.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "./build.mjs";

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

test("packages resolve relative to their importer and keep bare built-ins", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quarto-bundle-scope-"));
  try {
    // entry -> dep (root node_modules) -> inner@2 (nested under dep); the root also
    // holds inner@1. dep imports bare "path", which Quarto's import map sends to @std/path.
    write(path.join(dir, "node_modules/dep/package.json"), JSON.stringify({ name: "dep", version: "1.0.0", main: "index.js" }));
    write(path.join(dir, "node_modules/dep/index.js"), 'const path = require("path");\nconst inner = require("inner");\nmodule.exports = { sep: path.sep, inner };\n');
    write(path.join(dir, "node_modules/dep/node_modules/inner/package.json"), JSON.stringify({ name: "inner", version: "2.0.0", main: "index.js" }));
    write(path.join(dir, "node_modules/dep/node_modules/inner/index.js"), 'module.exports = "inner@2 nested under dep";\n');
    write(path.join(dir, "node_modules/inner/package.json"), JSON.stringify({ name: "inner", version: "1.0.0", main: "index.js" }));
    write(path.join(dir, "node_modules/inner/index.js"), 'module.exports = "inner@1 at the root";\n');
    write(path.join(dir, "entry.ts"), 'import dep from "dep";\nconsole.log(JSON.stringify(dep));\n');
    const outfile = path.join(dir, "out", "entry.mjs");
    await bundle({ entry: path.join(dir, "entry.ts"), outfile, shim: false, sourcemap: false, writeMeta: true });
    const js = fs.readFileSync(outfile, "utf8");
    assert.match(js, /inner@2 nested under dep/, "dep must get its nested inner@2");
    assert.doesNotMatch(js, /inner@1 at the root/, "the root inner@1 must not replace dep's nested copy");
    assert.doesNotMatch(js, /std__path/, "dep's bare `path` must stay the Node built-in, not Quarto's @std/path alias");
    assert.deepEqual(JSON.parse(fs.readFileSync(outfile + ".resolved.json", "utf8")), {}, "nothing in the fixture goes through the import map");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
```

Before the `node_modules` importer check in `build.mjs`, this test fails on the third assertion: `dep`'s `path` goes through the import map, `@jsr/std__path` is resolved from the repository root and its module path comments appear in the bundle (esbuild labels every inlined module with its path). With the check, it passes.

- [ ] **Step 6: Run the tooling tests**

Run: `node --test tools/node-bundle/check-shim.test.mjs tools/node-bundle/build.test.mjs`
Expected: `# pass 2`, `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add tools/node-bundle/build.mjs tools/node-bundle/build.test.mjs tools/node-bundle/check-shim.mjs tools/node-bundle/check-shim.test.mjs
git commit -m "node-bundle: esbuild bundler with an exported bundle(), an import map scoped to first-party importers, and a shim check over bundle and resources"
```

### Task 4: The temporary Deno shim

**Files:**
- Create: `tools/node-bundle/deno-shim.mjs`

- [ ] **Step 1: Write the shim**

The member list is the union of the assessment's inventory (section 3.1 and 3.3), what the spike needed, and what `src/resources/**/*.js` references (run `node tools/node-bundle/check-shim.mjs` after the first build to see it). Every member is assigned as `Deno.<name> = ...` on its own line. Differences from the spike shim, each a review finding: `.mjs`; a no-op on Deno; `stdin`/`stdout`/`stderr` streams are created lazily (an eager `Readable.toWeb(process.stdin)` keeps the process alive while a pipe is open); `readDirSync` reads eagerly and `readDir` maps errors inside the iterator (a wrapped generator never maps ENOENT); `.bat`/`.cmd` go through the BatBadBut-safe `cmd.exe` command line Deno's Rust `Command` builds (PR 28 moves this into `src/deno_ral/process.ts` and deletes it here).

```js
// tools/node-bundle/deno-shim.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// TEMPORARY SCAFFOLDING. `globalThis.Deno` for the Node bundle, implemented
// on node: APIs. It does nothing when a real Deno global exists, so the same
// bundle runs on Deno (SPIKES.md, Spike #2 (a)). Each Phase 2 PR (27, 27b,
// 28, 29, 30) moves a src/deno_ral module onto node: APIs and deletes the
// members it makes unused: `node tools/node-bundle/build.mjs --check-shim`
// lists them. Do not add members for new application code: application code
// must not call Deno.* (PR 02 ratchet).
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import crypto from "node:crypto";
import util from "node:util";
import { spawn, spawnSync } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { isatty } from "node:tty";
import url from "node:url";
import { WebSocketServer } from "ws";

const onDeno = typeof globalThis.Deno !== "undefined";
const Deno = {};
Deno[Symbol.for("quarto.deno-shim")] = true;

// ---------------------------------------------------------------- errors
class DenoError extends Error {
  constructor(message, code) { super(message); this.name = new.target.name; this.code = code; }
}
const errors = {
  NotFound: class NotFound extends DenoError { constructor(m) { super(m, "ENOENT"); } },
  AlreadyExists: class AlreadyExists extends DenoError { constructor(m) { super(m, "EEXIST"); } },
  PermissionDenied: class PermissionDenied extends DenoError { constructor(m) { super(m, "EACCES"); } },
  AddrInUse: class AddrInUse extends DenoError { constructor(m) { super(m, "EADDRINUSE"); } },
  ConnectionRefused: class ConnectionRefused extends DenoError { constructor(m) { super(m, "ECONNREFUSED"); } },
  ConnectionReset: class ConnectionReset extends DenoError { constructor(m) { super(m, "ECONNRESET"); } },
  ConnectionAborted: class ConnectionAborted extends DenoError { constructor(m) { super(m, "ECONNABORTED"); } },
  NotConnected: class NotConnected extends DenoError { constructor(m) { super(m, "ENOTCONN"); } },
  BrokenPipe: class BrokenPipe extends DenoError { constructor(m) { super(m, "EPIPE"); } },
  NotSupported: class NotSupported extends DenoError { constructor(m) { super(m, "ENOTSUP"); } },
  Interrupted: class Interrupted extends DenoError { constructor(m) { super(m, "EINTR"); } },
  BadResource: class BadResource extends DenoError { constructor(m) { super(m, "EBADF"); } },
  InvalidData: class InvalidData extends DenoError { constructor(m) { super(m, "EINVAL"); } },
};
const byCode = {
  ENOENT: errors.NotFound, EEXIST: errors.AlreadyExists, EACCES: errors.PermissionDenied, EPERM: errors.PermissionDenied,
  EADDRINUSE: errors.AddrInUse, ECONNREFUSED: errors.ConnectionRefused, ECONNRESET: errors.ConnectionReset,
  ECONNABORTED: errors.ConnectionAborted, ENOTCONN: errors.NotConnected, EPIPE: errors.BrokenPipe, ENOTSUP: errors.NotSupported,
};
// Node throws plain errors with .code; code that still does `instanceof Deno.errors.X` needs the class.
function mapError(e) {
  const C = e && byCode[e.code];
  if (!C || e instanceof C) return e;
  const out = new C(e.message);
  out.stack = e.stack;
  return out;
}
function wrapSync(fn) { return (...a) => { try { return fn(...a); } catch (e) { throw mapError(e); } }; }
function wrapAsync(fn) { return async (...a) => { try { return await fn(...a); } catch (e) { throw mapError(e); } }; }
Deno.errors = errors;

// ---------------------------------------------------------------- paths & stat
const p = (x) => (x instanceof URL ? url.fileURLToPath(x) : x);
function fileInfo(st) {
  return {
    isFile: st.isFile(), isDirectory: st.isDirectory(), isSymlink: st.isSymbolicLink(),
    size: st.size, mtime: st.mtime, atime: st.atime, birthtime: st.birthtime, ctime: st.ctime,
    mode: st.mode, dev: st.dev, ino: st.ino, nlink: st.nlink, uid: st.uid, gid: st.gid, rdev: st.rdev,
    blksize: st.blksize, blocks: st.blocks, isBlockDevice: st.isBlockDevice(), isCharDevice: st.isCharacterDevice(),
    isFifo: st.isFIFO(), isSocket: st.isSocket(),
  };
}
function dirEntry(d) { return { name: d.name, isFile: d.isFile(), isDirectory: d.isDirectory(), isSymlink: d.isSymbolicLink() }; }
const writeFlags = (o = {}) => (o.append ? "a" : "w") + (o.createNew ? "x" : "");

Deno.readTextFileSync = wrapSync((f) => fs.readFileSync(p(f), "utf8"));
Deno.readTextFile = wrapAsync((f) => fsp.readFile(p(f), "utf8"));
Deno.readFileSync = wrapSync((f) => new Uint8Array(fs.readFileSync(p(f))));
Deno.readFile = wrapAsync(async (f) => new Uint8Array(await fsp.readFile(p(f))));
Deno.writeTextFileSync = wrapSync((f, d, o) => fs.writeFileSync(p(f), d, { flag: writeFlags(o), mode: o?.mode }));
Deno.writeTextFile = wrapAsync((f, d, o) => fsp.writeFile(p(f), d, { flag: writeFlags(o), mode: o?.mode }));
Deno.writeFileSync = wrapSync((f, d, o) => fs.writeFileSync(p(f), d, { flag: writeFlags(o), mode: o?.mode }));
Deno.writeFile = wrapAsync((f, d, o) => fsp.writeFile(p(f), d, { flag: writeFlags(o), mode: o?.mode }));
Deno.statSync = wrapSync((f) => fileInfo(fs.statSync(p(f))));
Deno.stat = wrapAsync(async (f) => fileInfo(await fsp.stat(p(f))));
Deno.lstatSync = wrapSync((f) => fileInfo(fs.lstatSync(p(f))));
Deno.lstat = wrapAsync(async (f) => fileInfo(await fsp.lstat(p(f))));
Deno.mkdirSync = wrapSync((f, o) => { fs.mkdirSync(p(f), { recursive: !!o?.recursive, mode: o?.mode }); });
Deno.mkdir = wrapAsync(async (f, o) => { await fsp.mkdir(p(f), { recursive: !!o?.recursive, mode: o?.mode }); });
Deno.removeSync = wrapSync((f, o) => fs.rmSync(p(f), { recursive: !!o?.recursive, force: false }));
Deno.remove = wrapAsync((f, o) => fsp.rm(p(f), { recursive: !!o?.recursive, force: false }));
Deno.renameSync = wrapSync((a, b) => fs.renameSync(p(a), p(b)));
Deno.rename = wrapAsync((a, b) => fsp.rename(p(a), p(b)));
Deno.copyFileSync = wrapSync((a, b) => fs.copyFileSync(p(a), p(b)));
Deno.copyFile = wrapAsync((a, b) => fsp.copyFile(p(a), p(b)));
// Deno.readDirSync throws at the call for a missing directory: read eagerly.
Deno.readDirSync = wrapSync((f) => fs.readdirSync(p(f), { withFileTypes: true }).map(dirEntry));
// Deno.readDir throws at the first iteration: map the error inside the iterator.
Deno.readDir = (f) => ({
  async *[Symbol.asyncIterator]() {
    let list;
    try { list = await fsp.readdir(p(f), { withFileTypes: true }); } catch (e) { throw mapError(e); }
    for (const d of list) yield dirEntry(d);
  },
});
Deno.symlinkSync = wrapSync((t, f, o) => fs.symlinkSync(p(t), p(f), o?.type === "dir" ? "dir" : o?.type === "file" ? "file" : undefined));
Deno.symlink = wrapAsync((t, f, o) => fsp.symlink(p(t), p(f), o?.type === "dir" ? "dir" : o?.type === "file" ? "file" : undefined));
Deno.readLinkSync = wrapSync((f) => fs.readlinkSync(p(f)));
Deno.readLink = wrapAsync((f) => fsp.readlink(p(f)));
Deno.realPathSync = wrapSync((f) => fs.realpathSync.native(p(f)));
Deno.realPath = wrapAsync((f) => fsp.realpath(p(f)));
Deno.chmodSync = wrapSync((f, m) => fs.chmodSync(p(f), m));
Deno.chmod = wrapAsync((f, m) => fsp.chmod(p(f), m));
Deno.utimeSync = wrapSync((f, a, m) => fs.utimesSync(p(f), a, m));
Deno.utime = wrapAsync((f, a, m) => fsp.utimes(p(f), a, m));
Deno.truncateSync = wrapSync((f, l) => fs.truncateSync(p(f), l));
Deno.cwd = () => process.cwd();
Deno.chdir = wrapSync((d) => process.chdir(p(d)));

class FsFile {
  constructor(fd, filePath) { this.fd = fd; this.path = filePath; }
  get readable() { return Readable.toWeb(fs.createReadStream(this.path, { fd: this.fd, autoClose: true })); }
  get writable() { return Writable.toWeb(fs.createWriteStream(this.path, { fd: this.fd, autoClose: true })); }
  readSync(buf) { const n = fs.readSync(this.fd, buf); return n === 0 ? null : n; }
  writeSync(buf) { return fs.writeSync(this.fd, buf); }
  statSync() { return fileInfo(fs.fstatSync(this.fd)); }
  close() { try { fs.closeSync(this.fd); } catch { /* already closed by a stream */ } }
  [Symbol.dispose]() { this.close(); }
}
function openFlags(o = { read: true }) {
  if (o.createNew) return o.read ? "wx+" : "wx";
  if (o.append) return o.read ? "a+" : "a";
  if (o.truncate || (o.write && o.create && !o.read)) return o.read ? "w+" : "w";
  if (o.write) return "r+";
  return "r";
}
Deno.openSync = wrapSync((f, o) => new FsFile(fs.openSync(p(f), openFlags(o), o?.mode), p(f)));
Deno.open = wrapAsync(async (f, o) => Deno.openSync(f, o));
Deno.createSync = wrapSync((f) => new FsFile(fs.openSync(p(f), "w+"), p(f)));
Deno.create = wrapAsync(async (f) => Deno.createSync(f));

// ---------------------------------------------------------------- temp files: <dir>/<prefix><random><suffix>, 5 attempts on EEXIST
function tempPath(o = {}) {
  return path.join(o.dir ?? os.tmpdir(), `${o.prefix ?? ""}${crypto.randomBytes(6).toString("hex")}${o.suffix ?? ""}`);
}
function attempts(fn) {
  let last;
  for (let i = 0; i < 5; i++) { try { return fn(); } catch (e) { last = e; if (e.code !== "EEXIST") throw mapError(e); } }
  throw mapError(last);
}
Deno.makeTempDirSync = (o) => attempts(() => { const t = tempPath(o); fs.mkdirSync(t); return t; });
Deno.makeTempDir = async (o) => Deno.makeTempDirSync(o);
Deno.makeTempFileSync = (o) => attempts(() => { const t = tempPath(o); fs.closeSync(fs.openSync(t, "wx", 0o600)); return t; });
Deno.makeTempFile = async (o) => Deno.makeTempFileSync(o);

// ---------------------------------------------------------------- env, process, platform
Deno.env = {
  get: (k) => process.env[k],
  set: (k, v) => { process.env[k] = v; },
  delete: (k) => { delete process.env[k]; },
  has: (k) => k in process.env,
  toObject: () => ({ ...process.env }),
};
Deno.args = process.argv.slice(2);
Deno.exit = (code) => process.exit(code ?? 0);
Deno.execPath = () => process.execPath;
Deno.pid = process.pid;
Deno.uid = () => (process.getuid ? process.getuid() : null);
Deno.noColor = !!process.env.NO_COLOR;
Deno.build = {
  os: process.platform === "win32" ? "windows" : process.platform,
  arch: process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : process.arch,
  target: `${process.arch}-${process.platform}`,
};
Deno.version = { deno: `node-shim/${process.versions.node}`, v8: process.versions.v8, typescript: "n/a" };
Deno.consoleSize = () => ({ columns: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 });
Deno.inspect = (v, o) => util.inspect(v, { depth: o?.depth ?? 4, colors: !!o?.colors });
Deno.addSignalListener = (sig, fn) => process.on(sig, fn);
Deno.removeSignalListener = (sig, fn) => process.off(sig, fn);
Deno.kill = (pid, sig = "SIGTERM") => process.kill(pid, sig);
// @cliffy/prompt path suggestions call Deno.permissions unguarded (SPIKES.md, Spike #2 (e)).
Deno.permissions = { query: async () => ({ state: "granted" }), querySync: () => ({ state: "granted" }) };
Deno.hostname = () => os.hostname();
Deno.memoryUsage = () => process.memoryUsage();
// Streams are created on first use: Readable.toWeb(process.stdin) on a pipe
// keeps the event loop alive until the pipe closes.
function lazy(obj, name, make) {
  let v;
  Object.defineProperty(obj, name, { enumerable: true, get: () => (v ??= make()) });
}
Deno.stdout = { writeSync: (b) => fs.writeSync(1, b), write: async (b) => fs.writeSync(1, b), isTerminal: () => isatty(1), rid: 1 };
lazy(Deno.stdout, "writable", () => Writable.toWeb(process.stdout));
Deno.stderr = { writeSync: (b) => fs.writeSync(2, b), write: async (b) => fs.writeSync(2, b), isTerminal: () => isatty(2), rid: 2 };
lazy(Deno.stderr, "writable", () => Writable.toWeb(process.stderr));
Deno.stdin = {
  readSync: (b) => { const n = fs.readSync(0, b); return n === 0 ? null : n; },
  read: async (b) => { const n = fs.readSync(0, b); return n === 0 ? null : n; },
  isTerminal: () => isatty(0), rid: 0, setRaw: (on) => process.stdin.setRawMode?.(on),
};
lazy(Deno.stdin, "readable", () => Readable.toWeb(process.stdin));
Deno.isatty = (rid) => isatty(rid);
Deno.dlopen = () => { throw new Error("FFI is not available on Node (deno_dom native plugin is removed in PR 20)"); };

// ---------------------------------------------------------------- Deno.Command
function stdio(v, def) { if (v === undefined) return def; if (typeof v === "number") return v; return v === "piped" ? "pipe" : v === "null" ? "ignore" : "inherit"; }
function spawnOptions(opts, mode) {
  const env = opts.clearEnv ? { ...(opts.env ?? {}) } : { ...process.env, ...(opts.env ?? {}) };
  const defIn = mode === "spawn" ? "inherit" : "ignore";
  const defOut = mode === "spawn" ? "inherit" : "pipe";
  return { cwd: opts.cwd, env, stdio: [stdio(opts.stdin, defIn), stdio(opts.stdout, defOut), stdio(opts.stderr, defOut)], windowsHide: true, signal: opts.signal };
}
// Deno's Rust Command escapes .bat/.cmd arguments for cmd.exe (CVE-2024-24576);
// Node refuses to spawn them without a shell (CVE-2024-27980). Same algorithm
// as PR 28's batchCommandLine (Rust std make_bat_command_line).
function batchCommandLine(script, args) {
  if (script.includes('"') || script.endsWith("\\")) throw Object.assign(new Error(`invalid batch file path: ${script}`), { code: "EINVAL" });
  let line = `"${script}"`;
  for (const arg of args) {
    if (/[\r\n\0]/.test(arg)) throw Object.assign(new Error("batch file arguments are invalid"), { code: "EINVAL" });
    let quote = arg.length === 0 || arg.endsWith("\\");
    for (const ch of arg) {
      if (ch.codePointAt(0) < 0x80 ? !/[A-Za-z0-9#$*+\-./:?@\\_]/.test(ch) : /\p{Cc}/u.test(ch)) quote = true;
    }
    let out = "";
    let backslashes = 0;
    for (const ch of arg) {
      if (ch === "\\") { backslashes++; out += ch; continue; }
      if (ch === '"') out += "\\".repeat(backslashes) + '"';
      else if (ch === "%") out += "%%cd:~,";
      backslashes = 0;
      out += ch;
    }
    line += " " + (quote ? `"${out}${"\\".repeat(backslashes)}"` : out);
  }
  return line;
}
function windowsCommand(cmd, args) {
  if (process.platform !== "win32" || !/\.(cmd|bat)$/i.test(cmd)) return [cmd, args, {}];
  return [process.env.ComSpec ?? "cmd.exe", ["/e:ON", "/v:OFF", "/d", "/c", `"${batchCommandLine(cmd, args)}"`], { windowsVerbatimArguments: true }];
}
function exitStatus(code, signal) { return { success: code === 0, code: code ?? (signal ? 128 : 1), signal: signal ?? null }; }
class ChildProcess {
  constructor(child) {
    this.child = child; this.pid = child.pid;
    this.stdin = child.stdin ? Writable.toWeb(child.stdin) : null;
    this.stdout = child.stdout ? Readable.toWeb(child.stdout) : null;
    this.stderr = child.stderr ? Readable.toWeb(child.stderr) : null;
    this.status = new Promise((resolve, reject) => { child.on("error", (e) => reject(mapError(e))); child.on("close", (c, s) => resolve(exitStatus(c, s))); });
    this.status.catch(() => {});
  }
  async output() { const st = await this.status; return { ...st, stdout: new Uint8Array(), stderr: new Uint8Array() }; }
  kill(sig = "SIGTERM") { this.child.kill(sig); }
  ref() { this.child.ref(); }
  unref() { this.child.unref(); }
}
class Command {
  constructor(cmd, opts = {}) { this.cmd = cmd; this.opts = opts; }
  spawn() { const [c, a, extra] = windowsCommand(p(this.cmd), this.opts.args ?? []); return new ChildProcess(spawn(c, a, { ...spawnOptions(this.opts, "spawn"), ...extra })); }
  output() {
    return new Promise((resolve, reject) => {
      const [c, a, extra] = windowsCommand(p(this.cmd), this.opts.args ?? []);
      const child = spawn(c, a, { ...spawnOptions(this.opts, "output"), ...extra });
      const out = [], err = [];
      child.stdout?.on("data", (d) => out.push(d));
      child.stderr?.on("data", (d) => err.push(d));
      child.on("error", (e) => reject(mapError(e)));
      child.on("close", (code, signal) => resolve({ ...exitStatus(code, signal), stdout: new Uint8Array(Buffer.concat(out)), stderr: new Uint8Array(Buffer.concat(err)) }));
    });
  }
  outputSync() {
    const [c, a, extra] = windowsCommand(p(this.cmd), this.opts.args ?? []);
    const r = spawnSync(c, a, { ...spawnOptions(this.opts, "output"), ...extra, maxBuffer: 1024 * 1024 * 1024 });
    if (r.error) throw mapError(r.error);
    return { ...exitStatus(r.status, r.signal), stdout: new Uint8Array(r.stdout ?? Buffer.alloc(0)), stderr: new Uint8Array(r.stderr ?? Buffer.alloc(0)) };
  }
}
Deno.Command = Command;

// ---------------------------------------------------------------- Deno.openKv (JSON file; PR 30 replaces with deno_ral/kv.ts)
class Kv {
  constructor(file) { this.file = file; this.data = {}; this.vs = 0; try { this.data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* new store */ } }
  flush() { const tmp = `${this.file}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(this.data)); fs.renameSync(tmp, this.file); }
  async get(key) { const e = this.data[JSON.stringify(key)]; return { key, value: e === undefined ? null : revive(e.value), versionstamp: e ? e.vs : null }; }
  async set(key, value) { const vs = `${Date.now()}-${++this.vs}`; this.data[JSON.stringify(key)] = { value: freeze(value), vs }; this.flush(); return { ok: true, versionstamp: vs }; }
  async delete(key) { delete this.data[JSON.stringify(key)]; this.flush(); }
  async *list({ prefix = [] } = {}) {
    for (const [k, e] of Object.entries(this.data)) { const key = JSON.parse(k); if (prefix.every((x, i) => key[i] === x)) yield { key, value: revive(e.value), versionstamp: e.vs }; }
  }
  close() {}
  [Symbol.dispose]() {}
}
function freeze(v) {
  if (v instanceof Uint8Array) return { $bytes: Buffer.from(v).toString("base64") };
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, freeze(x)]));
  return v;
}
function revive(v) {
  if (v && typeof v === "object" && typeof v.$bytes === "string") return new Uint8Array(Buffer.from(v.$bytes, "base64"));
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]));
  return v;
}
// Different file name from Deno's SQLite store, so a Deno build never opens it (review S7).
Deno.openKv = async (file) => { fs.mkdirSync(path.dirname(file), { recursive: true }); return new Kv(`${file}.node-shim.json`); };

// ---------------------------------------------------------------- Deno.serve + Deno.upgradeWebSocket (PR 29 replaces with deno_ral/http.ts)
const upgradable = new WeakMap();
const upgraded = new WeakSet();
let wss;
function toRequest(req, hostname, port) {
  const u = `http://${req.headers.host ?? `${hostname}:${port}`}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const hasBody = !(req.method === "GET" || req.method === "HEAD");
  return new Request(u, { method: req.method, headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: hasBody ? "half" : undefined });
}
async function sendResponse(res, response) {
  if (!response) { res.statusCode = 500; res.end(); return; }
  res.statusCode = response.status;
  for (const [k, v] of response.headers) if (k !== "set-cookie") res.setHeader(k, v);
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  if (response.body) for await (const chunk of response.body) res.write(chunk);
  res.end();
}
Deno.serve = (a, b) => {
  const opts = typeof a === "function" ? {} : a;
  const handler = typeof a === "function" ? a : (b ?? opts.handler);
  const port = opts.port ?? 8000;
  const hostname = opts.hostname ?? "0.0.0.0";
  const server = http.createServer();
  const info = (req) => ({ remoteAddr: { transport: "tcp", hostname: req.socket.remoteAddress, port: req.socket.remotePort } });
  server.on("request", async (req, res) => {
    try { await sendResponse(res, await handler(toRequest(req, hostname, port), info(req))); }
    catch (e) { console.error("[deno-shim serve]", e); res.statusCode = 500; res.end(); }
  });
  server.on("upgrade", async (req, socket, head) => {
    const request = toRequest(req, hostname, port);
    upgradable.set(request, { req, socket, head });
    try { const r = await handler(request, info(req)); if (!(r && upgraded.has(r))) socket.destroy(); }
    catch (e) { console.error("[deno-shim upgrade]", e); socket.destroy(); }
  });
  let addr;
  let resolveFinished, rejectFinished;
  const finished = new Promise((res, rej) => { resolveFinished = res; rejectFinished = rej; });
  finished.catch(() => {});
  server.on("close", () => resolveFinished());
  server.on("error", (e) => rejectFinished(mapError(e)));
  server.listen(port, hostname, () => {
    addr = server.address();
    (opts.onListen ?? (({ hostname, port }) => console.error(`Listening on http://${hostname}:${port}/`)))({ hostname: addr.address, port: addr.port, transport: "tcp" });
  });
  const shutdown = () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); });
  opts.signal?.addEventListener("abort", shutdown);
  return { finished, get addr() { return { hostname: addr?.address ?? hostname, port: addr?.port ?? port, transport: "tcp" }; }, shutdown, ref: () => server.ref(), unref: () => server.unref() };
};
Deno.upgradeWebSocket = (request) => {
  const u = upgradable.get(request);
  if (!u) throw new TypeError("Request is not upgradable");
  wss ??= new WebSocketServer({ noServer: true });
  let socket;
  wss.handleUpgrade(u.req, u.socket, u.head, (ws) => { socket = ws; });
  // Node's Response rejects status 101; ws already wrote the handshake.
  const response = new Response(null, { status: 200 });
  upgraded.add(response);
  return { socket, response };
};

// ---------------------------------------------------------------- Deno.connect (buffered), Deno.listen (fake; PR 15 made probing async)
class Conn {
  constructor(socket) {
    this.socket = socket; this.chunks = []; this.waiters = []; this.ended = false;
    socket.on("data", (d) => { this.chunks.push(d); this.#wake(); });
    socket.on("end", () => { this.ended = true; this.#wake(); });
    socket.on("close", () => { this.ended = true; this.#wake(); });
    socket.on("error", (e) => { this.error = mapError(e); this.ended = true; this.#wake(); });
    this.localAddr = { transport: "tcp", hostname: socket.localAddress, port: socket.localPort };
    this.remoteAddr = { transport: "tcp", hostname: socket.remoteAddress, port: socket.remotePort };
  }
  #wake() { for (const r of this.waiters.splice(0)) r(); }
  async read(buf) {
    while (this.chunks.length === 0) { if (this.error) throw this.error; if (this.ended) return null; await new Promise((r) => this.waiters.push(r)); }
    const head = this.chunks[0]; const n = Math.min(head.length, buf.length);
    buf.set(head.subarray(0, n));
    if (n < head.length) this.chunks[0] = head.subarray(n); else this.chunks.shift();
    return n;
  }
  write(data) { return new Promise((resolve, reject) => this.socket.write(data, (e) => (e ? reject(mapError(e)) : resolve(data.length)))); }
  close() { this.socket.destroy(); }
  closeWrite() { return new Promise((r) => this.socket.end(r)); }
  setNoDelay(v = true) { this.socket.setNoDelay(v); }
  setKeepAlive(v = true) { this.socket.setKeepAlive(v); }
  ref() { this.socket.ref(); }
  unref() { this.socket.unref(); }
}
Deno.connect = (opts) => new Promise((resolve, reject) => {
  const socket = opts.transport === "unix" ? net.createConnection({ path: opts.path }) : net.createConnection({ host: opts.hostname ?? "127.0.0.1", port: opts.port });
  socket.once("connect", () => resolve(new Conn(socket)));
  socket.once("error", (e) => reject(mapError(e)));
});
Deno.listen = (opts) => ({
  // Node cannot bind synchronously. Report every port as free; Deno.serve fails loudly with AddrInUse.
  addr: { hostname: opts.hostname ?? "0.0.0.0", port: opts.port, transport: "tcp" }, close() {}, [Symbol.asyncIterator]: async function* () {},
});

// ---------------------------------------------------------------- Deno.watchFs (PR 29 replaces with deno_ral/watch.ts)
Deno.watchFs = (paths, opts = { recursive: true }) => {
  const list = Array.isArray(paths) ? paths : [paths];
  const queue = []; const waiters = []; let closed = false;
  const push = (ev) => { queue.push(ev); for (const w of waiters.splice(0)) w(); };
  const watchers = list.map((dir) => fs.watch(dir, { recursive: opts.recursive !== false }, (type, name) => {
    const full = name ? path.join(dir, name) : dir;
    let kind = "modify";
    if (type === "rename") kind = fs.existsSync(full) ? "create" : "remove";
    push({ kind, paths: [full], flag: null });
  }));
  return {
    close() { closed = true; for (const w of watchers) w.close(); for (const w of waiters.splice(0)) w(); },
    async *[Symbol.asyncIterator]() {
      while (!closed) { if (queue.length) { yield queue.shift(); continue; } await new Promise((r) => waiters.push(r)); }
    },
  };
};

if (!onDeno) globalThis.Deno = Deno;
export default Deno;
```

- [ ] **Step 2: Build with the shim check and run the bundle**

Run:
```bash
node tools/node-bundle/build.mjs --check-shim
QUARTO_BIN_PATH=$PWD/package/dist/bin QUARTO_SHARE_PATH=$PWD/src/resources node tools/node-bundle/dist/quarto.mjs --version
```
Expected: `shim: N members referenced, 0 missing, U unused` (the unused list names members no bundle or resource file references yet; keep them only if `src/resources/**/*.js` or the bundle will need them, otherwise delete them now) and `99.9.9`. If members are missing, the error lists them with the files that reference them; add each as a `Deno.<name> = ...` line following the pattern above (the inventory in assessment section 3.1 is the reference), never by adding a dependency. Missing members referenced only from `src/resources/extension-subtrees/julia-engine/` are added too: the Julia engine runs on the shim until the subtree is pulled (decision 7).

- [ ] **Step 3: The process exits with a piped stdin, and a missing directory maps to NotFound**

Run:
```bash
sleep 10 | QUARTO_BIN_PATH=$PWD/package/dist/bin QUARTO_SHARE_PATH=$PWD/src/resources timeout 5 node tools/node-bundle/dist/quarto.mjs --version; echo "exit=$?"
node --input-type=module -e '
const { default: D } = await import("./tools/node-bundle/deno-shim.mjs");
try { D.readDirSync("/definitely/missing"); } catch (e) { console.log("sync", e instanceof D.errors.NotFound); }
try { for await (const _ of D.readDir("/definitely/missing")) {} } catch (e) { console.log("async", e instanceof D.errors.NotFound); }'
```
Expected: `99.9.9` and `exit=0` (with an eager `Readable.toWeb(process.stdin)` the process waits for the pipe and `timeout` ends it with `exit=124`; verified on Node 22.22), then `sync true` and `async true`.

- [ ] **Step 4: Commit**

```bash
git add tools/node-bundle/deno-shim.mjs
git commit -m "node-bundle: temporary Deno shim (.mjs, lazy stdio, no-op on Deno)"
```

### Task 5: Launcher, HTML normaliser and a local render diff

**Files:**
- Create: `tools/node-bundle/quarto-node`
- Create: `tools/node-bundle/normalize-html.mjs`
- Create: `tools/node-bundle/normalize-html.test.mjs`

- [ ] **Step 1: Write the launcher**

```bash
#!/usr/bin/env bash
# tools/node-bundle/quarto-node
# Copyright (C) 2026 Posit Software, PBC
#
# Runs the Node bundle (tools/node-bundle/dist/quarto.mjs) against the dev
# share directory and the binaries downloaded by ./configure.sh.
set -euo pipefail
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
HERE="$(cd -P "$(dirname "$SOURCE")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
BUNDLE="$HERE/dist/quarto.mjs"
if [ ! -f "$BUNDLE" ]; then
  echo "quarto-node: $BUNDLE not found; run: node tools/node-bundle/build.mjs" >&2
  exit 1
fi
export QUARTO_BIN_PATH="${QUARTO_BIN_PATH:-$ROOT/package/dist/bin}"
export QUARTO_SHARE_PATH="${QUARTO_SHARE_PATH:-$ROOT/src/resources}"
export QUARTO_DEBUG="${QUARTO_DEBUG:-false}"
NODE="${QUARTO_NODE:-node}"
exec "$NODE" --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 "$BUNDLE" "$@"
```

Run: `chmod +x tools/node-bundle/quarto-node && tools/node-bundle/quarto-node --version`
Expected: `99.9.9`.

- [ ] **Step 2: Write the failing normaliser test**

```js
// tools/node-bundle/normalize-html.test.mjs
// Copyright (C) 2026 Posit Software, PBC
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeText } from "./normalize-html.mjs";

test("normalizeText replaces the root in every spelling, hashes, cell ids and timestamps only", () => {
  const root = path.join(os.tmpdir(), "render", "node");
  const input = [
    `<script src="${root}/site_libs/quarto.js"></script>`,
    `"path": ${JSON.stringify(root + path.sep + "a.qmd")}`,
    `<a href="${pathToFileURL(root).href}/b.html">`,
    `bootstrap-0123456789abcdef0123456789abcdef.min.css`,
    `<div id="1a2b3c4d" class="cell">`,
    `generated 2026-10-15T10:20:30.123Z`,
    `unchanged text 12345678`,
  ].join("\n");
  const out = normalizeText(input, root);
  assert.equal(out, [
    `<script src="@ROOT@/site_libs/quarto.js"></script>`,
    `"path": "@ROOT@${path.sep === "\\" ? "\\\\" : "/"}a.qmd"`,
    `<a href="@ROOT@/b.html">`,
    `bootstrap-HASH.min.css`,
    `<div id="CELLID" class="cell">`,
    `generated TIMESTAMP`,
    `unchanged text 12345678`,
  ].join("\n"));
});
```

Run: `node --test tools/node-bundle/normalize-html.test.mjs`
Expected: `ERR_MODULE_NOT_FOUND` for `./normalize-html.mjs`.

- [ ] **Step 3: Write the normaliser**

```js
// tools/node-bundle/normalize-html.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Rewrites rendered output in place so a Deno render and a Node render of the
// same document diff clean: the render root (absolute paths), Sass/library
// hashes, Jupyter cell ids and timestamps. Nothing else changes.
// Usage: node tools/node-bundle/normalize-html.mjs [--root <abs-dir>] <dir>...
// Diff afterwards with `diff -r -x .quarto` (the project cache index format
// differs per runtime by design, PR 30).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const exts = new Set([".html", ".css", ".js", ".json", ".xml", ".md", ".tex"]);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeText(text, root) {
  let out = text;
  if (root) {
    const fileUrl = pathToFileURL(root).href;
    const forward = root.split(path.sep).join("/");
    const jsonEscaped = JSON.stringify(root).slice(1, -1);
    for (const spelling of [fileUrl, root, forward, jsonEscaped]) {
      out = out.replace(new RegExp(escapeRe(spelling), "g"), "@ROOT@");
    }
  }
  return out
    .replace(/\b[0-9a-f]{40}\b|\b[0-9a-f]{32}\b/g, "HASH")
    .replace(/ id="[0-9a-f]{8}"/g, ' id="CELLID"')
    .replace(/cell-[0-9a-f]{8}\b/g, "cell-CELLID")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g, "TIMESTAMP");
}

function* files(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) yield* files(full);
    else yield full;
  }
}

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--root");
  const root = i === -1 ? undefined : path.resolve(argv.splice(i, 2)[1]);
  let count = 0;
  for (const dir of argv) {
    for (const file of [...files(dir)]) {
      let target = file;
      if (exts.has(path.extname(file))) {
        const before = fs.readFileSync(file, "utf8");
        const after = normalizeText(before, root);
        if (after !== before) fs.writeFileSync(file, after);
        count++;
      }
      const renamed = path.join(path.dirname(target), path.basename(target).replace(/[0-9a-f]{32}/g, "HASH"));
      if (renamed !== target) fs.renameSync(target, renamed);
    }
  }
  console.log(`normalized ${count} files`);
}
```

The `file://` URL spelling of the root is replaced before the plain path, so a URL becomes `@ROOT@/…` and not `file://@ROOT@/…`.

- [ ] **Step 4: Run the test**

Run: `node --test tools/node-bundle/normalize-html.test.mjs`
Expected: `# pass 1`, `# fail 0`.

- [ ] **Step 5: Diff a Deno render against a Node render locally**

Run:
```bash
rm -rf /tmp/rt26 && mkdir -p /tmp/rt26 && cp -r dev-docs/runtime-migration/spike/tests /tmp/rt26/deno && cp -r dev-docs/runtime-migration/spike/tests /tmp/rt26/node
package/dist/bin/quarto render /tmp/rt26/deno/simple.qmd
tools/node-bundle/quarto-node render /tmp/rt26/node/simple.qmd
node tools/node-bundle/normalize-html.mjs --root /tmp/rt26/deno /tmp/rt26/deno
node tools/node-bundle/normalize-html.mjs --root /tmp/rt26/node /tmp/rt26/node
diff -r -x .quarto /tmp/rt26/deno /tmp/rt26/node && echo "IDENTICAL"
```
Expected: both renders print `Output created: simple.html`; the diff prints `IDENTICAL` (PR 01 made the bslib Sass order deterministic; the bootstrap hash and the absolute root are normalised; `.quarto/` is excluded).

- [ ] **Step 6: Commit**

```bash
git add tools/node-bundle/quarto-node tools/node-bundle/normalize-html.mjs tools/node-bundle/normalize-html.test.mjs
git commit -m "node-bundle: quarto-node launcher and render-output normaliser"
```

### Task 6: `deno_ral` unit tests on real Node, with a shrinking known-failures list

**Files:**
- Create: `tools/node-bundle/junit.mjs`, `tools/node-bundle/junit.test.mjs`
- Create: `tools/node-bundle/node-test-adapter.mjs`, `tools/node-bundle/build-test.mjs`
- Create: `tools/node-bundle/run-unit-on-node.mjs`, `tools/node-bundle/known-failures.json`

- [ ] **Step 1: Write the failing JUnit parser test**

```js
// tools/node-bundle/junit.test.mjs
// Copyright (C) 2026 Posit Software, PBC
import { test } from "node:test";
import assert from "node:assert/strict";
import { caseId, normalizeTestFile, parseJUnit } from "./junit.mjs";

// Deno shape: one <testsuite> per file, escaped attributes, classname = file.
const deno = `<?xml version="1.0"?><testsuites><testsuite name="./unit/a.test.ts" tests="5">
<testcase name="[unit] &gt; a passes" classname="./unit/a.test.ts" time="0.1"/>
<testcase name="[unit] &gt; a fails" classname="./unit/a.test.ts"><failure message="boom"/></testcase>
<testcase name="[unit] &gt; a errors" classname="./unit/a.test.ts"><error message="boom"/></testcase>
<testcase name="[unit] &gt; a skipped" classname="./unit/a.test.ts"><skipped message="skip"/></testcase>
<testcase name="[unit] &gt; with output" classname="./unit/a.test.ts"><system-out>log</system-out></testcase>
</testsuite></testsuites>`;

// node:test shape (Node 26): no file suite, ">" unescaped in attributes, an
// absolute file="" on each testcase, a test with steps written as a
// <testsuite> with counters and no file (its steps carry it).
const node = `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
	<testsuite name="[unit] > passes" time="0.003" disabled="0" errors="0" tests="1" failures="0" skipped="0" hostname="vm">
		<testcase name="inner" time="0.001" classname="[unit] > passes" file="/w/quarto-cli/tests/unit/a.test.ts"/>
	</testsuite>
	<testcase name="[unit] > fails" time="0.000479" classname="test" file="/w/quarto-cli/tests/unit/a.test.ts" failure="boom">
		<failure type="testCodeFailure" message="boom">at TestContext.&lt;anonymous> (x.mjs:1:1)</failure>
	</testcase>
	<testcase name="[unit] > ignored" time="0.0004" classname="test" file="C:\\w\\quarto-cli\\tests\\unit\\b.test.ts"><skipped type="skipped" message="true"/></testcase>
</testsuites>`;

// Node 22's reporter writes no file at all.
const node22 = `<testsuites><testcase name="[unit] > plain" time="0.001" classname="test"/></testsuites>`;

test("parseJUnit reads Deno reports, with the file from classname", () => {
  const r = parseJUnit(deno);
  assert.deepEqual([...r.passed].sort(), ["[unit] > a passes", "[unit] > with output"]);
  assert.deepEqual([...r.failed].sort(), ["[unit] > a errors", "[unit] > a fails"]);
  assert.deepEqual([...r.skipped], ["[unit] > a skipped"]);
  assert.deepEqual(r.cases.map((c) => c.file), Array(5).fill("unit/a.test.ts"));
  assert.equal(caseId(r.cases[0]), "unit/a.test.ts :: [unit] > a passes");
});

test("parseJUnit reads node:test reports with steps and unescaped attributes, the file from the file attribute", () => {
  const r = parseJUnit(node);
  assert.deepEqual([...r.passed].sort(), ["[unit] > passes", "[unit] > passes > inner"]);
  assert.deepEqual([...r.failed], ["[unit] > fails"]);
  assert.deepEqual([...r.skipped], ["[unit] > ignored"]);
  assert.deepEqual(r.cases.map((c) => c.file), ["unit/a.test.ts", "unit/a.test.ts", "unit/a.test.ts", "unit/b.test.ts"]);
  assert.deepEqual(parseJUnit(node22).cases.map((c) => c.file), [""]);
});

test("normalizeTestFile: one spelling per file", () => {
  for (const p of ["./smoke/a.test.ts", ".\\smoke\\a.test.ts", "smoke/a.test.ts", "C:/w/quarto-cli/tests/smoke/a.test.ts", "/w/tests/smoke/a.test.ts"]) {
    assert.equal(normalizeTestFile(p), "smoke/a.test.ts", p);
  }
});
```

Run: `node --test tools/node-bundle/junit.test.mjs`
Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 2: Write the parser**

```js
// tools/node-bundle/junit.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Minimal JUnit reader for the reports of `deno test --junit-path`,
// `node --test --test-reporter=junit` and Vitest's junit reporter.
// node:test writes a test that has subtests as a <testsuite> (with counters)
// instead of a <testcase>, and does not escape ">" inside attributes; both
// are handled. A testcase nested in such a test is named "<parent> > <child>".
// Suites named after a file (*.ts, *.mjs, *.js) or unnamed do not prefix names.
//
// Identity. A test is identified by its file and its name: two files may
// register the same name (R14 of REVIEW-2026-10-16.md). The file comes from
// the testcase's `file` attribute (node:test on Node 26: an absolute path on
// every <testcase>, none on the <testsuite> of a test with steps, which takes
// its first child's), else a file-looking `classname` (Deno), else the
// enclosing file suite (Deno, Vitest; PR 32 adds one for a reporter that
// writes none, such as Node 22's). `cases` carries both; the name sets are
// kept for callers that already know the file (run-unit-on-node.mjs).
// Usage: node tools/node-bundle/junit.mjs summary <file.xml>...
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const unescape = (s) => s.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
function attr(attrs, name) {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? unescape(m[1]) : undefined;
}
export const isTestFile = (name) => /\.(m?[jt]s)$/.test(name);
const isFileSuite = (name) => name === "" || isTestFile(name);

/** "./smoke\\a.test.ts", "C:/x/tests/smoke/a.test.ts" and "smoke/a.test.ts" are the same file. */
export function normalizeTestFile(p) {
  let f = p.replace(/\\/g, "/").replace(/^(\.\/)+/, "");
  const i = f.lastIndexOf("/tests/");
  if (i !== -1) f = f.slice(i + "/tests/".length);
  return f;
}
/** The identity the parity report compares: "<file> :: <name>". */
export const caseId = ({ file, name }) => `${file} :: ${name}`;

export function parseJUnit(xml) {
  const passed = new Set(), failed = new Set(), skipped = new Set();
  const cases = [];
  const stack = []; // enclosing suites: { name: "" for file suites, file, test: the suite's own case if it is a test with steps }
  const prefixed = (name) => [...stack.map((s) => s.name).filter(Boolean), name].join(" > ");
  const record = (outcome, name, attrs) => {
    const own = attr(attrs, "file") ?? attr(attrs, "classname");
    const file = own && isTestFile(own) ? normalizeTestFile(own) : (stack.findLast((s) => s.file)?.file ?? "");
    ({ passed, failed, skipped })[outcome].add(name);
    const c = { file, name, outcome };
    cases.push(c);
    if (file) for (const s of stack) if (s.test && !s.test.file) s.test.file = file; // a test with steps: its file is its steps' file
    return c;
  };
  const tag = /<(\/?)(testsuite|testcase)\b((?:[^>"]|"[^"]*")*?)(\/?)>/g;
  let m;
  while ((m = tag.exec(xml))) {
    const [, closing, kind, attrs, selfClosing] = m;
    if (kind === "testsuite") {
      if (closing) { stack.pop(); continue; }
      const name = attr(attrs, "name") ?? "";
      let test;
      if (!isFileSuite(name)) {
        const bad = Number(attr(attrs, "failures") ?? 0) + Number(attr(attrs, "errors") ?? 0);
        test = record(bad > 0 ? "failed" : "passed", prefixed(name), attrs);
      }
      if (!selfClosing) stack.push(isFileSuite(name) ? { name: "", file: name ? normalizeTestFile(name) : "" } : { name, file: "", test });
      continue;
    }
    if (closing) continue;
    const name = prefixed(attr(attrs, "name") ?? "");
    let body = "";
    if (!selfClosing) {
      const end = xml.indexOf("</testcase>", tag.lastIndex);
      body = xml.slice(tag.lastIndex, end === -1 ? undefined : end);
      if (end !== -1) tag.lastIndex = end + "</testcase>".length;
    }
    if (/<(failure|error)\b/.test(body)) record("failed", name, attrs);
    else if (/<skipped\b/.test(body)) record("skipped", name, attrs);
    else record("passed", name, attrs);
  }
  return { passed, failed, skipped, cases };
}

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain && process.argv[2] === "summary") {
  for (const f of process.argv.slice(3)) {
    const r = parseJUnit(fs.readFileSync(f, "utf8"));
    const n = (o) => r.cases.filter((c) => c.outcome === o).length;
    const noFile = r.cases.filter((c) => !c.file).length;
    console.log(`${f}: passed ${n("passed")}, failed ${n("failed")}, skipped ${n("skipped")}${noFile ? ` (${noFile} without a file)` : ""}`);
  }
}
```

Run: `node --test tools/node-bundle/junit.test.mjs`
Expected: `# pass 3`, `# fail 0`.

- [ ] **Step 3: Write the `node:test` adapter**

```js
// tools/node-bundle/node-test-adapter.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Implements Deno.test on node:test for test files bundled by build-test.mjs.
// tests/harness.ts (PR 23) registers every test through Deno.test({...}).
// Active only when the Deno global is the Node shim. Caveats: sanitizers are
// ignored; inside a bundle import.meta.url is the bundle's URL, so tests that
// locate fixtures through it fail here (list them in known-failures.json;
// PR 31 runs tests unbundled).
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const D = globalThis.Deno;

function context(t, origin) {
  return {
    name: t.name,
    origin,
    async step(nameOrDef, fn) {
      const def = typeof nameOrDef === "string" ? { name: nameOrDef, fn } : nameOrDef;
      if (def.ignore) {
        await t.test(def.name, { skip: true }, () => {});
        return false;
      }
      let ok = true;
      await t.test(def.name, async (inner) => {
        try {
          await def.fn(context(inner, origin));
        } catch (e) {
          ok = false;
          throw e;
        }
      });
      return ok;
    },
  };
}

if (D && D[Symbol.for("quarto.deno-shim")]) {
  D.test = (a, b) => {
    const def = typeof a === "string" ? { name: a, fn: b } : a;
    const origin = globalThis.__QUARTO_TEST_ORIGIN__ ?? pathToFileURL(process.argv[1]).href;
    test(def.name, { skip: def.ignore === true, only: def.only === true }, (t) => def.fn(context(t, origin)));
  };
}
```

- [ ] **Step 4: Write the test bundler**

```js
// tools/node-bundle/build-test.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Bundles test files (or helper scripts with --script) for Node.
// Usage: node tools/node-bundle/build-test.mjs [--script] [--out-dir tools/node-bundle/dist/tests] <file.ts>...
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { bundle, here, importLine, root } from "./build.mjs";

export async function bundleTest(file, { script = false, outDir = path.join(here, "dist", "tests") } = {}) {
  const abs = path.resolve(file);
  const outfile = path.join(outDir, path.relative(root, abs).replace(/\.ts$/, ".mjs"));
  const banner = [
    // Every inlined module sees this object as import.meta: main is false so
    // src/quarto.ts's isMainModule guard never starts the CLI inside a test.
    `const __quartoImportMeta = { url: import.meta.url, main: false, filename: import.meta.filename, dirname: import.meta.dirname, resolve: (s) => import.meta.resolve(s) };`,
  ];
  if (!script) {
    banner.unshift(importLine(outfile, path.join(here, "node-test-adapter.mjs")));
    banner.push(`globalThis.__QUARTO_TEST_ORIGIN__ = ${JSON.stringify(pathToFileURL(abs).href)};`);
  }
  await bundle({ entry: abs, outfile, banner, define: { "import.meta": "__quartoImportMeta" } });
  return outfile;
}

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  const argv = process.argv.slice(2);
  const script = argv.includes("--script");
  const i = argv.indexOf("--out-dir");
  const outDir = i === -1 ? undefined : path.resolve(argv[i + 1]);
  const files = argv.filter((a, j) => a !== "--script" && a !== "--out-dir" && (i === -1 || j !== i + 1));
  for (const f of files) console.log(`${f} -> ${path.relative(process.cwd(), await bundleTest(f, { script, outDir }))}`);
}
```

The banner's `import` of the adapter is hoisted with the shim import that `bundle()` puts first, so the order of evaluation is: shim, adapter, then the banner statements, then the test file; the adapter reads `__QUARTO_TEST_ORIGIN__` only when a test registers.

- [ ] **Step 5: Write the runner and the ratchet**

```js
// tools/node-bundle/run-unit-on-node.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Runs test files on real Node (bundled one by one) and compares the
// failures with tools/node-bundle/known-failures.json, which may only shrink.
// Usage: node tools/node-bundle/run-unit-on-node.mjs --known-failures <json>
//          [--base <git-ref>] [--allow-growth] [--write] <file-or-dir>...
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { bundleTest } from "./build-test.mjs";
import { parseJUnit } from "./junit.mjs";
import { root } from "./build.mjs";

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv.splice(i, 2)[1]; };
const flag = (name) => { const i = argv.indexOf(name); if (i === -1) return false; argv.splice(i, 1); return true; };
const knownPath = path.resolve(opt("--known-failures") ?? path.join(root, "tools/node-bundle/known-failures.json"));
const base = opt("--base");
const allowGrowth = flag("--allow-growth");
const write = flag("--write");
const osKey = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux";

function* testFiles(p) {
  const abs = path.resolve(p);
  if (fs.statSync(abs).isDirectory()) {
    for (const d of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      yield* testFiles(path.join(abs, d.name));
    }
  } else if (abs.endsWith(".test.ts")) {
    yield abs;
  }
}
const rel = (f) => path.relative(root, f).split(path.sep).join("/");

const env = {
  ...process.env,
  QUARTO_BIN_PATH: process.env.QUARTO_BIN_PATH ?? path.join(root, "package", "dist", "bin"),
  QUARTO_SHARE_PATH: process.env.QUARTO_SHARE_PATH ?? path.join(root, "src", "resources"),
  QUARTO_DEBUG: "true",
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "node-unit-"));
const observed = {}; // file -> "*" | string[]
const ran = {}; // file -> Set of test names that ran
for (const file of argv.flatMap((a) => [...testFiles(a)])) {
  const key = rel(file);
  let bundlePath;
  try {
    bundlePath = await bundleTest(file);
  } catch (e) {
    console.log(`BUILD FAILED ${key}: ${e.message.split("\n")[0]}`);
    observed[key] = "*";
    continue;
  }
  const junit = path.join(tmp, key.replace(/[\\/]/g, "__") + ".xml");
  const r = spawnSync(process.execPath, [
    "--enable-experimental-regexp-engine", "--test", "--test-force-exit", "--test-timeout=300000",
    "--test-reporter=dot", "--test-reporter-destination=stdout",
    "--test-reporter=junit", `--test-reporter-destination=${junit}`,
    bundlePath,
  ], { cwd: path.join(root, "tests"), env, stdio: "inherit" });
  if (!fs.existsSync(junit)) {
    console.log(`NO REPORT ${key} (exit ${r.status})`);
    observed[key] = "*";
    continue;
  }
  const res = parseJUnit(fs.readFileSync(junit, "utf8"));
  ran[key] = new Set([...res.passed, ...res.failed, ...res.skipped]);
  console.log(`${key}: passed ${res.passed.size}, failed ${res.failed.size}, skipped ${res.skipped.size}`);
  if (res.failed.size) observed[key] = [...res.failed].sort();
}

const known = JSON.parse(fs.readFileSync(knownPath, "utf8"));
known[osKey] ??= {};
if (write) {
  known[osKey] = Object.fromEntries(Object.entries(observed).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(knownPath, JSON.stringify(known, null, 2) + "\n");
  console.log(`wrote ${Object.keys(observed).length} entries for ${osKey} to ${rel(knownPath)}`);
  process.exit(0);
}

const problems = [];
const listed = known[osKey];
for (const [file, failures] of Object.entries(observed)) {
  const entry = listed[file];
  if (failures === "*") {
    if (entry !== "*") problems.push(`new Node failure: ${file} (whole file)`);
    continue;
  }
  for (const name of failures) {
    if (entry !== "*" && !(entry ?? []).includes(name)) problems.push(`new Node failure: ${file} > ${name}`);
  }
}
for (const [file, entry] of Object.entries(listed)) {
  if (!(file in observed) && !(file in ran)) { problems.push(`stale known-failures entry: ${file} (not run)`); continue; }
  if (entry === "*") {
    if (observed[file] !== "*") problems.push(`now builds and runs on Node, replace "*" with its failing tests: ${file}`);
    continue;
  }
  for (const name of entry) {
    if (!ran[file]?.has(name)) problems.push(`stale known-failures entry: ${file} > ${name}`);
    else if (!(observed[file] ?? []).includes(name)) problems.push(`now passes on Node, remove it from known-failures.json: ${file} > ${name}`);
  }
}
if (base) {
  let before = {};
  try {
    before = JSON.parse(execFileSync("git", ["show", `${base}:${rel(knownPath)}`], { cwd: root, encoding: "utf8" }))[osKey] ?? {};
  } catch { /* file absent on the base branch: everything is new, allowed once (this PR) */ before = null; }
  if (before) {
    for (const [file, entry] of Object.entries(listed)) {
      const old = before[file];
      const grew = entry === "*" ? old !== "*" : entry.some((n) => old !== "*" && !(old ?? []).includes(n));
      if (grew && !allowGrowth) problems.push(`known-failures.json grew for ${osKey}: ${file} (add the node-known-failures-grow label to accept)`);
    }
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
if (problems.length) {
  for (const p of problems) console.log(p);
  process.exit(1);
}
console.log(`node unit tests: no change against ${rel(knownPath)} (${osKey})`);
```

- [ ] **Step 6: The helper for tests that spawn a layer script**

`tests/unit/ral/layer-script.ts`:

```ts
/*
 * layer-script.ts
 *
 * Helper for tests under tests/unit/ral/ that must run a separate process
 * importing src/deno_ral/ (process exit draining, cross-process KV writes).
 * Not a test file. Tests run with cwd = tests/.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join, relative, resolve } from "../../../src/deno_ral/path.ts";
import { cwd, exec, execPath } from "../../../src/deno_ral/process.ts";
import { runtime } from "../../../src/deno_ral/platform.ts";

export async function layerScriptCommand(
  fixture: string,
  args: string[] = [],
): Promise<{ cmd: string; args: string[] }> {
  const repo = resolve(cwd(), "..");
  const file = resolve(cwd(), fixture);
  if (runtime().name === "deno") {
    return {
      cmd: execPath(),
      args: ["run", "--allow-all", "--no-config", `--import-map=${join(repo, "src", "import_map.json")}`, file, ...args],
    };
  }
  const built = await exec(execPath(), {
    args: [join(repo, "tools", "node-bundle", "build-test.mjs"), "--script", file],
    cwd: repo,
  });
  if (!built.success) {
    throw new Error(`bundling ${fixture} failed:\n${new TextDecoder().decode(built.stderr)}`);
  }
  const bundle = join(repo, "tools", "node-bundle", "dist", "tests", relative(repo, file).replace(/\.ts$/, ".mjs"));
  return { cmd: execPath(), args: [bundle, ...args] };
}
```

`runtime()` reports `node` inside a test bundle only once PR 27b teaches it the shim marker; until then this helper takes the Deno branch on Node and the spawned `node run …` fails, which lists the (few) tests that use it in `known-failures.json` until PR 27b. No test uses the helper in this PR.

- [ ] **Step 7: Create the known-failures list from a first run**

Run:
```bash
echo '{ "$comment": "Node failures of the deno_ral unit tests, per OS. May only shrink (PR 26, run-unit-on-node.mjs). Values: a list of test names, or \"*\" for the whole file.", "linux": {}, "macos": {}, "windows": {} }' > tools/node-bundle/known-failures.json
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json --write tests/unit/ral/
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/
```
Expected: one tally line per `tests/unit/ral/*.test.ts` file, `wrote N entries for linux`, then the second run ends with `node unit tests: no change against tools/node-bundle/known-failures.json (linux)` and exit 0. Inspect every entry: a failure that is a shim gap (a missing or wrong member) is fixed in the shim now instead of being listed; a failure that is a genuine Node difference the Phase 2 PRs fix (for example an `instanceof Deno.errors.X` assertion, a `.cmd` case) stays listed. The Windows section is filled the same way from the first CI run's log (Task 7): copy the `--write` output of a `workflow_dispatch` run with an added `--write` step, or run the two commands on a Windows machine.

- [ ] **Step 8: Prove the ratchet both ways**

Run:
```bash
# A listed test that passes must fail the check.
node -e 'const f="tools/node-bundle/known-failures.json"; const j=require("./"+f); const file=Object.keys(j.linux)[0] ?? "tests/unit/ral/fs.test.ts"; j.linux[file]=["[unit] > definitely-not-a-real-test"]; require("fs").writeFileSync("/tmp/kf.json", JSON.stringify(j))'
node tools/node-bundle/run-unit-on-node.mjs --known-failures /tmp/kf.json tests/unit/ral/; echo "exit=$?"
```
Expected: `stale known-failures entry: ... > [unit] > definitely-not-a-real-test` and `exit=1`.

- [ ] **Step 9: Commit**

```bash
git add tools/node-bundle/junit.mjs tools/node-bundle/junit.test.mjs tools/node-bundle/node-test-adapter.mjs tools/node-bundle/build-test.mjs tools/node-bundle/run-unit-on-node.mjs tools/node-bundle/known-failures.json tests/unit/ral/layer-script.ts
git commit -m "node-bundle: run the deno_ral unit tests on Node with a shrinking known-failures list"
```

### Task 7: The CI workflow

**Files:**
- Create: `.github/workflows/test-node-bundle.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# Node signal for the runtime migration (dev-docs/runtime-migration/node-bundle.md).
# node-unit: the deno_ral unit tests bundled and run on Node 26 per PR, compared
#   with tools/node-bundle/known-failures.json (may only shrink). Not allowed to fail.
# node-render: renders smoke documents on Deno and on the Node bundle and diffs
#   them. Allowed to fail until PR 32.
name: Node Bundle
on:
  workflow_dispatch:
  pull_request:
    branches: [main]
    paths-ignore:
      - "news/**"
      - ".claude/**"
  push:
    branches: [main]
    paths-ignore:
      - "news/**"
      - ".claude/**"

concurrency:
  group: node-bundle-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  node-unit:
    name: deno_ral unit tests on Node (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0 # the ratchet reads known-failures.json on the base branch

      - name: Install Node 26
        uses: actions/setup-node@v6
        with:
          node-version: 26
          cache: npm

      - name: Configure Quarto dev (binaries the tests resolve through QUARTO_BIN_PATH)
        uses: ./.github/workflows/actions/quarto-dev

      - name: Install npm dependencies (npm + JSR via .npmrc)
        run: npm ci

      - name: Tooling unit tests
        run: node --test "tools/node-bundle/*.test.mjs"

      - name: Dependencies mirror the import map
        run: node tools/node-bundle/check-deps.mjs

      - name: Build the bundle and check the shim
        run: node tools/node-bundle/build.mjs --check-shim

      - name: deno_ral unit tests on Node against the known-failures list
        shell: bash
        run: |
          base_args=()
          if [ "${{ github.event_name }}" = "pull_request" ]; then base_args=(--base "origin/${{ github.base_ref }}"); fi
          if [ "${{ contains(github.event.pull_request.labels.*.name, 'node-known-failures-grow') }}" = "true" ]; then base_args+=(--allow-growth); fi
          node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json "${base_args[@]}" tests/unit/ral/

  node-render:
    name: Build and render on Node (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    continue-on-error: true
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest]
    env:
      SPIKE_TESTS: dev-docs/runtime-migration/spike/tests
    steps:
      - uses: actions/checkout@v6

      - name: Install Node 26
        uses: actions/setup-node@v6
        with:
          node-version: 26
          cache: npm

      # Downloads Deno, Pandoc, Dart Sass, Typst into package/dist/bin/tools (the Deno baseline needs them too).
      - name: Configure Quarto dev (Deno baseline)
        uses: ./.github/workflows/actions/quarto-dev

      - name: Install uv for Python
        uses: astral-sh/setup-uv@20cfd1bf945f4377ade1205e4dbc17946fc9a30d # v10.0.1
        with:
          version: "0.12.10"
          enable-cache: true
          cache-dependency-glob: "tests/uv.lock"

      - name: Install the tests Python environment (Jupyter)
        working-directory: tests
        run: uv sync --frozen

      - name: Install npm dependencies (npm + JSR via .npmrc)
        run: npm ci

      - name: Build the bundle
        run: node tools/node-bundle/build.mjs --check-shim

      - name: Version and check
        run: |
          tools/node-bundle/quarto-node --version
          tools/node-bundle/quarto-node check 2>&1 | tee check.log || true

      - name: Render on Deno and on Node
        shell: bash
        run: |
          source tests/.venv/bin/activate
          rm -rf "$RUNNER_TEMP/render" && mkdir -p "$RUNNER_TEMP/render"
          cp -r "$SPIKE_TESTS" "$RUNNER_TEMP/render/deno"
          cp -r "$SPIKE_TESTS" "$RUNNER_TEMP/render/node"
          for runtime in deno node; do
            if [ "$runtime" = deno ]; then q="$PWD/package/dist/bin/quarto"; else q="$PWD/tools/node-bundle/quarto-node"; fi
            for doc in simple.qmd website jupyter.qmd; do
              echo "::group::$runtime: $doc"
              "$q" render "$RUNNER_TEMP/render/$runtime/$doc"
              echo "::endgroup::"
            done
          done

      - name: Diff the renders (root, hashes and timestamps normalised; .quarto excluded)
        shell: bash
        run: |
          for runtime in deno node; do
            node tools/node-bundle/normalize-html.mjs --root "$RUNNER_TEMP/render/$runtime" "$RUNNER_TEMP/render/$runtime"
          done
          if diff -r -x .quarto "$RUNNER_TEMP/render/deno" "$RUNNER_TEMP/render/node" > node-render.diff; then
            echo "Node render identical to Deno render"
          else
            echo "::warning::Node render differs from Deno render; see the node-render-diff artifact"
            head -c 20000 node-render.diff
            exit 1
          fi

      - name: Upload the diff and the renders
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: node-render-diff
          path: |
            node-render.diff
            check.log
            ${{ runner.temp }}/render
          if-no-files-found: ignore
          retention-days: 14
```

- [ ] **Step 2: Validate the workflow locally**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test-node-bundle.yml')); print('yaml ok')"`
Expected: `yaml ok`. (If `pyyaml` is absent: `npx -y yaml-lint .github/workflows/test-node-bundle.yml`.)

- [ ] **Step 3: Create the label**

Run: `gh label create node-known-failures-grow --description "Accept new entries in tools/node-bundle/known-failures.json (runtime migration)" --color FBCA04`
Expected: the label exists (`gh label list | grep node-known-failures-grow`).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test-node-bundle.yml
git commit -m "ci: deno_ral unit tests on Node per PR; allowed-failure Node render job"
```

### Task 8: Documentation

**Files:**
- Create: `dev-docs/runtime-migration/node-bundle.md`
- Modify: `dev-docs/runtime-migration/spike/README.md`
- Modify: `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Write the usage note**

```markdown
# Running quarto-cli on Node (dev bundle)

`tools/node-bundle/` builds `src/quarto.ts` into a single ESM file for Node 26
and runs it with a temporary `Deno` shim. It exists so Phase 2 of the runtime
migration (`dev-docs/runtime-migration/README.md`) is measured on Node before
the runtime flip. Nothing here is shipped to users.

## Setup

```bash
./configure.sh                      # Pandoc, Dart Sass, Typst, Deno under package/dist/bin/tools
npm ci                              # npm + JSR packages (see .npmrc); needs Node 26
node tools/node-bundle/build.mjs --check-shim
tools/node-bundle/quarto-node render path/to/doc.qmd
```

`QUARTO_NODE=/path/to/node` selects a Node binary; `QUARTO_DEBUG=true` enables
debug logging as with the Deno dev build.

## Files

| Path | Role |
|---|---|
| `tools/node-bundle/import-map.mjs` | Maps `src/import_map.json` to npm/JSR package specifiers. Shared with `check-deps.mjs` and the Node test loader (PR 31). |
| `tools/node-bundle/build.mjs` | esbuild bundler; exports `bundle()` (the builder contract: CLI mode and fixture mode, `26-node-build-job.md` Interfaces). The import map applies to Quarto's own imports only; anything imported from inside `node_modules` resolves as Node would, relative to its importer (the resolver scope rule, same Interfaces section; `build.test.mjs` checks it). `--check-shim` runs `check-shim.mjs`; `--write-meta` writes `<outfile>.meta.json` and `.resolved.json`. Writes `dist/quarto.mjs`. |
| `tools/node-bundle/check-shim.mjs` | Deno members referenced by the bundle and by `src/resources/**/*.js` vs members the shim defines: missing fails, unused is listed. |
| `tools/node-bundle/deno-shim.mjs` | Temporary `globalThis.Deno` on `node:` APIs; a no-op on Deno. Shrinks with PR 27–30 and 27b. |
| `tools/node-bundle/build-test.mjs`, `node-test-adapter.mjs` | Bundle one test file for Node; `Deno.test` on `node:test`. |
| `tools/node-bundle/run-unit-on-node.mjs`, `known-failures.json` | The per-PR real-Node run of `tests/unit/ral/` and its shrinking failure list. |
| `tools/node-bundle/junit.mjs` | JUnit reader shared with PR 32's parity report; identifies a case by file and name (`cases`, `caseId`) from the `file` attribute, the `classname` or the file suite. |
| `tools/node-bundle/quarto-node` | Launcher with the dev share path and V8 flags. |
| `tools/node-bundle/check-deps.mjs` | Fails when `package.json` `dependencies` drift from the import map. `--write` regenerates them. |
| `tools/node-bundle/normalize-html.mjs` | Normalises the render root, hashes, cell ids and timestamps so Deno and Node renders diff clean. |
| `package.json` | `dependencies` mirror the import map (checked); `devDependencies` are Node-only (`esbuild`, `ws`). No `"type": "module"`: all tooling is `.mjs`. |
| `.github/workflows/test-node-bundle.yml` | `node-unit` (Linux, Windows; must pass) and `node-render` (allowed failure). |

## Adding or bumping a dependency

1. Edit `src/import_map.json` (only `jsr:` and `npm:` values).
2. `node tools/node-bundle/check-deps.mjs --write && npm install`.
3. Commit `package.json` and `package-lock.json` with the import map.

## When the shim check fails

`--check-shim` lists `Deno.*` members the bundle or a runtime-loaded resource
uses that the shim lacks, with the files that reference them. Application
code must not add new `Deno.*` calls (PR 02 ratchet); if the member comes from
a dependency or from `src/resources/`, add it to the shim following the
existing pattern and note it in the PR. Members become unused as PR 27–30 and
27b land: the PR that makes a member unused deletes it (the `unused` list must
be empty when that PR merges).

## When `node-unit` fails

- `new Node failure`: your change broke a layer test on Node (or the test is
  new and fails on Node). Fix it; if the failure is a known Phase 2 gap owned
  by a later PR, add the test name under the OS key in `known-failures.json`
  and label the PR `node-known-failures-grow` (a reviewer must agree).
- `now passes on Node`: remove the entry (the list may only shrink).
- `stale known-failures entry`: the test was renamed or deleted; remove it.

## Reading a render diff

The artifact `node-render-diff` holds `node-render.diff`, `check.log` and
both render trees. Differences after normalisation are real behaviour
differences and belong in the Phase 2 backlog.
```

- [ ] **Step 2: Point the spike README at the tooling**

Insert after the first paragraph of `dev-docs/runtime-migration/spike/README.md`:

```markdown
> Superseded by `tools/node-bundle/` (PR 26); see `../node-bundle.md`. This
> directory is kept as the record of the 2026-10-14 spike. The `tests/`
> documents are still the smoke set used by `.github/workflows/test-node-bundle.yml`.
```

- [ ] **Step 3: Update the PR table**

In `dev-docs/runtime-migration/README.md`, change the PR 26 row status from `planned` to `merged` (done on the PR branch; the reviewer checks it).

- [ ] **Step 4: Commit**

```bash
git add dev-docs/runtime-migration/node-bundle.md dev-docs/runtime-migration/spike/README.md dev-docs/runtime-migration/README.md
git commit -m "Document the Node bundle tooling"
```

## Verification

Before opening the PR:

- `node --test "tools/node-bundle/*.test.mjs"` → all pass (`check-deps`, `check-shim`, `junit`, `normalize-html`).
- `node tools/node-bundle/check-deps.mjs` → `package.json dependencies match src/import_map.json (N packages)`.
- `node tools/node-bundle/build.mjs --check-shim` → `shim: N members referenced, 0 missing, U unused`.
- `tools/node-bundle/quarto-node --version` → `99.9.9`; `sleep 10 | timeout 5 tools/node-bundle/quarto-node --version; echo "exit=$?"` → `exit=0`.
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` → `no change against …`, exit 0.
- The local render diff from Task 5 step 5 prints `IDENTICAL`.
- `git diff --stat main -- src/` → empty.
- Existing Deno suite unaffected: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts` passes.
- The ratchet: `quarto run --dev tools/check-runtime-boundary.ts` passes (counts unchanged).
- Push the branch: `node-unit` is green on Linux and Windows; `node-render` runs and uploads `node-render-diff`, and a failure there does not block the PR.

## Review checklist

- [ ] `tools/node-bundle/build.mjs` contains no absolute paths and no clone directories; the only resolution sources are `src/import_map.json`, `node_modules`, and `node:` externals; the import map is consulted only for importers outside `node_modules`, mapped targets resolve from the root and unmapped bare names from the importer (`build.test.mjs` passes); `bundle()` is exported with the inputs of the builder contract, and every bundle starts with the interop prelude (`require`, `__filename`, `__dirname`).
- [ ] A remaining `https://` import-map value fails the build with `unmapped remote import <spec> -> <value>` naming the importer.
- [ ] `deno-shim.mjs` has no third-party imports other than `ws`; every member is a `Deno.<name> =` assignment on its own line; it does nothing when `globalThis.Deno` exists; stdio streams are lazy; `readDirSync`/`readDir` map ENOENT; the header names PR 27–30, 27b and 33.
- [ ] `check-shim.mjs` scans the bundle and `src/resources/**/*.js`, handles `Deno?.x` and nested members, prints the unused list.
- [ ] Test bundles override `import.meta` (`main: false`), so `src/quarto.ts` never starts inside a test.
- [ ] `known-failures.json` entries were each inspected (no shim gap is listed instead of fixed); the ratchet rejects passes, stale entries and growth without the label.
- [ ] `package.json` has no `"type": "module"`; `engines.node` is `>=26`; `dependencies` equals `dependenciesFromImportMap`; `ws` and `esbuild` are `devDependencies`; `test:tooling` uses a glob.
- [ ] `package-lock.json` resolves `@jsr/*` packages from `https://npm.jsr.io` (grep `npm.jsr.io` in the lockfile).
- [ ] Every `setup-node` step uses `node-version: 26`.
- [ ] `node-unit` has no `continue-on-error`; `node-render` has it and excludes `.quarto` from the diff.
- [ ] No file under `src/` changed; the only file under `tests/` is the helper `tests/unit/ral/layer-script.ts`.

## Risks and rollback

- **npm.jsr.io availability or a JSR package without a Node-compatible build.** Shows up as `npm ci` 404 or a bundle-time resolution error naming the package. The render job is allowed to fail; `node-unit` fails and blocks: fix forward by pinning a different version in the import map (which the Deno build also uses), or revert this PR.
- **Shim drift.** New `Deno.*` uses in a dependency or a resource file break the build with a clear member list. The ratchet (PR 02) prevents new uses in application code.
- **A package that only works through Quarto's import map.** With the resolver scope rule a dependency's bare imports resolve as on Node, so a package that itself imports an import-map-only name (a `jsr:` or `https:` specifier, or a Quarto alias such as `fs/`) fails the bundle naming the importer. Such a package was already broken for `npm ci` and for PR 31's unbundled loader; fix it in the dependency PR (a different version or package), never by widening the plugin back to every importer.
- **Bundled tests differ from unbundled ones** (`import.meta.url` is the bundle's; module state is per bundle). Such tests are listed in `known-failures.json` with a comment in the PR; PR 31 runs tests unbundled and PR 32 retires this job's unit step in favour of the full Node suite.
- **A flaky Node test** would make `node-unit` red at random. Treat it like a flaky Deno test (`dev-docs/debugging-flaky-tests.md`); do not list a flaky test as a known failure (the ratchet then fails whenever it passes).
- **`package.json` at the root confuses other tooling** (editor TypeScript server picking up `node_modules`). Mitigated by `/node_modules` in `.gitignore` and no `"type"` field. If it bites, move `package.json` to `tools/node-bundle/` and point `check-deps.mjs` and the workflow at it; `import-map.mjs` takes the root as a parameter so this is a two-line change.
- **Rollback of the whole PR:** delete `tools/node-bundle/`, `package.json`, `package-lock.json`, `.npmrc`, the workflow, and the two `.gitignore` lines. No application code depends on them.

## Decisions needed

None. The shim ownership and its per-PR shrinking, the bundled real-Node unit run with its known-failures ratchet, the Node-only dependency placement, Node 26 in CI and the absence of `"type": "module"` are decided above with their justification; reverse any of them in the PR description if the reviewer disagrees.

Review items not changed here, with the reason:

- The render job stays at three documents, Linux only, allowed to fail, with `quarto-node check … || true`. Not changed because the per-PR real-Node gate is now `node-unit` (Linux and Windows, not allowed to fail); the render job is a smoke signal for the bundle until PR 32 makes it required and adds the full Node suite and nightly render parity on three OSes.
- The shim makes Cliffy's internal runtime helpers and `@std/path` take their Deno branches on Node, which can hide Node-only problems. Not changed because the shim is what lets the unmodified sources run on Node before Phase 2 ports the layer; the members those packages reach are listed by `check-shim.mjs` (so they are visible), PR 27b makes `runtime()` see through the shim, and PR 31's runner runs the sources unbundled without the shim, so the PR 32 Node matrix exercises the Node branches of Cliffy and `@std` before PR 33 removes the shim from the shipped bundle.
