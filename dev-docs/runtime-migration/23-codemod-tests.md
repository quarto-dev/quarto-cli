# PR 23: Codemod `tests/` (813 sites); `tests/harness.ts` adapter around `Deno.test`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the test harness's single `Deno.test` call behind `tests/harness.ts` (`registerTest`), convert the three test files that call `Deno.test` directly, move every process/fs/env/platform `Deno.*` call in `tests/` onto `src/deno_ral/` (by hand for `Deno.Command`/`Deno.kill`, by codemod for the rest), keep the `deno test` self-invocations behind `runHarness()` in `tests/utils.ts`, migrate the test tree's assertion and std imports to `tests/asserts.ts` and `src/deno_ral/`, and replace the removed `Deno.run` in `tests/run-parallel-tests.ts` (which stays a `quarto run` script for the installed Quarto that CI uses).
**Phase:** 1. **Depends on:** PR 08 (`process.ts`), PR 09 (codemod tool `tools/codemod-deno-ral.ts`, `fs.ts`/`temp.ts`/`errors.ts`), PR 14 (`env.ts`), PR 19 (`platform.ts`), PR 02 (`tests/asserts.ts`; the `tests` ratchet scope). Uses PR 22's `tools/rewrite-import-specifier.sh` and seams (PR 22 lands right after PR 08). **Unblocks:** PR 25, PR 26 (its Node run of `tests/unit/ral` uses `tests/harness.ts`), PR 31.
**Branch:** `rt/23-codemod-tests`.
**Suggested executor:** Opus. The harness conversion must preserve `context.origin` (GitHub Actions grouping), the three sanitizer flags and `t.step`; `quarto-cmd.ts`'s spawn/kill/timeout logic is the test suite's backbone and has no test of its own.
**Size:** L. 142 files with `Deno.*` sites in `tests/` (813 sites in scope; 27 more under `tests/docs/**` are user scripts run by `quarto run`/pre-render hooks, excluded from the `tests` scope by PR 02 and owned by PR 35), the assertion import of 162 files (mostly the same files), 2 new files.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 11, "Order of work" step 8: the test harness's single `Deno.test` call goes behind a `tests/harness.ts` adapter; same codemod as `src/`. Vocabulary: `tests/harness.ts` exports `registerTest(def: { name; fn; ignore?; sanitize? })`; PR 31 reimplements it on `node:test`.

Inventory (2026-10-14, `grep -rhoE '\bDeno\.[A-Za-z_]+' <dir> --include=*.ts | wc -l`):

| Directory | Sites | Files |
|---|---|---|
| `tests/unit` | 360 | 68 |
| `tests/smoke` | 324 | 60 |
| `tests/*.ts` (top level) | 110 | `verify.ts` 40, `quarto-cmd.ts` 24, `utils.ts` 20, `test.ts` 13, `run-parallel-tests.ts` 8, `verify-snapshot.ts` 2, `puppeteer.ts` 1, `verify-pdf-metadata.ts` 1, `verify-pdf-text-position.ts` 1 |
| `tests/integration` | 14 | 1 |
| `tests/tools` | 5 | 1 |
| `tests/docs` | 27 | 10 (out of scope: `quarto run` scripts and pre/post-render hooks, PR 35) |

By API: `writeTextFileSync` 172, `removeSync` 141, `makeTempDirSync` 83, `readTextFileSync` 66, `remove` 64, `mkdirSync` 49, `cwd` 40, `env` 29, `readTextFile` 19, `copyFileSync` 17, `statSync` 14, `makeTempFileSync` 14, `Command` 13, `writeTextFile` 11, `makeTempDir` 11, `exit` 9, `args` 9, `chmodSync` 8, `readDirSync` 7, `chdir` 7, `test` 5, `copyFile` 5, `symlinkSync` 4, `renameSync` 4, `execPath` 4, `errors` 4, `build` 4, `writeFileSync` 3, `uid` 3, `rename` 3, `readFile` 3, `kill` 3, `utimeSync` 2, `serve` 2 (inside generated script strings), `stderr`/`listen` 1 each (same), `run` 1, `mkdir` 1, `chmod` 1, `TestDefinition` 1, `Kv` 1 (comment).

Sites that need hands, not the codemod:

- `tests/test.ts:545-794`: `const args: Deno.TestDefinition = {...}; Deno.test(args);` with `fn(context)` reading `context.origin` (lines 549, 596) and the `delete args.ignore` workaround (789–792).
- Direct `Deno.test`: `tests/integration/playwright-tests.test.ts:118` (object form with `ignore`), `tests/smoke/logging/log-level-and-formats.test.ts:55` (object form), `tests/smoke/create/create.test.ts:34` (name + `async (t)` using `t.step` at 49, 72 (object form with `ignore`), 89).
- `deno test` self-invocations: `tests/unit/harness-failure-reporting.test.ts:53-78` and `tests/unit/smoke-all-prerender-isolation.test.ts:163-185` (`new Deno.Command(Deno.execPath(), ["test", "--config", ..., "--unstable-kv", ..., fixture])`).
- Runtime re-invocation for fake executables: `tests/unit/chrome-launch-fixtures.ts:30-50` writes a `.cmd`/`.sh` wrapper that runs `"${Deno.execPath()}" run --allow-net <script.js>`; the generated script bodies in `tests/unit/chrome-launch.test.ts` and `chrome-launch-flags.test.ts` are JavaScript strings containing `Deno.listen`, `Deno.serve`, `Deno.exit`, `Deno.args`, `Deno.writeTextFile`, `Deno.stderr` (8 occurrences). Those strings describe a Deno program by design; PR 31 rewrites them for Node. They stay and are the documented residue of this PR.
- `Deno.Command` by hand: `tests/quarto-cmd.ts:164-170` (`outputSync`), `:218-222` (`output`), `:276-280` (`outputSync`), `:457-464` (`spawn` + `child.output()`), `Deno.kill` at `:234,245,319`, `Deno.errors.NotFound` at `:322`; `tests/utils.ts:291-292` (`outputSync`); `tests/verify.ts:845-849` (`output`); `tests/unit/dart-sass.test.ts:25-27,35-37` (`output`); `tests/smoke/render/placeholder-typst-text.test.ts:28-40` (`output`); `tests/smoke/filters/editor-support.test.ts:13-30` (`spawn` with piped stdin); `tests/smoke/typst-gather/typst-gather.test.ts:473` (`Deno.execPath()`).
- `Deno.errors.PermissionDenied` as an `assertRejects` error class at `tests/unit/project/project-context-unreadable-dir.test.ts:72-75`.
- `tests/run-parallel-tests.ts`: dynamic imports of `stdlib/path|fs|flags` with a fallback to `https://deno.land/std/...` (lines 1–18), `Deno.run({ cmd }).status()` (262), `Deno.args`, `Deno.cwd` ×2, `Deno.exit` ×3, `Deno.readTextFileSync`. `tests/run-parallel-tests.sh` launches it as `quarto run run-parallel-tests.ts $*`, and `.github/workflows/test-smokes-parallel.yml:61-71` runs that with an **installed** release or prerelease Quarto (`quarto-actions/setup`) to compute the CI buckets. It is therefore a user script, not dev code: `quarto run --dev` resolves `sharePath()/../../src/import_map.json` (`src/core/run/deno.ts:39-43`), which an installed Quarto does not have, and the "horrendous hack" fallback exists for installed versions without `stdlib/*`. This PR only replaces `Deno.run` (soft-removed in Deno 2) with `Deno.Command`, which PR 35's `quarto run` Node shim also provides (`Command` with `spawn()`/`status`), keeps the fallback and the launcher, and leaves its other `Deno.*` to PR 35 like the `tests/docs` scripts.
- Assertion and std imports: 157 files import `testing/asserts` (`assert` 114, `assertEquals` 88, `assertThrows` 7, `assertRejects` 5, `fail` 3, `assertStringIncludes` 3, `assertStrictEquals` 2, `assertFalse` 2, `AssertionError` 2, `assertNotEquals` 1, `assertInstanceOf` 1), `tests/test-deps.ts:2` does `import * as _asserts from "testing/asserts"`, and four `tests/smoke/inspect/*.test.ts` imported `assertObjectMatch` from `https://deno.land/std@0.93.0/assert/assert_object_match.ts` until PR 00b Task 6 moved them onto `tests/asserts.ts` (the `4` expected in Task 1 Step 2 below is then `0`). PR 02 created `tests/asserts.ts` with `assert`, `assertEquals`, `AssertionError`, `assertMatch`, `assertObjectMatch`, `assertRejects`, `assertStringIncludes`, `assertThrows`, `fail`; this PR adds the four names it lacks and moves every importer onto it. Other std imports in `tests/`: `fmt/colors` (`tests/test.ts`, `tests/verify.ts`), `encoding/base64` (`tests/smoke/lua-unit/quarto-version-repr.test.ts`), `fs/eol` (`tests/smoke/run/run-script.test.ts`), bare `path` (7 files).
- `tests/smoke/smoke-all.test.ts:393,397`: `Deno.args` becomes `args()` from `process.ts` through the codemod. Under `deno test <file> -- <args>` that is the arguments after `--`; under `node --test` it is not (Node passes no per-file arguments). PR 31 owns that meaning (it passes them through `QUARTO_TEST_ARGS`, see the vocabulary's `runHarness`).

Facts from the earlier plans this relies on: `tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform (--dir <d> | --file <f>)... [--dry-run]` (PR 09) rewrites `Deno.<fsCall>(`/`Deno.makeTemp*`/`Deno.env.*`/`Deno.cwd|exit|args|chdir|execPath|pid`/`Deno.build.*`, adds imports relative to `src/deno_ral/` from any directory, skips `src/deno_ral/`, `src/vendor/`, `src/resources/extension-subtrees/`, `node_modules`, `*.d.ts`, `*.ejs.ts`, and reports files it leaves untouched as `skipped: <reason>`; `src/deno_ral/process.ts` (PR 08) exports `spawn`, `exec`, `execSync`, `exit`, `cwd`, `chdir`, `args`, `execPath`, `pid`, `ChildProcess`, `ExecOutput`, `Signal` and `killProcess(pid: number, signal?: Signal): void` (a negative pid addresses a process group); `src/deno_ral/errors.ts` (PR 09) exports `isNotFound`, `isPermissionDenied`; `src/deno_ral/fs.ts` exports the async `chmod` (PR 09 addition). PR 31 (`31-test-harness-on-node.md`) extends `tests/harness.ts` and calls `runHarness` with `{ file, cwd, flags, junitPath }`, so `runHarness` is implemented in `tests/utils.ts` (as this plan's brief asks) and re-exported from `tests/harness.ts`; PR 31 keeps exactly this options shape and adds a Node branch behind it.

### Scope

In: everything above except the listed residue; `tests/harness.ts` and its unit test; `tests/utils.ts` helpers `runHarness`, `runtimeScriptCommand`; `tests/asserts.ts` (four names added) and the assertion/std imports of the test tree; the `Deno.run` call in `tests/run-parallel-tests.ts`.
Out: `tests/docs/**/*.ts` (PR 35); `tests/run-parallel-tests.ts`'s other `Deno.*` and its `stdlib/*`/`https://deno.land/std` imports (a `quarto run` script run by an installed Quarto; PR 35); `tests/run-parallel-tests.sh` (unchanged); the generated fake-Chrome script strings (PR 31); `tests/integration/playwright/**` (Playwright's own Node code). The `tests/unit/ral/*.test.ts` contract tests written by PRs 15–19 already use only the layer.

### Interfaces

`tests/harness.ts` (new). A superset of the vocabulary's `registerTest(def: { name; fn; ignore?; sanitize?: boolean })`: `fn` receives a context because `tests/test.ts` needs `context.origin` for GitHub Actions log grouping, `sanitize` also accepts the three-flag object `TestContext.sanitize` already carries, and `step` mirrors `t.step` for `create.test.ts`.

```ts
/*
 * harness.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * The only module under tests/ that registers tests with the runtime's
 * test API. PR 31 reimplements registerTest on node:test behind the same
 * TestDefinition.
 */

export interface TestRunContext {
  /** file:// URL of the module that registered the test. */
  origin: string;
  /** Runs a named sub-test; resolves true when it passed, false when ignored or failed. */
  step(
    name: string,
    fn: (ctx: TestRunContext) => Promise<void> | void,
    options?: { ignore?: boolean },
  ): Promise<boolean>;
}

export interface SanitizeOptions {
  resources?: boolean;
  ops?: boolean;
  exit?: boolean;
}

export interface TestDefinition {
  name: string;
  fn: (ctx: TestRunContext) => Promise<void> | void;
  /** Statically skip (not run, not counted). */
  ignore?: boolean;
  /** `true`/`false` sets all three sanitizers; the object sets them individually. */
  sanitize?: boolean | SanitizeOptions;
}

export function registerTest(def: TestDefinition): void;
```

`tests/utils.ts` (new exports; `runHarness` is also re-exported from `tests/harness.ts` for PR 31):

```ts
/** Runs one test file through the harness in a child process (`deno test`
 * today; PR 31 adds the Node branch). The command line is
 * `<runtime> test <harness flags> [flags...] [--junit-path=<junitPath>] <file> [-- args...]`,
 * run from `cwd` (must be the tests/ directory). Resolves with decoded
 * stdout/stderr and the exit code. */
export function runHarness(options: {
  file: string;                   // test file, relative to cwd, e.g. "smoke/smoke-all.test.ts"
  cwd: string;
  flags?: string[];               // runtime flags placed before the file, e.g. ["--no-check"]
  args?: string[];                // test arguments placed after "--", e.g. [".../a.qmd"]
  env?: Record<string, string>;   // merged over the inherited environment
  junitPath?: string;             // adds --junit-path=<junitPath>
}): Promise<{ stdout: string; stderr: string; code: number }>;

/** Command line that runs `scriptPath` with the current JavaScript runtime
 * (`<deno> run --allow-net [--allow-write=<path>] <script>` today; PR 31
 * returns `node <script>`). Used to write fake executables. */
export function runtimeScriptCommand(
  scriptPath: string,
  options?: { allowWritePath?: string },
): { cmd: string; args: string[] };
```

### Files

- Create: `tests/harness.ts`, `tests/unit/harness.test.ts`.
- Modify: `tests/test.ts:1-30,545-794`; `tests/integration/playwright-tests.test.ts:118-122`; `tests/smoke/logging/log-level-and-formats.test.ts:55-57`; `tests/smoke/create/create.test.ts:31-95`; `tests/utils.ts` (helpers + `:283-307`); `tests/unit/harness-failure-reporting.test.ts:44-91`; `tests/unit/smoke-all-prerender-isolation.test.ts:158-190`; `tests/unit/chrome-launch-fixtures.ts:23-51`; `tests/quarto-cmd.ts:157-183,212-330,440-540`; `tests/verify.ts:845-851`; `tests/unit/dart-sass.test.ts:23-39`; `tests/smoke/render/placeholder-typst-text.test.ts:28-40`; `tests/smoke/filters/editor-support.test.ts:12-35`; `tests/smoke/typst-gather/typst-gather.test.ts:472-474`; `tests/unit/project/project-context-unreadable-dir.test.ts:70-78`; `tests/run-parallel-tests.ts:256-266`; `tests/asserts.ts`; `tests/test-deps.ts:2,5-6`; the 157 `testing/asserts` importers and the 4 `tests/smoke/inspect/*.test.ts` remote imports (import lines); `tests/test.ts`, `tests/verify.ts`, `tests/smoke/lua-unit/quarto-version-repr.test.ts`, `tests/smoke/run/run-script.test.ts` and the 7 bare-`path` importers (import lines); every other file the codemod touches (import lines plus `Deno.` prefix removal); `tools/runtime-boundary-baseline.json`; `tests/README.md` (one paragraph).

### Acceptance criteria

- `grep -rn 'Deno\.test(' tests --include=*.ts` prints exactly `tests/harness.ts:<n>:  Deno.test(args);`.
- `grep -rnE '\bDeno\.' tests --include=*.ts | grep -v '^tests/docs/' | grep -v '^tests/harness.ts' | grep -v '^tests/run-parallel-tests.ts' | grep -v 'tests/unit/chrome-launch'` prints nothing; the two `chrome-launch*.test.ts` files contain only `Deno.` occurrences inside string literals (verify with `grep -n 'Deno\.' tests/unit/chrome-launch*.test.ts`: every hit is on a line starting with a backtick or quote).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` and `$(find smoke/ -name '*.test.ts')` → pass (full suite; CI runs it anyway).
- `cd tests && ./run-parallel-tests.sh --dry-run` → prints the buckets, with the dev `quarto` on `PATH` and with an installed release `quarto` on `PATH` (the CI path).
- `grep -rnE 'from "(testing/asserts|fmt/colors|encoding/base64|fs/eol|path)"|deno.land/std' tests --include=*.ts | grep -v '^tests/asserts.ts' | grep -v '^tests/docs/' | grep -v '^tests/run-parallel-tests.ts' | grep -v build-ts-extension` prints nothing.
- Ratchet: `tests` `Deno.` count = 19 (`harness.ts` 3: `Deno.TestContext`, `Deno.TestDefinition`, `Deno.test`; the chrome-launch script strings 8; `run-parallel-tests.ts` 8); `tests` std-import files = 1 (`run-parallel-tests.ts`); `src/` and `package/src` unchanged; baseline committed.

## Plan

### Task 1: `tests/harness.ts` with a unit test

**Files:**
- Create: `tests/harness.ts`, `tests/unit/harness.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * harness.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals } from "../asserts.ts";
import { registerTest } from "../harness.ts";

registerTest({
  name: "[unit] > harness - registerTest passes origin and runs steps",
  fn: async (ctx) => {
    assert(
      ctx.origin.endsWith("tests/unit/harness.test.ts"),
      `origin: ${ctx.origin}`,
    );
    let ran = 0;
    const ok = await ctx.step("inner step", async (inner) => {
      assertEquals(inner.origin, ctx.origin);
      ran++;
    });
    assertEquals(ok, true);
    assertEquals(ran, 1);
    const skipped = await ctx.step("ignored step", () => {
      ran++;
    }, { ignore: true });
    assertEquals(skipped, false);
    assertEquals(ran, 1);
  },
});

registerTest({
  name: "[unit] > harness - ignore:true never runs",
  ignore: true,
  fn: () => {
    throw new Error("must not run");
  },
});

registerTest({
  name: "[unit] > harness - sanitize object is accepted",
  sanitize: { resources: true, ops: true, exit: true },
  fn: () => {},
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness.test.ts`
Expected: type-check error `Module not found "file:///.../tests/harness.ts"`.

- [ ] **Step 3: Implement `tests/harness.ts`**

```ts
/*
 * harness.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * The only module under tests/ that registers tests with the runtime's
 * test API (three Deno references: TestContext, TestDefinition, test).
 * PR 31 reimplements registerTest on node:test behind the same
 * TestDefinition.
 */

export interface TestRunContext {
  origin: string;
  step(
    name: string,
    fn: (ctx: TestRunContext) => Promise<void> | void,
    options?: { ignore?: boolean },
  ): Promise<boolean>;
}

export interface SanitizeOptions {
  resources?: boolean;
  ops?: boolean;
  exit?: boolean;
}

export interface TestDefinition {
  name: string;
  fn: (ctx: TestRunContext) => Promise<void> | void;
  ignore?: boolean;
  sanitize?: boolean | SanitizeOptions;
}

function wrapContext(t: Deno.TestContext): TestRunContext {
  return {
    origin: t.origin,
    step: (name, fn, options) =>
      t.step({
        name,
        ignore: options?.ignore ?? false,
        fn: (inner) => Promise.resolve(fn(wrapContext(inner))),
      }),
  };
}

export function registerTest(def: TestDefinition): void {
  const sanitize: SanitizeOptions = typeof def.sanitize === "boolean"
    ? { resources: def.sanitize, ops: def.sanitize, exit: def.sanitize }
    : def.sanitize ?? {};
  const args: Deno.TestDefinition = {
    name: def.name,
    fn: (t) => Promise.resolve(def.fn(wrapContext(t))),
    sanitizeResources: sanitize.resources,
    sanitizeOps: sanitize.ops,
    sanitizeExit: sanitize.exit,
  };
  // Deno 1.32.5 rejected an explicit `ignore: undefined`
  // (https://github.com/denoland/deno/issues/18784); only set it when given.
  if (def.ignore !== undefined) {
    args.ignore = def.ignore;
  }
  Deno.test(args);
}

// PR 31 imports the child-harness runner from this module.
export { runHarness } from "./utils.ts";
```

(`tests/utils.ts` does not import `harness.ts`, so the re-export creates no cycle. Until Task 4 adds `runHarness` to `utils.ts`, leave this last line out and add it in Task 4 step 1.)

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness.test.ts`
Expected: `..` then `ok | 2 passed | 0 failed | 1 ignored`.

- [ ] **Step 5: Commit**

```bash
git add tests/harness.ts tests/unit/harness.test.ts
git commit -m "tests: add harness.ts registerTest adapter around Deno.test"
```

### Task 2: `tests/test.ts` on `registerTest`

**Files:**
- Modify: `tests/test.ts:1-30,545-794`

- [ ] **Step 1: Import**

Add after the `./gha-grouping.ts` import block (around line 50):

```ts
import { registerTest, TestRunContext } from "./harness.ts";
```

- [ ] **Step 2: Replace lines 545–549 (the start of the definition)**

```ts
  registerTest({
    name: testName,
    async fn(context: TestRunContext) {
```

- [ ] **Step 3: Replace lines 782–794 (the end of the definition)**

The current tail is:

```ts
    ignore,
    sanitizeExit,
    sanitizeOps,
    sanitizeResources,
  };

  // work around 1.32.5 bug: https://github.com/denoland/deno/issues/18784
  if (args.ignore === undefined) {
    delete args.ignore;
  }
  Deno.test(args);
}
```

It becomes:

```ts
    ignore,
    sanitize: {
      resources: sanitizeResources,
      ops: sanitizeOps,
      exit: sanitizeExit,
    },
  });
}
```

The body in between is unchanged: `context.origin` (lines 549, 596) and `testFileFromOrigin(context.origin)` keep compiling because `TestRunContext.origin` is a string.

- [ ] **Step 4: Run a unit file and a smoke file through the converted harness**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness.test.ts unit/path.test.ts smoke/render/render-html.test.ts unit/harness-failure-reporting.test.ts`
Expected: `ok | N passed | 0 failed | 1 ignored`. `harness-failure-reporting.test.ts` runs a child harness and inspects its GitHub Actions output, which proves `origin` still flows into the annotations.

- [ ] **Step 5: Commit**

```bash
git add tests/test.ts
git commit -m "tests/test.ts: register through harness.ts instead of Deno.test"
```

### Task 3: The three direct `Deno.test` callers

**Files:**
- Modify: `tests/integration/playwright-tests.test.ts:118-122`, `tests/smoke/logging/log-level-and-formats.test.ts:55-57`, `tests/smoke/create/create.test.ts:31-95`

- [ ] **Step 1: `playwright-tests.test.ts:118`**

Add `import { registerTest } from "../harness.ts";` and replace `Deno.test({` with `registerTest({` (the object already has `name`, `ignore`, `fn`; `fn: async () =>` ignores the context, which is fine).

- [ ] **Step 2: `log-level-and-formats.test.ts:55`**

Add `import { registerTest } from "../../harness.ts";` and replace `Deno.test({` with `registerTest({`.

- [ ] **Step 3: `create.test.ts:34,49,72,89`**

Add `import { registerTest } from "../../harness.ts";`. Line 34:

```ts
    registerTest({
      name: `quarto create ${type} ${template}`,
      fn: async (t) => {
```

Line 49: `await t.step(`> quarto ${type} ${template}`, async () => {` is unchanged (the harness `step` accepts `(name, fn)`).

Lines 72–76 (object form) become:

```ts
      await t.step(`> check writable ${type} ${template}`, () => {
        for (const entry of walkSync(artifactPath)) {
```

with `, { ignore: isWindows })` appended where the object's closing `});` was (keep the step body as is; `isWindows` imported from `../../../src/deno_ral/platform.ts` replaces the `Deno.build.os === "windows"` that PR 19 already rewrote).

Line 89 stays as `await t.step(`> render ${type} ${template}`, async () => {`.

Close the test with `},` + `});` in place of the old `});` so the object form is balanced (the `fn` arrow closes, then the `registerTest` call).

- [ ] **Step 4: Run them**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/create/create.test.ts smoke/logging/log-level-and-formats.test.ts`
Expected: pass. `integration/playwright-tests.test.ts` needs Playwright browsers; run it only if `tests/integration/playwright/node_modules` exists. `deno test --check` type-checks only the listed files and their imports, so type-check the playwright file explicitly: `cd tests && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=../src/import_map.json integration/playwright-tests.test.ts` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/playwright-tests.test.ts tests/smoke/logging/log-level-and-formats.test.ts tests/smoke/create/create.test.ts
git commit -m "tests: route the three direct Deno.test callers through registerTest"
```

### Task 4: `runHarness`, `runtimeScriptCommand` and the hand-converted process sites

**Files:**
- Modify: `tests/utils.ts`, `tests/unit/harness-failure-reporting.test.ts`, `tests/unit/smoke-all-prerender-isolation.test.ts`, `tests/unit/chrome-launch-fixtures.ts`, `tests/quarto-cmd.ts`, `tests/verify.ts`, `tests/unit/dart-sass.test.ts`, `tests/smoke/render/placeholder-typst-text.test.ts`, `tests/smoke/filters/editor-support.test.ts`, `tests/smoke/typst-gather/typst-gather.test.ts`, `tests/unit/project/project-context-unreadable-dir.test.ts`

- [ ] **Step 1: Helpers in `tests/utils.ts`**

Add the imports (merge with existing ones):

```ts
import { exec, execPath, execSync } from "../src/deno_ral/process.ts";
import { env } from "../src/deno_ral/env.ts";
```

Append:

```ts
// The flags run-tests.sh passes to `deno test`, minus --check/--no-check,
// which callers choose. Kept in one place so PR 31 can swap the runtime.
const kHarnessFlags = [
  "--config",
  "test-conf.json",
  "--no-lock",
  "--allow-all",
  "--unstable-kv",
  "--v8-flags=--enable-experimental-regexp-engine",
];

// Runs one test file through the harness in a child process and returns its
// decoded output. `cwd` must be the tests/ directory (the repo root is its parent).
export async function runHarness(options: {
  file: string;
  cwd: string;
  flags?: string[];
  args?: string[];
  env?: Record<string, string>;
  junitPath?: string;
}): Promise<{ stdout: string; stderr: string; code: number }> {
  const quartoRoot = dirname(options.cwd);
  const importMap = `--importmap=${join(quartoRoot, "src", "import_map.json")}`;
  const commandArgs = ["test", ...kHarnessFlags, importMap, ...(options.flags ?? [])];
  if (options.junitPath) {
    commandArgs.push(`--junit-path=${options.junitPath}`);
  }
  commandArgs.push(options.file);
  if (options.args && options.args.length > 0) {
    commandArgs.push("--", ...options.args);
  }
  const result = await exec(execPath(), {
    args: commandArgs,
    cwd: options.cwd,
    env: options.env,
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

// Command line that runs a script with the current JavaScript runtime.
export function runtimeScriptCommand(
  scriptPath: string,
  options?: { allowWritePath?: string },
): { cmd: string; args: string[] } {
  const args = ["run", "--allow-net"];
  if (options?.allowWritePath) {
    args.push(`--allow-write=${options.allowWritePath}`);
  }
  args.push(scriptPath);
  return { cmd: execPath(), args };
}
```

Then add the re-export line from Task 1 step 3 to `tests/harness.ts`: `export { runHarness } from "./utils.ts";`.

Also convert `makeUnreadableDir` (lines 287–307):

```ts
export function makeUnreadableDir(dir: string): () => void {
  if (isWindows) {
    const user = env.get("USERNAME")!;
    const icacls = (...args: string[]) => {
      const result = execSync("icacls", { args: [dir, ...args] });
      if (!result.success) {
        throw new Error(
          `icacls ${args.join(" ")} failed: ${
            new TextDecoder().decode(result.stderr)
          }`,
        );
      }
    };
    icacls("/deny", `${user}:(RD)`);
    return () => icacls("/remove:d", user);
  } else {
    const mode = statSync(dir).mode!;
    chmodSync(dir, 0o000);
    return () => chmodSync(dir, mode & 0o7777);
  }
}
```

(`statSync`/`chmodSync` from `../src/deno_ral/fs.ts`; the codemod in Task 5 would do these two, doing them now keeps the function readable in one diff.)

- [ ] **Step 2: `harness-failure-reporting.test.ts:44-91`**

```ts
async function runFixture(
  opts: {
    githubActions: boolean;
    unwritableSummary?: boolean;
    prefillSummaryBytes?: number;
  },
): Promise<ChildRun> {
  const tmpDir = makeTempDirSync({ prefix: "quarto-harness-report" });
  const summary = opts.unwritableSummary
    ? join(tmpDir, "no-such-dir", "summary.md")
    : join(tmpDir, "summary.md");
  if (opts.prefillSummaryBytes) {
    writeTextFileSync(summary, "x".repeat(opts.prefillSummaryBytes));
  }
  const tests = testsDir();
  const out = await runHarness({
    file: kFixture,
    flags: ["--no-check"],
    cwd: tests,
    env: {
      NO_COLOR: "1",
      GITHUB_ACTIONS: opts.githubActions ? "true" : "",
      GITHUB_STEP_SUMMARY: summary,
      QUARTO_TESTS_GHA_ORCHESTRATED: "",
      RUNNER_OS: "Linux",
    },
  });
  const stdout = stripAnsi(out.stdout + out.stderr);
  let summaryText = "";
  try {
    summaryText = readTextFileSync(summary);
  } catch {
    // The summary may be intentionally unwritable.
  }
  safeRemoveSync(tmpDir, { recursive: true });
  return { stdout, summary: summaryText, code: out.code };
}
```

Imports: `runHarness` from `../utils.ts`; `makeTempDirSync` from `../../src/deno_ral/temp.ts`; `readTextFileSync`, `writeTextFileSync` from `../../src/deno_ral/fs.ts`. The `root`/`dirname` computation and the `--importmap` flag move into `runHarness`.

- [ ] **Step 3: `smoke-all-prerender-isolation.test.ts:158-190`**

Replace the `importMapArg` constant and the `new Deno.Command(Deno.execPath(), {...})` block with:

```ts
      const junitPath = join(tmpRoot, "report.xml");
      const out = await runHarness({
        file: "smoke/smoke-all.test.ts",
        junitPath,
        args: [
          join(projectDir, "broken-a.qmd"),
          join(projectDir, "broken-b.qmd"),
          join(projectDir, "broken-c.qmd"),
          join(smokeAllDir, "healthy-canary.qmd"),
        ],
        cwd: testsDir,
      });
```

and adapt the lines that follow (they read `out.stdout`/`out.stderr` after `await command.output()` and decode them; `runHarness` returns strings, so drop the `TextDecoder` calls and use `out.code`). Keep the rest of the assertions untouched.

- [ ] **Step 4: `chrome-launch-fixtures.ts:23-51`**

```ts
export async function writeFakeExecutable(
  dir: string,
  name: string,
  scriptLines: string[],
  allowWritePath?: string,
): Promise<string> {
  const scriptPath = join(dir, `${name}.js`);
  await writeTextFile(scriptPath, scriptLines.join("\n"));

  const { cmd, args } = runtimeScriptCommand(scriptPath, { allowWritePath });
  const quoted = args.map((a) => `"${a}"`).join(" ");
  if (isWindows) {
    const cmdPath = join(dir, `${name}.cmd`);
    await writeTextFile(cmdPath, `@echo off\r\n"${cmd}" ${quoted} %*\r\n`);
    return cmdPath;
  }
  const shPath = join(dir, `${name}.sh`);
  await writeTextFile(shPath, `#!/bin/sh\n"${cmd}" ${quoted} "$@"\n`);
  await chmod(shPath, 0o755);
  return shPath;
}
```

Imports: `runtimeScriptCommand` from `../utils.ts`; `writeTextFile`, `chmod` from `../../src/deno_ral/fs.ts` (assumes PR 09 exports the async `chmod`; if only `chmodSync` exists, use it); `isWindows` from `../../src/deno_ral/platform.ts` (PR 19 already did this line); `join` from `../../src/deno_ral/path.ts` (if the file still imports from bare `path`, change that import line here; Task 5 rewrites the remaining bare `path` importers).

- [ ] **Step 5: `tests/quarto-cmd.ts`**

Imports (merge): `import { exec, execSync, killProcess, spawn } from "../src/deno_ral/process.ts"; import { isNotFound } from "../src/deno_ral/errors.ts";`

Lines 164–170:

```ts
  const result = execSync(bin, {
    args: ["--version"],
    stdout: "piped",
    stderr: "piped",
    env: buildBinaryEnv(),
    clearEnv: true,
  });
```

Lines 218–222:

```ts
      const result = await exec("taskkill", {
        args: ["/PID", String(pid), "/T", "/F"],
        stdout: "null",
        stderr: "piped",
      });
```

Lines 234, 245, 319: `Deno.kill(pid, "SIGKILL")` → `killProcess(pid, "SIGKILL")` (and `killProcess(target, "SIGKILL")`).

Lines 276–280:

```ts
      const result = execSync("pgrep", {
        args: ["-P", String(current)],
        stdout: "piped",
        stderr: "piped",
      });
```

Line 322: `if (!(e instanceof Deno.errors.NotFound)) {` → `if (!isNotFound(e)) {`.

Lines 457–475: the spawn plus `child.output()`:

```ts
  const child = spawn(bin, {
    args: spawnArgs,
    cwd: options.cwd ?? cwd(),
    env: buildBinaryEnv(options.env),
    clearEnv: true,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });

  let timedOut = false;
  let killPromise: Promise<KillOutcome> | undefined;
  const timer = setTimeout(() => {
    timedOut = true;
    killPromise = killProcessTree(child.pid);
  }, timeoutMs);

  // Drain both streams to avoid pipe-buffer deadlocks.
  const [stdoutBytes, stderrBytes, status] = await Promise.all([
    readAllBytes(child.stdout),
    readAllBytes(child.stderr),
    child.status,
  ]);
  const output = { code: status.code, success: status.success, stdout: stdoutBytes, stderr: stderrBytes };
  clearTimeout(timer);
```

with this helper added near the top of the file:

```ts
async function readAllBytes(
  stream: ReadableStream<Uint8Array> | null,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of stream) {
    chunks.push(chunk);
    total += chunk.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
```

`cwd` comes from `../src/deno_ral/process.ts` (the codemod would have done `Deno.cwd()` → `cwd()`; do it here since the line is being rewritten). The later uses (`output.stderr` at 495, `output.code` at 502, 521, 536, 540) keep working through the `output` object built above.

- [ ] **Step 6: The small ones**

`tests/verify.ts:845-851`:

```ts
      const output = await exec("pdftotext", {
        args: [file, "-"],
        stdout: "piped",
      });
      assert(output.success, `Failed to extract text from ${file}.`);
      const text = new TextDecoder().decode(output.stdout);
```

`tests/unit/dart-sass.test.ts:25-27` and `35-37`: `await new Deno.Command("cmd", { args: [...] }).output()` → `await exec("cmd", { args: [...] })` (both; `result.success`/`result.stderr` keep working).

`tests/smoke/render/placeholder-typst-text.test.ts:28`: `const { code } = await new Deno.Command(typstBinaryPath(), {` → `const { code } = await exec(typstBinaryPath(), {` and delete the trailing `}).output();` → `});`.

`tests/smoke/filters/editor-support.test.ts:13-20`:

```ts
  const child = spawn(quartoDevBinCmd(), {
    args: ["editor-support", "crossref"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
    ...quartoSpawnEnvOptions(),
  });
  const writer = child.stdin!.getWriter();
```

Then read lines 25–35 of that file: it awaits `child.output()` after closing the writer; replace with the same `readAllBytes` pattern (copy the helper into this file or export it from `tests/utils.ts` as `readAllBytes` and import it in both places; exporting is the DRY choice: add it to `tests/utils.ts` and import in `quarto-cmd.ts` and `editor-support.test.ts`).

`tests/smoke/typst-gather/typst-gather.test.ts:473`: `Deno.execPath()` → `execPath()` with `import { execPath } from "../../../src/deno_ral/process.ts";`.

`tests/unit/project/project-context-unreadable-dir.test.ts:72-75`:

```ts
            walkError = await assertRejects(
              () => projectContext(root, notebookContext(), undefined, force),
            );
            assert(isPermissionDenied(walkError), `expected a permission error, got ${walkError}`);
```

with `isPermissionDenied` from `../../../src/deno_ral/errors.ts` and `assert` from the file's existing assertion import (Task 5 moves it to `../../asserts.ts`).

- [ ] **Step 7: Run the touched tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/dart-sass.test.ts unit/project/project-context-unreadable-dir.test.ts smoke/render/placeholder-typst-text.test.ts smoke/filters/editor-support.test.ts smoke/typst-gather/typst-gather.test.ts smoke/render/render-pdf.test.ts`
Expected: pass (`render-pdf` exercises `verify.ts`'s `pdftotext`; it is skipped without `pdftotext`).

Binary-mode check of `quarto-cmd.ts`'s spawn path: `QUARTO_TEST_BIN=/path/to/an/installed/quarto cd tests && ./run-tests.sh --agent smoke/render/render-html.test.ts` → pass (if no installed Quarto is available, say so in the PR; CI's `test-smokes-built.yml` covers it).

- [ ] **Step 8: Commit**

```bash
git add tests/utils.ts tests/unit/harness-failure-reporting.test.ts tests/unit/smoke-all-prerender-isolation.test.ts tests/unit/chrome-launch-fixtures.ts tests/quarto-cmd.ts tests/verify.ts tests/unit/dart-sass.test.ts tests/smoke/render/placeholder-typst-text.test.ts tests/smoke/filters/editor-support.test.ts tests/smoke/typst-gather/typst-gather.test.ts tests/unit/project/project-context-unreadable-dir.test.ts
git commit -m "tests: runHarness/runtimeScriptCommand helpers; process sites on deno_ral/process and errors"
```

### Task 5: Assertions and std imports in the test tree

**Files:**
- Modify: `tests/asserts.ts`, `tests/test-deps.ts`, the 157 `testing/asserts` importers, `tests/smoke/inspect/{inspect-code-cells,inspect-extensions,inspect-include,inspect-recursive-include}.test.ts`, `tests/test.ts`, `tests/verify.ts`, `tests/smoke/lua-unit/quarto-version-repr.test.ts`, `tests/smoke/run/run-script.test.ts`, the 7 bare-`path` importers

- [ ] **Step 1: Extend `tests/asserts.ts` with the four names tests use and PR 02 did not export**

```ts
/** The assertions tests use. Tests import from here, never from "testing/asserts" or "@std/assert". */
export {
  assert,
  assertEquals,
  assertFalse,
  assertInstanceOf,
  AssertionError,
  assertMatch,
  assertNotEquals,
  assertObjectMatch,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
  fail,
} from "testing/asserts";
```

- [ ] **Step 2: Rewrite the importers with PR 22's tool**

```bash
tools/rewrite-import-specifier.sh testing/asserts tests/asserts.ts tests | wc -l
tools/rewrite-import-specifier.sh https://deno.land/std@0.93.0/assert/assert_object_match.ts tests/asserts.ts tests
tools/rewrite-import-specifier.sh fmt/colors src/deno_ral/colors.ts tests
tools/rewrite-import-specifier.sh encoding/base64 src/deno_ral/encoding.ts tests
tools/rewrite-import-specifier.sh fs/eol src/deno_ral/fs.ts tests
tools/rewrite-import-specifier.sh path src/deno_ral/path.ts tests
git checkout -- tests/docs tests/run-parallel-tests.ts
```

Expected: `157`; then 4 (the inspect tests); 2 (`tests/test.ts`, `tests/verify.ts`); 1; 1; 7 (the build-ts-extension fixture is skipped by the tool). The `git checkout` keeps the user-script fixtures and `run-parallel-tests.ts` as they are (the tool would only touch them if they imported these specifiers; the command is a guard).

Then `tests/test-deps.ts` by hand: line 2 becomes `import * as _asserts from "./asserts.ts";` and delete lines 5–6 (the commented `http/` imports).

- [ ] **Step 3: Type-check all test files**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')`
Expected: every unit test compiles and passes (`--check` is on in `run-tests.sh`).
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/inspect/ -name '*.test.ts') smoke/run/run-script.test.ts $(find smoke/lua-unit/ -name '*.test.ts') smoke/render/render-html.test.ts smoke/jupyter/cache.test.ts` → pass.
Run: the std-import acceptance grep → nothing.

- [ ] **Step 4: Commit**

```bash
git add tests
git commit -m "tests: assertions through tests/asserts.ts; std imports through src/deno_ral"
```

### Task 6: Codemod, one directory per commit

README ground rule 7 applies to this task: run the codemod on fresh `main`, open and merge the same day (the reviewer is booked; the local smoke run of step 3 is budgeted in that day); a conflict is reset + re-run, never a hand merge; the baseline is regenerated per ground rule 8. PR 20 edits `tests/run-tests.sh` and two unit tests this codemod rewrites: land PR 20 first (README ground rule 8 merge order), or re-run the codemod after it merges.


**Files:** every remaining file with `Deno.` under `tests/unit`, `tests/smoke`, `tests/integration`, `tests/tools`, `tests/*.ts`

- [ ] **Step 1: Measure before**

```bash
for d in tests/unit tests/smoke tests/integration tests/tools; do printf "%s: " $d; grep -rhoE '\bDeno\.[A-Za-z_]+' $d --include=*.ts | wc -l; done; printf "tests/*.ts: "; grep -hoE '\bDeno\.[A-Za-z_]+' tests/*.ts | wc -l
```

Expected (after Tasks 1–4): roughly `tests/unit: 330`, `tests/smoke: 320`, `tests/integration: 13`, `tests/tools: 5`, `tests/*.ts: 90`. Record the exact numbers in the PR description.

- [ ] **Step 2: `tests/unit`**

```bash
quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests/unit --dry-run | head -50
quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests/unit
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') && cd ..
grep -rnE '\bDeno\.' tests/unit --include=*.ts | grep -v 'chrome-launch'
```

Expected: the dry run shows only `Deno.x(` → `x(` substitutions plus added imports; the unit suite passes; the final grep prints nothing. Fix by hand anything the codemod skipped (it prints `skipped: <file>:<line> <reason>` for forms it does not recognise, e.g. `Deno.readTextFileSync` used as a value rather than called).

```bash
git add tests/unit && git commit -m "tests/unit: codemod Deno.* to deno_ral"
```

- [ ] **Step 3: `tests/smoke`**

Same three commands with `--dir tests/smoke`, then `./run-tests.sh --agent $(find smoke/ -name '*.test.ts')` (slow: 30–60 min; run the subset `$(find smoke/render/ -name '*.test.ts') $(find smoke/project/ -name '*.test.ts') $(find smoke/use/ -name '*.test.ts') $(find smoke/check/ -name '*.test.ts')` locally and let CI run the rest), then the grep over `tests/smoke` must print nothing.

```bash
git add tests/smoke && git commit -m "tests/smoke: codemod Deno.* to deno_ral"
```

- [ ] **Step 4: `tests/integration`, `tests/tools`, top-level**

```bash
quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests/integration
quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests/tools
quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests
```

The third run is idempotent over the subdirectories already done and rewrites `tests/test.ts`, `tests/utils.ts`, `tests/verify.ts`, `tests/verify-snapshot.ts`, `tests/puppeteer.ts`, `tests/verify-pdf-*.ts`, `tests/quarto-cmd.ts`, `tests/gha-grouping.ts`. It must not touch `tests/docs/**` or `tests/run-parallel-tests.ts` (both are `quarto run` scripts executed by whatever Quarto is installed): pass `--exclude tests/docs --exclude tests/run-parallel-tests.ts` if the tool supports it, otherwise run `git checkout -- tests/docs tests/run-parallel-tests.ts` before committing and say so in the PR.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') smoke/render/render-html.test.ts $(find smoke/check/ -name '*.test.ts')`
Run: `cd tests && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=../src/import_map.json integration/playwright-tests.test.ts tools/check-gha-log.ts`
Expected: pass / exit 0.

```bash
git add tests/integration tests/tools tests/*.ts && git commit -m "tests: codemod top-level, integration and tools files to deno_ral"
```

- [ ] **Step 5: Measure after**

Rerun the Step 1 loop. Expected: `tests/unit` 8 (the chrome-launch string literals), `tests/*.ts` 11 (`harness.ts` 3, `run-parallel-tests.ts` 8), all others 0. Record in the PR description.

### Task 7: `tests/run-parallel-tests.ts`: replace the removed `Deno.run`

The script stays a `quarto run` user script (see Context): `tests/run-parallel-tests.sh` and its `quarto run run-parallel-tests.ts $*` line are unchanged, the `stdlib/*` imports and their `https://deno.land/std` fallback stay, and the codemod must not touch the file.

**Files:**
- Modify: `tests/run-parallel-tests.ts:256-266`

- [ ] **Step 1: Check the codemod left the file alone**

Run: `git diff main -- tests/run-parallel-tests.ts`
Expected: empty (Task 6 step 4 excluded it). The file keeps `Deno.args`, `Deno.cwd`, `Deno.exit` and `Deno.readTextFileSync`, which an installed Quarto provides to `quarto run` scripts (Deno today, PR 35's shim on Node), while `src/deno_ral/` is not importable there.

- [ ] **Step 2: Replace `Deno.run` (lines 256–266)**

```ts
  // LOCAL EXECUTION ON CORES
  console.log("Running `run-test.sh` in parallel... ");
  Promise.all(buckets.map((bucket) => {
    // Deno.Command, not the removed Deno.run: this file runs under
    // `quarto run` with whatever Quarto is installed (PR 35 shims Command).
    return new Deno.Command("./run-tests.sh", {
      args: bucket.map((tt) => tt.name),
      stdout: "inherit",
      stderr: "inherit",
    }).spawn().status;
  })).then(() => {
    console.log("Running `run-test.sh` in parallel... END");
  });
```

(The unused `i` parameter of the old callback is dropped.)

- [ ] **Step 3: Verify with the dev Quarto and with an installed one**

Run: `cd tests && ./run-parallel-tests.sh --dry-run | head -3` → the start of the bucket JSON (requires `timing.txt`, which is committed).
Run: `cd tests && ./run-parallel-tests.sh -n=4 --json-for-ci --timing-file=timing-for-ci.txt | head -5` → a JSON array of four arrays (what `.github/workflows/test-smokes-parallel.yml:61-71` consumes; `grep -n run-parallel .github/workflows/*.yml` shows it still calls the script with those flags).
Run the same `--json-for-ci` command with an installed release Quarto first on `PATH` (`PATH=/path/to/quarto-release/bin:$PATH`) → the same JSON. This is the CI configuration; it must not need `--dev`.
Run: `grep -c 'Deno\.' tests/run-parallel-tests.ts` → `8`; `grep -n 'Deno.run' tests/run-parallel-tests.ts` → nothing.

- [ ] **Step 4: Commit**

```bash
git add tests/run-parallel-tests.ts
git commit -m "tests/run-parallel-tests: Deno.Command instead of the removed Deno.run; stays a quarto run script"
```

### Task 8: Ratchet and docs

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → `tests` `Deno.` count drops to 19 (`tests/docs` is outside the scope, PR 02) and `tests` std-import files to 1 (`run-parallel-tests.ts`).
- [ ] **Step 2:** In `tests/README.md`, under the section that describes `test.ts`, add:

```markdown
Tests are registered through `tests/harness.ts` (`registerTest`), the only
place that calls the runtime's test API. Child harness runs go through
`runHarness()` in `tests/utils.ts`. Test code imports `src/deno_ral/` for
file, process and environment access, never `Deno.*` directly, and
assertions from `tests/asserts.ts`. Two exceptions: the fake Chrome scripts
in `tests/unit/chrome-launch*.test.ts` (Deno programs written as strings,
PR 31) and `run-parallel-tests.ts`, a `quarto run` script executed by the
installed Quarto in CI, which cannot import `src/`.
```

- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json tests/README.md
git commit -m "ratchet baseline after the tests codemod; document the harness seam"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` → pass.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/ -name '*.test.ts')` → pass (CI).
- `cd tests && ./run-parallel-tests.sh --dry-run` → works with the dev and with an installed `quarto`.
- Acceptance greps → as stated.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.

## Review checklist

- [ ] `tests/harness.ts` is the only `Deno.test` caller; `origin`, the three sanitizer flags and `ignore` reach Deno unchanged.
- [ ] `runHarness` passes the flags of `run-tests.sh:72` minus `--check` and minus `--max-old-space-size`/`--max-heap-size` (as today's child `deno test` invocations in `harness-failure-reporting.test.ts` and `smoke-all-prerender-isolation.test.ts` do), the import map, `--junit-path` when given, and the `--` separator before `args`; it is importable from both `tests/utils.ts` and `tests/harness.ts` (PR 31 uses the latter).
- [ ] `TestDefinition` is a superset of the vocabulary's (`fn: () => void` and `sanitize: boolean` still accepted), so PR 31's Node branch only has to add `origin` and `step` to the context it passes.
- [ ] `quarto-cmd.ts` timeout/kill path: `killProcessTree` still runs on timeout and `child.status` resolves after the kill (the `Promise.all` must not hang: both streams end when the process dies).
- [ ] Codemod diffs contain only `Deno.` prefix removals and import lines (`git diff -U0 <commit> | grep '^[-+]' | grep -v 'import\|Deno\.' | grep -v '^[-+][-+]'` is empty for the three codemod commits).
- [ ] `tests/docs/**` untouched.
- [ ] Residue documented in the PR description with the exact remaining lines.

## Risks and rollback

- The codemod may rewrite `Deno.` inside template strings in the chrome-launch tests (turning the fake Chrome scripts into non-Deno code). Check `git diff tests/unit/chrome-launch*.test.ts` after Task 5 step 2 and revert any change inside backticks.
- `spawn()` with `stdin: "null"` for `runQuarto` in binary mode: previously `Deno.Command.spawn()` defaulted stdin to `inherit`; tests never write to it, and `null` prevents a hang if `quarto` ever reads stdin. If a smoke test starts hanging in binary mode, switch to `stdin: "inherit"`.
- Rollback: revert per commit; Task 1–3 (harness) can land alone if the codemod needs more time.

## Decisions needed

None. Not changed because: the first draft switched `run-parallel-tests.sh` to `quarto run --dev` to let the script import `src/deno_ral/`; CI runs it with an installed release Quarto, which cannot resolve `--dev`'s import map (review, PR 23 blocker), so the script stays a `quarto run` script and only its removed `Deno.run` is replaced.
