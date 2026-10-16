# PR 31: the test suite runs on Node (runner chosen by Spike V; harness adapter fixed)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `tests/` runnable on Node 26 with the test runner Spike V selects (`node:test` or Vitest), behind the harness adapter interface fixed in `_TEMPLATE.md`, with `tests/run-tests-node.sh`/`.ps1` mirroring `run-tests.sh`/`.ps1` (binary mode, `--agent`, timing, GitHub grouping), the self-spawning tests working on both runtimes, and the CI bucketing script `tests/run-parallel-tests` ported off Deno.
**Phase:** 2. **Depends on:** Spike V closed (`SPIKES.md`: it decides the runner; this plan keeps both variants until then, and keeps both if the spike recorded "inconclusive" with `node:test` as the provisional choice), PR 02b (no type-only imports kept as value imports, no `enum`/parameter properties/`<T>` assertions: required by the `node:test` variant, harmless for Vitest), PR 23 (`tests/harness.ts` adapter, `tests/` codemodded, `runHarness`/`runtimeScriptCommand`), PR 26 (root `package.json`, `tools/node-bundle/import-map.mjs`, `junit.mjs`), PR 27, 27b, 28, 29, 30 (the layer on `node:` APIs: Spike V runs after PR 30, so this plan starts after the ports; `env.ts` and `platform.ts` are imported by the harness itself). **Unblocks:** PR 32.
**Branch:** `rt/31-test-harness-on-node`.
**Suggested executor:** Opus. Two runtimes, a runner that is decided late, process spawning and CI bucketing need judgement.
**Size:** L (harness, asserts, one runner variant's tooling, 2 runner scripts, the bucketing port, 4 self-spawning tests, CI and docs).
**Ships on:** Deno; the whole suite stays green on `run-tests.sh`. Node: `run-tests-node.sh --agent unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts` passes and becomes a step of the PR 26 `node-unit` job; that job keeps running `tests/unit/ral/` bundled against its known-failures ratchet until PR 32 replaces it with the full Node suite. Broader Node parity is PR 32.

## Spec

### Context

Assessment section 3.5 and section 7 Phase 2 item 3: "Port the test harness: assertions to `@std/assert` or `node:assert`, registration to an adapter that can target `Deno.test` now and `node:test` later." PR 23 created `tests/harness.ts` (`registerTest`, `TestRunContext`, `runHarness`, `runtimeScriptCommand`) on Deno; PR 02 created `tests/asserts.ts`. This PR gives them a Node branch and the scripts to run them.

Review findings on the earlier draft (blockers B1, B2; S12), all addressed:

- **B1, type-only imports.** Node's type stripping keeps `import { Format } from "../config/types.ts"` when `Format` is only an interface, and module linking fails (`does not provide an export named 'Format'`, reproduced on Node 22.22). Every in-process test (through `tests/quarto-cmd.ts:11` → `src/quarto.ts`) hit this, and `<T>expr` assertions and the parameter property in `tests/quarto-cmd.ts` were missing from the draft's syntax list. PR 02b now fixes all of it in Phase 1 (`verbatimModuleSyntax`, the `import type` codemod, enums, parameter properties, `<T>`) and owns `tools/node-bundle/check-ts-syntax.mjs`; this PR's syntax-cleanup task and its copy of the scan are removed. Vitest's esbuild transform elides type-only imports anyway, which is one of the things Spike V measures.
- **B2, layer modules not ported.** The harness imports `src/deno_ral/env.ts` and `platform.ts`; on Node they threw at import, and `runtime()` answered `deno` inside the bundle. PR 27b ports both; this PR depends on it.
- **No `--test-force-exit` or timeout.** A test that leaks a handle (a timer, a child, a server) kept its `node --test` child alive forever. Both variants now set a per-test timeout (10 minutes; `--test-timeout` and `testTimeout` bound each test, not the file: two 1.5 s tests pass under a 2 s limit on Node 22.22) and force exit after the last test.
- **Forced exit is not leak detection (R13 of `REVIEW-2026-10-16.md`).** The earlier draft's acceptance said a leaked timer fails its file, while its worked example expected the leaking file to pass with exit 0 because the runner was terminated; those are different guarantees. They are now separate and each is stated once, in "Leak guarantees" (Interfaces): the per-test timeout is a watchdog for hangs, the forced exit bounds the run and reports nothing, and the detection Deno's sanitizers gave is kept on Node by `runChecked()` in `registerTest` (a count of libuv handles by kind before and after each test, `process.exit` guarded during it), with what Node cannot see listed as intentionally lost.
- **CI cost (S12).** One process per test file, each re-stripping ~1,200 modules through a JavaScript resolve hook, was not estimated. Spike V measures it against Vitest's transform cache; PR 32 buckets the Node matrix with the existing timing files.
- **`tests/run-parallel-tests.ts` is Deno-only** (`Deno.run`, unversioned `https://deno.land/std` imports through `quarto run`), and computes the CI buckets: it is ported here to `tests/run-parallel-tests.mjs` (plain Node ESM, also runs on Deno), with a `--runner deno|node` switch for local parallel runs.
- **Positional arguments.** Neither `node --test` nor `vitest run` passes positional arguments to a test file; `smoke/smoke-all.test.ts` and `integration/playwright-tests.test.ts` read them (after PR 23, through `args()` from `src/deno_ral/process.ts`). `testArgs()` reads `args()` after `--` and otherwise `QUARTO_TEST_ARGS` (newline-separated); both runner scripts set the variable.

### What is fixed and what Spike V decides

| Part | Fixed in this plan | Decided by Spike V |
|---|---|---|
| Harness adapter interface (`_TEMPLATE.md`: `TestRunContext`, `TestDefinition`, `registerTest`, `runHarness`, `runtimeScriptCommand`) | yes, unchanged | |
| `testArgs()`, `onProcessExit()`, `QUARTO_TEST_ARGS` | yes | |
| `tests/asserts.ts` on `@std/assert` 1.x | yes | |
| `tests/run-tests-node.sh`/`.ps1`: argument contract, environment, binary mode, timing format, `--agent` | yes | the one function that invokes the runner (`run_test_files`) |
| `tests/run-parallel-tests.mjs` (bucketing from timing files) | yes | |
| Self-spawning tests (`chrome-launch*`, `harness-failure-reporting`) | yes | |
| How `registerTest` reaches the runner (`node:test` `test()` or Vitest `test()`) | | Task 3 (Variant N) or Task 4 (Variant V) |
| Module resolution of import-map names on Node | | Variant N: `module.register` hook; Variant V: `resolve.alias` from the import map |
| Leak guarantees: `runChecked()` (handle check and exit guard) around every test, `sanitize` mapped onto it | yes (Task 2; the Node branches of Tasks 3 and 4 call it) | |
| Runner flags: per-test timeout (hang watchdog), force exit, serial files, JUnit | | Variant N: `--test-timeout=600000 --test-force-exit --test-concurrency=1 --test-reporter=junit`; Variant V: `testTimeout`, `teardownTimeout`, `fileParallelism: false`, `--reporter=junit` |
| `runHarness`'s Node command line | | per variant |

The executor implements Tasks 1, 2, 5–8 and **one** of Tasks 3/4 (the variant Spike V chose; the spike-closing PR deletes the other from this plan). Both are written out below so the spike prototypes from them. If `SPIKES.md` records Spike V as inconclusive with `node:test` provisional (its rule 4), implement Task 3, keep Task 4 and the Variant V bodies in this plan, keep the Vitest branch of the harness behind `process.env.VITEST` as the spike branch had it, and say so in the PR description; the spike's re-run decides whether Task 4 is deleted or swapped in before PR 32 makes the Node matrix required.

### Scope

In:
- `tests/asserts.ts` on `@std/assert` 1.x; import-map entry; `package.json` synced.
- `tests/harness.ts`: the Node branch of `registerTest` (variant), `testArgs()`, `onProcessExit()`, `runChecked()` and `sanitizeOptions()` (the Node mapping of `sanitize`). `tests/utils.ts`: Node branches of `runHarness` (variant) and `runtimeScriptCommand`.
- Variant N: `tools/node-bundle/import-map-hook.mjs`, `tools/node-bundle/register-import-map.mjs`. Variant V: `tests/vitest.config.mjs`, `vitest` in `devDependencies`.
- `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`.
- `tests/run-parallel-tests.mjs` replacing `tests/run-parallel-tests.ts`; `tests/run-parallel-tests.sh` calls it with Node; `.github/workflows/test-smokes-parallel.yml` `jobs-matrix` installs Node instead of Quarto for the bucketing step.
- `tests/test.ts`: `unload` listener → `onProcessExit`; `smoke/smoke-all.test.ts`, `integration/playwright-tests.test.ts`: `testArgs()`.
- Self-spawning tests: `tests/unit/chrome-launch-fixtures.ts` writes `.mjs` scripts on `node:` modules; `harness-failure-reporting.test.ts` guards Deno-reporter assertions.
- `.github/workflows/test-node-bundle.yml`: a `node-unit` step runs the harness tests through `run-tests-node.sh`; `tests/README.md` "Running on Node".

Out:
- Strip-only syntax cleanup and `check-ts-syntax.mjs` (PR 02b).
- Full-suite Node parity, macOS jobs, required status (PR 32).
- Type checking on Node (`tsc` arrives with PR 33/38).
- A Node equivalent of everything Deno's sanitizers see. Neither runner has sanitizers; `runChecked()` keeps the detection this migration depends on (children, listening servers, timers, `exit()`), and open file descriptors, client sockets and pending fs operations are intentionally lost on Node ("Leak guarantees", Interfaces).

### Interfaces

Unchanged from `_TEMPLATE.md` ("Test harness"): `TestRunContext`, `SanitizeOptions`, `TestDefinition`, `registerTest`, `runHarness`, `runtimeScriptCommand`. Added to `tests/harness.ts`:

```ts
/** Positional test arguments: args() after "--" (Deno: `deno test file -- a b`), else QUARTO_TEST_ARGS
 *  split on "\n" (set by run-tests-node.sh, run-tests-node.ps1 and runHarness on Node). */
export function testArgs(): string[];
/** Runs `handler` once when the test process exits (Deno: "unload" event; Node: process "exit"). */
export function onProcessExit(handler: () => void): void;
```

#### Leak guarantees

Four events, one mechanism each; no mechanism is described as another (R13).

| Event | Deno (`run-tests.sh`) | Node (`run-tests-node.sh`, both variants) | Result |
|---|---|---|---|
| A test does not settle (awaits something that never resolves while a handle keeps the loop alive) | nothing, the run hangs | the per-test timeout: `--test-timeout` / `testTimeout`, `QUARTO_TEST_TIMEOUT` ms, default 600000 | the test fails as timed out (`test timed out after 2000ms` with a 2 s limit), the next tests and files run, exit 1. A watchdog for hangs, not leak detection. |
| A test ends with a handle it opened still open: a child process (`ProcessWrap`), a listening server (`TCPServerWrap`, `PipeServerWrap`), a timer or immediate (`Timeout`, `Immediate`) | `sanitizeResources` (children, servers), `sanitizeOps` (timers) | `runChecked()` in `registerTest`: `process.getActiveResourcesInfo()` counted per kind before the test and two `setImmediate` turns after it (handles are released in the loop's close phase: a child that exited or a server whose `close` callback ran still counts for up to two turns, measured on Node 22.22) | the test fails naming the kinds that grew (`left handles open: ProcessWrap +1`), exit 1 |
| A test calls `exit()` | `sanitizeExit` | the exit guard in `runChecked()`: `process.exit` replaced for the test's duration by a function that throws (PR 28's `exit()` calls `process.exit` synchronously, so it is caught; without the guard `node:test` reports a file whose test called `process.exit(0)` as passed and never runs the tests after it, exit 0, checked on Node 22.22) | the test fails (`attempted to exit with code 0`) |
| The file's last test is done and a handle is still open (an opted-out test, module-level code, a library's pooled socket) | Deno's runner exits | `--test-force-exit` (Variant N) / the forked worker is terminated when its file is done (Variant V; Spike V confirms) | the process ends, nothing is reported, the exit code follows the test results. Bounds the run; detects nothing. |

`sanitize` maps onto the check: `resources: false` drops the child and server kinds, `ops: false` the timer kinds, `exit: false` the exit guard, `sanitize: false` all three; `undefined` checks everything, as Deno's defaults do. The existing opt-outs (`tests/smoke/extensions/install.test.ts`, PR 14b's process tests with `{ resources: false, ops: false }`) mean the same thing on both runtimes, and a test that passes Deno's sanitizers passes the check unless it relies on something listed below.

Intentionally lost on Node (Deno's sanitizers see them, `getActiveResourcesInfo()` does not): open file descriptors (an `FsFile` not closed is not a libuv handle), client sockets (`TCPSocketWrap`: `fetch` keeps its connection pooled for about 4 s after the response on Node 22.22, so counting them would fail every test that fetches), and pending fs operations (`FSReqCallback`). The tests that own files and client connections close them explicitly, as PR 16's and PR 29's tests already do for Deno's sanitizer. `process.getActiveResourcesInfo()` is Stability 1 (experimental; in Node since 17.3): when it is missing the check is skipped with one warning per file and the `harness-node.test.ts` leak case fails, which is the signal to reimplement the count on `async_hooks`.

`runHarness` on Node (variant-specific command line, same options and result):

- Variant N: `node --import <root>/tools/node-bundle/register-import-map.mjs --enable-experimental-regexp-engine [flags] --test --test-concurrency=1 --test-force-exit --test-timeout=600000 --test-reporter=spec --test-reporter-destination=stdout [--test-reporter=junit --test-reporter-destination=<junitPath>] <file>`.
- Variant V: `<root>/node_modules/.bin/vitest run --config <root>/tests/vitest.config.mjs --reporter=default [--reporter=junit --outputFile.junit=<junitPath>] <file>`.
- Both: `--no-check`/`--check` are dropped from `flags`; `args` go to `QUARTO_TEST_ARGS`; `cwd` must be `tests/`.

`runtimeScriptCommand` on Node: `{ cmd: execPath(), args: [scriptPath] }` (the script is an `.mjs` on `node:` modules only).

`tests/run-parallel-tests.mjs`: `node run-parallel-tests.mjs [-n=<buckets>] [--timing-file=timing.txt] [--json-for-ci] [--dry-run] [--verbose] [--runner=deno|node]`; same output as the Deno script it replaces (the JSON array of buckets in `--json-for-ci` mode; buckets of `{ name, timing }` in `--dry-run`); without either, runs `./run-tests.sh` (or `./run-tests-node.sh` with `--runner=node`) per bucket in parallel.

### Files

- Modify: `tests/asserts.ts`, `src/import_map.json`, `package.json`, `package-lock.json`
- Modify: `tests/harness.ts`, `tests/utils.ts`, `tests/test.ts`, `tests/smoke/smoke-all.test.ts`, `tests/integration/playwright-tests.test.ts`
- Create (Variant N): `tools/node-bundle/import-map-hook.mjs`, `tools/node-bundle/register-import-map.mjs`, `tools/node-bundle/import-map-hook.test.mjs`
- Create (Variant V): `tests/vitest.config.mjs`; modify `package.json` (`devDependencies.vitest`)
- Create: `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`, `tests/run-parallel-tests.mjs`
- Delete: `tests/run-parallel-tests.ts`; modify `tests/run-parallel-tests.sh`, `.github/workflows/test-smokes-parallel.yml` (`jobs-matrix`)
- Modify: `tests/unit/chrome-launch-fixtures.ts`, `tests/unit/chrome-launch.test.ts`, `tests/unit/chrome-launch-flags.test.ts`, `tests/unit/harness-failure-reporting.test.ts`
- Modify: `.github/workflows/test-node-bundle.yml` (`node-unit` job), `tests/README.md`
- Test: `tests/unit/harness-node.test.ts` (new)

### Acceptance criteria

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts` exits 0; `./run-tests-node.sh --agent unit/ral/` fails only on tests listed for Linux in `tools/node-bundle/known-failures.json` (compare by name in the output).
- `cd tests && ./run-tests-node.sh docs/smoke-all/2023/02/08/4272.qmd` runs `smoke-all.test.ts` on that document on Node.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-node.test.ts unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/smoke-all-prerender-isolation.test.ts` passes on Deno (unchanged behaviour).
- `cd tests && ./run-tests-node.sh --agent unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts` passes on Node.
- `cd tests && node run-parallel-tests.mjs -n=20 --json-for-ci --timing-file=timing-for-ci.txt` prints the same JSON bucket structure as `quarto run run-parallel-tests.ts -n=20 --json-for-ci --timing-file=timing-for-ci.txt` on `main` (bucket contents differ only where the Deno script placed untimed tests at random).
- A test that does not settle fails as timed out after the per-test timeout (`QUARTO_TEST_TIMEOUT=2000` in the example) and the run goes on, exit 1 (Task 5 step 3, `zz-hang`).
- A test that leaves a child process, a listening server or a timer open fails on Node naming the handle kind, and a test that calls `exit()` fails, as the four do on Deno through its sanitizers; `sanitize: false` opts a test out on both runtimes (`harness-node.test.ts`, Task 2; Task 5 step 3, `zz-child`, `zz-timer`).
- A file whose last test left a handle open while opted out still ends, with exit 0 and nothing reported: the forced exit bounds the run and detects nothing (Task 5 step 3, `zz-opted-out`).
- `quarto run --dev tools/check-runtime-boundary.ts` stays at zero in `src` and goes down in `tests` (the `.ts` bucketing script with its std imports is gone).

## Plan

### Task 1: `tests/asserts.ts` on `@std/assert`

**Files:**
- Modify: `src/import_map.json`, `package.json`, `package-lock.json`, `tests/asserts.ts`

- [ ] **Step 1: Add the import-map entry**

In `src/import_map.json`: `"@std/assert": "jsr:@std/assert@1.0.19",` (1.0.19 is the latest 1.0.x on 2026-10-15; pin the latest 1.0.x listed at https://jsr.io/@std/assert at execution time). Then:

```bash
node tools/node-bundle/check-deps.mjs --write && npm install && node tools/node-bundle/check-deps.mjs
```
Expected: `package.json dependencies match src/import_map.json (N packages)`.

- [ ] **Step 2: Point the seam at `@std/assert`**

PR 02 created `tests/asserts.ts` re-exporting from `testing/asserts` (`jsr:@std/testing@0.224.0/asserts`, itself a re-export of `@std/assert`). Change only the module specifier, keeping every exported name (`grep -n "^  [a-zA-Z]" tests/asserts.ts` before editing):

```ts
} from "@std/assert";
```

and the header comment's last sentence to: "Assertions come from @std/assert 1.x on both runtimes (resolved through the import map on Deno, and through the PR 31 resolver on Node)."

**Decision recorded here:** `@std/assert`, not `node:assert/strict`. `assertEquals` uses `@std/assert`'s structural `equal` (consistent `+0`/`-0` and `NaN`, `Date`/`RegExp`/`Map`/`Set`/typed arrays by value, prototypes ignored for plain objects) and throws `AssertionError` with a diff; `node:assert.deepStrictEqual` differs on prototypes and typed-array wrappers, and `assertStringIncludes`, `assertMatch`, `assertObjectMatch`, `assertRejects`, `fail` have no direct equivalents. Tests that match assertion message text keep matching (same code lineage).

- [ ] **Step 3: Run a sample on Deno**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/asserts.test.ts unit/path.test.ts unit/text.test.ts $(find unit/ral/ -name '*.test.ts')`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/import_map.json package.json package-lock.json tests/asserts.ts
git commit -m "tests: assertions from @std/assert 1.x"
```

### Task 2: Runner-independent harness parts

**Files:**
- Create: `tests/unit/harness-node.test.ts`
- Modify: `tests/harness.ts`, `tests/utils.ts`, `tests/test.ts`, `tests/smoke/smoke-all.test.ts`, `tests/integration/playwright-tests.test.ts`

- [ ] **Step 1: Write the failing test (runner-independent cases)**

```ts
/*
 * harness-node.test.ts
 *
 * The harness adapter on both runtimes and both Node runners: testArgs()
 * sources, ignore -> skip, step() results, runHarness on the current runtime.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assert, assertEquals, assertStringIncludes } from "../asserts.ts";
import { registerTest, testArgs } from "../harness.ts";
import { runHarness } from "../utils.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import { readTextFileSync, removeSync, writeTextFileSync } from "../../src/deno_ral/fs.ts";
import { cwd } from "../../src/deno_ral/process.ts";
import { runtime } from "../../src/deno_ral/platform.ts";

// Tests run with cwd = tests/ (run-tests.sh, run-tests-node.sh); import.meta.url
// is not used to find it so the file also works inside a bundle (PR 26 job).
const testsDir = cwd();

unitTest("harness - testArgs returns the positional arguments or QUARTO_TEST_ARGS", async () => {
  // Under run-tests.sh with no "--" arguments, and under run-tests-node.sh with
  // QUARTO_TEST_ARGS unset, the list is empty for this file.
  assertEquals(testArgs(), []);
});

let ignoredRan = false;
registerTest({ name: "[unit] > harness - ignored test never runs", ignore: true, fn: () => { ignoredRan = true; } });
unitTest("harness - ignore maps to skip on every runner", async () => {
  assertEquals(ignoredRan, false);
});

registerTest({
  name: "[unit] > harness - origin and step results on every runner",
  fn: async (ctx) => {
    assert(ctx.origin.startsWith("file://") && ctx.origin.endsWith("harness-node.test.ts"), ctx.origin);
    assertEquals(await ctx.step("passes", () => {}), true);
    assertEquals(await ctx.step("ignored", () => { throw new Error("never"); }, { ignore: true }), false);
  },
});

unitTest("harness - runHarness runs a child test file, passes arguments and reports its exit code", async () => {
  const dir = makeTempDirSync({ prefix: "rt31-harness-" });
  const file = join(dir, "child.test.ts");
  // file: URLs resolve identically on Deno and Node (and on Windows).
  const harnessUrl = toFileUrl(join(testsDir, "harness.ts")).href;
  const fsUrl = toFileUrl(join(testsDir, "..", "src", "deno_ral", "fs.ts")).href;
  writeTextFileSync(file, [
    `import { registerTest, testArgs } from ${JSON.stringify(harnessUrl)};`,
    `import { writeTextFileSync } from ${JSON.stringify(fsUrl)};`,
    `registerTest({ name: "child passes", fn: () => { writeTextFileSync(${JSON.stringify(join(dir, "args.txt"))}, testArgs().join("|")); } });`,
    `registerTest({ name: "child fails", fn: () => { throw new Error("child boom"); } });`,
  ].join("\n"));
  const junit = join(dir, "junit.xml");
  const result = await runHarness({ file, cwd: testsDir, flags: ["--no-check"], args: ["docs/a.qmd", "docs/b c.qmd"], junitPath: junit });
  assertEquals(result.code, 1);
  assertEquals(readTextFileSync(join(dir, "args.txt")), "docs/a.qmd|docs/b c.qmd");
  assertStringIncludes(result.stdout + result.stderr, "child boom");
  const xml = readTextFileSync(junit);
  assertStringIncludes(xml, "child passes");
  assertStringIncludes(xml, "child fails");
  removeSync(dir, { recursive: true });
});

// Leak guarantees (Spec): the same child file fails on Deno through its
// sanitizers and on Node through runChecked(); only the messages differ.
function junitOutcomes(xml: string): Map<string, "passed" | "failed"> {
  const outcomes = new Map<string, "passed" | "failed">();
  for (const m of xml.matchAll(/<testcase\b[^>]*\bname="([^"]*)"[^>]*?(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    outcomes.set(m[1], /<(failure|error)\b/.test(m[2] ?? "") ? "failed" : "passed");
  }
  return outcomes;
}

unitTest("harness - a test that leaves a child, a server or a timer open fails, as does one that calls exit(); sanitize: false opts out", async () => {
  const dir = makeTempDirSync({ prefix: "rt31-leaks-" });
  const file = join(dir, "leaks.test.ts");
  const harnessUrl = toFileUrl(join(testsDir, "harness.ts")).href;
  const processUrl = toFileUrl(join(testsDir, "..", "src", "deno_ral", "process.ts")).href;
  const netUrl = toFileUrl(join(testsDir, "..", "src", "deno_ral", "net.ts")).href;
  const httpUrl = toFileUrl(join(testsDir, "..", "src", "deno_ral", "http.ts")).href;
  writeTextFileSync(file, [
    `import { registerTest } from ${JSON.stringify(harnessUrl)};`,
    `import { execPath, exit, spawn } from ${JSON.stringify(processUrl)};`,
    `import { findOpenPort } from ${JSON.stringify(netUrl)};`,
    `import { serveHttp } from ${JSON.stringify(httpUrl)};`,
    // The child ends by itself: the forced exit of the test process would orphan it otherwise.
    `registerTest({ name: "leaks a child", fn: () => { spawn(execPath(), { args: ["-e", "setTimeout(() => {}, 5000)"] }); } });`,
    `registerTest({ name: "leaks a server", fn: async () => { await serveHttp({ port: await findOpenPort(), hostname: "127.0.0.1", handler: () => new Response("x"), onListen: () => {} }).listening; } });`,
    `registerTest({ name: "leaks a timer", fn: () => { setInterval(() => {}, 1000); } });`,
    `registerTest({ name: "calls exit", fn: () => { exit(0); } });`,
    `registerTest({ name: "opted out", sanitize: false, fn: () => { setInterval(() => {}, 1000); } });`,
    `registerTest({ name: "closes what it opens", fn: async () => { clearTimeout(setTimeout(() => {}, 1000)); const s = serveHttp({ port: await findOpenPort(), hostname: "127.0.0.1", handler: () => new Response("x"), onListen: () => {} }); await s.listening; await s.shutdown(); } });`,
  ].join("\n"));
  const junit = join(dir, "junit.xml");
  const result = await runHarness({ file, cwd: testsDir, flags: ["--no-check"], junitPath: junit });
  assertEquals(result.code, 1);
  const outcomes = junitOutcomes(readTextFileSync(junit));
  assertEquals(outcomes.size, 6, [...outcomes.keys()].join(", "));
  for (const name of ["leaks a child", "leaks a server", "leaks a timer", "calls exit"]) assertEquals(outcomes.get(name), "failed", name);
  for (const name of ["opted out", "closes what it opens"]) assertEquals(outcomes.get(name), "passed", name);
  if (runtime().name === "node") {
    const out = result.stdout + result.stderr;
    for (const text of ["ProcessWrap +1", "TCPServerWrap +1", "Timeout +1", "attempted to exit with code 0"]) assertStringIncludes(out, text);
  }
  removeSync(dir, { recursive: true });
});
```

(On Deno the four failures are the sanitizers' own: `leaking async ops`, `leaking resources`, `attempted to exit`. The file still ends on both runtimes: Deno's runner exits after the last test; on Node the "opted out" interval is what the forced exit is for.)

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-node.test.ts`
Expected: fails on `testArgs` not exported from `tests/harness.ts`.

- [ ] **Step 3: `testArgs`, `onProcessExit` and the Node `runtimeScriptCommand`**

Append to `tests/harness.ts` (keep PR 23's types and Deno body; add the imports the file lacks):

```ts
import { runtime } from "../src/deno_ral/platform.ts";
import { args } from "../src/deno_ral/process.ts";
import { env } from "../src/deno_ral/env.ts";

const isNode = runtime().name === "node";

// Positional test arguments. `deno test file -- a b` puts them after "--";
// node --test and vitest run have no positional channel, so run-tests-node.sh
// and runHarness pass them in QUARTO_TEST_ARGS (newline-separated).
export function testArgs(): string[] {
  const positional = args();
  const dash = positional.indexOf("--");
  const fromArgs = dash === -1 ? (isNode ? [] : positional) : positional.slice(dash + 1);
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

// Leak guarantees (Spec). Node has no test sanitizers; the Node branches of
// registerTest (Task 3 or 4) run every test through runChecked(), which maps
// Deno's three sanitizers onto what Node can see: libuv handles counted by
// kind before and after the test (children, listening servers, timers) and a
// guard on process.exit. Handles are released in the loop's close phase, so
// the count after the test waits two setImmediate turns. Open files, client
// sockets and pending fs operations are not handles and are not detected.
import { setImmediate } from "node:timers";

const kResourceKinds = ["ProcessWrap", "TCPServerWrap", "PipeServerWrap"];
const kOpKinds = ["Timeout", "Immediate"];
const activeResources: (() => string[]) | undefined =
  (process as { getActiveResourcesInfo?: () => string[] }).getActiveResourcesInfo;
let warnedNoHandleCheck = false;

/** PR 23's boolean-or-object normalisation, shared by the Deno branch and runChecked(). */
export function sanitizeOptions(def: TestDefinition): SanitizeOptions {
  return typeof def.sanitize === "boolean"
    ? { resources: def.sanitize, ops: def.sanitize, exit: def.sanitize }
    : def.sanitize ?? {};
}

function countHandles(kinds: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const kind of activeResources!()) {
    if (kinds.includes(kind)) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return counts;
}

export async function runChecked(def: TestDefinition, fn: () => Promise<void> | void): Promise<void> {
  const sanitize = sanitizeOptions(def);
  const kinds = [
    ...(sanitize.resources === false ? [] : kResourceKinds),
    ...(sanitize.ops === false ? [] : kOpKinds),
  ];
  if (kinds.length > 0 && activeResources === undefined && !warnedNoHandleCheck) {
    warnedNoHandleCheck = true;
    console.warn("harness: process.getActiveResourcesInfo() is missing on this Node; handles left open are not detected");
  }
  const before = kinds.length > 0 && activeResources ? countHandles(kinds) : undefined;
  const realExit = process.exit;
  if (sanitize.exit !== false) {
    process.exit = ((code?: number) => {
      throw new Error(`Test "${def.name}" attempted to exit with code ${code ?? 0}`);
    }) as typeof process.exit;
  }
  try {
    await fn();
  } finally {
    process.exit = realExit;
  }
  if (before === undefined) return;
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  const after = countHandles(kinds);
  const leaked = kinds
    .filter((k) => (after.get(k) ?? 0) > (before.get(k) ?? 0))
    .map((k) => `${k} +${(after.get(k) ?? 0) - (before.get(k) ?? 0)}`);
  if (leaked.length > 0) {
    throw new Error(
      `Test "${def.name}" left handles open: ${leaked.join(", ")} ` +
        "(a child process, listening server or timer was not closed; sanitize: { resources: false } or { ops: false } opts out, as on Deno)",
    );
  }
}
```

In PR 23's `registerTest`, replace the inline boolean-or-object computation of `sanitize` with `const sanitize = sanitizeOptions(def);` (same result; the Deno branch is otherwise unchanged).

(On Node, `args()` without `--` holds the runner's own arguments, not test arguments, hence the `isNode` guard. `process` is a global on both runtimes. The body of `runChecked` with the six cases of Step 1 was run on Node 22.22 under `node --test --test-force-exit`: the four leaking tests fail with the messages above, the two others pass.)

In `tests/utils.ts`, give `runtimeScriptCommand` its Node branch (PR 23's Deno branch plus the two read/env permissions the `.mjs` scripts below need):

```ts
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

(import `runtime` from `../src/deno_ral/platform.ts`.)

- [ ] **Step 4: Wire `test.ts`, `smoke-all.test.ts`, `playwright-tests.test.ts`**

- `tests/test.ts`: replace `globalThis.addEventListener("unload", () => {` with `onProcessExit(() => {` (import `onProcessExit` from `./harness.ts`).
- `tests/smoke/smoke-all.test.ts`: replace its read of the positional arguments (`args()` after PR 23, `Deno.args` on `main`) with `testArgs()` from `../harness.ts`.
- `tests/integration/playwright-tests.test.ts`: `const globOutput = testArgs().length ? expandGlobSync(testArgs()[0]) : expandGlobSync("docs/playwright/!(serve|shiny)/**/*.qmd");`.
- `grep -rn "Deno\.args\|[^a-zA-Z]args()" tests --include=*.ts | grep -v "tests/docs/"` → only `tests/harness.ts` (inside `testArgs`) and files that read their own process arguments as scripts (none expected); convert any other test file to `testArgs()`.

- [ ] **Step 5: Run on Deno**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness.test.ts unit/harness-failure-reporting.test.ts docs/smoke-all/2023/02/08/4272.qmd`
Expected: green; `harness-node.test.ts` still fails its two `runHarness` cases until a variant's `runHarness` Node branch exists (the Deno branch passes them: run `./run-tests.sh --agent unit/harness-node.test.ts` and expect all five green on Deno, the leak case through Deno's own sanitizers).

- [ ] **Step 6: Commit**

```bash
git add tests/harness.ts tests/utils.ts tests/test.ts tests/smoke/smoke-all.test.ts tests/integration/playwright-tests.test.ts tests/unit/harness-node.test.ts
git commit -m "tests/harness: testArgs, onProcessExit, runtimeScriptCommand on Node"
```

### Task 3 (Variant N, decided by Spike V): `node:test`

Implement this task only if Spike V chose `node:test`.

**Files:**
- Create: `tools/node-bundle/import-map-hook.mjs`, `tools/node-bundle/register-import-map.mjs`, `tools/node-bundle/import-map-hook.test.mjs`
- Modify: `tests/harness.ts` (`registerTest` Node branch), `tests/utils.ts` (`runHarness` Node branch)

- [ ] **Step 1: Write the failing hook test**

```js
// tools/node-bundle/import-map-hook.test.mjs
// Copyright (C) 2026 Posit Software, PBC
import { test } from "node:test";
import assert from "node:assert/strict";
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
    "--no-warnings", "--import", path.join(root, "tools", "node-bundle", "register-import-map.mjs"), file,
  ], { encoding: "utf8", cwd: root });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /hook-ok function true/);
  fs.rmSync(dir, { recursive: true });
});
```

Run: `node --test tools/node-bundle/import-map-hook.test.mjs`
Expected: fails with `Cannot find module '.../register-import-map.mjs'`.

- [ ] **Step 2: Implement the hook**

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
// stripping (default in Node 26). Imports from inside node_modules are left
// to Node.
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

Run: `node --test tools/node-bundle/import-map-hook.test.mjs`
Expected: `# pass 1` (after Task 1 put `@std/assert` in the import map and `node_modules`).

- [ ] **Step 3: `registerTest` on `node:test`**

In `tests/harness.ts`, below the Task 2 additions:

```ts
import { pathToFileURL } from "node:url";

// node:test is loaded only on Node so the Deno build never imports it.
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
  if (nodeTest) {
    nodeTest(def.name, { skip: def.ignore === true }, (t) => {
      const origin = t.filePath ? pathToFileURL(t.filePath).href : "";
      // Leak guarantees (Spec): the handle check and exit guard around the test.
      return runChecked(def, () => def.fn(nodeContext(t, origin)));
    });
    return;
  }
```

- [ ] **Step 4: `runHarness` on `node:test`**

In `tests/utils.ts`, the Node branch of PR 23's `runHarness` (the Deno branch is unchanged):

```ts
  if (runtime().name === "node") {
    const quartoRoot = dirname(options.cwd);
    const nodeFlags = (options.flags ?? []).filter((f) => f !== "--no-check" && f !== "--check");
    const cmdArgs = [
      "--no-warnings",
      "--import",
      join(quartoRoot, "tools", "node-bundle", "register-import-map.mjs"),
      "--enable-experimental-regexp-engine",
      ...nodeFlags,
      "--test",
      "--test-concurrency=1",
      "--test-force-exit",
      "--test-timeout=600000",
      "--test-reporter=spec",
      "--test-reporter-destination=stdout",
      ...(options.junitPath ? ["--test-reporter=junit", `--test-reporter-destination=${options.junitPath}`] : []),
      options.file,
    ];
    const childEnv: Record<string, string> = { ...(options.env ?? {}) };
    if (options.args && options.args.length > 0) childEnv.QUARTO_TEST_ARGS = options.args.join("\n");
    const result = await exec(execPath(), { args: cmdArgs, cwd: options.cwd, env: childEnv, stdout: "piped", stderr: "piped" });
    const decoder = new TextDecoder();
    return { stdout: decoder.decode(result.stdout), stderr: decoder.decode(result.stderr), code: result.code };
  }
```

- [ ] **Step 5: Run on Node**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true node --no-warnings --import ../tools/node-bundle/register-import-map.mjs --test --test-concurrency=1 --test-force-exit unit/harness-node.test.ts unit/path.test.ts
```
Expected: `# pass` covers the five harness cases and the path tests, `# fail 0` (the leak case's own child file fails four of its six tests; that is what the case asserts).

- [ ] **Step 6: Commit**

```bash
git add tools/node-bundle/import-map-hook.mjs tools/node-bundle/register-import-map.mjs tools/node-bundle/import-map-hook.test.mjs tests/harness.ts tests/utils.ts
git commit -m "tests/harness: node:test registration and runHarness on Node (Spike V: node:test)"
```

### Task 4 (Variant V, decided by Spike V): Vitest

Implement this task only if Spike V chose Vitest.

**Files:**
- Create: `tests/vitest.config.mjs`
- Modify: `package.json`, `package-lock.json` (`devDependencies.vitest`, the exact version Spike V recorded)
- Modify: `tests/harness.ts` (`registerTest` Vitest branch), `tests/utils.ts` (`runHarness` Vitest branch)

- [ ] **Step 1: Install and configure**

Run: `npm install --save-dev --save-exact vitest@<version recorded in SPIKES.md, Spike V results>`

```js
// tests/vitest.config.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Vitest configuration for running tests/ on Node (PR 31, Variant V).
// Import-map names resolve through tools/node-bundle/import-map.mjs; files run
// one at a time in forked processes (GitHub grouping in tests/test.ts assumes
// serial files).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadImportMap, resolveBare } from "../tools/node-bundle/import-map.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const map = loadImportMap(root);

const importMapPlugin = {
  name: "quarto-import-map",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (/^(\.\.?\/|\/|[a-zA-Z]:[\\/]|file:|node:|data:|virtual:|\0)/.test(source)) return null;
    if (importer && importer.includes("/node_modules/")) return null;
    let r;
    try {
      r = resolveBare(source, map);
    } catch (e) {
      this.error(e.message);
    }
    if (r.external || r.target === source) return null;
    return this.resolve(r.target, path.join(root, "package.json"), { ...options, skipSelf: true });
  },
};

export default defineConfig({
  plugins: [importMapPlugin],
  test: {
    root: path.join(root, "tests"),
    include: ["**/*.test.ts"],
    exclude: ["integration/playwright/**", ".venv/**", "node_modules/**", "docs/**"],
    pool: "forks",
    poolOptions: {
      forks: { execArgv: ["--enable-experimental-regexp-engine", "--max-old-space-size=8192", "--stack-trace-limit=100"] },
    },
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 600_000,
    teardownTimeout: 10_000,
  },
});
```

- [ ] **Step 2: `registerTest` on Vitest**

In `tests/harness.ts`, below the Task 2 additions:

```ts
import { pathToFileURL } from "node:url";

type VitestContext = { task: { file?: { filepath?: string } } };
type VitestTestFn = (name: string, options: { skip?: boolean }, fn: (ctx: VitestContext) => Promise<void>) => void;
let vitestTest: VitestTestFn | undefined;
if (isNode && env.get("VITEST")) {
  // A non-literal specifier keeps `deno check` from resolving "vitest".
  const vitestModule = "vitest";
  vitestTest = (await import(vitestModule)).test as VitestTestFn;
}

// Vitest has no nested tests: steps run inline; a failed step fails the
// test at its end, like Deno's t.step.
function vitestContext(origin: string, failures: unknown[]): TestRunContext {
  return {
    origin,
    step: async (_name, fn, options) => {
      if (options?.ignore) return false;
      try {
        await fn(vitestContext(origin, failures));
        return true;
      } catch (e) {
        failures.push(e);
        return false;
      }
    },
  };
}
```

At the top of PR 23's `registerTest`:

```ts
  if (vitestTest) {
    vitestTest(def.name, { skip: def.ignore === true }, async (ctx) => {
      const origin = ctx.task.file?.filepath ? pathToFileURL(ctx.task.file.filepath).href : "";
      const failures: unknown[] = [];
      // Leak guarantees (Spec): the handle check and exit guard around the test.
      await runChecked(def, () => def.fn(vitestContext(origin, failures)));
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) throw new AggregateError(failures, `${failures.length} steps failed`);
    });
    return;
  }
```

- [ ] **Step 3: `runHarness` on Vitest**

In `tests/utils.ts`, the Node branch of `runHarness`:

```ts
  if (runtime().name === "node") {
    const quartoRoot = dirname(options.cwd);
    const file = resolve(options.cwd, options.file);
    const cmdArgs = [
      join(quartoRoot, "node_modules", "vitest", "vitest.mjs"),
      "run",
      "--config",
      join(quartoRoot, "tests", "vitest.config.mjs"),
      // Scan the file's own directory: a child file outside tests/ (a temp
      // fixture) is not under the configured root.
      "--dir",
      dirname(file),
      "--reporter=default",
      ...(options.junitPath ? ["--reporter=junit", `--outputFile.junit=${options.junitPath}`] : []),
      file,
    ];
    const childEnv: Record<string, string> = { ...(options.env ?? {}) };
    if (options.args && options.args.length > 0) childEnv.QUARTO_TEST_ARGS = options.args.join("\n");
    const result = await exec(execPath(), { args: cmdArgs, cwd: options.cwd, env: childEnv, stdout: "piped", stderr: "piped" });
    const decoder = new TextDecoder();
    return { stdout: decoder.decode(result.stdout), stderr: decoder.decode(result.stderr), code: result.code };
  }
```

(`flags` are runtime flags for the Deno command line; Vitest takes its Node flags from `poolOptions.forks.execArgv`, so they are not forwarded. `resolve` comes from `../src/deno_ral/path.ts`.)

- [ ] **Step 4: Run on Node**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ../node_modules/.bin/vitest run --config vitest.config.mjs unit/harness-node.test.ts unit/path.test.ts`
Expected: all tests pass; the ignored test is reported as skipped.

- [ ] **Step 5: Commit**

```bash
git add tests/vitest.config.mjs package.json package-lock.json tests/harness.ts tests/utils.ts
git commit -m "tests/harness: Vitest registration and runHarness on Node (Spike V: Vitest)"
```

### Task 5: `run-tests-node.sh` and `run-tests-node.ps1`

**Files:**
- Create: `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`

- [ ] **Step 1: Write the bash runner**

The script is runner-independent except `run_test_files`; the block below carries Variant N's body, and the Variant V body follows it.

```bash
#!/usr/bin/env bash
# tests/run-tests-node.sh
# Copyright (C) 2026 Posit Software, PBC
#
# Runs the test suite on Node 26 (runner chosen by Spike V, see
# dev-docs/runtime-migration/31-test-harness-on-node.md). Same arguments and
# environment as run-tests.sh. See tests/README.md "Running on Node".
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  SCRIPT_PATH="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$SCRIPT_PATH/$SOURCE"
done
export SCRIPT_PATH="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"

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

export QUARTO_ROOT="$(cd "$SCRIPT_PATH/.." > /dev/null 2>&1 && pwd)"
export QUARTO_BIN_PATH="$QUARTO_ROOT/package/dist/bin"
export QUARTO_SHARE_PATH="$(cd "$QUARTO_ROOT/src/resources/"; pwd)"
export QUARTO_DEBUG=true
NODE="${QUARTO_NODE:-node}"

if [ ! -d "$QUARTO_ROOT/node_modules" ]; then
  echo "ERROR: $QUARTO_ROOT/node_modules missing; run 'npm ci' in $QUARTO_ROOT"
  exit 1
fi

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

all_tests() {
  find . -name '*.test.ts' -not -path './integration/playwright/*' -not -path './.venv/*' -not -path './node_modules/*' | sort
}

# ---- Variant N (node:test). Replace with the Variant V body when Spike V chose Vitest.
# $1: newline-separated QUARTO_TEST_ARGS (may be empty); rest: test files.
# QUARTO_TEST_JUNIT=<path> adds a JUnit report (single invocations only; PR 32).
# QUARTO_TEST_TIMEOUT=<ms> is the per-test timeout (default 600000; a hang watchdog,
# see "Leak guarantees" in the plan). --test-force-exit ends the file's process
# after its last test whatever is still open.
run_test_files() {
  local test_args="$1"; shift
  local reporter=(--test-reporter=spec --test-reporter-destination=stdout)
  [[ "$AGENT_MODE" == "true" ]] && reporter=(--test-reporter=dot --test-reporter-destination=stdout)
  local junit=()
  [[ -n "$QUARTO_TEST_JUNIT" ]] && junit=(--test-reporter=junit "--test-reporter-destination=$QUARTO_TEST_JUNIT")
  QUARTO_TEST_ARGS="$test_args" "$NODE" --no-warnings \
    --import "$QUARTO_ROOT/tools/node-bundle/register-import-map.mjs" \
    --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 \
    --test --test-concurrency=1 --test-force-exit "--test-timeout=${QUARTO_TEST_TIMEOUT:-600000}" \
    "${reporter[@]}" "${junit[@]}" "$@"
}
# ---- end of the runner-specific part

if [ "$QUARTO_TEST_TIMING" != "" ] && [ "$QUARTO_TEST_TIMING" != "false" ]; then
  if [ "$QUARTO_TEST_TIMING" == "true" ]; then QUARTO_TEST_TIMING="timing.txt"; fi
  echo "> Running tests with timing and writing to ${QUARTO_TEST_TIMING}"
  rm -f "$QUARTO_TEST_TIMING"
  FILES=("$@")
  if [ "${#FILES[@]}" -eq 0 ]; then mapfile -t FILES < <(all_tests); fi
  for i in "${FILES[@]}"; do
    if [ "$i" == "$SMOKE_ALL_TEST_FILE" ]; then
      while IFS= read -r j; do
        echo "${SMOKE_ALL_TEST_FILE} -- ${j}" >> "$QUARTO_TEST_TIMING"
        export -f run_test_files; export NODE QUARTO_ROOT AGENT_MODE
        /usr/bin/time -f "        %e real %U user %S sys" -a -o "${QUARTO_TEST_TIMING}" \
          bash -c 'run_test_files "$0" "$1"' "$j" "$SMOKE_ALL_TEST_FILE"
      done < <(find docs/smoke-all/ -type f -regextype "posix-extended" -regex ".*/[^_][^/]*[.](qmd|md|ipynb)")
      continue
    fi
    echo "$i" >> "$QUARTO_TEST_TIMING"
    export -f run_test_files; export NODE QUARTO_ROOT AGENT_MODE
    /usr/bin/time -f "        %e real %U user %S sys" -a -o "$QUARTO_TEST_TIMING" bash -c 'run_test_files "" "$0"' "$i"
  done
  grep -q 'Command exited with non-zero status' "$QUARTO_TEST_TIMING" && SUCCESS=1 || SUCCESS=0
else
  if [[ "$1" =~ smoke-all\.test\.ts ]]; then
    shift
    [[ "$1" == "--" ]] && shift
    run_test_files "$(printf '%s\n' "$@")" "$SMOKE_ALL_TEST_FILE"
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
      run_test_files "$(printf '%s\n' "${SMOKE_ALL_FILES[@]}")" "$SMOKE_ALL_TEST_FILE"
      SUCCESS=$?
    else
      if [[ -n "$QUARTO_TEST_BIN" && "${#TESTS_TO_RUN[@]}" -eq 0 ]]; then
        TESTS_TO_RUN=("smoke/")
        echo "> BINARY MODE: defaulting to smoke/ tests"
      fi
      FILES=()
      if [ "${#TESTS_TO_RUN[@]}" -eq 0 ]; then
        mapfile -t FILES < <(all_tests)
      else
        for t in "${TESTS_TO_RUN[@]}"; do
          if [ -d "$t" ]; then
            while IFS= read -r f; do FILES+=("$f"); done < <(find "$t" -name '*.test.ts' -not -path '*/node_modules/*' | sort)
          else
            FILES+=("$t")
          fi
        done
      fi
      run_test_files "" "${FILES[@]}"
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

Variant V body of `run_test_files` (Vitest takes its V8 flags from `poolOptions.forks.execArgv` in `tests/vitest.config.mjs`):

```bash
run_test_files() {
  local test_args="$1"; shift
  local reporter=(--reporter=default)
  [[ "$AGENT_MODE" == "true" ]] && reporter=(--reporter=dot)
  local junit=()
  [[ -n "$QUARTO_TEST_JUNIT" ]] && junit=(--reporter=junit "--outputFile.junit=$QUARTO_TEST_JUNIT")
  QUARTO_TEST_ARGS="$test_args" "$NODE" "$QUARTO_ROOT/node_modules/vitest/vitest.mjs" run \
    --config "$SCRIPT_PATH/vitest.config.mjs" "--testTimeout=${QUARTO_TEST_TIMEOUT:-600000}" \
    "${reporter[@]}" "${junit[@]}" "$@"
}
```

- [ ] **Step 2: Write the PowerShell runner**

```powershell
# tests/run-tests-node.ps1
# Copyright (C) 2026 Posit Software, PBC
# Runs the test suite on Node 26 (runner chosen by Spike V). Same argument
# contract as run-tests.ps1; see tests/README.md "Running on Node".
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

# ---- Variant N (node:test). Replace with the Variant V body when Spike V chose Vitest.
function Run-TestFiles([string]$testArgs, [string[]]$files) {
  $Env:QUARTO_TEST_ARGS = $testArgs
  $reporter = if ($AGENT_MODE) { @("--test-reporter=dot", "--test-reporter-destination=stdout") } else { @("--test-reporter=spec", "--test-reporter-destination=stdout") }
  $junit = if ($Env:QUARTO_TEST_JUNIT) { @("--test-reporter=junit", "--test-reporter-destination=$($Env:QUARTO_TEST_JUNIT)") } else { @() }
  $timeout = if ($Env:QUARTO_TEST_TIMEOUT) { $Env:QUARTO_TEST_TIMEOUT } else { "600000" }
  & $NODE --no-warnings --import (Join-Path $Env:QUARTO_ROOT "tools" "node-bundle" "register-import-map.mjs") `
    --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 `
    --test --test-concurrency=1 --test-force-exit "--test-timeout=$timeout" @reporter @junit @files
  return $LASTEXITCODE
}
# ---- end of the runner-specific part

$smokeFiles = @(); $tests = @()
foreach ($f in $customArgs) {
  $name = Split-Path -Leaf $f
  if ($name -match "^[^_].*[.](qmd|ipynb|md)$") { $smokeFiles += $f }
  elseif ($f -match "[.]ts$" -or (Test-Path $f -PathType Container)) { $tests += $f }
  else { Write-Host "#### WARNING: Only .ts files, directories, or .qmd/.md/.ipynb are accepted."; Exit 1 }
}
if ($smokeFiles.Count -gt 0) {
  $code = Run-TestFiles ($smokeFiles -join "`n") @($SMOKE_ALL)
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
  $code = Run-TestFiles "" $files
}
if (Get-Command deactivate -ErrorAction SilentlyContinue) { deactivate }
Exit $code
```

Variant V body of `Run-TestFiles`:

```powershell
function Run-TestFiles([string]$testArgs, [string[]]$files) {
  $Env:QUARTO_TEST_ARGS = $testArgs
  $reporter = if ($AGENT_MODE) { @("--reporter=dot") } else { @("--reporter=default") }
  $junit = if ($Env:QUARTO_TEST_JUNIT) { @("--reporter=junit", "--outputFile.junit=$($Env:QUARTO_TEST_JUNIT)") } else { @() }
  $timeout = if ($Env:QUARTO_TEST_TIMEOUT) { $Env:QUARTO_TEST_TIMEOUT } else { "600000" }
  & $NODE (Join-Path $Env:QUARTO_ROOT "node_modules" "vitest" "vitest.mjs") run --config (Join-Path $SCRIPT_PATH "vitest.config.mjs") "--testTimeout=$timeout" @reporter @junit @files
  return $LASTEXITCODE
}
```

- [ ] **Step 3: Run on Node, then one file per leak guarantee**

Run:
```bash
chmod +x tests/run-tests-node.sh
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts; echo "exit=$?"
```
Expected: dots and a tally with no failure, `exit=0`. First-run failures that name `Deno` or an import-map specifier are Phase 2 gaps: file them against the PR that owns the module rather than patching here, unless they are in `tests/` itself.

Then the four cases of "Leak guarantees" (Spec), one file each, each with its own expected result; `timeout 120` is the outer guard, an exit status of 124 means the run itself did not end:

```bash
cat > unit/zz-hang.test.ts <<'EOF'
import { unitTest } from "../test.ts";
unitTest("sleeps 5 s", async () => { await new Promise((r) => setTimeout(r, 5000)); });
EOF
QUARTO_TEST_TIMEOUT=2000 QUARTO_TESTS_NO_CONFIG=true timeout 120 ./run-tests-node.sh --agent unit/zz-hang.test.ts; echo "hang exit=$?"

cat > unit/zz-child.test.ts <<'EOF'
import { unitTest } from "../test.ts";
import { execPath, spawn } from "../../src/deno_ral/process.ts";
// The child ends by itself after 5 s; a forced exit would orphan one that did not.
unitTest("leaves a child running", async () => { spawn(execPath(), { args: ["-e", "setTimeout(() => {}, 5000)"] }); });
EOF
QUARTO_TESTS_NO_CONFIG=true timeout 120 ./run-tests-node.sh --agent unit/zz-child.test.ts; echo "child exit=$?"

cat > unit/zz-timer.test.ts <<'EOF'
import { unitTest } from "../test.ts";
unitTest("leaks a timer", async () => { setInterval(() => {}, 1000); });
EOF
QUARTO_TESTS_NO_CONFIG=true timeout 120 ./run-tests-node.sh --agent unit/zz-timer.test.ts; echo "timer exit=$?"

cat > unit/zz-opted-out.test.ts <<'EOF'
import { unitTest } from "../test.ts";
unitTest("leaks a timer, opted out", async () => { setInterval(() => {}, 1000); }, { sanitize: { ops: false } });
EOF
QUARTO_TESTS_NO_CONFIG=true timeout 120 ./run-tests-node.sh --agent unit/zz-opted-out.test.ts; echo "opted-out exit=$?"
rm unit/zz-hang.test.ts unit/zz-child.test.ts unit/zz-timer.test.ts unit/zz-opted-out.test.ts
```

Expected:

| File | Mechanism | Output | Exit |
|---|---|---|---|
| `zz-hang` | the per-test timeout (watchdog) | one failure, `test timed out after 2000ms` (Variant V: `Test timed out in 2000ms`), after about 2 s | `hang exit=1` |
| `zz-child` | `runChecked()` handle check | one failure, `left handles open: ProcessWrap +1`; the run ends at once, the child ends on its own 5 s later (`pgrep -f "setTimeout(() => {}, 5000)"` is empty after that) | `child exit=1` |
| `zz-timer` | `runChecked()` handle check | one failure, `left handles open: Timeout +1`; the run ends although the interval is still armed | `timer exit=1` |
| `zz-opted-out` | the forced exit only | no failure; the run ends well before the 120 s `timeout` (Variant N: `--test-force-exit`; Variant V: the worker is terminated) and reports nothing about the interval | `opted-out exit=0` |

The last row is the forced exit's whole guarantee: the run is bounded, the leak is not detected. The same four files on Deno (`./run-tests.sh --agent unit/zz-*.test.ts`): the hang file hangs (Deno has no per-test timeout; interrupt it), the child and timer files fail through `sanitizeResources` and `sanitizeOps`, the opted-out file passes. (`unitTest`'s third argument carries `sanitize` into the context PR 23 maps onto `registerTest`; if the signature differs after PR 23, write the two leaking cases with `registerTest` directly as `harness-node.test.ts` does.)

- [ ] **Step 4: Commit**

```bash
git add tests/run-tests-node.sh tests/run-tests-node.ps1
git commit -m "tests: run-tests-node entry points for Node 26"
```

### Task 6: `run-parallel-tests` off Deno

**Files:**
- Create: `tests/run-parallel-tests.mjs`
- Delete: `tests/run-parallel-tests.ts`
- Modify: `tests/run-parallel-tests.sh`, `.github/workflows/test-smokes-parallel.yml`

- [ ] **Step 1: Record the current output**

Run: `cd tests && quarto run run-parallel-tests.ts -n=20 --json-for-ci --timing-file=timing-for-ci.txt > /tmp/rt31-buckets-deno.json; node -e 'const j=require("/tmp/rt31-buckets-deno.json"); console.log(j.length, j.flat().length)'`
Expected: `20` and the item count (1801 on `main` at the time of writing).

- [ ] **Step 2: Write the port**

```js
// tests/run-parallel-tests.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Splits the test files (and, with --json-for-ci, the smoke-all documents)
// into buckets of similar total duration from a timing file written by
// `QUARTO_TEST_TIMING=<file> ./run-tests.sh` (or run-tests-node.sh: same
// format). Port of the former run-parallel-tests.ts (Deno-only: Deno.run,
// unversioned deno.land/std imports) to plain Node ESM; it also runs on Deno.
// Usage: node run-parallel-tests.mjs [-n=<buckets>] [--timing-file=timing.txt]
//          [--json-for-ci] [--dry-run] [--verbose] [--runner=deno|node]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const { values: flags } = parseArgs({
  args: process.argv.slice(2).map((a) => a.replace(/^-n=/, "--n=")),
  options: {
    n: { type: "string" },
    "timing-file": { type: "string", default: "timing.txt" },
    "json-for-ci": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
    runner: { type: "string", default: "deno" },
  },
});

const timingFile = flags["timing-file"];
const detailedSmokeAll = flags["json-for-ci"];
const smokeAllTestFile = "./smoke/smoke-all.test.ts";
const log = (...a) => flags.verbose && console.log(...a);
const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join("/");

function* walk(dir, skip) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (!skip.has(d.name)) yield* walk(full, skip);
    } else yield full;
  }
}

let timingFileContent;
try {
  timingFileContent = fs.readFileSync(timingFile, "utf8");
} catch (e) {
  console.log(String(e));
  console.log(`'${timingFile}' missing. Run './run-tests.sh' with QUARTO_TEST_TIMING='${timingFile}'`);
  process.exit(1);
}

const lines = timingFileContent.trim().split("\n");
const skipDirs = new Set(["node_modules", ".venv", ".git"]);
const currentTests = new Set(
  [...walk(".", skipDirs)].filter((f) => f.endsWith(".test.ts")).map((f) => `./${rel(f)}`),
);
const currentSmokeFiles = new Set(
  detailedSmokeAll
    ? [...walk("docs/smoke-all", skipDirs)]
      .filter((f) => /\.(md|qmd|ipynb)$/.test(f) && /^[^_]/.test(path.basename(f)))
      .map(rel)
    : [],
);

const RegSmokeAllFile = /smoke\/smoke-all\.test\.ts -- (.*)$/;
if (detailedSmokeAll && lines.filter((l) => RegSmokeAllFile.test(l.trim())).length === 0) {
  throw new Error(
    `No smoke-all timed tests found in ${timingFile}. Run './run-tests.sh' with QUARTO_TEST_TIMING to create a new file, and pass another file with '--timing-file='`,
  );
}

const timedTests = new Set();
const timedSmokeAllDocs = new Set();
const testTimings = [];
let dontUseDetailedSmokeAll = false;
for (let i = 0; i < lines.length; i += 2) {
  const name = lines[i].trim();
  if (/(^|\/)test\.ts$/.test(name)) continue; // ./test.ts is a helper file
  if (RegSmokeAllFile.test(name)) {
    if (!detailedSmokeAll) {
      dontUseDetailedSmokeAll = true;
      continue;
    }
    const smokeFile = name.split(" -- ")[1];
    if (!currentSmokeFiles.has(smokeFile)) {
      log(`Test ${name} in '${timingFile}' does not exist anymore.`);
      continue;
    }
    timedSmokeAllDocs.add(smokeFile);
  } else if (!currentTests.has(name)) {
    log(`Test ${name} in '${timingFile}' does not exist anymore.`);
    continue;
  }
  const t = (lines[i + 1] ?? "").trim().replace(/ +/g, " ").split(" ");
  testTimings.push({ name, timing: { real: Number(t[0]), user: Number(t[2]), sys: Number(t[4]) } });
  timedTests.add(name);
}

const nBuckets = Number(flags.n) || os.availableParallelism();
const buckets = Array.from({ length: nBuckets }, () => []);
const bucketSizes = new Array(nBuckets).fill(0);
const argmin = (a) => a.reduce((best, v, i) => (v < a[best] ? i : best), 0);
let failed = false;

if (dontUseDetailedSmokeAll) {
  failed = true;
  log(`${smokeAllTestFile} will run in its own bucket`);
  buckets[0].push({ name: smokeAllTestFile, timing: { real: 99999, user: 99999, sys: 99999 } });
  bucketSizes[0] += 99999;
}
for (const timing of testTimings) {
  const ix = argmin(bucketSizes);
  buckets[ix].push(timing);
  bucketSizes[ix] += timing.timing.real;
}
for (const currentTest of currentTests) {
  const missing = [];
  if (/smoke-all\.test\.ts/.test(currentTest)) {
    if (detailedSmokeAll && !dontUseDetailedSmokeAll) {
      for (const f of currentSmokeFiles) {
        if (!timedSmokeAllDocs.has(f)) {
          log(`Missing smoke-all doc '${f}' in ${timingFile}`);
          failed = true;
          missing.push(`${smokeAllTestFile} -- ${f}`);
        }
      }
    }
  } else if (!timedTests.has(currentTest)) {
    log(`Missing test '${currentTest}' in ${timingFile}`);
    failed = true;
    missing.push(currentTest);
  }
  for (const m of missing) {
    buckets[Math.floor(Math.random() * nBuckets)].push({ name: m, timing: { real: 0, user: 0, sys: 0 } });
  }
}

log(`Will run in ${nBuckets} buckets`);
if (!failed) {
  log(`Expected speedup: ${(bucketSizes.reduce((a, b) => a + b, 0) / Math.max(...bucketSizes)).toFixed(2)}`);
}

if (flags["dry-run"]) {
  console.log(JSON.stringify(buckets, null, 2));
  process.exit(0);
}
if (flags["json-for-ci"]) {
  const simple = buckets.map((b) => b.map((tt) => (RegSmokeAllFile.test(tt.name) ? tt.name.split(" -- ")[1] : tt.name)));
  console.log(JSON.stringify(simple, null, 2));
} else {
  const runner = flags.runner === "node" ? "./run-tests-node.sh" : "./run-tests.sh";
  console.log(`Running ${runner} in parallel...`);
  await Promise.all(buckets.map((bucket) =>
    new Promise((resolve) => {
      spawn(runner, bucket.map((tt) => tt.name), { stdio: "inherit" }).on("close", resolve);
    })
  ));
  console.log(`Running ${runner} in parallel... END`);
}
```

`tests/run-parallel-tests.sh` becomes:

```bash
#!/usr/bin/env bash
# Buckets tests by timing (see run-parallel-tests.mjs). Node 26 or Deno 2 can run it.
exec node "$(dirname "$0")/run-parallel-tests.mjs" "$@"
```

- [ ] **Step 3: Compare with the Deno output and delete the `.ts`**

Run:
```bash
cd tests && node run-parallel-tests.mjs -n=20 --json-for-ci --timing-file=timing-for-ci.txt > /tmp/rt31-buckets-node.json
node -e 'const a=require("/tmp/rt31-buckets-deno.json"), b=require("/tmp/rt31-buckets-node.json"); console.log(a.length===b.length, a.flat().length===b.flat().length, new Set(a.flat()).size===new Set(b.flat()).size)'
git rm run-parallel-tests.ts
```
Expected: `true true true` (verified while writing this plan: 20 buckets, 1801 items from `tests/timing-for-ci.txt`). Bucket contents can differ only for untimed tests, which both scripts place at random.

- [ ] **Step 4: The CI bucketing job no longer needs Quarto**

In `.github/workflows/test-smokes-parallel.yml`, job `jobs-matrix`, replace the "Set up Quarto" step:

```yaml
      - name: Set up Node (bucketing script)
        uses: actions/setup-node@v6
        with:
          node-version: 26
```

The "Create Job for tests" step keeps `./run-parallel-tests.sh -n=… --json-for-ci --timing-file=timing-for-ci.txt` unchanged (the shell script now calls Node).

- [ ] **Step 5: Commit**

```bash
git add tests/run-parallel-tests.mjs tests/run-parallel-tests.sh .github/workflows/test-smokes-parallel.yml
git commit -m "tests: run-parallel-tests on Node (was Deno-only), same buckets"
```

### Task 7: Self-spawning tests on both runtimes

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
Expected: green on both. (`smoke-all-prerender-isolation` on Node renders documents in-process; a failure there is a Phase 2 gap owned by the PR of the failing module and is recorded in the PR description, not patched here.)

- [ ] **Step 5: Commit**

```bash
git add tests/unit/chrome-launch-fixtures.ts tests/unit/chrome-launch.test.ts tests/unit/chrome-launch-flags.test.ts tests/unit/harness-failure-reporting.test.ts tools/runtime-boundary-baseline.json
git commit -m "tests: runtime-neutral fake executables; guard Deno-reporter assertions"
```

### Task 8: CI step and docs

**Files:**
- Modify: `.github/workflows/test-node-bundle.yml`, `tests/README.md`

- [ ] **Step 1: Add a harness step to the `node-unit` job, after the bundled `deno_ral` step**

```yaml
      - name: Harness tests through run-tests-node
        working-directory: tests
        shell: bash
        env:
          QUARTO_TESTS_NO_CONFIG: "true"
        run: ./run-tests-node.sh --agent unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts
```

(On the Windows leg `shell: bash` runs Git Bash; `run-tests-node.ps1` is exercised by PR 32's Windows matrix.)

- [ ] **Step 2: Document in `tests/README.md`**

Add a section after "Running the tests locally":

```markdown
### Running on Node

`run-tests-node.sh` / `run-tests-node.ps1` run the same files on Node 26 with
the runner chosen in `dev-docs/runtime-migration/SPIKES.md` (Spike V):

```bash
npm ci                                  # once, in the repository root
cd tests
QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/path.test.ts
./run-tests-node.sh docs/smoke-all/2023/02/08/4272.qmd   # smoke-all on one document
QUARTO_TEST_BIN=../tools/node-bundle/quarto-node ./run-tests-node.sh smoke/   # binary mode against the Node bundle
node run-parallel-tests.mjs -n=8 --runner=node            # local parallel run in 8 buckets
```

Differences from the Deno runner: no type checking; test files run one at a
time in child processes; smoke-all document arguments are passed through
`QUARTO_TEST_ARGS` (`testArgs()` in `harness.ts`) because the Node runners
have no positional arguments; and the Node runners have no sanitizers, so
`harness.ts` provides what they would have (see "Leak guarantees" in
`dev-docs/runtime-migration/31-test-harness-on-node.md`):

- a test that leaves a child process, a listening server or a timer open
  fails (`left handles open: ProcessWrap +1`), and a test that calls `exit()`
  fails; `sanitize: { resources: false }`, `{ ops: false }`, `{ exit: false }`
  or `sanitize: false` opt out exactly as they do on Deno. Open files, client
  sockets and pending fs operations are not detected on Node: close them in
  the test;
- a test that does not settle fails after the per-test timeout
  (`QUARTO_TEST_TIMEOUT`, default 600000 ms). This is a watchdog for hangs,
  not leak detection;
- after a file's last test its process is ended whatever is still open
  (`--test-force-exit` / the Vitest worker is terminated). This bounds the
  run and reports nothing.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test-node-bundle.yml tests/README.md
git commit -m "ci/docs: harness tests on Node through run-tests-node"
```

## Verification

- Deno (unchanged behaviour): `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') smoke/render/render-html.test.ts docs/smoke-all/2023/02/08/4272.qmd` → green.
- Node: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts` → no failure.
- Node, layer tests unbundled: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/ral/` → failures only among the Linux entries of `tools/node-bundle/known-failures.json`.
- Node smoke-all: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh docs/smoke-all/2023/02/08/4272.qmd` → passes (in-process render on Node).
- Node binary mode: `node tools/node-bundle/build.mjs && cd tests && QUARTO_TEST_BIN=$PWD/../tools/node-bundle/quarto-node QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent smoke/render/render-html.test.ts` → passes.
- `node --test "tools/node-bundle/*.test.mjs"` → all pass (Variant N adds `import-map-hook.test.mjs`).
- `quarto run --dev tools/check-runtime-boundary.ts` → zero in `src`; lower in `tests`.
- Timing mode: `cd tests && QUARTO_TEST_TIMING=/tmp/t.txt QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh unit/path.test.ts && cat /tmp/t.txt` → two lines per test file as `run-tests.sh` produces, readable by `node run-parallel-tests.mjs --timing-file=/tmp/t.txt --dry-run -n=1`.
- GitHub grouping: `GITHUB_ACTIONS=true QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh unit/gha-grouping.test.ts | grep -c "::group::"` → at least 1.

## Review checklist

- [ ] Exactly one of Task 3 / Task 4 is implemented, the one `SPIKES.md` (Spike V results) records; the other variant's files are absent, unless the spike recorded "inconclusive" (then Variant N is implemented, Variant V stays in the plan and the harness, and the PR description names the pending re-run).
- [ ] `tests/harness.ts` imports the runner only on Node (dynamic import; Vitest through a non-literal specifier); PR 23's Deno path, `TestRunContext` and `SanitizeOptions` unchanged; `step` returns `false` for ignored and failed steps; a failed step fails its test.
- [ ] `testArgs()` prefers positional arguments after `--`; `QUARTO_TEST_ARGS` otherwise; on Node it never returns the runner's own arguments.
- [ ] `run-tests-node.sh`/`.ps1` mirror `run-tests.sh`/`.ps1`: `--agent`, `--keep-outputs`, document → smoke-all, directory targets, binary-mode default, venv activation, timing format, `QUARTO_TEST_JUNIT`; files run serially with a per-test timeout (`QUARTO_TEST_TIMEOUT`, default 10 minutes) and a forced exit.
- [ ] Leak guarantees: every test on both Node variants goes through `runChecked()`; `sanitize` maps as the Spec table says and PR 23's Deno branch uses the same `sanitizeOptions()`; the four Task 5 step 3 files give the stated results; no sentence in the plan, `tests/README.md` or the PR description presents the per-test timeout or the forced exit as leak detection.
- [ ] `tests/asserts.ts` re-exports every name it exported before, now from `@std/assert`; the import map and `package.json` agree (`check-deps.mjs`).
- [ ] `tests/run-parallel-tests.ts` is deleted; the `.mjs` produces the same bucket structure; the CI bucketing job installs Node 26, not Quarto.
- [ ] Fake executables are `.mjs` using only `node:` modules and `process`; `runtimeScriptCommand` passes Deno permissions only on Deno.
- [ ] `runHarness` keeps PR 23's options; the Node branch drops `--check`/`--no-check`, writes JUnit when asked and passes arguments through `QUARTO_TEST_ARGS`.
- [ ] `tests/test.ts` uses `onProcessExit`.

## Risks and rollback

- **The spike's verdict does not hold on the full suite** (a runner that passed ten files fails on a class of tests Spike V did not sample). The other variant is written out in this plan; switching is Task 3 ↔ Task 4 plus the two `run_test_files` bodies. Record the reason in `SPIKES.md` results.
- **Test isolation differences**: both Node runners run each file in its own process (fresh module state), Deno shares one process. Tests that relied on module state leaking between files would pass on Node and fail on Deno or vice versa; serial files keep the order identical.
- **Per-file process cost (S12)**: measured by Spike V; PR 32 buckets the Node matrix with the existing timing files so wall time per PR stays near today's Deno matrix.
- **Handle-check false positives**: a library that keeps a ref'd timer or an `Immediate` alive after an awaited call (undici's keep-alive uses an unref'd timer and a client socket, both outside the counted kinds, checked on Node 22.22) would fail a test that passes Deno's sanitizers. PR 32's parity run shows them; the fix is a settle or an opt-out in that test, as Deno's sanitizers required, never a wider exclusion list without a reason recorded here.
- **`process.getActiveResourcesInfo()` is experimental** (Stability 1 since Node 17.3). If Node 26 or a later LTS drops or renames it, the check logs one warning per file and the `harness-node.test.ts` leak case fails on Node; reimplement `countHandles()` on `async_hooks.createHook` (track `PROCESSWRAP`, `TCPSERVERWRAP`, `PIPESERVERWRAP`, `Timeout`, `Immediate` by `asyncId`) in this file.
- **`@std/assert` 1.x message formats** differ slightly from `@std/testing@0.224/asserts` (same code lineage). Tests that assert on the exact assertion message would fail on both runtimes and are fixed in this PR when found.
- **Whole-PR rollback:** revert the commits; `run-tests.sh` and the Deno harness are untouched except for `onProcessExit` and `testArgs`, both equivalent on Deno; restore `tests/run-parallel-tests.ts` with the revert.

## Decisions needed

The runner (`node:test` or Vitest) is decided by Spike V before this plan is executed (decision 4); the decision rule and what it changes are in `SPIKES.md`. Everything else is decided above: `@std/assert` over `node:assert`, unbundled execution, `QUARTO_TEST_ARGS`, the leak guarantees (per-test timeout as watchdog, `runChecked()` for what Deno's sanitizers saw, forced exit as a bound; open files, client sockets and pending fs operations intentionally undetected on Node), the `run-parallel-tests` port. Not changed because it moved: the strip-only syntax cleanup and `check-ts-syntax.mjs` are PR 02b's.
