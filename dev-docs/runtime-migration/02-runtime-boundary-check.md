# PR 02: Runtime boundary ratchet in CI, and `tests/asserts.ts`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A committed baseline of `Deno.*` call sites and direct std-library imports (outside the std allow-list below) per scope (TypeScript under `src/`, JavaScript under `src/`, runtime-loaded resources, `package/src`, `tests`), a script that fails when any count rises, a GitHub Actions job that runs it on every PR, and the `tests/asserts.ts` assertion seam.
**Phase:** 0. **Lands first in Phase 0**: every other Phase 0 plan lowers (or, for `tests` only, explicitly accepts) this baseline in the same change. **Depends on:** none. **Unblocks:** 00a, 00b, 00c, 01, 03–07, and every Phase 1 PR (08–14, 22, 25 drive the baseline down).
**Branch:** `rt/02-runtime-boundary-check`.
**Suggested executor:** Sonnet. The script, the fixture and the expected numbers are fully specified below; the only judgement is re-measuring if `main` moved.
**Size:** S (6 new files: script, baseline, assertion seam, two unit tests, workflow; one line added to `src/import_map.json`).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` section 11, "Order of work", step 1, and `README.md` ground rule 2: application code never calls `Deno.*` and imports the standard library directly only where a module is an import-map seam (the std boundary rule below); everything else goes through `src/deno_ral/`. Today that is a habit, not a check. The migration lowers the counts PR by PR, so a ratchet is needed: the allowed number is a committed baseline that can only go down.

`REVIEW-2026-10-15.md` S1 found the first draft of this ratchet blind to JavaScript files and to the resources Quarto loads at runtime (`tree-sitter-deno.js`, `graphviz-wasm.js`, `deno-cri/*.js`), and its std-import rule blind to full `https://deno.land/std` URLs, `jsr:@std` specifiers, single-quoted imports and the `http/` import-map key, while counting `deno.land/x` packages (`semver`, `xml`, `xmlp`, `media_types`, `another_cookiejar`) as std. This plan fixes all of that and adds two scopes with their own baselines.

Scopes (the scope keys are the baseline JSON keys; PR 25 relies on `"src"` and `"package/src"`):

| Scope | Files counted | Excluded |
|---|---|---|
| `src` | `.ts` under `src/` | `kSrcExclusions` (below) |
| `src-js` | `.js`, `.mjs` under `src/` | `src/vendor`, `src/resources` (counted by `resources`, so no file is counted twice) |
| `resources` | `.js`, `.mjs` under `src/resources/`, plus the `.ts` under `src/resources/scripts/` and `src/resources/create/` (the user-script fixtures and templates `src` excludes) | `src/resources/extension-subtrees` (upstream subtree, decision 7 of the review: no in-tree edit), `src/resources/deno_std/cache` (gitignored `DENO_DIR` written by `configure.sh`) |
| `package/src` | `.ts` under `package/src/` | none |
| `tests` | `.ts` under `tests/` | `kTestsExclusions`: `tests/docs` (documents and user-script fixtures run by Quarto; PR 35 keeps their `Deno.*` on purpose as shim regression fixtures) and `tests/asserts.ts` (the assertion seam this PR adds) |

`node_modules` and `.venv` are skipped everywhere.

**The std boundary rule (owned by this plan; PR 22, PR 25, `README.md` and `_TEMPLATE.md` refer here).** A direct import of the standard library is a boundary violation unless the module is an *import-map seam*: a std module with no runtime `Deno.*` inside, whose import-map key is the only thing PR 26's Node resolver has to map. The scanner holds that set as `kStdAllowListed`, derived from the inventory table in PR 22 ("Import-map key / Runtime `Deno.*` inside / Owner", the rows owned by "import map"):

| Allow-listed (not counted) | Counted (a violation until routed through `src/deno_ral/`) |
|---|---|
| `async`, `async/*`; `crypto`, `crypto/*`; `datetime`, `datetime/*`; `streams`, `streams/*`; `io/*`; `log`, `log/*` except `log/file-handler`; `fmt/printf`; `dotenv/stringify` | everything else: `fmt/colors`, `flags`, `encoding/*`, `fs/*`, `path`, `@std/path`, `http/*`, `testing/*`, `dotenv` (its `load`), `log/file-handler`, `tar`, `bytes`, `uuid`, every `https://deno.land/std` URL and every `jsr:@std` specifier |

A file counts as a `stdImportFiles` hit when at least one non-comment line imports a counted module; a file whose only std imports are allow-listed does not count. The rule is textual: it cannot see a Quarto helper that imports a counted module on the file's behalf (the fixture shows this with `src/core/indirect.ts`, which imports a helper that calls `Deno.*` and imports `fs/exists`: the helper is counted, the importer is not), and it does not say whether an allow-listed module is *safe*; that is PR 22's table (which reads the std sources) and PR 25's hidden-dependency inventory (which proves each std module with internal `Deno.*` has a replacement before Phase 1 closes). Changing the allow-list is a PR 22 change (the table) mirrored here (the constant), never the other way round. The zero PR 25 reaches is therefore "zero counted std imports", not "zero std imports".

Measured on `main` at `b86f98d` with the counting rules of Task 1 (reproduced with a Node 22 port of the same walk and regexes; the first run of the committed script must print exactly these numbers, plus the one `Deno.` occurrence the new unit test adds to `tests`):

| Scope | `Deno.*` occurrences | Files with a direct std import |
|---|---|---|
| `src` | 992 | 49 (62 files import std; 13 import allow-listed modules only) |
| `src-js` | 7 (`src/core/cri/deno-cri/chrome.js` 1, `external-request.js` 1, `src/core/lib/external/tree-sitter-deno.js` 5) | 0 |
| `resources` | 10 (`src/resources/js/graphviz-wasm.js` 3, `scripts/check-usage.ts` 2, `scripts/juice.ts` 2, `create/extensions/engine/src/qstart-filesafename-qend.ejs.ts` 1, and the built `editor/tools/vs-code.mjs` 1 and `editor/tools/yaml/web-worker.js` 1) | 1 (`scripts/check-usage.ts`, `https://deno.land/std@0.76.0/io/bufio.ts`) |
| `package/src` | 240 | 3 (4 files import std; `util/utils.ts` imports `io/write-all` only) |
| `tests` | 813 on `main`; **814** with this PR's unit test | 165 (no test file imports allow-listed modules only) |

The 13 `src` files that import allow-listed modules only, and so are not counted: `src/command/capabilities/cmd.ts`, `src/command/render/render-files.ts`, `src/core/console.ts`, `src/core/date.ts`, `src/core/deno/monkey-patch.ts`, `src/core/download.ts`, `src/core/file.ts`, `src/core/hash.ts`, `src/core/process.ts`, `src/format/html/format-html-scss.ts`, `src/format/jats/format-jats-postprocess.ts`, `src/format/pdf/format-pdf.ts`, `src/preview/preview-server.ts` (`src/core/log.ts` imports `log/file-handler` and is counted; `src/quarto-core/dotenv.ts` imports `dotenv` and is counted). Reproduced with a Python port of Task 1's walk and regexes on `b86f98d`: without the allow-list the port prints 62, 0, 1, 4, 165, the first draft's numbers.

How the numbers relate to the first draft's 992/75, 240/2, 840/161: `Deno.*` counts are unchanged for `src` and `package/src`. Before the allow-list, `src` std files fall from 75 to 62: 15 files drop because their only "std" import was a `deno.land/x` package (`src/quarto.ts`, `src/command/check/check.ts`, `src/command/create/artifacts/artifact-shared.ts`, `src/command/use/commands/binder/binder.ts`, `binder-types.ts`, `src/core/git.ts`, `src/execute/engine.ts`, `src/execute/jupyter/jupyter.ts`, `src/extension/extension.ts`, `src/extension/types.ts`, `src/project/project-environment.ts`, `project-environment-types.ts`, `src/project/types/manuscript/meca.ts`, `src/project/types/website/website-sitemap.ts`, `src/publish/rsconnect/api/index.ts`), and two are added by the full-URL rule (`src/vendor_deps.ts`, `src/resources/tools/ast-diagram/main.ts`). The comment-line rule keeps `src/core/lib/external/colors.ts:14` and `src/core/sass/analyzer/get-dependencies.ts:2` out (a JSDoc example and a commented-out import). `package/src` std files rise from 2 to 4 (`package/src/common/import-report/find-bad-imports.ts` and `find-bad-types-constants.ts` import `jsr:/@std/fmt@^0.224.0/colors`). `tests` loses the 27 `Deno.` occurrences under `tests/docs` (840 → 813) and gains four std files (`tests/run-parallel-tests.ts` and three of the four `tests/smoke/inspect/*.test.ts` that import `https://deno.land/std@0.93.0/assert/assert_object_match.ts`; the fourth already imported `testing/asserts`).

Per module (all 62 `src` files with any std import, allow-listed ones included), the files split as: `fmt` 26, `encoding` 12, `testing` 9, `io` 6, `flags` 4, `log` 3, `crypto` 2, `async` 2, `dotenv` 2, full `deno.land/std` URL 2, `fs` 1, `datetime` 1, `streams` 1 (a file can import several). `tests`: `testing` 157, `path` 8, `deno.land/std` URL 5, `fmt` 2, `encoding` 1, `fs` 1.

`kSrcExclusions` (unchanged from the first draft; PR 25 relies on the list): `src/deno_ral/` (the layer itself), `src/vendor/`, `src/resources/extension-subtrees/` (subtree of `PumasAI/quarto-julia-engine`, overwritten by `quarto dev-call pull-git-subtree`), `src/resources/scripts/` and `src/resources/create/` (counted by the `resources` scope instead; PR 35 owns the scripts and PR 36 the engine template, per the runtime residue table in PR 25) and `src/webui/quarto-preview/build.ts` (that package's own build script, run with `--no-config` so it cannot import the layer; allow-listed until PR 33 deletes it).

The `Deno.` rule counts textual occurrences, comments and strings included (as in the first draft; the codemod PRs remove those too). The std-import rule ignores lines that start with `//`, `/*` or `*` (comment lines), so commented-out imports and JSDoc examples do not count.

The two counters are all the ratchet sees. A Deno CLI spawn written without `Deno.` on the line (`execPath()` or `QUARTO_DENO` after PR 08, a `deno` command in a launcher such as `package/src/quarto-bld`, `configure.sh` or a `.cmd` file, a `deno run` in a workflow) is not a count and never lowers or raises a baseline. Those are the rows of the runtime residue table in PR 25 (Context), and the check that they are all listed at a phase boundary is PR 25 Task 7 step 2's `rg -n 'execPath\(\)|QUARTO_DENO'` over `package/src` and `src`, repeated by PR 33 and PR 37 at their gates, not this script (review `REVIEW-2026-10-16.md` R02, "Later validation").

`tests/asserts.ts` moves here from PR 22's design: the tests that later plans add import assertions from it, so PR 31 can swap the assertion library in one file. This PR only adds the seam and its test; migrating the 157 existing `testing/asserts` importers is PR 22/PR 23 work.

The seam re-exports from `@std/assert` 0.224.0 through a new import-map key, `"@std/assert": "jsr:@std/assert@0.224.0"`, not from `testing/asserts` (Decisions needed, "The seam's source"). `testing/asserts` resolves to `jsr:/@std/testing@0.224.0/asserts.ts`, a deprecated shim whose functions delegate to `@std/assert` but which declares its own `AssertionError` class, so `assert(false)` throws an error that is not `instanceof` the `AssertionError` the shim exports. `@std/assert` 0.224.0 is the version the shim already depends on; the `testing/` key stays (157 test files and 9 `src` files still import it). `@std/assert` joins `kStdModules`, so a test that imports it directly instead of through the seam is counted.

The `tests` scope has a ratchet too, but tests written before PR 09 lands (PR 09 adds `deno_ral` `fs`/`temp` with `readTextFileSync`, `writeTextFileSync`, `makeTempDirSync`) have no way to touch files without `Deno.*`. Those PRs (PR 01: +6, PR 05: +1, and PR 08 if its tests write files) run `--update-baseline --accept-tests-increase`, which lowers every other scope as usual and sets `tests` to the current counts; the PR description lists each new test file and its `Deno.` count. From PR 09 on, `--accept-tests-increase` is not used (`_TEMPLATE.md` rule: new tests use `deno_ral`).

`quarto run --dev` (how the script runs) sets `DENO_DIR` to the user cache copy of `src/resources/deno_std/cache` (`initDenoCache` in `src/core/run/deno.ts:95-119`), not to `package/dist/bin/deno_cache`; the first run downloads the script's graph (the `@std/fs` and `@std/path` versions in `src/import_map.json`) into that cache, so the CI job needs network, which it has.

### Scope

In:
- `tools/check-runtime-boundary.ts`: counts per scope, compares with the baseline, exits 1 on any increase; `--update-baseline` rewrites the baseline with lower counts only; `--accept-tests-increase` (with `--update-baseline`) also accepts a higher `tests` count.
- `tools/runtime-boundary-baseline.json`: the committed baseline (five scopes).
- `tests/asserts.ts`: the assertion seam, and its import-map key `@std/assert` in `src/import_map.json`.
- `tests/unit/tools/check-runtime-boundary.test.ts`, `tests/unit/asserts.test.ts`.
- `.github/workflows/runtime-boundary.yml`: runs the script on pull requests and pushes to `main`.

Out:
- A `deno lint` plugin (mentioned in the assessment as a later replacement for the regexes).
- Any change to the counted code, and migrating existing tests to `tests/asserts.ts` (PR 22/23).
- `tools/` itself (never counted: it is build and migration tooling; PR 33/38 own it).
- Counting Deno CLI invocations and launchers (`execPath()`, `QUARTO_DENO`, `deno …` in shell or workflow files): the runtime residue table in PR 25 and its `rg` check own those (Context, last paragraph).

### Interfaces

`tools/check-runtime-boundary.ts` exports (the CLI part is guarded by `import.meta.main`, so the unit test imports the module without running it):

```ts
/** One scope's counts. */
export interface BoundaryCounts {
  /** Number of `\bDeno\.` matches across the scope's files (comments and strings included). */
  denoCalls: number;
  /** Number of the scope's files with at least one direct std import (see hasStdImport). */
  stdImportFiles: number;
}

/** Keyed by scope name: "src", "src-js", "resources", "package/src", "tests". */
export type Baseline = Record<string, BoundaryCounts>;

/** What one scope counts. Paths are relative to the repository root, forward slashes. */
export interface ScopeSpec {
  dir: string;
  /** File-name suffixes counted, e.g. [".ts"] (".d.ts" and ".ejs.ts" match ".ts"). */
  exts: string[];
  /** Paths never counted; a directory excludes everything beneath it. */
  exclude: string[];
  /** Optional extra filter on the relative path, applied after `exclude`. */
  include?: (rel: string) => boolean;
}

/** Import-map names that resolve to the std library (`src/import_map.json`). deno.land/x packages are not std. */
export const kStdModules: readonly string[]; // async bytes crypto datetime dotenv encoding flags fmt fs http io log path @std/path @std/assert streams tar testing uuid

/** The std boundary rule (Context): import-map seams that are not counted. Exact names and `name/` prefixes;
 * `log/file-handler` is counted although `log/` is a prefix here. Mirrors the "import map" rows of PR 22's table. */
export const kStdAllowListed: readonly string[]; // async async/ crypto crypto/ datetime datetime/ streams streams/ io/ log log/ fmt/printf dotenv/stringify
export const kStdCountedExceptions: readonly string[]; // log/file-handler

/** True when `specifier` (the import string as written) is an allow-listed std import. URLs and jsr: specifiers never are. */
export function isAllowListedStdImport(specifier: string): boolean;

/** Matches one direct std import on a line: an import-map std name (optionally followed by "/..."), a
 * `https://deno.land/std[@version]/...` URL, or a `jsr:@std/...` / `jsr:/@std/...` specifier, in single or
 * double quotes, after `from` or `import` / `import(`. The specifier is capture group 1. */
export const kStdImportRe: RegExp;

/** True when a non-comment line of `text` matches kStdImportRe with a specifier that is not allow-listed. */
export function hasStdImport(text: string): boolean;

/** Never counted in the `src` scope (PR 25 relies on this list and does not extend it). */
export const kSrcExclusions: readonly string[]; // src/deno_ral, src/vendor, src/resources/extension-subtrees, src/resources/scripts, src/resources/create, src/webui/quarto-preview/build.ts

/** Never counted in the `tests` scope. */
export const kTestsExclusions: readonly string[]; // tests/docs, tests/asserts.ts

/** The five scopes, in report order. */
export const kScopes: Readonly<Record<string, ScopeSpec>>;

/** Count one scope under `root`. Skips node_modules and .venv. */
export function countScope(root: string, spec: ScopeSpec): BoundaryCounts;

/** Count every scope in kScopes under `root`. */
export function measure(root: string): Baseline;

/** One message per scope/field above the baseline (regressions) and one per scope/field below it (improvements). */
export function compareToBaseline(current: Baseline, baseline: Baseline): { regressions: string[]; improvements: string[] };

/** Field-wise minimum of current and baseline (a baseline can only go down). A scope missing from the baseline takes the current counts. */
export function lowerBaseline(current: Baseline, baseline: Baseline): Baseline;

/** lowerBaseline, except that the `tests` scope takes the current counts even when they are higher. */
export function acceptTestsIncrease(current: Baseline, baseline: Baseline): Baseline;
```

CLI contract (`quarto run --dev tools/check-runtime-boundary.ts [--update-baseline [--accept-tests-increase]] [--root <dir>]`, from the repository root):

- prints a table of current counts against the baseline;
- exit 0 when no count exceeds the baseline; one `::notice::` line per count below the baseline;
- exit 1 with one `::error::` line per regression;
- `--update-baseline`: writes `lowerBaseline(current, baseline)` (2-space JSON, trailing newline) and exits 0;
- `--update-baseline --accept-tests-increase`: writes `acceptTestsIncrease(current, baseline)`, prints `::warning::tests baseline raised from <old> to <new>` for each raised field, exits 0;
- `--accept-tests-increase` without `--update-baseline`: exit 2 with a usage message;
- `--root <dir>`: repository root (default: the current directory); exit 2 if `<root>/src/quarto.ts` does not exist.

`tests/asserts.ts`:

```ts
/** The assertions tests use. Tests import from here, never from "testing/asserts" or "@std/assert". */
export {
  assert,
  assertEquals,
  AssertionError,
  assertMatch,
  assertObjectMatch,
  assertRejects,
  assertStringIncludes,
  assertThrows,
  fail,
} from "@std/assert"; // src/import_map.json: "@std/assert": "jsr:@std/assert@0.224.0"
```

### Files

- Create: `tools/check-runtime-boundary.ts` (counting, comparison, CLI)
- Create: `tools/runtime-boundary-baseline.json` (baseline)
- Create: `tests/asserts.ts` (assertion seam)
- Modify: `src/import_map.json` (one key: `"@std/assert": "jsr:@std/assert@0.224.0"`, after `"@std/path"`)
- Create: `tests/unit/tools/check-runtime-boundary.test.ts` (unit tests on a temp fixture)
- Create: `tests/unit/asserts.test.ts` (the seam's exports)
- Create: `.github/workflows/runtime-boundary.yml` (CI job)
- Modify: `dev-docs/runtime-migration/README.md` (status column of the PR 02 row only)

### Acceptance criteria

- `quarto run --dev tools/check-runtime-boundary.ts` on the PR branch prints the five scopes with counts equal to the baseline and exits 0.
- The baseline is `src` 992/49, `src-js` 7/0, `resources` 10/1, `package/src` 240/3, `tests` 814/165 (or the numbers the script prints on the PR's merge-base, if `main` moved; the PR description shows the script output).
- Adding one `Deno.cwd()` call to any file under `src/command/` makes the same command exit 1 with `::error::src: Deno.* calls rose from 992 to 993 ...`; adding one to `src/core/cri/deno-cri/chrome.js` reports `src-js`; adding `import { join } from 'https://deno.land/std/path/mod.ts';` to a file under `src/core/` reports `src: std-import files rose`; adding `import { delay } from "async";` to a file under `src/core/` that imports no std module reports nothing (allow-listed).
- `--update-baseline` never raises a number; `--update-baseline --accept-tests-increase` raises only `tests`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts unit/asserts.test.ts` → `10 passed`.
- The `Runtime Boundary` workflow runs on the PR and is green.

## Plan

### Task 1: The assertion seam

**Files:**
- Create: `tests/asserts.ts`
- Modify: `src/import_map.json`
- Test: `tests/unit/asserts.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/unit/asserts.test.ts`:

```ts
/*
 * asserts.test.ts
 *
 * tests/asserts.ts is the one module tests import assertions from (so the
 * assertion library can be swapped in one place when the tests run on Node).
 * This pins the exported names and that they behave like @std/assert.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import {
  assert,
  assertEquals,
  AssertionError,
  assertMatch,
  assertObjectMatch,
  assertRejects,
  assertStringIncludes,
  assertThrows,
  fail,
} from "../asserts.ts";

// deno-lint-ignore require-await
unitTest("asserts - passing assertions return normally", async () => {
  assert(true);
  assertEquals({ a: [1, 2] }, { a: [1, 2] });
  assertMatch("quarto 1.11", /\d+\.\d+/);
  assertObjectMatch({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 2 } });
  assertStringIncludes("render html", "html");
});

unitTest("asserts - failing assertions throw AssertionError", async () => {
  assertThrows(() => assert(false), AssertionError);
  assertThrows(() => assertEquals(1, 2), AssertionError);
  assertThrows(() => fail("boom"), AssertionError, "boom");
  await assertRejects(() => Promise.reject(new TypeError("x")), TypeError, "x");
});
```

- [x] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/asserts.test.ts`
Expected: FAIL at type-check time, `Module not found "file:///.../tests/asserts.ts"`.

- [ ] **Step 3: Create the seam and its import-map key**

In `src/import_map.json`, add one line after `"@std/path": "jsr:@std/path@1.0.8",`:

```json
    "@std/assert": "jsr:@std/assert@0.224.0",
```

Leave the `"testing/"` key as it is. The key changes the import map's hash, which the dev launcher compares with its installed configuration (`src/quarto.ts:78`, `src/core/devconfig.ts`): on Linux and macOS the next `quarto` command reconfigures by itself, on Windows it stops with "Quarto requires reconfiguration"; run `./configure.cmd` once before Task 3's `quarto run --dev`. The test runner in Step 4 does not go through that check.

Create `tests/asserts.ts`:

```ts
/*
 * asserts.ts
 *
 * The assertions tests use. Tests import from here, never from
 * "testing/asserts" or "@std/assert" directly, so the assertion library can
 * be swapped in one place (dev-docs/runtime-migration, PR 31).
 * Not "testing/asserts": that module declares its own AssertionError, which
 * its assert() and fail() do not throw.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

export {
  assert,
  assertEquals,
  AssertionError,
  assertMatch,
  assertObjectMatch,
  assertRejects,
  assertStringIncludes,
  assertThrows,
  fail,
} from "@std/assert";
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/asserts.test.ts`
Expected: two dots, `2 passed`. With `from "testing/asserts"` instead, the second test fails with `Expected error to be instance of "AssertionError", but was "AssertionError"`.

- [ ] **Step 5: Commit**

```bash
git add src/import_map.json tests/asserts.ts tests/unit/asserts.test.ts
git commit -m "Add tests/asserts.ts as the single assertion import for tests"
```

### Task 2: The counting and comparison module

**Files:**
- Create: `tools/check-runtime-boundary.ts`
- Test: `tests/unit/tools/check-runtime-boundary.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/tools/check-runtime-boundary.test.ts`. The fixture strings are assembled from `DENO`, `FROM` and `IMPORT` so that this file's own text contains no `Deno.`, no `from "<std>"` and no `import("<std>")`; otherwise the ratchet would count the fixtures in the `tests` scope.

```ts
/*
 * check-runtime-boundary.test.ts
 *
 * Unit tests for the runtime boundary ratchet (tools/check-runtime-boundary.ts).
 * The fixture repository is written to a temp directory so the tests do not
 * depend on the real counts.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";
import { createTempContext } from "../../../src/core/temp.ts";
import {
  acceptTestsIncrease,
  compareToBaseline,
  countScope,
  hasStdImport,
  kScopes,
  lowerBaseline,
  measure,
} from "../../../tools/check-runtime-boundary.ts";

// Built at runtime so this file's text is not counted by the ratchet itself.
const DENO = ["De", "no"].join("") + ".";
const FROM = ["fr", "om"].join("");
const IMPORT = ["im", "port"].join("");

function writeFixture(root: string, rel: string, contents: string) {
  const parts = rel.split("/");
  ensureDirSync(join(root, ...parts.slice(0, -1)));
  Deno.writeTextFileSync(join(root, ...parts), contents);
}

function makeRepo(root: string) {
  writeFixture(root, "src/quarto.ts", "export {};\n");
  // src: 2 calls, 1 std file (import-map name, double quotes)
  writeFixture(
    root,
    "src/command/a.ts",
    `import { blue } ${FROM} "fmt/colors";\nconst x = ${DENO}cwd();\nconst y = ${DENO}env.get("X");\nconsole.log(blue(x), y);\n`,
  );
  // "DenoX." must not match \bDeno\.
  writeFixture(root, "src/core/b.ts", "const DenoX = { a: 1 }; console.log(DenoX.a);\n");
  // std file: full deno.land/std URL in single quotes
  writeFixture(root, "src/core/c.ts", `import { assertObjectMatch } ${FROM} 'https://deno.land/std@0.93.0/assert/assert_object_match.ts';\n`);
  // std file: dynamic jsr:@std import
  writeFixture(root, "src/core/d.ts", `const p = await ${IMPORT}("jsr:@std/path@1.0.8");\nexport { p };\n`);
  // not std: deno.land/x package and the semver import-map name
  writeFixture(root, "src/core/e.ts", `import { satisfies } ${FROM} "semver/mod.ts";\nimport { stringify } ${FROM} "https://deno.land/x/xml@2.1.1/mod.ts";\n`);
  // not std: commented-out import
  writeFixture(root, "src/core/f.ts", `// import { assert } ${FROM} "jsr:@std/assert";\nexport const f = 1;\n`);
  // std file: the http/ import-map key
  writeFixture(root, "src/core/g.ts", `import { serveDir } ${FROM} "http/file-server";\n`);
  // not counted: allow-listed import-map seams only (the std boundary rule)
  writeFixture(root, "src/core/h.ts", `import { delay } ${FROM} "async";\nimport { getLogger } ${FROM} "log";\nimport { readAll } ${FROM} "io/read-all";\nimport { sprintf } ${FROM} "fmt/printf";\n`);
  // std file: log/file-handler is the counted exception under the log/ prefix
  writeFixture(root, "src/core/i.ts", `import { FileHandler } ${FROM} "log/file-handler";\n`);
  // R01 "Later validation": a forbidden filesystem import (1 std file) next to a call (1 call), in a helper...
  writeFixture(root, "src/core/helper.ts", `import { exists } ${FROM} "fs/exists";\nexport const cwd = () => ${DENO}cwd();\nexport { exists };\n`);
  // ...and the importer of that helper: an indirect Deno dependency the textual rule does not see (0 calls, 0 std files)
  writeFixture(root, "src/core/indirect.ts", `import { cwd, exists } ${FROM} "./helper.ts";\nexport const here = cwd();\nexport const ok = exists(here);\n`);
  // excluded from src
  writeFixture(root, "src/deno_ral/c.ts", `import { walk } ${FROM} "fs/walk";\n${DENO}cwd();\n`);
  writeFixture(root, "src/vendor/d.ts", `${DENO}cwd();\n`);
  writeFixture(root, "src/resources/extension-subtrees/julia-engine/src/j.ts", `import { exists } ${FROM} "fs/exists";\n${DENO}cwd();\n`);
  writeFixture(root, "src/resources/extension-subtrees/julia-engine/_extensions/j.js", `${DENO}cwd();\n`);
  writeFixture(root, "src/webui/quarto-preview/build.ts", `${DENO}cwd();\n`);
  // a sibling of the excluded file is counted in src
  writeFixture(root, "src/webui/quarto-preview/m.ts", `${DENO}cwd();\n`);
  // src-js
  writeFixture(root, "src/e.js", `${DENO}cwd();\n`);
  // resources: .js anywhere, .ts only under scripts/ and create/
  writeFixture(root, "src/resources/js/r.js", `import { join } ${FROM} "https://deno.land/std/path/mod.ts";\n${DENO}env.get("X");\n`);
  writeFixture(root, "src/resources/scripts/k.ts", `${DENO}cwd();\n`);
  writeFixture(root, "src/resources/create/l.ejs.ts", `${DENO}cwd();\n`);
  writeFixture(root, "src/resources/deno_std/cache/npm/x.js", `${DENO}cwd();\n`);
  // skipped tree
  writeFixture(root, "src/webui/node_modules/f.ts", `${DENO}cwd();\n`);
  // package/src: g.ts imports an allow-listed module only (not counted); h.ts a counted one
  writeFixture(root, "package/src/g.ts", `import { readAll } ${FROM} "io/read_all";\n${DENO}exit(0);\n`);
  writeFixture(root, "package/src/h.ts", `import { walk } ${FROM} "fs/walk";\n`);
  // tests: 1 call, 2 std files; tests/docs and tests/asserts.ts excluded
  writeFixture(root, "tests/h.test.ts", `import { assert } ${FROM} "testing/asserts";\nimport { x } ${FROM} "@std/path";\n`);
  writeFixture(root, "tests/i.test.ts", `import { y } ${FROM} "https://deno.land/std@0.93.0/assert/mod.ts";\n${DENO}cwd();\n`);
  writeFixture(root, "tests/asserts.ts", `export { assert } ${FROM} "testing/asserts";\n`);
  writeFixture(root, "tests/docs/prepost/pre.ts", `${DENO}cwd();\n`);
}

const kExpected = {
  "src": { denoCalls: 4, stdImportFiles: 6 },
  "src-js": { denoCalls: 1, stdImportFiles: 0 },
  "resources": { denoCalls: 3, stdImportFiles: 1 },
  "package/src": { denoCalls: 1, stdImportFiles: 1 },
  "tests": { denoCalls: 1, stdImportFiles: 2 },
};

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - countScope counts each scope of the fixture", async () => {
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    makeRepo(root);
    for (const [name, spec] of Object.entries(kScopes)) {
      assertEquals(
        countScope(root, spec),
        kExpected[name as keyof typeof kExpected],
        `scope ${name}`,
      );
    }
  } finally {
    temp.cleanup();
  }
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - measure returns the five scopes in order", async () => {
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    makeRepo(root);
    const result = measure(root);
    assertEquals(Object.keys(result), ["src", "src-js", "resources", "package/src", "tests"]);
    assertEquals(result, kExpected);
  } finally {
    temp.cleanup();
  }
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - hasStdImport covers URLs, jsr, quotes, http/, skips comments and the allow-list", async () => {
  const yes = [
    `import { FileHandler } ${FROM} "log/file-handler";`,
    `import { load } ${FROM} "dotenv";`,
    `import { blue } ${FROM} "fmt/colors";`,
    `import { blue } ${FROM} 'fmt/colors';`,
    `import { a } ${FROM} "https://deno.land/std@0.93.0/assert/assert_object_match.ts";`,
    `import { join } ${FROM} "https://deno.land/std/path/mod.ts";`,
    `const p = await ${IMPORT}("https://deno.land/std/path/mod.ts");`,
    `import { brightBlue } ${FROM} "jsr:/@std/fmt@^0.224.0/colors";`,
    `import { assert } ${FROM} "jsr:@std/assert";`,
    `import { serveDir } ${FROM} "http/file-server";`,
    `import { x } ${FROM} "@std/path";`,
    `import { assert } ${FROM} "@std/assert";`,
    `import {\n  exists,\n} ${FROM} "fs/exists";`,
    `export { walk } ${FROM} "fs/walk";`,
  ];
  const no = [
    `import { satisfies } ${FROM} "semver/mod.ts";`,
    `import { SAXParser } ${FROM} "xmlp/mod.ts";`,
    `import x ${FROM} "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";`,
    `import { join } ${FROM} "./path.ts";`,
    `import fs ${FROM} "node:fs";`,
    `import { delay } ${FROM} "async";`,
    `import { crypto } ${FROM} "crypto/crypto";`,
    `import { parse } ${FROM} "datetime/parse";`,
    `import { TextLineStream } ${FROM} "streams/text-line-stream";`,
    `import { readAll } ${FROM} "io/read-all";`,
    `import { getLogger } ${FROM} "log";`,
    `import { BaseHandler } ${FROM} "log/base-handler";`,
    `import { sprintf } ${FROM} "fmt/printf";`,
    `import { stringify } ${FROM} "dotenv/stringify";`,
    `// import { assert } ${FROM} "jsr:@std/assert";`,
    ` * import { bgBlue } ${FROM} "https://deno.land/std@$STD_VERSION/fmt/colors";`,
  ];
  for (const text of yes) assert(hasStdImport(text), `expected std import: ${text}`);
  for (const text of no) assert(!hasStdImport(text), `expected no std import: ${text}`);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - an indirect Deno dependency is counted at the helper, not at its importer", async () => {
  // The std boundary rule is textual (Context): src/core/indirect.ts in the fixture imports ./helper.ts,
  // which calls Deno and imports fs/exists. In a repository holding the importer alone, src counts nothing;
  // the helper is what the fixture's kExpected.src counts (its 1 call and 1 std file are in the 4 and 6).
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    writeFixture(root, "src/quarto.ts", "export {};\n");
    writeFixture(root, "src/core/indirect.ts", `import { cwd, exists } ${FROM} "./helper.ts";\nexport const here = cwd();\nexport const ok = exists(here);\n`);
    assertEquals(countScope(root, kScopes["src"]), { denoCalls: 0, stdImportFiles: 0 });
  } finally {
    temp.cleanup();
  }
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - compareToBaseline reports regressions and improvements", async () => {
  const baseline = {
    "src": { denoCalls: 10, stdImportFiles: 3 },
    "tests": { denoCalls: 5, stdImportFiles: 1 },
  };
  const current = {
    "src": { denoCalls: 11, stdImportFiles: 2 },
    "tests": { denoCalls: 5, stdImportFiles: 1 },
  };
  assertEquals(compareToBaseline(current, baseline), {
    regressions: ["src: Deno.* calls rose from 10 to 11"],
    improvements: ["src: std-import files fell from 3 to 2"],
  });
  assertEquals(compareToBaseline(baseline, baseline), { regressions: [], improvements: [] });
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - a scope missing from the baseline is a regression", async () => {
  assertEquals(compareToBaseline({ "src-js": { denoCalls: 1, stdImportFiles: 0 } }, {}), {
    regressions: ["src-js: Deno.* calls rose from 0 to 1"],
    improvements: [],
  });
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - lowerBaseline never raises a number", async () => {
  const baseline = { "src": { denoCalls: 10, stdImportFiles: 3 }, "tests": { denoCalls: 5, stdImportFiles: 1 } };
  assertEquals(
    lowerBaseline({ "src": { denoCalls: 12, stdImportFiles: 1 }, "tests": { denoCalls: 7, stdImportFiles: 1 } }, baseline),
    { "src": { denoCalls: 10, stdImportFiles: 1 }, "tests": { denoCalls: 5, stdImportFiles: 1 } },
  );
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - acceptTestsIncrease raises tests only", async () => {
  const baseline = { "src": { denoCalls: 10, stdImportFiles: 3 }, "tests": { denoCalls: 5, stdImportFiles: 1 } };
  assertEquals(
    acceptTestsIncrease({ "src": { denoCalls: 12, stdImportFiles: 1 }, "tests": { denoCalls: 7, stdImportFiles: 2 } }, baseline),
    { "src": { denoCalls: 10, stdImportFiles: 1 }, "tests": { denoCalls: 7, stdImportFiles: 2 } },
  );
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts`
Expected: FAIL at type-check time, `Module not found "file:///.../tools/check-runtime-boundary.ts"`.

- [ ] **Step 3: Write the script**

Create `tools/check-runtime-boundary.ts`:

```ts
/*
 * check-runtime-boundary.ts
 *
 * Runtime boundary ratchet for the Deno -> Node migration
 * (dev-docs/runtime-migration/02-runtime-boundary-check.md).
 *
 * Counts, per scope, the `Deno.` occurrences and the files that import the
 * standard library directly instead of through src/deno_ral/, and fails when
 * any count exceeds the committed baseline.
 *
 * Usage (from the repository root):
 *   quarto run --dev tools/check-runtime-boundary.ts
 *   quarto run --dev tools/check-runtime-boundary.ts --update-baseline
 *   quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-tests-increase
 *   quarto run --dev tools/check-runtime-boundary.ts --root /path/to/quarto-cli
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { existsSync, walkSync } from "../src/deno_ral/fs.ts";
import { join, relative } from "../src/deno_ral/path.ts";

export interface BoundaryCounts {
  denoCalls: number;
  stdImportFiles: number;
}

export type Baseline = Record<string, BoundaryCounts>;

export interface ScopeSpec {
  dir: string;
  exts: string[];
  exclude: string[];
  include?: (rel: string) => boolean;
}

export const kBaselineRelPath = "tools/runtime-boundary-baseline.json";

/** Import-map names that resolve to the std library. deno.land/x packages are not std. */
export const kStdModules: readonly string[] = [
  "async",
  "bytes",
  "crypto",
  "datetime",
  "dotenv",
  "encoding",
  "flags",
  "fmt",
  "fs",
  "http",
  "io",
  "log",
  "path",
  "@std/path",
  "@std/assert",
  "streams",
  "tar",
  "testing",
  "uuid",
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const kStdImportRe = new RegExp(
  `(?:\\bfrom|\\bimport)\\s*\\(?\\s*["']((?:` +
    `(?:${kStdModules.map(escapeRe).join("|")})(?:/[^"']*)?` +
    `|https://deno\\.land/std(?:@[^/"']*)?/[^"']*` +
    `|jsr:/?@std/[^"']*` +
    `))["']`,
);

/** The std boundary rule (dev-docs/runtime-migration/02-runtime-boundary-check.md, Context):
 * import-map seams with no runtime Deno.* inside (PR 22's inventory table) are not counted.
 * Exact names, or prefixes ending in "/". */
export const kStdAllowListed: readonly string[] = [
  "async", "async/",
  "crypto", "crypto/",
  "datetime", "datetime/",
  "streams", "streams/",
  "io/",
  "log", "log/",
  "fmt/printf",
  "dotenv/stringify",
];

/** Counted although a prefix above matches: @std/log's FileHandler calls Deno.openSync (PR 20b replaces it). */
export const kStdCountedExceptions: readonly string[] = ["log/file-handler"];

export function isAllowListedStdImport(specifier: string): boolean {
  if (kStdCountedExceptions.includes(specifier)) {
    return false;
  }
  return kStdAllowListed.some((entry) =>
    entry.endsWith("/") ? specifier.startsWith(entry) : specifier === entry
  );
}

const kCommentLineRe = /^\s*(\/\/|\/\*|\*)/;

export function hasStdImport(text: string): boolean {
  return text.split("\n").some((line) => {
    if (kCommentLineRe.test(line)) {
      return false;
    }
    const match = kStdImportRe.exec(line);
    return match !== null && !isAllowListedStdImport(match[1]);
  });
}

/** Never counted in the `src` scope. A directory entry covers every file beneath it. */
export const kSrcExclusions: readonly string[] = [
  "src/deno_ral", // the runtime layer itself
  "src/vendor", // vendored dependencies
  "src/resources/extension-subtrees", // git subtree of PumasAI/quarto-julia-engine, maintained upstream
  "src/resources/scripts", // `quarto run` fixtures under the user-script runtime (PR 35); counted in `resources`
  "src/resources/create", // .ejs.ts extension templates for users (engine template: PR 36); counted in `resources`
  "src/webui/quarto-preview/build.ts", // that package's own build script (allow-listed until PR 33 deletes it)
];

/** Never counted in the `tests` scope. */
export const kTestsExclusions: readonly string[] = [
  "tests/docs", // documents and user-script fixtures run by Quarto (PR 35 keeps their Deno.* on purpose)
  "tests/asserts.ts", // the assertion seam: the one test file that imports @std/assert
];

const kUserScriptResourceDirs = ["src/resources/scripts/", "src/resources/create/"];

export const kScopes: Readonly<Record<string, ScopeSpec>> = {
  "src": { dir: "src", exts: [".ts"], exclude: [...kSrcExclusions] },
  "src-js": {
    dir: "src",
    exts: [".js", ".mjs"],
    exclude: ["src/vendor", "src/resources"],
  },
  "resources": {
    dir: "src/resources",
    exts: [".js", ".mjs", ".ts"],
    exclude: [
      "src/resources/extension-subtrees",
      "src/resources/deno_std/cache",
    ],
    include: (rel) =>
      !rel.endsWith(".ts") ||
      kUserScriptResourceDirs.some((d) => rel.startsWith(d)),
  },
  "package/src": { dir: "package/src", exts: [".ts"], exclude: [] },
  "tests": { dir: "tests", exts: [".ts"], exclude: [...kTestsExclusions] },
};

const kDenoRe = /\bDeno\./g;
const kSkip = [/node_modules/, /\.venv/];

function isExcluded(rel: string, exclude: string[]): boolean {
  return exclude.some((e) => rel === e || rel.startsWith(e + "/"));
}

export function countScope(root: string, spec: ScopeSpec): BoundaryCounts {
  let denoCalls = 0;
  let stdImportFiles = 0;
  const dir = join(root, ...spec.dir.split("/"));
  if (!existsSync(dir)) {
    return { denoCalls, stdImportFiles };
  }
  for (
    const entry of walkSync(dir, {
      exts: spec.exts,
      includeDirs: false,
      skip: kSkip,
    })
  ) {
    const rel = relative(root, entry.path).replaceAll("\\", "/");
    if (isExcluded(rel, spec.exclude)) {
      continue;
    }
    if (spec.include && !spec.include(rel)) {
      continue;
    }
    const text = Deno.readTextFileSync(entry.path);
    denoCalls += (text.match(kDenoRe) ?? []).length;
    if (hasStdImport(text)) {
      stdImportFiles++;
    }
  }
  return { denoCalls, stdImportFiles };
}

export function measure(root: string): Baseline {
  const result: Baseline = {};
  for (const [name, spec] of Object.entries(kScopes)) {
    result[name] = countScope(root, spec);
  }
  return result;
}

const kFieldLabels: Record<keyof BoundaryCounts, string> = {
  denoCalls: "Deno.* calls",
  stdImportFiles: "std-import files",
};
const kFields = ["denoCalls", "stdImportFiles"] as const;

export function compareToBaseline(
  current: Baseline,
  baseline: Baseline,
): { regressions: string[]; improvements: string[] } {
  const regressions: string[] = [];
  const improvements: string[] = [];
  for (const [scope, counts] of Object.entries(current)) {
    const base = baseline[scope] ?? { denoCalls: 0, stdImportFiles: 0 };
    for (const field of kFields) {
      if (counts[field] > base[field]) {
        regressions.push(
          `${scope}: ${kFieldLabels[field]} rose from ${base[field]} to ${counts[field]}`,
        );
      } else if (counts[field] < base[field]) {
        improvements.push(
          `${scope}: ${kFieldLabels[field]} fell from ${base[field]} to ${counts[field]}`,
        );
      }
    }
  }
  return { regressions, improvements };
}

export function lowerBaseline(current: Baseline, baseline: Baseline): Baseline {
  const result: Baseline = {};
  for (const [scope, counts] of Object.entries(current)) {
    const base = baseline[scope] ?? counts;
    result[scope] = {
      denoCalls: Math.min(counts.denoCalls, base.denoCalls),
      stdImportFiles: Math.min(counts.stdImportFiles, base.stdImportFiles),
    };
  }
  return result;
}

export function acceptTestsIncrease(
  current: Baseline,
  baseline: Baseline,
): Baseline {
  const result = lowerBaseline(current, baseline);
  if (current["tests"]) {
    result["tests"] = { ...current["tests"] };
  }
  return result;
}

function readBaseline(path: string): Baseline {
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(Deno.readTextFileSync(path)) as Baseline;
}

function printTable(current: Baseline, baseline: Baseline) {
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(pad("scope", 14) + pad("Deno.* calls", 24) + "std-import files");
  for (const [scope, counts] of Object.entries(current)) {
    const base = baseline[scope];
    const cell = (field: keyof BoundaryCounts) =>
      `${counts[field]} (baseline ${base ? base[field] : "none"})`;
    console.log(
      pad(scope, 14) + pad(cell("denoCalls"), 24) + cell("stdImportFiles"),
    );
  }
}

if (import.meta.main) {
  const args = [...Deno.args];
  const rootIndex = args.indexOf("--root");
  const root = rootIndex >= 0 ? args[rootIndex + 1] : Deno.cwd();
  const update = args.includes("--update-baseline");
  const acceptTests = args.includes("--accept-tests-increase");

  if (acceptTests && !update) {
    console.error(
      "check-runtime-boundary: --accept-tests-increase is only valid with --update-baseline",
    );
    Deno.exit(2);
  }
  if (!existsSync(join(root, "src", "quarto.ts"))) {
    console.error(
      `check-runtime-boundary: ${root} is not the quarto-cli root (src/quarto.ts not found); run from the repository root or pass --root`,
    );
    Deno.exit(2);
  }

  const baselinePath = join(root, ...kBaselineRelPath.split("/"));
  const baseline = readBaseline(baselinePath);
  const current = measure(root);

  console.log(`Runtime boundary check (baseline: ${kBaselineRelPath})`);
  printTable(current, baseline);

  if (update) {
    const next = acceptTests
      ? acceptTestsIncrease(current, baseline)
      : lowerBaseline(current, baseline);
    if (acceptTests && baseline["tests"]) {
      for (const field of kFields) {
        if (next["tests"][field] > baseline["tests"][field]) {
          console.log(
            `::warning::tests baseline raised from ${baseline["tests"][field]} to ${
              next["tests"][field]
            } (${kFieldLabels[field]}); list the new test files in the PR description`,
          );
        }
      }
    }
    Deno.writeTextFileSync(baselinePath, JSON.stringify(next, null, 2) + "\n");
    console.log(`Baseline written to ${kBaselineRelPath}`);
    Deno.exit(0);
  }

  const { regressions, improvements } = compareToBaseline(current, baseline);
  for (const line of improvements) {
    console.log(
      `::notice::${line}; run 'quarto run --dev tools/check-runtime-boundary.ts --update-baseline' and commit ${kBaselineRelPath}`,
    );
  }
  if (regressions.length > 0) {
    for (const line of regressions) {
      console.log(
        `::error::${line} (baseline ${kBaselineRelPath}). Application code must use src/deno_ral/ instead of Deno.* or direct std imports; see dev-docs/runtime-migration/README.md`,
      );
    }
    Deno.exit(1);
  }
  console.log("OK: no count exceeds the baseline.");
}
```

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts unit/asserts.test.ts`
Expected: ten dots, `10 passed`.

- [ ] **Step 5: Lint the script and tests**

Run: `package/dist/bin/tools/x86_64/deno lint tools/check-runtime-boundary.ts tests/unit/tools/check-runtime-boundary.test.ts tests/asserts.ts tests/unit/asserts.test.ts`
Expected: `Checked 4 files`.

- [ ] **Step 6: Commit**

```bash
git add tools/check-runtime-boundary.ts tests/unit/tools/check-runtime-boundary.test.ts
git commit -m "Add runtime boundary ratchet script

Counts Deno. occurrences and direct std imports (import-map std names,
deno.land/std URLs, jsr:@std specifiers) per scope: src, src-js,
resources, package/src, tests. deno.land/x packages are not std."
```

### Task 3: The baseline

**Files:**
- Create: `tools/runtime-boundary-baseline.json`

- [ ] **Step 1: Run the script without a baseline**

Run: `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"`
Expected (if `main` moved since `b86f98d`, the printed numbers are the new truth; put them in the PR description):
```
Runtime boundary check (baseline: tools/runtime-boundary-baseline.json)
scope         Deno.* calls            std-import files
src           992 (baseline none)     49 (baseline none)
src-js        7 (baseline none)       0 (baseline none)
resources     10 (baseline none)      1 (baseline none)
package/src   240 (baseline none)     3 (baseline none)
tests         814 (baseline none)     165 (baseline none)
::error::src: Deno.* calls rose from 0 to 992 (baseline tools/runtime-boundary-baseline.json). ...
::error::src: std-import files rose from 0 to 49 ...
::error::src-js: Deno.* calls rose from 0 to 7 ...
::error::resources: Deno.* calls rose from 0 to 10 ...
::error::resources: std-import files rose from 0 to 1 ...
::error::package/src: Deno.* calls rose from 0 to 240 ...
::error::package/src: std-import files rose from 0 to 3 ...
::error::tests: Deno.* calls rose from 0 to 814 ...
::error::tests: std-import files rose from 0 to 165 ...
exit=1
```

- [ ] **Step 2: Write the baseline**

Run: `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline && cat tools/runtime-boundary-baseline.json`
Expected file contents:

```json
{
  "src": {
    "denoCalls": 992,
    "stdImportFiles": 49
  },
  "src-js": {
    "denoCalls": 7,
    "stdImportFiles": 0
  },
  "resources": {
    "denoCalls": 10,
    "stdImportFiles": 1
  },
  "package/src": {
    "denoCalls": 240,
    "stdImportFiles": 3
  },
  "tests": {
    "denoCalls": 814,
    "stdImportFiles": 165
  }
}
```

- [ ] **Step 3: Confirm the check passes against the baseline**

Run: `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"`
Expected: the table with `(baseline 992)` etc., then `OK: no count exceeds the baseline.` and `exit=0`.

- [ ] **Step 4: Prove the ratchet catches a regression in each kind of file**

Run:
```bash
echo 'const _rt02 = Deno.cwd();' >> src/command/utils.ts
echo 'Deno.cwd();' >> src/core/cri/deno-cri/chrome.js
echo "import { join as _rt02j } from 'https://deno.land/std/path/mod.ts';" >> src/core/text.ts
echo 'import { delay as _rt02d } from "async";' >> src/core/path.ts
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"
git checkout -- src/command/utils.ts src/core/cri/deno-cri/chrome.js src/core/text.ts src/core/path.ts
```
Expected: `::error::src: Deno.* calls rose from 992 to 993`, `::error::src: std-import files rose from 49 to 50` (`text.ts` only: `path.ts` gained an allow-listed import, which does not count), `::error::src-js: Deno.* calls rose from 7 to 8`, and `exit=1`; the last command restores the files.

- [ ] **Step 5: Prove `--update-baseline` never raises and `--accept-tests-increase` raises only `tests`**

Run:
```bash
echo 'const _rt02 = Deno.cwd();' >> src/command/utils.ts
echo 'const _rt02 = Deno.cwd();' >> tests/utils.ts
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline
git diff --stat tools/runtime-boundary-baseline.json
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-tests-increase
git diff tools/runtime-boundary-baseline.json
git checkout -- src/command/utils.ts tests/utils.ts tools/runtime-boundary-baseline.json
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --accept-tests-increase; echo "exit=$?"
```
Expected: the first `git diff --stat` is empty; after the second run the diff shows only `"denoCalls": 814` → `815` under `tests` and a `::warning::tests baseline raised from 814 to 815` line was printed (`src` stays 992); the last command prints the usage message and `exit=2`.

- [ ] **Step 6: Commit**

```bash
git add tools/runtime-boundary-baseline.json
git commit -m "Add runtime boundary baseline

Measured on main: src 992 Deno. occurrences / 49 std-import files
(allow-listed import-map seams not counted), src-js 7 / 0,
resources 10 / 1, package/src 240 / 3, tests 814 / 165."
```

### Task 4: The CI workflow

**Files:**
- Create: `.github/workflows/runtime-boundary.yml`
- Modify: `dev-docs/runtime-migration/README.md` (PR 02 row status)

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/runtime-boundary.yml` (same checkout/action pattern as `.github/workflows/test-bundle.yml`):

```yaml
# Runtime boundary ratchet for the Deno -> Node migration.
# Fails when the number of `Deno.` occurrences or direct std-library imports
# (per scope: src, src-js, resources, package/src, tests) rises above
# tools/runtime-boundary-baseline.json.
# See dev-docs/runtime-migration/02-runtime-boundary-check.md.
name: Runtime Boundary
on:
  workflow_dispatch:
  pull_request:
    branches: [main]
    paths:
      - "src/**"
      - "package/src/**"
      - "tests/**"
      - "tools/check-runtime-boundary.ts"
      - "tools/runtime-boundary-baseline.json"
      - ".github/workflows/runtime-boundary.yml"
  push:
    branches: [main]
    paths:
      - "src/**"
      - "package/src/**"
      - "tests/**"
      - "tools/check-runtime-boundary.ts"
      - "tools/runtime-boundary-baseline.json"
      - ".github/workflows/runtime-boundary.yml"

permissions:
  contents: read

jobs:
  runtime-boundary:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v6

      - name: Set Path
        shell: bash
        run: |
          echo "$HOME/bin" >> $GITHUB_PATH

      - name: Configure Quarto
        uses: ./.github/workflows/actions/quarto-dev

      - name: Check runtime boundary
        shell: bash
        run: |
          quarto run --dev tools/check-runtime-boundary.ts
```

- [ ] **Step 2: Validate the YAML locally**

Run: `package/dist/bin/tools/x86_64/deno eval 'import { parse } from "jsr:@std/yaml@1.0.5"; console.log(Object.keys(parse(Deno.readTextFileSync(".github/workflows/runtime-boundary.yml")) as Record<string, unknown>))'`
Expected: `[ "name", "on", "permissions", "jobs" ]`.

- [ ] **Step 3: Update the README status row**

In `dev-docs/runtime-migration/README.md`, change the PR 02 row's last cell from `planned` to `in progress`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/runtime-boundary.yml dev-docs/runtime-migration/README.md
git commit -m "Run the runtime boundary ratchet in CI"
```

- [ ] **Step 5: Push and watch the job**

After opening the PR, the `Runtime Boundary` check must appear and pass. If `quarto` is not on `PATH` in the job, the `Set Path` step is missing (compare with `test-bundle.yml`).

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts unit/asserts.test.ts` → `10 passed`.
- `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` → `OK: no count exceeds the baseline.`, exit 0.
- Task 3 steps 4 and 5 (regressions detected in `src` and `src-js`; baseline never raised except `tests` with the explicit flag).
- `package/dist/bin/tools/x86_64/deno lint tools/check-runtime-boundary.ts tests/asserts.ts` → clean.
- The `Runtime Boundary` workflow is green on the PR.

## Review checklist

- [ ] Baseline numbers equal the script's output on the merge-base of the PR (re-run on `main` if the PR branch is behind); the PR description pastes the table.
- [ ] `kStdModules` is exactly the 19 std names of `src/import_map.json` after Task 1 (async, bytes, crypto, datetime, dotenv, encoding, flags, fmt, fs, http, io, log, path, @std/path, @std/assert, streams, tar, testing, uuid) and contains none of `semver`, `media_types`, `xml`, `xmlp`, `another_cookiejar`, `yaml`.
- [ ] `kStdImportRe` accepts single and double quotes, `deno.land/std` with and without a version, `jsr:@std` and `jsr:/@std`; `hasStdImport` skips comment lines.
- [ ] `kStdAllowListed` and `kStdCountedExceptions` equal the "import map" rows of PR 22's inventory table (`async`, `crypto`, `datetime`, `streams`, `io/*`, `log` and `log/*` except `log/file-handler`, `fmt/printf`, `dotenv/stringify`); a URL or `jsr:` specifier is never allow-listed; the fixture has one file that imports allow-listed modules only and is not counted.
- [ ] The fixture holds the three cases of `REVIEW-2026-10-16.md` R01 "Later validation": a permitted pure import (`src/core/h.ts`, not counted), a forbidden filesystem import (`src/core/helper.ts`, `fs/exists`, counted) and an importer of a helper with an indirect Deno dependency (`src/core/indirect.ts`, not counted; its own test proves it contributes nothing).
- [ ] `kSrcExclusions` is exactly the six entries, each with its reason; `kTestsExclusions` is `tests/docs` and `tests/asserts.ts`; `src-js` and `resources` never count the same file.
- [ ] `--update-baseline` uses `lowerBaseline`; only `--accept-tests-increase` can raise a number, and only `tests`.
- [ ] The unit test file contains no literal `Deno.` and no literal std import (it builds them from `DENO`/`FROM`/`IMPORT`), so it adds exactly one `Deno.` occurrence (`Deno.writeTextFileSync` in `writeFixture`) to `tests` and no std-import file.
- [ ] `tests/asserts.ts` exports the nine names of `_TEMPLATE.md`'s vocabulary and nothing else, from `"@std/assert"` (not `"testing/asserts"`); `src/import_map.json` gains exactly one key, `"@std/assert": "jsr:@std/assert@0.224.0"`, and its `"testing/"` key is unchanged.
- [ ] The workflow has `permissions: contents: read` and the same `paths` list in both triggers.

## Risks and rollback

- Two PRs that both lower the baseline can merge with a stale baseline on `main`; the check still passes (lower is not a failure) and prints a `::notice::`. The next PR that touches counts runs `--update-baseline`.
- `--accept-tests-increase` weakens the `tests` ratchet until PR 09. The PR description must list each new test file and its `Deno.` count, and reviewers reject any raise not explained by new test files. After PR 09, the flag is not used (`_TEMPLATE.md`).
- The built artifacts `src/resources/editor/tools/vs-code.mjs` and `src/resources/editor/tools/yaml/web-worker.js` are counted in `resources`. They follow their sources (`src/core/lib/yaml-intelligence/`): a PR that removes a `Deno.` from those sources lowers the artifact count after `quarto dev-call build-artifacts`; a `build-artifacts` run can never raise it without the source (counted in `src`) rising first.
- The `Deno.` rule counts comments and strings. Intentional (the codemods remove those too); the std rule skips comment lines because commented-out imports are not dependencies.
- The job adds one `configure.sh` run per PR (about 3 minutes with the Deno cache restored by `quarto-dev`). A later PR can install Deno with `denoland/setup-deno` pinned to `configuration`'s `DENO` and run `deno run --allow-read --import-map src/import_map.json tools/check-runtime-boundary.ts` directly; not part of this PR.
- Rollback: delete the workflow file; the script, the baseline and `tests/asserts.ts` are inert without it.

## Decisions needed

None. Recorded choices (review items closed here):

- **The seam's source (decided 2026-10-21, after Task 1 step 4 failed on the first draft):** `tests/asserts.ts` re-exports from `"@std/assert"`, mapped in `src/import_map.json` to `jsr:@std/assert@0.224.0`, not from `"testing/asserts"`. Evidence, measured with the Deno in `package/dist/bin/tools/x86_64/`:
  - Failure: the first draft's seam failed `asserts - failing assertions throw AssertionError` with `Expected error to be instance of "AssertionError", but was "AssertionError"`.
  - Cause: `"testing/"` maps to `jsr:/@std/testing@0.224.0/`, and `asserts.ts` there is a deprecated shim. It imports `jsr:@std/assert@^0.224.0` as a namespace and delegates every function to it, but declares its own `export class AssertionError extends Error` (same body as `@std/assert`'s: a one-string constructor and `name = "AssertionError"`), so `assert(false)` throws `@std/assert`'s class, not the one the shim exports.
  - Not a duplicate package: `deno info` lists exactly one `@std/assert`, 0.224.0.
  - No `@std/testing` version helps: 0.225.3, the last 0.x, has the same design, and 1.0 removed the module.
  - Graph: with the new key, the seam's module graph is the same 33 remote modules as `testing/asserts`' graph minus the shim file. PR 00b's `tools/check-test-imports.ts` therefore finds them in the locked graph: through `tests/test-deps.ts`'s `testing/asserts` import until PR 23, and through the seam once PR 23 points `test-deps.ts` at `./asserts.ts`.
  - Run: `unit/asserts.test.ts` passed (`2 passed`) together with an existing `testing/asserts` importer, and `deno lint` was clean on both files.
  - Existing importers: none of the 157 importers in `tests/`, nor anything in `src/`, `package/` or `tools/`, tests `instanceof AssertionError`. `tests/test.ts` only constructs it, and `tests/smoke/verify/pdf-text-position.test.ts` imports it unused. So PR 23's move of those importers onto the seam is behavior-identical, and PR 23's four extra names exist in `@std/assert` 0.224.0.

  Alternatives rejected:
  - Keep the shim and weaken the test to `Error` or a `name` check: it gives up the identity pin, which the test exists for (later tests write `assertThrows(fn, AssertionError)` against the seam).
  - Re-export from a raw `jsr:@std/assert@0.224.0` specifier with no import-map key: it passes on Deno. On Node it does not: PR 26 makes the root `package.json` `dependencies` the exact mirror of `src/import_map.json` (`check-deps.mjs`), so `@jsr/std__assert` would be an undeclared package reached only through `@jsr/std__testing`'s own dependency, from PR 26 until PR 31. PR 31 would also still have to edit the seam.

  With the key, PR 31 Task 1 bumps the key's version and edits only the seam's header comment. `@std/assert` is added to `kStdModules` and to PR 22's inventory table as counted, so a direct import outside the seam raises the `tests` count. The `"testing/"` key is not touched, because 157 test files (PR 23) and 9 `src` files (PR 18 owns `src/core/cache/cache.ts`) still import it. The dev launcher sees a changed import-map hash and reconfigures once (Task 1 step 3). PR 02 lands before PR 00b, so no `deno.lock` exists yet to regenerate.

- S1 / review section 4 "02": `.js` and runtime-loaded resources are counted (`src-js`, `resources`), each with its own baseline; the std regex covers full URLs, `jsr:@std`, single quotes, `http/`, and no longer counts `deno.land/x` packages.
- Review "02": the unit tests no longer contradict each other (one fixture, one `kExpected`, used by both `countScope` and `measure`).
- Review "02" (minor): `quarto run --dev` uses the `deno_std` cache copy as `DENO_DIR` (Context, last paragraph).
- `src-js` excludes `src/resources` so that `src-js` and `resources` are disjoint (`_TEMPLATE.md`'s first wording overlapped them; counting a file twice would make one removal lower two baselines).
- The std boundary rule (review `REVIEW-2026-10-16.md` R01, triage B1): the allow-list of import-map seams lives here as `kStdAllowListed`, PR 22's table is its source, PR 25's zero is "zero counted std imports", and `README.md` ground rule 2 and `_TEMPLATE.md` say so. The first draft counted every std import and so made PR 22 (which keeps the seams) and PR 25 (which required zero) contradict each other.
- Re-read against the review's "Later validation" lines (2026-10-16): R01's three fixture cases are in `makeRepo` (`h.ts`, `helper.ts`, `indirect.ts`) with a test for the indirect case; R02's point (a residue check must look at subprocess commands and launchers, not only `Deno.` references) is recorded as a limit of this ratchet in Context and Scope, with PR 25 Task 7 step 2's `rg` named as the check that covers it.
- `kStdModules` keeps PR 22's `http` and leaves out `yaml`: `yaml` maps to `js-yaml` (skypack today, npm after PR 03), not to the std library; PR 22 lists it as out of scope for the same reason. `semver`, `media_types`, `xml`, `xmlp` and `another_cookiejar` are `deno.land/x` packages that PR 04 replaces; they are not std either.

## Execution log (executor notes, not plan text)

One dated entry per working session; newest last. The normative plan ends at
"Decisions needed" above.

### 2026-10-21 (session 2): Task 1 blocked at step 4, handed to a plan-amendment session

- Step 0 (coordinator refresh) done: `main` moved `b86f98d` → `502f28448`
  (+48 commits, includes the merged plans). The three path:line citations
  (`src/core/run/deno.ts:95-119` `initDenoCache`, `src/core/lib/external/colors.ts:14`,
  `src/core/sass/analyzer/get-dependencies.ts:2`) re-verified against current
  `main`. No "Open decisions with an owner" row names PR 02. **Task 3 must
  re-measure the baseline with the committed script and commit the fresh
  numbers, not the plan's 992/49, 7/0, 10/1, 240/3, 814/165.**
- Environment (Windows Git Bash): `tests/run-tests.sh` line 53 sets
  `DENO_ARCH_DIR=$DENO_DIR`, so tests run as
  `cd tests && DENO_DIR=x86_64 QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent <files>`.
  Do not edit `run-tests.sh` (out of scope).
- Task 1 steps 1–3 done: [tests/asserts.ts](../../../tests/asserts.ts) and
  [tests/unit/asserts.test.ts](../../../tests/unit/asserts.test.ts) written
  exactly as the plan specifies, uncommitted. Step 2 failure confirmed
  (TS2307). Step 4 blocked: `1 passed | 1 failed` —
  `asserts - failing assertions throw AssertionError` fails with
  `Expected error to be instance of "AssertionError", but was "AssertionError"`.
- Root cause (verified at runtime, `deno info` + cached source inspection;
  this supersedes session 1's "two copies of @std/assert" hypothesis):
  `src/import_map.json` maps `"testing/"` → `"jsr:/@std/testing@0.224.0/"`,
  so the seam resolves to `@std/testing@0.224.0/asserts.ts`, a deprecated
  pass-through shim. Its `assert()`/`fail()` delegate to
  `jsr:@std/assert@^0.224.0` (the graph holds exactly one `@std/assert`,
  0.224.0 — not a duplicate-package problem), but the shim defines its **own
  local** `export class AssertionError extends Error` instead of re-exporting
  `@std/assert`'s. So `assert(false)` throws an error that is not
  `instanceof` the `AssertionError` exported from the same module. The design
  is identical in `@std/testing@0.225.3` (the last 0.x; the module was
  removed in 1.0), so **no published `@std/testing` can satisfy the plan's
  test**. Re-exporting the nine names from `jsr:@std/assert@0.224.0` directly
  makes the test pass verbatim (verified). Baseline impact of changing the
  seam's source: none (`tests/asserts.ts` is in `kTestsExclusions`). The 157
  existing `testing/asserts` importers never rely on `AssertionError`
  identity, which is why the wart was invisible until this test pinned it.
- The plan is normative and the test cannot pass as specified, so execution
  stopped per instruction rather than improvising a deviation. A separate
  session (Opus) is deciding the resolution and amending the plan
  ("Decisions needed" above, plus downstream references: `_TEMPLATE.md`'s
  nine-name vocabulary, PRs 22/23/31, the `"testing/"` import-map entry).
- State at hand-back: branch `rt/02-runtime-boundary-check`, **nothing
  committed**; working tree holds only the two uncommitted Task 1 files
  (amendments to this file aside). Resume after the amendment: redo Task 1
  step 3 if the seam text changed, run step 4 (`2 passed`), commit at step 5,
  then Tasks 2–4.

### 2026-10-21 (session 3): plan amended, Task 1 step 3 reopened

- Resolution recorded in "Decisions needed", "The seam's source": the seam
  imports from `"@std/assert"` through a new import-map key
  `"@std/assert": "jsr:@std/assert@0.224.0"`. The other changes in this
  file: Context, Scope, Interfaces (`kStdModules` + `@std/assert`, the seam
  block), Files, Task 1 step 3 (unticked: its text changed), Task 1 step 5's
  `git add`, Task 2's `kStdModules`, one `hasStdImport` positive case, the
  `kTestsExclusions` comment, and two review-checklist items. The `10 passed`
  count is unchanged (the new case sits in an existing test).
- Downstream plans amended to match: `_TEMPLATE.md` (the seam's source),
  PR 22's inventory table (an `@std/assert` row), PR 23 Task 5 step 1 (the
  extended seam keeps `from "@std/assert"`), PR 31 (Task 1 bumps the
  existing key instead of adding it; the seam's specifier is already right).
- Probe run, then reverted (`src/import_map.json` clean against `HEAD`,
  `tests/asserts.ts` byte-identical to the session-2 file): with the key and
  the seam on `"@std/assert"`, `unit/asserts.test.ts` gave `2 passed`, plus
  an existing `testing/asserts` importer green, and `deno lint` was clean.
- Resume: redo Task 1 step 3 as now written (the key, then the seam), step 4,
  step 5. On Windows run `./configure.cmd` once before Task 3's
  `quarto run --dev` (the import-map hash changed).
