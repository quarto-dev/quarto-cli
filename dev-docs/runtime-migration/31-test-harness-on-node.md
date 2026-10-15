# PR 31: the test suite runs on Node (`tests/harness.ts` on `node:test`, `run-tests-node`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `tests/` runnable on Node 22 with type stripping and the import-map loader hook, with `registerTest` dispatching to `node:test`, assertions from `@std/assert`, `tests/run-tests-node.sh`/`.ps1` entry points mirroring `run-tests.sh`/`.ps1` (binary mode, `--agent`, timing, GitHub grouping), and the self-spawning tests working on both runtimes.
**Phase:** 2. **Depends on:** PR 23 (`tests/harness.ts` adapter, `tests/` codemodded), PR 26 (root `package.json`, `tools/node-bundle/import-map.mjs`). **Unblocks:** PR 32.
**Branch:** `rt/31-test-harness-on-node`.
**Suggested executor:** Opus. Two runtimes, loader hooks, process spawning and 45 syntax sites need judgement.
**Size:** L (harness, asserts, 2 runner scripts, loader hook, syntax scan, ~50 source files with enum/parameter-property edits, 4 self-spawning tests).
**Ships on:** Deno; the whole suite stays green on `run-tests.sh`. Node: `run-tests-node.sh --agent unit/deno-ral/ unit/path.test.ts unit/text.test.ts` passes; the PR 26 job gains a step running them. Broader Node parity is PR 32.

## Spec

### Context

Assessment section 3.5: Node's type stripping requires explicit `.ts` extensions (Quarto has them) and rejects `enum`, parameter properties, decorators and runtime namespaces; "bare import-map aliases … have no native equivalent in Node". Section 7 Phase 2 item 3: "Port the test harness: assertions to `@std/assert` or `node:assert`, registration to an adapter that can target `Deno.test` now and `node:test` later." PR 23 created `tests/harness.ts` (`registerTest`) and `tests/asserts.ts` (PR 22) on Deno; this PR gives both a Node branch and the scripts to run them.

Facts verified in this sandbox (Node 22.22):

- `node --experimental-strip-types --import ./register.mjs --test t.test.ts` runs a `.ts` test that imports `path`, `testing/asserts` and `fs/walk` through a `module.register` resolve hook that applies `src/import_map.json` and resolves the npm/JSR package from the root `node_modules`. `import.meta.url` inside the file is the real `file:///…/t.test.ts` (no bundling, so `tests/utils.ts:252` `fromFileUrl(import.meta.url)` and `tests/quarto-cmd.ts` `new URL("binary-mode-strip-env.txt", import.meta.url)` keep working; a bundled test would see the bundle's URL, which is why this plan does not bundle tests).
- Strip-only mode fails with `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode` and `… TypeScript parameter property is not supported in strip-only mode`, each with the file, line and a caret. `node --check` does **not** report them; `module.stripTypeScriptTypes(source, { mode: "strip" })` throws the same messages and is the basis of the scan tool below. `--experimental-transform-types` accepts both but is experimental; this plan removes the syntax instead (12 `enum` declarations in `src/`, 40 constructor parameter properties in `src/` plus one in `tests/gha-grouping.ts`; the scan lists them).
- `node --test` passes `process.execArgv` (`--experimental-strip-types`, `--import`, V8 flags) to its child processes; `--test-reporter=dot` works; a failing test makes `--test` exit 1. Running a test file directly (`node file.test.ts -- args`) also runs `node:test` tests and exits 1 on failure, with `process.argv.slice(2)` = `["--", ...args]`.
- `node --test` runs files in parallel processes by default; `--test-concurrency=1` serialises them (Deno runs files serially in one process; Quarto's smoke tests share `tests/docs` and ports, so serial is required).
- The root `package.json` has no `type` field (PR 26 decision), so Node classifies each `.ts` file by syntax detection (default since 22.7): a file with `import`/`export` or top-level `await` is ESM. Every file under `tests/` and `src/` has imports, so none is mistaken for CommonJS.
- Node's `TestContext` has `filePath` (v22.6+), used only for diagnostics; the harness captures the test file from the stack at registration, as `tests/test.ts` already does with `testFileUrlFromStack`.

**Decision: assertions from `@std/assert` (JSR), not `node:assert/strict`.** `assertEquals` uses `@std/assert`'s own structural `equal` (treats `+0`/`-0` and `NaN` consistently, compares `Date`/`RegExp`/`Map`/`Set`/typed arrays by value, ignores prototype differences for plain objects) and throws `AssertionError` with a diff message; `node:assert.deepStrictEqual` differs on prototypes and typed-array wrappers and formats messages differently, and `assertStringIncludes`, `assertMatch`, `assertObjectMatch`, `assertRejects`, `fail` have no direct equivalents. `tests/asserts.ts` has used `testing/asserts` (`jsr:@std/testing@0.224.0/asserts`, itself a re-export of `@std/assert`) since PR 22; switching it to `jsr:@std/assert@1.x` keeps every assertion's semantics and makes the one specifier Node-resolvable through the hook. Existing tests that match assertion message text keep matching.

**Decision: tests are not bundled.** Node runs `tests/**/*.test.ts` directly with `--experimental-strip-types` and the loader hook; `src/` is imported in-process exactly as under `deno test`. The bundle (`tools/node-bundle/dist/quarto.mjs`) is only what `QUARTO_TEST_BIN` points at for binary-mode runs.

**Decision: smoke-all arguments travel in `QUARTO_TEST_ARGS`.** `node --test` cannot pass positional arguments to test files, so `tests/harness.ts` exports `testArgs()`, which returns `args()` when non-empty and otherwise the newline-separated `QUARTO_TEST_ARGS`; `smoke/smoke-all.test.ts` and `integration/playwright-tests.test.ts` use it. `run-tests-node.sh` sets the variable; `run-tests.sh` keeps passing `--` args (Deno), and `testArgs()` returns them unchanged there.

### Scope

In:
- `tests/harness.ts`: `registerTest` on `node:test` when `runtime().name === "node"`; `testArgs()`; `onProcessExit()`. `tests/utils.ts`: Node branches of `runHarness` and `runtimeScriptCommand` (both from PR 23).
- `tests/asserts.ts` on `@std/assert` 1.x via a new import-map entry; `package.json` synced.
- `tools/node-bundle/import-map-hook.mjs`, `tools/node-bundle/register-import-map.mjs`, `tools/node-bundle/check-ts-syntax.mjs`.
- `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`.
- Syntax cleanup in `src/`, `tests/`, `package/src`: `enum` → `const` object + union type; constructor parameter properties → explicit fields.
- Self-spawning tests: the two `runHarness` callers from PR 23 work unchanged once `runHarness` has its Node branch (Deno-only assertions in `harness-failure-reporting.test.ts` get a runtime guard); `tests/unit/chrome-launch-fixtures.ts` writes `.mjs` scripts and the two `chrome-launch*.test.ts` fake-Chrome bodies are rewritten on Node APIs (PR 23 left those string literals as this PR's job).
- `tests/test.ts`: `unload` listener → `onProcessExit`; `smoke/smoke-all.test.ts`, `integration/playwright-tests.test.ts`: `testArgs()`.
- A step in `.github/workflows/test-node-bundle.yml` running `run-tests-node.sh --agent unit/deno-ral/ unit/path.test.ts unit/text.test.ts`.
- `tests/README.md`: a "Running on Node" section.

Out:
- Full-suite Node parity, macOS/Windows jobs, making the job required (PR 32).
- `deno test --check` type checking on Node (`tsc` arrives with PR 38).
- Deno sanitizers (`sanitizeOps`/`sanitizeResources`/`sanitizeExit`): no Node equivalent; the `sanitize` field is honoured on Deno and ignored on Node (documented).
- `tests/run-parallel-tests.ts` (bucket computation for CI; unchanged, it only lists files).

### Interfaces

`tests/harness.ts` (PR 23's module, unchanged types; this PR adds the Node branch and two helpers). PR 23 defined `fn` with a `TestRunContext` (`origin`, `step`) and `sanitize` as `boolean | SanitizeOptions`; those stay exactly as PR 23 wrote them:

```ts
export interface TestRunContext {
  /** file:// URL of the module that registered the test. */
  origin: string;
  step(name: string, fn: (ctx: TestRunContext) => Promise<void> | void, options?: { ignore?: boolean }): Promise<boolean>;
}
export interface SanitizeOptions { resources?: boolean; ops?: boolean; exit?: boolean; }
export interface TestDefinition { name: string; fn: (ctx: TestRunContext) => Promise<void> | void; ignore?: boolean; sanitize?: boolean | SanitizeOptions; }
/** Deno: Deno.test({...}) as PR 23 wrote it. Node: node:test `test(name, { skip: ignore }, (t) => fn(nodeContext(t)))`;
 *  `origin` is `pathToFileURL(t.filePath).href` (Node 22.6+), `step` maps to `t.test` and resolves false when
 *  the step was ignored or threw; `sanitize` is ignored (no Node equivalent). */
export function registerTest(def: TestDefinition): void;
/** Positional test arguments: process args after "--", or QUARTO_TEST_ARGS (newline-separated) when running under `node --test`. */
export function testArgs(): string[];
/** Runs `handler` once when the test process exits (Deno: "unload" event; Node: process "exit"). */
export function onProcessExit(handler: () => void): void;
export { runHarness } from "./utils.ts"; // PR 23 re-export, kept
```

`tests/utils.ts` (PR 23's helpers get a Node branch; signatures unchanged):

```ts
/** Same options as PR 23 (`{ file, cwd, flags?, args?, env?, junitPath? }`; the two PR 23 callers compile unchanged).
 *  Deno: `deno test <harness flags> --importmap=… [flags] [--junit-path=<junitPath>] <file> [-- args]` (PR 23, unchanged).
 *  Node: `node --experimental-strip-types --import tools/node-bundle/register-import-map.mjs [flags] --test
 *  --test-concurrency=1 [--test-reporter=junit --test-reporter-destination=<junitPath>] <file>`; `--no-check`/`--check`
 *  are dropped from `flags`, `args` go to QUARTO_TEST_ARGS (newline-separated). */
export function runHarness(options: { file: string; cwd: string; flags?: string[]; args?: string[]; env?: Record<string, string>; junitPath?: string }): Promise<{ stdout: string; stderr: string; code: number }>;
/** Deno: `<deno> run --allow-net --allow-read --allow-env [--allow-write=<path>] <script>` (PR 23, plus the two read/env
 *  permissions the Node-API scripts below need). Node: `<node> <script>`. */
export function runtimeScriptCommand(scriptPath: string, options?: { allowWritePath?: string }): { cmd: string; args: string[] };
```

`tools/node-bundle/import-map-hook.mjs` (Node `module.register` hooks): `resolve(specifier, context, next)` leaves relative, absolute, `file:`, `node:` and `data:` specifiers and any import whose `parentURL` is inside a `node_modules` directory untouched; otherwise applies `resolveBare` from `import-map.mjs` and resolves the npm target from the repository root. `tools/node-bundle/register-import-map.mjs`: `register("./import-map-hook.mjs", import.meta.url)`.

`tools/node-bundle/check-ts-syntax.mjs [dir...]`: runs `stripTypeScriptTypes` on every `.ts` under the directories (default `src tests package/src`, skipping `node_modules`, `vendor`, `resources`), prints `path:line:col: <message>` per rejected file, exits 1 when any.

`tests/run-tests-node.sh [--agent] [--keep-outputs|-k] [targets...]`: same argument contract as `run-tests.sh` (a `.qmd`/`.md`/`.ipynb` target selects `smoke/smoke-all.test.ts`; `.ts` targets and directories run as is; no target runs everything except `integration/playwright/` and `.venv/`; binary mode defaults to `smoke/`; `QUARTO_TEST_TIMING` writes a timing file). Environment: `QUARTO_BIN_PATH`, `QUARTO_SHARE_PATH`, `QUARTO_DEBUG=true`, `QUARTO_ROOT`, Python venv activation, `QUARTO_TEST_BIN` preflight, all as in `run-tests.sh`.

### Files

- Modify: `tests/harness.ts`, `tests/utils.ts` (`runHarness`, `runtimeScriptCommand` Node branches)
- Modify: `tests/asserts.ts`, `src/import_map.json`, `package.json`, `package-lock.json`
- Create: `tools/node-bundle/import-map-hook.mjs`, `tools/node-bundle/register-import-map.mjs`, `tools/node-bundle/check-ts-syntax.mjs`
- Create: `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`
- Modify: `tests/test.ts` (exit hook), `tests/smoke/smoke-all.test.ts`, `tests/integration/playwright-tests.test.ts` (`testArgs`)
- Modify: `tests/unit/chrome-launch-fixtures.ts` (`.mjs` scripts), `tests/unit/chrome-launch.test.ts`, `tests/unit/chrome-launch-flags.test.ts` (Node-API script bodies), `tests/unit/harness-failure-reporting.test.ts` (Deno-only assertions guarded); `tests/unit/smoke-all-prerender-isolation.test.ts` already calls `runHarness` (PR 23) and needs no change
- Modify: the files `check-ts-syntax.mjs` lists (12 `enum` sites in `src/`: `src/publish/confluence/api/types.ts` ×7, `src/publish/provider-types.ts`, `src/publish/netlify/api/models/accountSetup.ts`, `src/project/types/website/listing/website-listing-shared.ts` ×2, `src/core/giscus.ts`; 40 parameter-property constructors in `src/` (36 single-line, 4 multi-line) plus `tests/gha-grouping.ts` `GroupEmitter`; the same numbers as the assessment, section 3.5, and PR 33)
- Modify: `.github/workflows/test-node-bundle.yml`, `tests/README.md`
- Test: `tests/unit/harness-node.test.ts` (new; `testArgs`, `registerTest` skip, `runHarness` round-trip)

### Acceptance criteria

- `node tools/node-bundle/check-ts-syntax.mjs` exits 0.
- `cd tests && ./run-tests-node.sh --agent unit/deno-ral/ unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts` exits 0 and prints a dot per test plus a tally.
- `cd tests && ./run-tests-node.sh docs/smoke-all/2023/02/08/4272.qmd` runs `smoke-all.test.ts` on that document on Node.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-node.test.ts unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/smoke-all-prerender-isolation.test.ts` passes on Deno (unchanged behaviour).
- `cd tests && ./run-tests-node.sh --agent unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts` passes on Node.
- `QUARTO_TEST_BIN=$PWD/tools/node-bundle/quarto-node cd tests && ./run-tests-node.sh --agent smoke/render/render.test.ts` runs in binary mode against the bundle.
- `quarto run --dev tools/check-runtime-boundary.ts` stays at zero; `run-tests.sh` full suite stays green.

## Plan

### Task 1: Loader hook and syntax scan tooling

**Files:**
- Create: `tools/node-bundle/import-map-hook.mjs`, `tools/node-bundle/register-import-map.mjs`, `tools/node-bundle/check-ts-syntax.mjs`
- Modify: `tools/node-bundle/check-deps.test.mjs` (hook test)

- [ ] **Step 1: Write the failing test (hook)**

Append to `tools/node-bundle/check-deps.test.mjs`:

```js
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

test("import-map hook resolves bare specifiers in a .ts file run directly", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-"));
  const file = path.join(dir, "t.ts");
  fs.writeFileSync(file, [
    'import { join } from "path";',
    'import { assertEquals } from "@std/assert";',
    `import { walkSync } from ${JSON.stringify(pathToFileURL(path.join(root, "src", "deno_ral", "fs.ts")).href)};`,
    'assertEquals(join("a", "b").replace("\\\\", "/"), "a/b");',
    'console.log("hook-ok", typeof walkSync, import.meta.url.startsWith("file:///"));',
  ].join("\n"));
  const r = spawnSync(process.execPath, [
    "--no-warnings", "--experimental-strip-types",
    "--import", path.join(root, "tools", "node-bundle", "register-import-map.mjs"),
    file,
  ], { encoding: "utf8", cwd: root });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /hook-ok function true/);
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tools/node-bundle/check-deps.test.mjs`
Expected: the new test fails with `Cannot find module '.../register-import-map.mjs'`.

- [ ] **Step 3: Implement the hook**

```js
// tools/node-bundle/register-import-map.mjs
// Copyright (C) 2026 Posit Software, PBC
// node --import tools/node-bundle/register-import-map.mjs <file.ts>
import { register } from "node:module";
register("./import-map-hook.mjs", import.meta.url);
```

```js
// tools/node-bundle/import-map-hook.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Node module customization hook: resolves Deno import-map specifiers
// ("path", "fs/walk", "@std/assert", "ws") to the npm packages installed in
// the repository root, so tests/ and src/ run unbundled on Node with type
// stripping. Imports originating inside node_modules are left to Node.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadImportMap, resolveBare } from "./import-map.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const rootUrl = pathToFileURL(path.join(root, "package.json")).href;
const map = loadImportMap(root);

function passThrough(specifier, context) {
  if (/^(\.\.?\/|\/|[a-zA-Z]:[\\/]|file:|node:|data:)/.test(specifier)) return true;
  return typeof context.parentURL === "string" && context.parentURL.includes("/node_modules/");
}

export async function resolve(specifier, context, next) {
  if (passThrough(specifier, context)) return next(specifier, context);
  const r = resolveBare(specifier, map); // throws a clear error for https: values
  if (r.external) return next(specifier, context);
  return next(r.target, { ...context, parentURL: rootUrl });
}
```

- [ ] **Step 4: Implement the syntax scan**

```js
// tools/node-bundle/check-ts-syntax.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Lists TypeScript syntax that Node's strip-only type stripping rejects
// (enum, parameter properties, namespaces with values, decorators), using
// node:module stripTypeScriptTypes. Usage: node --no-warnings tools/node-bundle/check-ts-syntax.mjs [dir...]
import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ["src", "tests", "package/src"];
const skip = new Set(["node_modules", "vendor", "resources", ".venv", "docs"]);

function* tsFiles(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(d.name)) continue;
    const full = path.join(dir, d.name);
    if (d.isDirectory()) yield* tsFiles(full);
    else if (d.name.endsWith(".ts") && !d.name.endsWith(".d.ts")) yield full;
  }
}

let failures = 0;
for (const dir of dirs) {
  for (const file of tsFiles(path.resolve(root, dir))) {
    try {
      stripTypeScriptTypes(fs.readFileSync(file, "utf8"), { mode: "strip", sourceUrl: file });
    } catch (e) {
      failures++;
      const where = e.message.match(/\((\d+):(\d+)\)/);
      console.log(`${path.relative(root, file)}:${where ? `${where[1]}:${where[2]}` : "?"}: ${e.message.split("\n")[0]}`);
    }
  }
}
console.log(failures === 0 ? "ok: no strip-only incompatible syntax" : `${failures} file(s) use syntax Node strip-only mode rejects`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 5: Run both**

Run:
```bash
node --test tools/node-bundle/check-deps.test.mjs
node --no-warnings tools/node-bundle/check-ts-syntax.mjs
```
Expected: the hook test passes (`@std/assert` resolves once Task 2 adds it to the import map and `package.json`; run this step again after Task 2 if it reports `@std/assert` unmapped). The scan prints one line per offending file (about 46 files: the 5 `enum` files, the 40 parameter-property classes in `src/` and `tests/gha-grouping.ts`) and `N file(s) use syntax …`, exit 1. Task 3 drives it to `ok`.

- [ ] **Step 6: Commit**

```bash
git add tools/node-bundle/import-map-hook.mjs tools/node-bundle/register-import-map.mjs tools/node-bundle/check-ts-syntax.mjs tools/node-bundle/check-deps.test.mjs
git commit -m "node-bundle: import-map loader hook and strip-only syntax scan"
```

### Task 2: `tests/asserts.ts` on `@std/assert`

**Files:**
- Modify: `src/import_map.json`, `package.json`, `package-lock.json`, `tests/asserts.ts`

- [ ] **Step 1: Add the import-map entry**

In `src/import_map.json`: `"@std/assert": "jsr:@std/assert@1.0.13",` (pin the latest 1.0.x listed at https://jsr.io/@std/assert at execution time; 1.0.13 is the version assumed here). Then:

```bash
node tools/node-bundle/check-deps.mjs --write && npm install && node tools/node-bundle/check-deps.mjs
```

- [ ] **Step 2: Rewrite `tests/asserts.ts`**

```ts
/*
 * asserts.ts
 *
 * Assertions for the test suite, from @std/assert (JSR) on Deno and on Node
 * (resolved through tools/node-bundle/import-map-hook.mjs). Decision record:
 * dev-docs/runtime-migration/31-test-harness-on-node.md.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
export {
  assert,
  assertEquals,
  assertExists,
  assertFalse,
  AssertionError,
  assertMatch,
  assertNotEquals,
  assertObjectMatch,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
  fail,
  unreachable,
} from "@std/assert";
```

(Keep any extra name PR 22 exported; `grep -n "^  [a-zA-Z]" tests/asserts.ts` before overwriting. `@std/assert` 1.x has every name `@std/testing@0.224/asserts` had except `assertNotStrictEquals`/`assertArrayIncludes`/`assertAlmostEquals`, which exist too; add them if PR 22 exported them.)

- [ ] **Step 3: Run a sample on both runtimes**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts unit/text.test.ts unit/deno-ral/
cd .. && node --test tools/node-bundle/check-deps.test.mjs
```
Expected: green on Deno; the hook test passes.

- [ ] **Step 4: Commit**

```bash
git add src/import_map.json package.json package-lock.json tests/asserts.ts
git commit -m "tests: assertions from @std/assert 1.x"
```

### Task 3: Remove strip-only incompatible syntax

**Files:** every file `check-ts-syntax.mjs` lists.

- [ ] **Step 1: Convert `enum` declarations**

For each `export enum X { A = "a", B = "b" }` (string enums; all five files are string enums except `LogLevel` in `src/publish/confluence/api/types.ts` and `AccountTokenType` in `src/publish/provider-types.ts`, which are numeric), replace with:

```ts
export const X = {
  A: "a",
  B: "b",
} as const;
export type X = (typeof X)[keyof typeof X];
```

Call sites `X.A` and type annotations `: X` keep compiling. For the numeric `LogLevel` enum, use explicit numbers in the object (`DEBUG: 0, INFO: 1, …`) and check `grep -n "LogLevel\[" src/publish/confluence` for reverse lookups (`LogLevel[value]`); replace any with a lookup over `Object.entries(LogLevel)`. `src/publish/netlify/api/models/accountSetup.ts` wraps `period` in a namespace: `export namespace AccountSetup { export enum period {…} }` — Node rejects namespaces with values too; replace with `export const AccountSetupPeriod = {…} as const; export type AccountSetupPeriod = …` and update the two usages `AccountSetup.period.` (`grep -rn "AccountSetup.period" src/`). Run `deno check` via the normal dev build after each file: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/` (the test runner type-checks with `--check`).

- [ ] **Step 2: Convert constructor parameter properties**

For each `constructor(private readonly x: T, public y: U) {}` reported, add explicit fields and assignments:

```ts
private readonly x: T;
public y: U;
constructor(x: T, y: U) {
  this.x = x;
  this.y = y;
}
```

Worked example, `tests/gha-grouping.ts` `GroupEmitter`:

```ts
export class GroupEmitter {
  private openFile: string | undefined = undefined;
  private readonly gate: () => boolean;
  private readonly onStart: (title: string) => void;
  private readonly onEnd: () => void;

  constructor(
    gate: () => boolean,
    onStart: (title: string) => void,
    onEnd: () => void,
  ) {
    this.gate = gate;
    this.onStart = onStart;
    this.onEnd = onEnd;
  }
```

Order matters when a field initialiser references a parameter property: keep assignments before any code that used the parameter in the constructor body.

- [ ] **Step 3: Verify**

Run:
```bash
node --no-warnings tools/node-bundle/check-ts-syntax.mjs
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/gha-grouping.test.ts unit/github-actions-reporting.test.ts unit/project/ smoke/publish/ 2>/dev/null || QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/gha-grouping.test.ts unit/github-actions-reporting.test.ts unit/project/
```
Expected: `ok: no strip-only incompatible syntax`; tests green (type check included via `--check`).

- [ ] **Step 4: Commit**

```bash
git add -A src tests package/src
git commit -m "Replace enum and parameter-property syntax rejected by Node type stripping"
```

### Task 4: `tests/harness.ts` on `node:test`; `runHarness`/`runtimeScriptCommand` on Node

**Files:**
- Create: `tests/unit/harness-node.test.ts`
- Modify: `tests/harness.ts`, `tests/utils.ts`, `tests/test.ts`, `tests/smoke/smoke-all.test.ts`, `tests/integration/playwright-tests.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * harness-node.test.ts
 *
 * The harness adapter on both runtimes: testArgs() sources, ignore -> skip,
 * step() results, runHarness on the current runtime.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assert, assertEquals, assertStringIncludes } from "../asserts.ts";
import { registerTest, testArgs } from "../harness.ts";
import { runHarness } from "../utils.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "../../src/deno_ral/path.ts";
import { env } from "../../src/deno_ral/env.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import { readTextFileSync, removeSync, writeTextFileSync } from "../../src/deno_ral/fs.ts";

const testsDir = dirname(dirname(fromFileUrl(import.meta.url)));

unitTest("harness - testArgs falls back to QUARTO_TEST_ARGS", async () => {
  const saved = env.get("QUARTO_TEST_ARGS");
  env.set("QUARTO_TEST_ARGS", "docs/a.qmd\ndocs/b c.qmd");
  try {
    const got = testArgs();
    // Under run-tests.sh "--" args win (none here under the harness); under node --test they are empty.
    if (got.length === 2) assertEquals(got, ["docs/a.qmd", "docs/b c.qmd"]);
  } finally {
    if (saved === undefined) env.delete("QUARTO_TEST_ARGS");
    else env.set("QUARTO_TEST_ARGS", saved);
  }
});

let ignoredRan = false;
registerTest({ name: "[unit] > harness - ignored test never runs", ignore: true, fn: () => { ignoredRan = true; } });
unitTest("harness - ignore maps to skip on both runtimes", async () => {
  assertEquals(ignoredRan, false);
});

registerTest({
  name: "[unit] > harness - origin and step results on both runtimes",
  fn: async (ctx) => {
    assert(ctx.origin.startsWith("file://") && ctx.origin.endsWith("harness-node.test.ts"), ctx.origin);
    assertEquals(await ctx.step("passes", () => {}), true);
    assertEquals(await ctx.step("ignored", () => { throw new Error("never"); }, { ignore: true }), false);
  },
});

unitTest("harness - runHarness runs a child test file and reports its exit code", async () => {
  const dir = makeTempDirSync({ prefix: "rt31-harness-" });
  const file = join(dir, "child.test.ts");
  // file: URLs resolve identically on Deno and Node (and on Windows).
  const harnessUrl = toFileUrl(join(testsDir, "harness.ts")).href;
  const fsUrl = toFileUrl(join(testsDir, "..", "src", "deno_ral", "fs.ts")).href;
  writeTextFileSync(file, [
    `import { registerTest } from ${JSON.stringify(harnessUrl)};`,
    `import { writeTextFileSync } from ${JSON.stringify(fsUrl)};`,
    `registerTest({ name: "child passes", fn: () => { writeTextFileSync(${JSON.stringify(join(dir, "ran.txt"))}, "yes"); } });`,
    `registerTest({ name: "child fails", fn: () => { throw new Error("child boom"); } });`,
  ].join("\n"));
  const junit = join(dir, "junit.xml");
  const result = await runHarness({ file, cwd: testsDir, flags: ["--no-check"], junitPath: junit });
  assertEquals(result.code, 1);
  assertEquals(readTextFileSync(join(dir, "ran.txt")), "yes");
  assertStringIncludes(result.stdout + result.stderr, "child boom");
  const xml = readTextFileSync(junit);
  assertStringIncludes(xml, "child passes");
  assertStringIncludes(xml, "child fails");
  removeSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-node.test.ts`
Expected: fails on `testArgs` not exported from `tests/harness.ts` (the Deno branch of `runHarness` from PR 23 already handles the JUnit case).

- [ ] **Step 3: Add the Node branch to `tests/harness.ts`**

Keep PR 23's types, `wrapContext` and the Deno body of `registerTest`; add the imports and the three pieces below.

```ts
import { runtime } from "../src/deno_ral/platform.ts";
import { args } from "../src/deno_ral/process.ts";
import { env } from "../src/deno_ral/env.ts";
import { pathToFileURL } from "node:url";

const isNode = runtime().name === "node";

// node:test is loaded lazily so the Deno build never imports it.
type NodeTestContext = {
  filePath?: string;
  test(name: string, options: { skip?: boolean }, fn: (t: NodeTestContext) => Promise<void> | void): Promise<void>;
};
type NodeTestFn = (name: string, options: { skip?: boolean }, fn: (t: NodeTestContext) => Promise<void> | void) => void;
let nodeTest: NodeTestFn | undefined;
if (isNode) {
  nodeTest = (await import("node:test")).test as unknown as NodeTestFn;
}

function nodeContext(t: NodeTestContext, origin: string): TestRunContext {
  return {
    origin,
    step: async (name, fn, options) => {
      if (options?.ignore) {
        await t.test(name, { skip: true }, () => {});
        return false;
      }
      let passed = true;
      await t.test(name, {}, async (inner) => {
        try {
          await fn(nodeContext(inner, origin));
        } catch (e) {
          passed = false;
          throw e; // node:test records the step failure and fails the parent
        }
      });
      return passed;
    },
  };
}
```

At the top of PR 23's `registerTest`, before the `sanitize` computation:

```ts
  if (isNode) {
    nodeTest!(def.name, { skip: def.ignore === true }, (t) => {
      const origin = t.filePath ? pathToFileURL(t.filePath).href : "";
      return Promise.resolve(def.fn(nodeContext(t, origin)));
    });
    return;
  }
```

After `registerTest`, the two helpers:

```ts
// Positional test arguments. `deno test file -- a b` and `node file.test.ts -- a b`
// put them after "--"; `node --test` has no positional channel, so
// run-tests-node.sh and runHarness pass them in QUARTO_TEST_ARGS (newline-separated).
export function testArgs(): string[] {
  const positional = args();
  const dash = positional.indexOf("--");
  const fromArgs = dash === -1 ? positional : positional.slice(dash + 1);
  if (fromArgs.length > 0) return fromArgs;
  const fromEnv = env.get("QUARTO_TEST_ARGS");
  return fromEnv ? fromEnv.split("\n").filter((a) => a.length > 0) : [];
}

export function onProcessExit(handler: () => void): void {
  if (isNode) {
    process.on("exit", handler);
  } else {
    globalThis.addEventListener("unload", handler);
  }
}
```

(`process` is a global on both runtimes; `node:url` is a built-in on both.)

- [ ] **Step 4: Node branches in `tests/utils.ts`**

Replace PR 23's `runHarness` and `runtimeScriptCommand` bodies with:

```ts
import { runtime } from "../src/deno_ral/platform.ts";

const kHarnessFlags = [
  "--config",
  "test-conf.json",
  "--no-lock",
  "--allow-all",
  "--unstable-ffi",
  "--v8-flags=--enable-experimental-regexp-engine",
];

// Runs one test file through the harness in a child process and returns its
// decoded output. `cwd` must be the tests/ directory. The options are PR 23's
// (`file`, `flags`, `args`, `env`, `junitPath`); the Deno branch is PR 23's
// body, the Node branch translates them (`--no-check`/`--check` dropped from
// `flags`, `junitPath` as the junit reporter, `args` through QUARTO_TEST_ARGS).
export async function runHarness(options: {
  file: string;
  cwd: string;
  flags?: string[];
  args?: string[];
  env?: Record<string, string>;
  junitPath?: string;
}): Promise<{ stdout: string; stderr: string; code: number }> {
  const quartoRoot = dirname(options.cwd);
  let cmdArgs: string[];
  const childEnv: Record<string, string> = { ...(options.env ?? {}) };
  if (runtime().name === "node") {
    const nodeFlags = (options.flags ?? []).filter((f) => f !== "--no-check" && f !== "--check");
    cmdArgs = [
      "--no-warnings",
      "--experimental-strip-types",
      "--import",
      join(quartoRoot, "tools", "node-bundle", "register-import-map.mjs"),
      "--enable-experimental-regexp-engine",
      ...nodeFlags,
      "--test",
      "--test-concurrency=1",
      "--test-reporter=spec",
      "--test-reporter-destination=stdout",
      ...(options.junitPath ? ["--test-reporter=junit", `--test-reporter-destination=${options.junitPath}`] : []),
      options.file,
    ];
    if (options.args && options.args.length > 0) {
      childEnv.QUARTO_TEST_ARGS = options.args.join("\n");
    }
  } else {
    const importMap = `--importmap=${join(quartoRoot, "src", "import_map.json")}`;
    cmdArgs = ["test", ...kHarnessFlags, importMap, ...(options.flags ?? [])];
    if (options.junitPath) {
      cmdArgs.push(`--junit-path=${options.junitPath}`);
    }
    cmdArgs.push(options.file);
    if (options.args && options.args.length > 0) {
      cmdArgs.push("--", ...options.args);
    }
  }
  const result = await exec(execPath(), {
    args: cmdArgs,
    cwd: options.cwd,
    env: childEnv,
    stdout: "piped",
    stderr: "piped",
  });
  const decoder = new TextDecoder();
  return {
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr),
    code: result.code,
  };
}

// Command line that runs an ESM script (.mjs, Node APIs only) with the
// current JavaScript runtime.
export function runtimeScriptCommand(
  scriptPath: string,
  options?: { allowWritePath?: string },
): { cmd: string; args: string[] } {
  if (runtime().name === "node") {
    return { cmd: execPath(), args: [scriptPath] };
  }
  const args = ["run", "--allow-net", "--allow-read", "--allow-env"];
  if (options?.allowWritePath) {
    args.push(`--allow-write=${options.allowWritePath}`);
  }
  args.push(scriptPath);
  return { cmd: execPath(), args };
}
```

(`--unstable-ffi` stays in `kHarnessFlags` until PR 20 lands; drop it if it already has. PR 30 removed `--unstable-kv` from this list.)

- [ ] **Step 5: Wire `test.ts`, `smoke-all.test.ts`, `playwright-tests.test.ts`**

- `tests/test.ts`: replace `globalThis.addEventListener("unload", () => {` with `onProcessExit(() => {` (import `onProcessExit` from `./harness.ts`).
- `tests/smoke/smoke-all.test.ts`: replace its read of the positional arguments (`args()` after PR 23) with `testArgs()` from `../harness.ts`.
- `tests/integration/playwright-tests.test.ts`: `const globOutput = testArgs().length ? expandGlobSync(testArgs()[0]) : expandGlobSync("docs/playwright/!(serve|shiny)/**/*.qmd");`.

- [ ] **Step 6: Run on Deno**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness.test.ts unit/harness-node.test.ts unit/harness-failure-reporting.test.ts docs/smoke-all/2023/02/08/4272.qmd`
Expected: green (PR 23's `harness.test.ts` still passes; the new test spawns a Deno child; smoke-all still reads `--` args).

- [ ] **Step 7: Commit**

```bash
git add tests/harness.ts tests/utils.ts tests/test.ts tests/smoke/smoke-all.test.ts tests/integration/playwright-tests.test.ts tests/unit/harness-node.test.ts
git commit -m "tests/harness: node:test registration, testArgs, runHarness and runtimeScriptCommand on Node"
```

### Task 5: `run-tests-node.sh` and `run-tests-node.ps1`

**Files:**
- Create: `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`

- [ ] **Step 1: Write the bash runner**

```bash
#!/usr/bin/env bash
# tests/run-tests-node.sh
# Copyright (C) 2026 Posit Software, PBC
#
# Runs the test suite on Node 22 with type stripping and the import-map loader
# hook (tools/node-bundle/). Same arguments and environment as run-tests.sh.
# See tests/README.md "Running on Node".
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  SCRIPT_PATH="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$SCRIPT_PATH/$SOURCE"
done
export SCRIPT_PATH="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"

VERBOSE_MODE=false
if [[ "$RUNNER_DEBUG" == "1" ]] || [[ "$QUARTO_TEST_VERBOSE" == "true" ]]; then VERBOSE_MODE=true; fi

KEEP_OUTPUTS=false
AGENT_MODE=false
FILTERED_ARGS=()
for arg in "$@"; do
  case $arg in
    --keep-outputs|-k) KEEP_OUTPUTS=true ;;
    --agent) AGENT_MODE=true ;;
    *) FILTERED_ARGS+=("$arg") ;;
  esac
done
set -- "${FILTERED_ARGS[@]}"
if [[ "$KEEP_OUTPUTS" == "true" ]]; then
  export QUARTO_TEST_KEEP_OUTPUTS=true
  echo "> Keep outputs mode enabled - test artifacts will not be deleted"
fi
REPORTER_ARGS=(--test-reporter=spec --test-reporter-destination=stdout)
if [[ "$AGENT_MODE" == "true" ]]; then REPORTER_ARGS=(--test-reporter=dot --test-reporter-destination=stdout); fi

export QUARTO_ROOT="$(cd "$SCRIPT_PATH/.." > /dev/null 2>&1 && pwd)"
export QUARTO_BIN_PATH="$QUARTO_ROOT/package/dist/bin"
export QUARTO_SHARE_PATH="$(cd "$QUARTO_ROOT/src/resources/"; pwd)"
export QUARTO_DEBUG=true
NODE="${QUARTO_NODE:-node}"

if [ ! -d "$QUARTO_ROOT/node_modules" ]; then
  echo "ERROR: $QUARTO_ROOT/node_modules missing; run 'npm ci' in $QUARTO_ROOT"
  exit 1
fi

NODE_OPTS=(--no-warnings --experimental-strip-types --import "$QUARTO_ROOT/tools/node-bundle/register-import-map.mjs"
  --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100)

# QUARTO_TEST_BIN selects an installed Quarto outside this checkout (binary mode).
if [[ -n "$QUARTO_TEST_BIN" ]]; then
  if [[ ! -x "$QUARTO_TEST_BIN" ]]; then
    echo "ERROR: QUARTO_TEST_BIN ($QUARTO_TEST_BIN) does not exist or is not executable"; exit 1
  fi
  strip_env_file="$SCRIPT_PATH/binary-mode-strip-env.txt"
  strip_args=()
  while IFS=$' \t\r' read -r name || [[ -n "$name" ]]; do
    [[ -z "$name" || "$name" == \#* ]] && continue
    strip_args+=(-u "$name")
  done < "$strip_env_file"
  QUARTO_TEST_BIN_VERSION="$(env "${strip_args[@]}" "$QUARTO_TEST_BIN" --version 2>/dev/null)"
  if [[ $? -ne 0 || -z "$QUARTO_TEST_BIN_VERSION" ]]; then
    echo "ERROR: QUARTO_TEST_BIN ($QUARTO_TEST_BIN) did not report a version."; exit 1
  fi
  echo "> BINARY MODE: testing built quarto ${QUARTO_TEST_BIN_VERSION} at ${QUARTO_TEST_BIN}"
fi

if [[ -z $GITHUB_ACTION ]] && [[ -z $QUARTO_TESTS_NO_CONFIG ]]; then
  echo "> Checking and configuring environment for tests"
  source configure-test-env.sh
fi

QUARTO_VENV_ACTIVATE="${QUARTO_ROOT}/tests/.venv/bin/activate"
if [[ -z $QUARTO_TESTS_FORCE_NO_VENV && -f $QUARTO_VENV_ACTIVATE ]]; then
  OLD_VIRTUAL_ENV=$VIRTUAL_ENV
  source "$QUARTO_VENV_ACTIVATE"
  quarto_venv_activated="true"
fi

SMOKE_ALL_TEST_FILE="./smoke/smoke-all.test.ts"

# Default target list: every .test.ts except test-conf.json's excludes.
all_tests() {
  find . -name '*.test.ts' -not -path './integration/playwright/*' -not -path './.venv/*' -not -path './node_modules/*' | sort
}

run_node_test() {
  # $1: newline-separated QUARTO_TEST_ARGS (may be empty); rest: test files
  local test_args="$1"; shift
  QUARTO_TEST_ARGS="$test_args" "$NODE" "${NODE_OPTS[@]}" --test --test-concurrency=1 "${REPORTER_ARGS[@]}" "$@"
}

if [ "$QUARTO_TEST_TIMING" != "" ] && [ "$QUARTO_TEST_TIMING" != "false" ]; then
  if [ "$QUARTO_TEST_TIMING" == "true" ]; then QUARTO_TEST_TIMING="timing.txt"; fi
  echo "> Running tests with timing and writing to ${QUARTO_TEST_TIMING}"
  rm -f "$QUARTO_TEST_TIMING"
  FILES=$@
  if [ "$FILES" == "" ]; then FILES=$(all_tests); fi
  for i in $FILES; do
    if [ "$i" == "$SMOKE_ALL_TEST_FILE" ]; then
      SMOKE_ALL_FILES=$(find docs/smoke-all/ -type f -regextype "posix-extended" -regex ".*/[^_][^/]*[.](qmd|md|ipynb)")
      for j in $SMOKE_ALL_FILES; do
        echo "${SMOKE_ALL_TEST_FILE} -- ${j}" >> "$QUARTO_TEST_TIMING"
        /usr/bin/time -f "        %e real %U user %S sys" -a -o "${QUARTO_TEST_TIMING}" bash -c "QUARTO_TEST_ARGS='$j' '$NODE' ${NODE_OPTS[*]} --test --test-concurrency=1 --test-reporter=dot --test-reporter-destination=stdout $SMOKE_ALL_TEST_FILE"
      done
      continue
    fi
    echo "$i" >> "$QUARTO_TEST_TIMING"
    /usr/bin/time -f "        %e real %U user %S sys" -a -o "$QUARTO_TEST_TIMING" "$NODE" "${NODE_OPTS[@]}" --test --test-concurrency=1 --test-reporter=dot --test-reporter-destination=stdout "$i"
  done
  grep -q 'Command exited with non-zero status' "$QUARTO_TEST_TIMING" && SUCCESS=1 || SUCCESS=0
else
  if [[ "$1" =~ smoke-all\.test\.ts ]]; then
    shift
    [[ "$1" == "--" ]] && shift
    run_node_test "$(printf '%s\n' "$@")" "$SMOKE_ALL_TEST_FILE"
    SUCCESS=$?
  else
    SMOKE_ALL_FILES=()
    TESTS_TO_RUN=()
    for file in "$@"; do
      filename=$(basename "$file")
      if [[ $filename =~ ^[^_].*[.](qmd|ipynb|md)$ ]]; then
        SMOKE_ALL_FILES+=("$file")
      elif [[ $file =~ .*[.]ts$ ]] || [[ -d "$file" ]]; then
        TESTS_TO_RUN+=("$file")
      else
        echo "#### WARNING: Only .ts files, directories, or .qmd/.md/.ipynb (for smoke-all) are accepted."; exit 1
      fi
    done
    if [ "${#SMOKE_ALL_FILES[@]}" -ne 0 ]; then
      if [ "${#TESTS_TO_RUN[@]}" -ne 0 ]; then
        echo "#### WARNING: When passing .qmd/.md/.ipynb only smoke-all.test.ts runs. Ignoring ${TESTS_TO_RUN[*]}."
      fi
      run_node_test "$(printf '%s\n' "${SMOKE_ALL_FILES[@]}")" "$SMOKE_ALL_TEST_FILE"
      SUCCESS=$?
    else
      if [[ -n "$QUARTO_TEST_BIN" && "${#TESTS_TO_RUN[@]}" -eq 0 ]]; then
        TESTS_TO_RUN=("smoke/")
        echo "> BINARY MODE: defaulting to smoke/ tests"
      fi
      FILES=()
      if [ "${#TESTS_TO_RUN[@]}" -eq 0 ]; then
        while IFS= read -r f; do FILES+=("$f"); done < <(all_tests)
      else
        for t in "${TESTS_TO_RUN[@]}"; do
          if [ -d "$t" ]; then
            while IFS= read -r f; do FILES+=("$f"); done < <(find "$t" -name '*.test.ts' -not -path '*/node_modules/*' | sort)
          else
            FILES+=("$t")
          fi
        done
      fi
      run_node_test "" "${FILES[@]}"
      SUCCESS=$?
    fi
  fi
fi

if [[ $quarto_venv_activated == "true" ]]; then
  deactivate
  if [[ -n $OLD_VIRTUAL_ENV ]]; then source "$OLD_VIRTUAL_ENV/bin/activate"; fi
fi
exit ${SUCCESS}
```

- [ ] **Step 2: Write the PowerShell runner**

```powershell
# tests/run-tests-node.ps1
# Copyright (C) 2026 Posit Software, PBC
# Runs the test suite on Node 22 (type stripping + import-map loader hook).
# Same argument contract as run-tests.ps1; see tests/README.md "Running on Node".
$ErrorActionPreference = "Continue"
$SCRIPT_PATH = Split-Path -Parent $MyInvocation.MyCommand.Path
$Env:QUARTO_ROOT = (Resolve-Path (Join-Path $SCRIPT_PATH "..")).Path
$Env:QUARTO_BIN_PATH = Join-Path $Env:QUARTO_ROOT "package" "dist" "bin"
$Env:QUARTO_SHARE_PATH = (Resolve-Path (Join-Path $Env:QUARTO_ROOT "src" "resources")).Path
$Env:QUARTO_DEBUG = "true"
$NODE = if ($Env:QUARTO_NODE) { $Env:QUARTO_NODE } else { "node" }

if (-not (Test-Path (Join-Path $Env:QUARTO_ROOT "node_modules"))) {
  Write-Host -ForegroundColor red "ERROR: node_modules missing; run 'npm ci' in $($Env:QUARTO_ROOT)"
  Exit 1
}

$customArgs = @($args)
$AGENT_MODE = $false
$FILTERED = @()
foreach ($a in $customArgs) {
  if ($a -eq "--keep-outputs" -or $a -eq "-k") { $Env:QUARTO_TEST_KEEP_OUTPUTS = "true" }
  elseif ($a -eq "--agent") { $AGENT_MODE = $true }
  else { $FILTERED += $a }
}
$customArgs = $FILTERED
$REPORTER = if ($AGENT_MODE) { @("--test-reporter=dot", "--test-reporter-destination=stdout") } else { @("--test-reporter=spec", "--test-reporter-destination=stdout") }
$NODE_OPTS = @("--no-warnings", "--experimental-strip-types", "--import", (Join-Path $Env:QUARTO_ROOT "tools" "node-bundle" "register-import-map.mjs"),
  "--enable-experimental-regexp-engine", "--max-old-space-size=8192", "--stack-trace-limit=100")

if ($Env:QUARTO_TEST_BIN) {
  if (-not (Test-Path $Env:QUARTO_TEST_BIN)) { Write-Host -ForegroundColor red "ERROR: QUARTO_TEST_BIN not found"; Exit 1 }
  $v = & $Env:QUARTO_TEST_BIN --version
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($v)) { Write-Host -ForegroundColor red "ERROR: QUARTO_TEST_BIN did not report a version"; Exit 1 }
  Write-Host "> BINARY MODE: testing built quarto $v at $($Env:QUARTO_TEST_BIN)"
}

if (-not $Env:GITHUB_ACTION -and -not $Env:QUARTO_TESTS_NO_CONFIG) {
  Write-Host "> Checking and configuring environment for tests"
  . ./configure-test-env.ps1
}
$venv = Join-Path $Env:QUARTO_ROOT "tests" ".venv" "Scripts" "Activate.ps1"
if (-not $Env:QUARTO_TESTS_FORCE_NO_VENV -and (Test-Path $venv)) { . $venv }

$SMOKE_ALL = "./smoke/smoke-all.test.ts"
function All-Tests {
  Get-ChildItem -Recurse -Filter "*.test.ts" | Where-Object { $_.FullName -notmatch "integration[\\/]playwright" -and $_.FullName -notmatch "[\\/]\.venv[\\/]" -and $_.FullName -notmatch "node_modules" } | ForEach-Object { Resolve-Path -Relative $_.FullName } | Sort-Object
}
function Run-NodeTest([string]$testArgs, [string[]]$files) {
  $Env:QUARTO_TEST_ARGS = $testArgs
  & $NODE @NODE_OPTS --test --test-concurrency=1 @REPORTER @files
  return $LASTEXITCODE
}

$smokeFiles = @(); $tests = @()
foreach ($f in $customArgs) {
  $name = Split-Path -Leaf $f
  if ($name -match "^[^_].*[.](qmd|ipynb|md)$") { $smokeFiles += $f }
  elseif ($f -match "[.]ts$" -or (Test-Path $f -PathType Container)) { $tests += $f }
  else { Write-Host "#### WARNING: Only .ts files, directories, or .qmd/.md/.ipynb are accepted."; Exit 1 }
}
if ($smokeFiles.Count -gt 0) {
  $code = Run-NodeTest ($smokeFiles -join "`n") @($SMOKE_ALL)
} else {
  if ($Env:QUARTO_TEST_BIN -and $tests.Count -eq 0) { $tests = @("smoke/"); Write-Host "> BINARY MODE: defaulting to smoke/ tests" }
  $files = @()
  if ($tests.Count -eq 0) { $files = All-Tests }
  else {
    foreach ($t in $tests) {
      if (Test-Path $t -PathType Container) { $files += Get-ChildItem -Path $t -Recurse -Filter "*.test.ts" | ForEach-Object { Resolve-Path -Relative $_.FullName } | Sort-Object }
      else { $files += $t }
    }
  }
  $code = Run-NodeTest "" $files
}
if (Get-Command deactivate -ErrorAction SilentlyContinue) { deactivate }
Exit $code
```

- [ ] **Step 3: Run on Node**

Run:
```bash
chmod +x tests/run-tests-node.sh
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/deno-ral/ unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts
echo "exit=$?"
```
Expected: dots and a tally (`# pass N`, `# fail 0`), `exit=0`. First-run failures that name `Deno` or an import-map specifier are Phase 2 gaps: file them against the PR that owns the module (27–30) rather than patching here, unless they are in `tests/` itself.

- [ ] **Step 4: Commit**

```bash
git add tests/run-tests-node.sh tests/run-tests-node.ps1
git commit -m "tests: run-tests-node entry points for Node 22"
```

### Task 6: Self-spawning tests on both runtimes

**Files:**
- Modify: `tests/unit/chrome-launch-fixtures.ts`, `tests/unit/chrome-launch.test.ts`, `tests/unit/chrome-launch-flags.test.ts`, `tests/unit/harness-failure-reporting.test.ts`

- [ ] **Step 1: Fake executables are `.mjs` scripts**

In `tests/unit/chrome-launch-fixtures.ts` (PR 23's version, already on `runtimeScriptCommand`), change the script extension so Node parses the script as ESM without a `package.json` (Deno treats `.mjs` as ESM too):

```ts
  const scriptPath = join(dir, `${name}.mjs`);
```

and update the doc comment: "Writes a small ESM script that uses only `node:` modules and `process`, so it runs under both the Deno and the Node executable".

- [ ] **Step 2: Rewrite the fake Chrome scripts on Node APIs**

`tests/unit/chrome-launch.test.ts` `writeSilentChromeExecutable` script lines:

```ts
    [
      'import net from "node:net";',
      'import fs from "node:fs";',
      "const server = net.createServer(() => { /* accept, never answer */ });",
      `server.listen(${port}, "127.0.0.1");`,
      stderrText ? `process.stderr.write(${JSON.stringify(stderrText)});` : "",
      "setTimeout(() => {",
      exitTimestampPath ? `  fs.writeFileSync(${JSON.stringify(exitTimestampPath)}, String(Date.now()));` : "",
      "  process.exit(1);",
      `}, ${selfDestructMs});`,
    ],
```

`tests/unit/chrome-launch-flags.test.ts` `writeFakeChromeExecutable` script lines:

```ts
    [
      'import http from "node:http";',
      'import fs from "node:fs";',
      "const args = process.argv.slice(2);",
      `fs.writeFileSync(${JSON.stringify(argvOutPath)}, JSON.stringify(args));`,
      "const server = http.createServer((req, res) => {",
      '  if (req.url === "/json/list") {',
      '    res.writeHead(200, { "content-type": "application/json" });',
      `    res.end(JSON.stringify([{ type: "page", webSocketDebuggerUrl: "ws://localhost:${port}/devtools/page/1" }]));`,
      '  } else if (req.url === "/shutdown") {',
      "    res.writeHead(200); res.end();",
      "    setTimeout(() => process.exit(0), 50);",
      "  } else {",
      "    res.writeHead(404); res.end();",
      "  }",
      "});",
      `server.listen(${port}, "127.0.0.1");`,
    ],
```

After this step `grep -n 'Deno\.' tests/unit/chrome-launch*.test.ts` prints nothing; lower the `tests/` count in `tools/runtime-boundary-baseline.json` accordingly (`quarto run --dev tools/check-runtime-boundary.ts --update-baseline`).

- [ ] **Step 3: Guard Deno-reporter assertions in `harness-failure-reporting.test.ts`**

`runFixture` already calls `runHarness` (PR 23). Assertions that read Deno's `ERRORS` section (`denoErrorsSection(...)`) describe Deno's reporter, not the harness; wrap each in `if (runtime().name === "deno") { … }` (import `runtime` from `../../src/deno_ral/platform.ts`). The `::error` annotations and the step-summary rows are produced by `tests/test.ts` and stay unconditional. The `run.summary.includes("harness-reporting-fixture.ts:25")` line-number assertion depends only on the fixture file and stays.

- [ ] **Step 4: Run on both runtimes**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts
QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts
```
Expected: green on both. (`smoke-all-prerender-isolation` on Node renders documents in-process; a failure there is a Phase 2 gap for PR 27–30 and is recorded in the PR description, not patched here.)

- [ ] **Step 5: Commit**

```bash
git add tests/unit/chrome-launch-fixtures.ts tests/unit/chrome-launch.test.ts tests/unit/chrome-launch-flags.test.ts tests/unit/harness-failure-reporting.test.ts tools/runtime-boundary-baseline.json
git commit -m "tests: runtime-neutral fake executables; guard Deno-reporter assertions"
```

### Task 7: CI step and docs

**Files:**
- Modify: `.github/workflows/test-node-bundle.yml`, `tests/README.md`

- [ ] **Step 1: Add the Node unit-test step after "Build the bundle"**

```yaml
      - name: Strip-only TypeScript syntax check
        run: node --no-warnings tools/node-bundle/check-ts-syntax.mjs

      - name: Unit tests on Node (harness, deno_ral)
        working-directory: tests
        env:
          QUARTO_TESTS_NO_CONFIG: "true"
        run: ./run-tests-node.sh --agent unit/deno-ral/ unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts unit/harness-failure-reporting.test.ts
```

- [ ] **Step 2: Document in `tests/README.md`**

Add a section after "Running the tests locally":

```markdown
### Running on Node

`run-tests-node.sh` / `run-tests-node.ps1` run the same files on Node 22 with
type stripping and the import-map loader hook (`tools/node-bundle/`):

```bash
npm ci                                  # once, in the repository root
cd tests
QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/deno-ral/
./run-tests-node.sh docs/smoke-all/2023/02/08/4272.qmd   # smoke-all on one document
QUARTO_TEST_BIN=../tools/node-bundle/quarto-node ./run-tests-node.sh smoke/   # binary mode against the Node bundle
```

Differences from the Deno runner: no sanitizers (`sanitize` is ignored), no
type checking (`deno test --check`; use the Deno runner or, after PR 38,
`tsc`), test files run serially in child processes (`--test-concurrency=1`),
and smoke-all document arguments are passed through `QUARTO_TEST_ARGS`
(`testArgs()` in `harness.ts`) because `node --test` has no positional
arguments. `node --no-warnings tools/node-bundle/check-ts-syntax.mjs` lists
syntax Node's strip-only mode rejects (`enum`, parameter properties).
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test-node-bundle.yml tests/README.md
git commit -m "ci/docs: run harness and deno_ral unit tests on Node"
```

## Verification

- Deno (unchanged behaviour): `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ smoke/render/render.test.ts docs/smoke-all/2023/02/08/4272.qmd` → green.
- Node: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/deno-ral/ unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts` → `# fail 0`.
- Node smoke-all: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh docs/smoke-all/2023/02/08/4272.qmd` → passes (in-process render on Node).
- Node binary mode: `node tools/node-bundle/build.mjs && cd tests && QUARTO_TEST_BIN=$PWD/../tools/node-bundle/quarto-node QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent smoke/render/render.test.ts` → passes.
- `node --no-warnings tools/node-bundle/check-ts-syntax.mjs` → `ok`.
- `node --test tools/node-bundle/` → all pass.
- `quarto run --dev tools/check-runtime-boundary.ts` → zero.
- Timing mode: `cd tests && QUARTO_TEST_TIMING=/tmp/t.txt QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh unit/path.test.ts && cat /tmp/t.txt` → two lines per test file as `run-tests.sh` produces.
- GitHub grouping: `GITHUB_ACTIONS=true QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh unit/gha-grouping.test.ts | grep -c "::group::"` → at least 1.

## Review checklist

- [ ] `tests/harness.ts` imports `node:test` only on Node (dynamic import); PR 23's Deno path, `TestRunContext` and `SanitizeOptions` unchanged; `step` returns `false` for ignored and failed steps on Node.
- [ ] `testArgs()` prefers positional args after `--`; `QUARTO_TEST_ARGS` only when none.
- [ ] `run-tests-node.sh` mirrors `run-tests.sh`: `--agent`, `--keep-outputs`, document → smoke-all, directory targets, binary-mode default, venv activation, timing, `test-conf.json` excludes via `find`.
- [ ] Node invocation always has `--experimental-strip-types`, `--import register-import-map.mjs`, `--test-concurrency=1`, the three V8 flags.
- [ ] The loader hook passes through relative/absolute/`node:`/`data:` specifiers and anything imported from inside `node_modules`.
- [ ] `tests/asserts.ts` re-exports every name it exported before, now from `@std/assert`; the import map and `package.json` agree (`check-deps.mjs`).
- [ ] `check-ts-syntax.mjs` reports `ok`; the enum replacements keep the same member names and values; `LogLevel` reverse lookups handled.
- [ ] Fake executables are `.mjs` using only `node:` modules and `process`; `runtimeScriptCommand` passes Deno permissions only on Deno.
- [ ] `runHarness` (in `tests/utils.ts`) keeps PR 23's `{ args, cwd, env }` shape; the Node branch translates `--junit-path=`, drops `--check`/`--no-check`, and passes `--` documents through `QUARTO_TEST_ARGS`.
- [ ] `tests/test.ts` uses `onProcessExit`.

## Risks and rollback

- **Test ordering/isolation differences**: Node runs each file in its own process (fresh module state), Deno shares one process. Tests that relied on module state leaking between files would pass on Node and fail on Deno or vice versa; `--test-concurrency=1` keeps file order identical. Rollback for a specific file: run it only on Deno by adding it to a `node-skip.txt` list that `run-tests-node.sh` filters (not added pre-emptively; add when a case appears).
- **`@std/assert` 1.x message formats** differ slightly from `@std/testing@0.224/asserts` (same code lineage, but the diff header changed). Tests that assert on the exact assertion message would fail on both runtimes and are fixed in this PR when found.
- **Enum/parameter-property rewrites** are behaviour-preserving but touch publishing code with few tests (`confluence`); the type checker (`deno test --check`) catches signature mismatches; `unit/confluence/` runs on Deno.
- **Whole-PR rollback:** revert the commits; `run-tests.sh` and the Deno harness are untouched except for `onProcessExit` and `testArgs`, both equivalent on Deno.

## Decisions needed

None. `@std/assert` over `node:assert`, unbundled execution over bundling, and `QUARTO_TEST_ARGS` are decided above with reasons.
