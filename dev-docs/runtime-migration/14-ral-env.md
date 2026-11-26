# PR 14: `deno_ral/env.ts` and codemod of all `Deno.env` uses in `src/`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/deno_ral/env.ts` (the `env` object from the shared vocabulary) with its unit test, then run the codemod's `env` rule over all of `src/` so that no application file reads or writes environment variables through `Deno.env`.
**Phase:** 1.
**Depends on:** PR 09 (the codemod and its `env` rule), PR 02 (ratchet); lands after PRs 10–13 and before PRs 08 and 22 (landing order below).
**Unblocks:** PR 20, PR 20b, PR 23, PR 24, PR 25, PR 27b.
**Branch:** `rt/14-ral-env`.
**Suggested executor:** Sonnet.
One 50-line module, one test, one codemod run, six alias fixes with the exact edits given below.
**Size:** L by file count, mechanical.
1 new module, 1 new test, 50 files rewritten by the codemod (148 replacements), 6 more edited by hand with an alias import (17 sites), 4 ratchet replacement keys.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 11, module plan row `env.ts`: "new: `Deno.env.get/set/delete/toObject` (253 sites); `process.env` on Node.
Dotenv loading in `core/quarto.ts` keeps using it."
Order of work step 4: "`env.ts` codemod (two days).
Mechanical."
The 253 figure spans `src/` (176), `package/src` (48, PR 24) and `tests/` (27, PR 23).

Measured on `main` at `b86f98d` (2026-10-15) with `grep -rhoE '\bDeno\.env\.[a-zA-Z]+' <dir> --include=*.ts | sort | uniq -c` (per directory: sites / files):

| Directory | Sites | Files | Notes |
|---|---|---|---|
| `src/core` | 80 | 27 | `platform.ts` 15, `appdirs.ts` 10, `typst.ts` 4, `temp.ts` 4, `resources.ts` 4, `jupyter/capabilities.ts` 4, `git.ts` 4, `main.ts` 3, `log.ts` 3, … |
| `src/command` | 38 | 13 | `render/project.ts` 6, `render/pandoc.ts` 5 (incl. the only `toObject`, line 1405; 1416 at `83432c028`), `create/editor.ts` 5, `render/render-files.ts` 4, … |
| `src/tools` | 14 | 3 | `github.ts` 10 (11 at `b86f98d`), `impl/tinytex.ts` 3, `impl/verapdf.ts` 1 |
| `src/publish` | 11 | 6 | `posit-connect-cloud/posit-connect-cloud.ts` 3, `confluence/confluence.ts` 3, `rsconnect/rsconnect.ts` 2, … |
| `src/execute` | 9 | 3 | `environment.ts` 7, `rmd.ts` 1, `jupyter/jupyter-kernel.ts` 1 |
| `src/quarto-core` | 5 | 2 | `dotenv.ts` 3 (`delete`, `get`, `set`), `profile.ts` 2 |
| `src/project` | 5 | 2 | `project-profile.ts` 4, `serve/serve.ts` 1 |
| `src/quarto.ts` | 5 | 1 | lines 62, 165, 167, 212, 214 |
| `src/config` | 1 | 1 | `constants.ts` |
| `src/resources` | 7 | 2 | all in the julia-engine subtree: excluded (see PR 13's exclusion table) |
| `src/format`, `src/extension`, `src/preview`, `src/inspect`, `src/render`, `src/webui` | 0 | 0 | |
| **In scope** | **168** | **58** | by method: `get` 145, `set` 19, `delete` 3, `toObject` 1 (`rg -o`; recounted at `83432c028`, see the execution log). Two of the 168 are comment text (`src/core/platform.ts:17`, `src/core/sass/analyzer/declaration-types.ts:84`, the latter a file with no other site), so the code sites are **166 in 57 files** |

How the environment is used today, verified:

- `src/quarto-core/dotenv.ts:42-72` (`dotenvSetVariables`) reads `_environment*` files with `@std/dotenv`'s `load({ envPath })`, which returns a record and does not export to the process; the function then sets each variable that is not already set with `Deno.env.set(key, conf[key])`, records it, and on re-run backs out with `dotenvVariablesSet.forEach(Deno.env.delete)` (line 44, the method passed as a callback, so the layer's `env.delete` must not depend on `this`).
- `src/core/quarto.ts:60-77` (`quartoConfig.dotenv`) also uses `load()` to read `share/env/env.defaults` and the dev `.env`; it returns the record and never touches `Deno.env`.
  Nothing to change there; the file has no `Deno.env` site.
- `src/quarto.ts:160-217` saves `oldEnv`, applies a caller-supplied `env` record with `Deno.env.set`, and restores with `Deno.env.delete`/`set` in `finally`.
- `src/command/render/pandoc.ts:1416` snapshots `Deno.env.toObject()` for `QUARTO_CAPTURE_RENDER_COMMAND`.
- `src/core/platform.ts:17-27`: `isRStudio()` has a test override precisely because `Deno.env.set` in parallel tests races; the layer keeps the process-global semantics (one environment per process), so that override stays.

Files where a binding named `env` exists (the codemod reports these and leaves every `Deno.env` in them untouched; fixed by alias in Task 3).
Six files, 17 code sites, confirmed by running PR 09's codemod logic on `b86f98d` and by the step 0 dry run at `83432c028` (line numbers below are at `83432c028`):

| File | Local `env` | `Deno.env` sites |
|---|---|---|
| `src/quarto.ts` | parameter `env?: Record<string, string>` of `passThroughPandoc` (87), `passThroughTypst` (105), `quarto` (125) | 62, 165, 167, 212, 214 |
| `src/command/render/project.ts` | `const env: Record<string, string>` at 324 and 844 | 328, 330 and four more |
| `src/core/jupyter/kernels.ts` | `const env = Deno.env.get("VIRTUAL_ENV")` at 39 | 39 |
| `src/publish/posit-connect-cloud/api/index.ts` | `const env = Deno.env.get(...)` at 65; parameters `env: EnvironmentConfig` at 354, 379, 454 | 65 |
| `src/publish/posit-connect-cloud/posit-connect-cloud.ts` | `const env = getEnvironmentConfig()` at 70 and 109 | 75, 363, 603 |
| `src/command/call/axe/cmd.ts` | parameter `env: (key: string) => string \| undefined = (key) => Deno.env.get(key)` at 314: the default value refers to `Deno.env`, and rewriting it to `env.get` would make the default read the parameter itself | 314 |

`src/core/performance/metrics.ts` has one `Deno.env.get` (line 63) but is skipped whole while it assigns to `Deno.readTextFileSync`; PR 20b replaces that assignment with `onFileRead`.
If PR 20b has landed first, the codemod rewrites it here; otherwise PR 25 converts it.

Property keys named `env:` (`serve.ts:461`, `jupyter-kernel.ts:195`, `pandoc.ts:327,1415`, `crossref.ts:132`, `run/deno.ts:35`, `ci-info.ts:46`, `jupyter/capabilities.ts:257`, at `83432c028`) are not bindings and do not collide; the codemod's collision check ignores property names.

### Scope

In: `src/deno_ral/env.ts`; `tests/unit/ral/env.test.ts`; `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src` (whole tree; the tool skips PR 09's `kCodemodExclusions`, `node_modules`, `*.d.ts`, `*.ejs.ts`); the six alias fixes; `deno fmt` on the rewritten files that are formatted on `main`; the `env.*` keys of `kRalDenoReplacements` in `tools/check-runtime-boundary.ts` with their unit test case; baseline; rules doc row.
Out: `package/src` (48 sites, PR 24), `tests/` (27 sites, PR 23), the julia-engine subtree (7 sites), any non-env `Deno.*` call.
Out: changelog (no user-visible change).

### Landing order and conflict protocol

Decided 2026-11-17 (README "Open decisions with an owner", landing order row): PRs 10–13 land first, then this PR, then PR 08 and PR 22.
PRs 10–13 are merged (#15418, #15423, #15426, #15427).
PR 08, PR 22 and PR 14 edit the import blocks of many of the same files (34–38 files overlap), and the codemod inserts its import after the last import, the same anchor every one of them uses, so whichever of 08 and 22 lands after this PR rebases onto it.
A conflict in this PR (with any PR merged while it is open) is resolved mechanically, never by hand-merging a codemodded hunk:

1. `git fetch upstream && git rebase upstream/main`; for every conflicted file under `src/`, `git checkout upstream/main -- <file>` (reset the file to the base; `origin` is a fork whose `main` can lag).
2. Re-run the codemod on exactly those files: `quarto run --dev tools/codemod-deno-ral.ts --rules env --file <file> [--file <file>...]`.
3. Re-apply this PR's hand edits for those files (each is listed with its exact code below), then `package/dist/bin/tools/x86_64/deno fmt <file>...` on those that are not in Task 2 Step 3's list of files already unformatted on `main`.
4. `git add` the files by explicit path and `git rebase --continue`; run the type check and the dry run of Task 2 again (it must report `0 replacements` once the hand edits are back).

This works because PR 09's collision detection is symbol-based and reuses existing alias imports: a re-run over a partly migrated file finishes it and does not report the layer's own imports as collisions.

### Interfaces

`src/deno_ral/env.ts` (complete):

```ts
/*
 * env.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Process environment, implemented on Deno.env. The contract is
 * tests/unit/ral/env.test.ts.
 *
 * The methods are plain functions (no `this`): callers pass them as callbacks
 * (quarto-core/dotenv.ts: `names.forEach(env.delete)`).
 */

// Deno.env throws on an empty name or one containing "=" or NUL, while
// Node's process.env silently returns undefined (or stores garbage). The
// layer validates names itself so that every runtime rejects the same ones.
function checkName(name: string): void {
  if (name.length === 0 || name.includes("=") || name.includes("\0")) {
    throw new TypeError(`Invalid environment variable name: ${JSON.stringify(name)}`);
  }
}

export const env = {
  get(name: string): string | undefined {
    checkName(name);
    return Deno.env.get(name);
  },
  set(name: string, value: string): void {
    checkName(name);
    if (value.includes("\0")) {
      throw new TypeError(`Invalid value for environment variable ${name}`);
    }
    Deno.env.set(name, value);
  },
  delete(name: string): void {
    checkName(name);
    Deno.env.delete(name);
  },
  toObject(): Record<string, string> {
    return Deno.env.toObject();
  },
};
```

Alias convention for the six colliding files: `import { env as runtimeEnv } from "<rel>/deno_ral/env.ts";` and `Deno.env.` → `runtimeEnv.` in those files only.
Local bindings are never renamed.

### Files

- Create: `src/deno_ral/env.ts`
- Test: `tests/unit/ral/env.test.ts`
- Modify (codemod): 50 files across `src/core`, `src/command`, `src/tools`, `src/publish`, `src/execute`, `src/quarto-core`, `src/project`, `src/config`
- Modify (hand, alias): `src/quarto.ts`, `src/command/render/project.ts`, `src/core/jupyter/kernels.ts`, `src/publish/posit-connect-cloud/api/index.ts`, `src/publish/posit-connect-cloud/posit-connect-cloud.ts`, `src/command/call/axe/cmd.ts`
- Modify: `tools/check-runtime-boundary.ts`, `tests/unit/tools/check-runtime-boundary.test.ts`, `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`

### Acceptance criteria

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts` → `ok | 5 passed | 0 failed`.
- AST check: `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src --dry-run | tail -1` → `0 would be rewritten, 0 replacements, 0 with collisions` (and `2 skipped`, or `1 skipped` if PR 20b landed first).
- Text check, comment lines excluded:

  ```bash
  rg -n '\bDeno\.env\b' src -g '*.ts' -g '!src/deno_ral/**' -g '!src/resources/**' -g '!src/core/performance/metrics.ts' \
    | rg -v '^[^:]+:[0-9]+:\s*(//|/\*|\*)'
  ```
  prints nothing (the two comment lines `src/core/platform.ts:17` and `src/core/sass/analyzer/declaration-types.ts:84` are filtered; PR 25 rewrites them).
- `quarto run --dev tools/check-runtime-boundary.ts` passes with the `src` scope count exactly 165 lower than before this PR, 384 → 219 at `83432c028` (148 codemod replacements + 17 alias-fixed sites; 166 if PR 20b landed first).
- `denoReplacement("env.get", "src")` returns the `deno_ral/env.ts` hint, so a new `Deno.env` call in `src` or `package/src` is a ratchet error.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.
- The tests in Verification pass.

## Plan

Assumes PR 09 landed (`tools/codemod-deno-ral.ts` with the `env` rule, tested on `tools/codemod/fixtures/env-basic` and `env-collision`).
PRs 10–13 have landed and PRs 08 and 22 have not; the `env` rule only touches `Deno.env`, and a file that PRs 10–13 already rewrote just gains a second `deno_ral` import (or, on a conflict, follows the protocol above).
On Windows, use `package/dist/bin/quarto.cmd`, `deno.exe` and `tests/run-tests.ps1` (`pwsh -File run-tests.ps1 --agent ...` from `tests/`, with `QUARTO_TESTS_NO_CONFIG=true` in the environment) for the POSIX forms below.

### Task 1: `src/deno_ral/env.ts` with its unit test

**Files:**
- Create: `src/deno_ral/env.ts`
- Test: `tests/unit/ral/env.test.ts`

- [x] **Step 1: Write the failing test**

```ts
/*
 * env.test.ts
 *
 * Compatibility contract for src/deno_ral/env.ts; the Node implementation
 * must keep this file green.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertThrows } from "../../asserts.ts";
import { env } from "../../../src/deno_ral/env.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";

const kName = "QUARTO_RAL_ENV_TEST_7F3A";

// deno-lint-ignore require-await
unitTest("env - get returns undefined for an unset variable", async () => {
  env.delete(kName);
  assertEquals(env.get(kName), undefined);
});

// deno-lint-ignore require-await
unitTest("env - set, get, delete round trip", async () => {
  env.set(kName, "value-1");
  assertEquals(env.get(kName), "value-1");
  env.set(kName, "");
  assertEquals(env.get(kName), "", "empty string is a value, not unset");
  env.delete(kName);
  assertEquals(env.get(kName), undefined);
  env.delete(kName); // deleting an unset variable does not throw
  if (isWindows) {
    env.set(kName, "case");
    assertEquals(env.get(kName.toLowerCase()), "case", "names are case-insensitive on Windows");
    env.delete(kName.toLowerCase());
    assertEquals(env.get(kName), undefined);
  }
});

// deno-lint-ignore require-await
unitTest("env - toObject is a snapshot containing set variables", async () => {
  env.set(kName, "snap");
  const all = env.toObject();
  assertEquals(all[kName], "snap");
  all[kName] = "mutated";
  assertEquals(env.get(kName), "snap", "mutating the snapshot does not write through");
  assert(Object.keys(all).length > 1);
  env.delete(kName);
});

// deno-lint-ignore require-await
unitTest("env - invalid names throw TypeError on every runtime", async () => {
  for (const bad of ["", "A=B", "A\0B"]) {
    assertThrows(() => env.get(bad), TypeError);
    assertThrows(() => env.set(bad, "x"), TypeError);
    assertThrows(() => env.delete(bad), TypeError);
  }
  assertThrows(() => env.set(kName, "a\0b"), TypeError);
  assertEquals(env.get(kName), undefined, "a rejected set writes nothing");
});

// deno-lint-ignore require-await
unitTest("env - methods work when passed as callbacks", async () => {
  env.set(kName, "cb");
  [kName].forEach(env.delete);
  assertEquals([kName].map(env.get), [undefined]);
});
```

- [x] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts` Expected: fails with `Module not found "file:///.../src/deno_ral/env.ts"`.

- [x] **Step 3: Implement**

Create `src/deno_ral/env.ts` with the exact content shown under Interfaces.

- [x] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts` Expected: `ok | 5 passed | 0 failed`

- [x] **Step 5: Commit**

```bash
git add src/deno_ral/env.ts tests/unit/ral/env.test.ts
git commit -m "deno_ral/env: process environment object with unit test"
```

### Task 2: Codemod `src/`

- [x] **Step 1: Dry run**

Run: `mkdir -p .claude/docs && quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src --dry-run > .claude/docs/codemod-env.txt; tail -1 .claude/docs/codemod-env.txt` Expected: `Summary: 625 files scanned, 50 would be rewritten, 148 replacements, 6 with collisions, 2 skipped` (measured at `83432c028`; 625 is the number of `.ts` files under `src/` outside the skip list and moves only if files are added or removed).
`.claude/docs/` is ignored by git; Step 2 and the execution log read the report from there.
50 = the 57 files with code sites, minus the 6 colliding files (the name `env` is blocked for a whole file), minus `metrics.ts` (skipped).
148 = 166 code sites − 17 in the colliding files (`quarto.ts` 5, `render/project.ts` 6, `kernels.ts` 1, `api/index.ts` 1, `posit-connect-cloud.ts` 3, `axe/cmd.ts` 1) − 1 in `metrics.ts`.
The two skipped files are `src/core/deno/monkey-patch.ts` and `src/core/performance/metrics.ts`; if PR 20b landed first, the line reads `51 would be rewritten, 149 replacements, 6 with collisions, 1 skipped`.
If the numbers differ, recount with `rg -c 'Deno\.env' <file>` on the six files before continuing.

- [x] **Step 2: Review the report**

Run: `grep -E 'skipped:|collision:' .claude/docs/codemod-env.txt` Expected exactly these six collision lines and two skipped lines (measured at `83432c028`):
```
src/command/call/axe/cmd.ts:314: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
src/command/render/project.ts:324: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
src/core/deno/monkey-patch.ts: skipped: assigns to Deno.realPathSync at line 17
src/core/jupyter/kernels.ts:39: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
src/core/performance/metrics.ts: skipped: assigns to Deno.readTextFileSync at line 23
src/publish/posit-connect-cloud/api/index.ts:65: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
src/publish/posit-connect-cloud/posit-connect-cloud.ts:70: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
src/quarto.ts:87: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
```
(The line number is the first conflicting identifier the tool finds; six colliding files is the invariant.)

Run: `grep '→' .claude/docs/codemod-env.txt | awk -F'→' '{print $2}' | sort | uniq -c` Expected: a single target, `148 env`.

- [x] **Step 3: Rewrite, format, type-check**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src | tail -1` Expected: `Summary: 625 files scanned, 50 rewritten, 148 replacements, 6 with collisions, 2 skipped`.

Format only the rewritten files that are already formatted on `main`.
`deno fmt --check` at `83432c028` reports seven of the PR's files unformatted: `src/core/ci-info.ts`, `src/core/log.ts`, `src/core/puppeteer.ts`, `src/publish/confluence/confluence.ts`, `src/tools/impl/tinytex.ts` (rewritten here) and `src/command/call/axe/cmd.ts`, `src/command/render/project.ts` (Task 3).
Formatting them would add unrelated hunks, so they keep the codemod's output as is:

```bash
git diff --name-only -- src \
  | grep -vxF -e src/core/ci-info.ts -e src/core/log.ts -e src/core/puppeteer.ts \
      -e src/publish/confluence/confluence.ts -e src/tools/impl/tinytex.ts \
  | xargs package/dist/bin/tools/x86_64/deno fmt
```
Expected: `git diff --stat` lists only the 50 rewritten files under `src/`, each with changes only on `Deno.env` lines and import lines.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git diff --name-only -- src | xargs git add --
git commit -m "src: codemod Deno.env to deno_ral/env (mechanical)"
```

### Task 3: Alias fixes for the six colliding files

**Files:**
- Modify: `src/quarto.ts`, `src/command/render/project.ts`, `src/core/jupyter/kernels.ts`, `src/publish/posit-connect-cloud/api/index.ts`, `src/publish/posit-connect-cloud/posit-connect-cloud.ts`, `src/command/call/axe/cmd.ts`

`axe/cmd.ts` and `render/project.ts` are already unformatted on `main`, so Step 1 formats only the other four.

- [ ] **Step 1: Apply the alias in each file**

```bash
sed -i 's/Deno\.env\./runtimeEnv./g' src/quarto.ts src/command/render/project.ts src/core/jupyter/kernels.ts src/publish/posit-connect-cloud/api/index.ts src/publish/posit-connect-cloud/posit-connect-cloud.ts src/command/call/axe/cmd.ts
```

Then add the import to each (before the first `import` line, or next to an existing `deno_ral` import):

| File | Import |
|---|---|
| `src/quarto.ts` | `import { env as runtimeEnv } from "./deno_ral/env.ts";` |
| `src/command/render/project.ts` | `import { env as runtimeEnv } from "../../deno_ral/env.ts";` |
| `src/core/jupyter/kernels.ts` | `import { env as runtimeEnv } from "../../deno_ral/env.ts";` |
| `src/publish/posit-connect-cloud/api/index.ts` | `import { env as runtimeEnv } from "../../../deno_ral/env.ts";` |
| `src/publish/posit-connect-cloud/posit-connect-cloud.ts` | `import { env as runtimeEnv } from "../../deno_ral/env.ts";` |
| `src/command/call/axe/cmd.ts` | `import { env as runtimeEnv } from "../../../deno_ral/env.ts";` |

The resulting lines read, for example, `src/core/jupyter/kernels.ts:39`: `const env = runtimeEnv.get("VIRTUAL_ENV");`, `src/command/call/axe/cmd.ts:314` (before the import line is added): `env: (key: string) => string | undefined = (key) => runtimeEnv.get(key),` and `src/quarto.ts:212-214`:

```ts
        runtimeEnv.delete(key);
      } else {
        runtimeEnv.set(key, value);
```

Then: `package/dist/bin/tools/x86_64/deno fmt src/quarto.ts src/core/jupyter/kernels.ts src/publish/posit-connect-cloud/api/index.ts src/publish/posit-connect-cloud/posit-connect-cloud.ts`.

- [ ] **Step 2: Verify and commit**

Run the text check from Acceptance criteria.
Expected: empty.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` Expected: no errors.

```bash
git add src/quarto.ts src/command/render/project.ts src/core/jupyter/kernels.ts src/publish/posit-connect-cloud/api/index.ts src/publish/posit-connect-cloud/posit-connect-cloud.ts src/command/call/axe/cmd.ts
git commit -m "Alias deno_ral env import in files with a local env binding"
```

### Task 4: Tests, docs, ratchet, commit

- [ ] **Step 1: Unit tests around environment handling**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts unit/environment.test.ts unit/dotenv-config.test.ts unit/binary-mode-strip-env.test.ts $(find unit/core/ -name '*.test.ts') $(find unit/tools/ -name '*.test.ts') $(find unit/jupyter/ -name '*.test.ts') $(find unit/project/ -name '*.test.ts') unit/github-actions-reporting.test.ts unit/chrome-launch.test.ts unit/preview-compatibility.test.ts` Expected: `0 failed`.

- [ ] **Step 2: Smoke tests that set or read environment variables (profiles, dotenv files, pre/post render scripts, drafts, check, run)**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/env/ -name '*.test.ts') smoke/website/drafts-env.test.ts smoke/project/project-prepost.test.ts smoke/project/project-simple.test.ts smoke/render/render-html.test.ts smoke/render/render-cli-metadata-file.test.ts $(find smoke/check/ -name '*.test.ts') $(find smoke/run/ -name '*.test.ts') smoke/jupyter/issue-10097.test.ts smoke/render/render-r.test.ts` Expected: `0 failed` (Jupyter/R tests skip without their prerequisites; note it).

- [ ] **Step 3: Manual dotenv check**

From the worktree root (the path is captured before the `cd`; `engine: knitr` because a document with only inline `` `r` `` code is not claimed by knitr):

```bash
Q="$PWD/package/dist/bin/quarto"   # "$PWD/package/dist/bin/quarto.cmd" on Windows
d=$(mktemp -d) && (cd "$d" && printf 'project:\n  type: default\n' > _quarto.yml && printf 'MY_DOTENV_VAR=hello\n' > _environment && printf -- '---\ntitle: t\nengine: knitr\n---\n\n`r Sys.getenv("MY_DOTENV_VAR")`\n' > index.qmd && "$Q" render index.qmd --to md 2>&1 | tail -2; tail -3 index.md)
```
Expected (with R available): the rendered `index.md` contains `hello`, proving `dotenvSetVariables` still exports the file's variables to child processes through `env.set`.
Without R, instead run `(cd "$d" && QUARTO_LOG_LEVEL=DEBUG "$Q" render index.qmd --to html 2>&1 | grep -c 'MY_DOTENV_VAR')` → `0` is fine as long as the render succeeds; the smoke test `smoke/env/` covers the variable plumbing.

- [ ] **Step 4: Docs and ratchet**

In `.claude/rules/typescript/deno-ral.md`, add this row to the module table after `errors.ts`, padded to the table's existing column widths (the file is already unformatted on `main`; do not run `deno fmt` on it):

```
| `env.ts` | Process environment | `env.get`, `env.set`, `env.delete`, `env.toObject` |
```

In `tools/check-runtime-boundary.ts`, add the `env` keys to `kRalDenoReplacements`, after the `errors.ts` entries and before the connection-error block, with the same scopes as the `fs` keys (README row "PRs 08 and 14, ratchet replacement keys": `tests` keeps deliberate fixtures; the ratchet reports a covered API only where a file's count rises, so `package/src`'s pending sites are not errors):

```ts
  ...ralReplacements("env.ts", ["env.get", "env.set", "env.delete", "env.toObject"]),
```

Update the `kRalLayerScopes` doc comment to read "The scopes of the fs, temp, errors and env keys."

In `tests/unit/tools/check-runtime-boundary.test.ts`, add after the "fs, temp and errors keys" test:

```ts
// deno-lint-ignore require-await
unitTest("check-runtime-boundary - env keys name their replacement in src and package/src", async () => {
  for (const key of ["env.get", "env.set", "env.delete", "env.toObject"]) {
    assertEquals(denoReplacement(key, "src"), `${key} from src/deno_ral/env.ts`, key);
    assertEquals(denoReplacement(key, "package/src"), `${key} from src/deno_ral/env.ts`, key);
    assertEquals(denoReplacement(key, "tests"), undefined, key);
  }
  assertEquals(denoReplacement("env", "src"), undefined);
});
```

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts` Expected: `0 failed`.

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts` Expected: passes; `git diff tools/runtime-boundary-baseline.json` shows `src.denoCalls` 384 → 219 (lower by exactly 165; 166 with PR 20b first) and no other change.

- [ ] **Step 5: Commit**

```bash
git add tools/check-runtime-boundary.ts tests/unit/tools/check-runtime-boundary.test.ts tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "Lower runtime boundary baseline after env codemod; document deno_ral/env"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts` → `ok | 5 passed | 0 failed`.
- Task 4 steps 1–2 → `0 failed`.
- The AST check and the text check from Acceptance criteria → as stated.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- Manual: `QUARTO_PROFILE=x package/dist/bin/quarto render tests/docs/test.qmd` works; `package/dist/bin/quarto check` shows the same environment-dependent rows (Python/R paths) as before; `QUARTO_CAPTURE_RENDER_COMMAND=$(mktemp -d) package/dist/bin/quarto render tests/docs/test.qmd` writes the capture directory (the `toObject` snapshot).

## Review checklist

- [ ] `env.ts` methods do not use `this`.
- [ ] `git diff` contains only `Deno.env.` → `env.` (or `runtimeEnv.`) rewrites and import lines.
- [ ] `src/quarto-core/dotenv.ts:44` still passes `env.delete` as a callback and the back-out loop still works (`smoke/env/`, `smoke/project/project-prepost.test.ts`).
- [ ] The six alias files kept their local `env` bindings unchanged.
- [ ] `src/core/platform.ts` test override (`_setIsRStudioForTest`) is untouched.
- [ ] No `package/src` file changed (PR 24), and no `tests/` file besides `unit/ral/env.test.ts` and the env case in `unit/tools/check-runtime-boundary.test.ts` (PR 23 owns the rest).
- [ ] The five files of Task 2 Step 3's unformatted list carry only `Deno.env` and import hunks (no formatter hunks).
- [ ] Baseline only decreased, by 165 under `src/` (166 with PR 20b first).
- [ ] The `env.*` keys of `kRalDenoReplacements` have the scopes `src` and `package/src`, not `tests`.
- [ ] `env.get`/`set`/`delete` validate the name before touching the runtime; the validation case is in the test.

## Risks and rollback

- The codemod blocks the name `env` for a whole file when any binding named `env` exists in it, which is why the six files are fixed by alias rather than by hand-rewriting single lines; if the dry run reports a seventh file, apply the same alias recipe.
  A re-run after the alias fix reuses `runtimeEnv` (PR 09 alias reuse).
- `env.toObject()` returns a fresh object like `Deno.env.toObject()`; the Node implementation must also copy (`{ ...process.env }`) so that mutation does not write through, which the unit test enforces.
- Name validation: code that called `Deno.env.get("")` and caught a Deno-specific error now gets a `TypeError` from the layer; no such caller exists in `src/` (all names are literals or come from YAML keys, which are non-empty).
- Rollback: `git revert` the four commits; `env.ts` is additive.

## Decisions needed

None.
Review items closed here: the sixth collision (`axe/cmd.ts:314`), counts (58 files with matches, 57 with code; 166 code sites; dry run 50 / 148 at `83432c028`), comment hits in the greps (`platform.ts:17`, `declaration-types.ts:84`; filtered, PR 25 rewrites them), key validation pinned by the contract (TypeError on empty, `=` or NUL names on every runtime), landing order and the reset-and-re-run protocol.

## Execution log

### Step 0 — coordinator preflight at `83432c028`

- Prerequisites: README marks PRs 02, 09 and 10–13 (10, 11, 12, 13) merged (#15418, #15423, #15426, #15427); their beads are closed.
  PRs 08 and 22 have not landed, as the landing-order decision of 2026-11-17 allows; the header, landing-order paragraph and Plan intro are corrected.
  No open PR touches `dev-docs/runtime-migration/` or an `rt/*` branch.
  PR 20b has not landed, so `metrics.ts` stays skipped.
- Recount (`rg -o '\bDeno\.env\.[a-zA-Z]+'` per directory on `83432c028`): `src/tools` 14 in 3 files (`github.ts` 10, down from 11: the tinytex rate-limit fix #15388 moved one site into a `getEnv` default parameter, which the codemod rewrites); every other directory as at `b86f98d`.
  In scope 168 sites in 58 files (`get` 145, `set` 19, `delete` 3, `toObject` 1), 166 code sites in 57 files.
  Expected deltas move by one: 148 codemod replacements, ratchet `src` delta 165 (384 → 219).
- Citation audit (`rg -n` on `83432c028`): same at `quarto.ts:62,87,105,125,165,167,212,214`, `kernels.ts:39`, `api/index.ts:65`, `dotenv.ts:44`, `platform.ts:17`, `declaration-types.ts:84`, `ci-info.ts:46`, `capabilities.ts:257`.
  Moved: `render/project.ts:320,839` → 324,844 and its sites 324,326 → 328,330; `api/index.ts:351,376,451` → 354,379,454; `posit-connect-cloud.ts:69,108` → 70,109 and its sites 74,362,602 → 75,363,603; `axe/cmd.ts:307` → 314; `pandoc.ts:1405` → 1416; the `env:` property keys `serve.ts:454` → 461, `jupyter-kernel.ts:188` → 195, `pandoc.ts:316,1404` → 327,1415, `editor-support/crossref.ts:127` → 132, `run/deno.ts:31` → 35.
  None changed or gone; the Context tables now carry the new numbers.
- Dry run (Windows, Deno 2.9.8): `package/dist/bin/quarto.cmd run --dev tools/codemod-deno-ral.ts --rules env --dir src --dry-run > .claude/docs/codemod-env.txt` printed `Summary: 625 files scanned, 50 would be rewritten, 148 replacements, 6 with collisions, 2 skipped`; the six collisions and two skips are the lines now in Task 2 Step 2; the only target is `148 env`.
  `git status --short` printed nothing.
  The report stays at `.claude/docs/codemod-env.txt` (ignored by git).
- Type check on the untouched base: from `src`, `deno.exe check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` exits 1 with `Requires import access to "cdn.skypack.dev:443"` (`src/core/yaml.ts:31`); with `--allow-import` it exits 0.
  The four `deno check` commands gain `--allow-import` (README row "Any plan that type-checks `src/quarto.ts`").
- Ratchet on the base: `quarto.cmd run --dev tools/check-runtime-boundary.ts` prints `OK: no count exceeds the baseline.` with `src` 384.
  `diffChanges` reports a covered API only for a file that adds it while the scope's `Deno.*` total rises and that API's net count across the scope's files that can import `deno_ral` rises (`tools/check-runtime-boundary.ts:478`, `:492`, `:500`): a covered call passes unreported when either delta is zero or below, for example when other `Deno.*` removals keep the scope total flat or the call moved from another eligible file. Existing sites never produce a finding, so `env.*` keys scoped to `src` and `package/src` leave PR 24's 48 pending `package/src` sites as counts, like PR 10's `fs` keys.
  The plan named no step for the keys; Task 4 Step 4 now adds them with a unit test case (README row "PRs 08 and 14, ratchet replacement keys").
- Formatting: `deno fmt --check` on the 58 files the dry run lists reports 7 already unformatted: `src/core/ci-info.ts`, `src/core/log.ts`, `src/core/puppeteer.ts`, `src/publish/confluence/confluence.ts`, `src/tools/impl/tinytex.ts` (codemod) and `src/command/call/axe/cmd.ts`, `src/command/render/project.ts` (alias).
  `.claude/rules/typescript/deno-ral.md` is also unformatted.
  Task 2 Step 3 formats only the other rewritten files, Task 3 formats only its four formatted files, and Task 4 Step 4 adds the docs row by hand (README row "PR 14, what PRs 10–13 found", item 2).
- Staging: Task 2 Step 4's `git add src` stages explicit paths from `git diff --name-only -- src` (same row, item 3); the report path moved from `/tmp` to `.claude/docs/` (item 1).
- Code-block audit: `rg -n 'function \w+'` finds `checkName` only, with no existing equivalent in `src/` or the test helpers.
  The indirect-`Deno` grep hits prose only.
  The `PR [0-9]` code-comment grep hit `env.ts`'s header and `checkName` comment; both now state the current reason (README row "PR 14 (audit of 2026-11-16)").
  The `Deno.*` calls in the listings are in `src/deno_ral/env.ts`, which the ratchet exempts.
- Other corrections: the conflict protocol uses `upstream/main` (README row "PR 14, conflict procedure") and names Task 2's dry run; Task 3's Modify list gains `axe/cmd.ts`; the manual dotenv check captures the dev launcher's absolute path before `cd`, runs in a subshell, and sets `engine: knitr` (Windows review E05); Scope says `Out: changelog`.
- Windows review: readiness "Conventions" with E05 (above) and one P3 row, 14:390: `Deno.env.get` is case-insensitive on Windows.
  Probed on Windows: Deno 2.9.8 and Node 24.21.0 both return the value set as `QUARTO_CASE_PROBE` for `quarto_case_probe`, list one key in `toObject()`/`{ ...process.env }`, and delete through the lower-case name.
  Task 1's round-trip test gains a Windows-only block that pins this; the test count stays 5.
- Tests: every file named in Task 4 and `tests/docs/test.qmd` exist; the `find` directories hold 9 (`unit/core`), 4 (`unit/tools`), 1 (`unit/jupyter`), 8 (`unit/project`), 2 (`smoke/env`), 6 (`smoke/check`) and 3 (`smoke/run`) test files.
  The `.cmd` launcher and `run-tests.ps1` replace the POSIX forms on Windows (Plan intro).
- Gate inputs: of the `Plan defect`/`Plan gap` beads, the `--allow-import` one applies and is a README row; the `testing/asserts` one for PRs 08, 09 and 14 is closed (the listing imports `../../asserts.ts`).
  121 commits touched `src` since `b86f98d`; the recount and citation audit cover them.
  `configuration` pins Deno v2.9.8, the version every measurement here used.

### Task 1: `src/deno_ral/env.ts` with its unit test

- Steps 1–2: added `tests/unit/ral/env.test.ts`, then ran `.\run-tests.ps1 --agent unit/ral/env.test.ts` from `tests` with the worktree's `package/dist/bin` first on `PATH` and `QUARTO_TESTS_NO_CONFIG=true`.
  The expected characterization start exited 1 at module load, before any behaviour test ran: `TS2307 [ERROR]: Cannot find module 'file:///.../src/deno_ral/env.ts'.` and `error: Type checking failed.`
  This is the Windows runner's wording of the planned `Module not found` failure, not a failing behaviour test.
- Steps 3–4: added the planned `src/deno_ral/env.ts`; the same test command exited 0 with `ok | 5 passed | 0 failed (122ms)`.
- Formatting: with the two new files marked intent-to-add, `git diff --shortstat -- src/deno_ral/env.ts tests/unit/ral/env.test.ts` printed `2 files changed, 108 insertions(+)` before formatting.
  `package/dist/bin/tools/x86_64/deno.exe fmt src/deno_ral/env.ts tests/unit/ral/env.test.ts` printed `Checked 2 files`; the shortstat afterward was `2 files changed, 118 insertions(+)` because the formatter reflowed long lines in the new files.
  The post-format test run exited 0 with `ok | 5 passed | 0 failed (95ms)`; `git diff --check` passed.
- Deviations: used the Windows PowerShell runner and `.exe` formatter as the plan requires; no implementation or test changes beyond formatting.
- Outstanding: none in Task 1. Tasks 2–4 remain unticked for later sessions; no maintainer-reserved steps occur in this plan.

### Task 2: Codemod `src/`

- Step 1: `package/dist/bin/quarto.cmd run --dev tools/codemod-deno-ral.ts --rules env --dir src --dry-run > .claude/docs/codemod-env.txt` exited 0 and printed `Summary: 625 files scanned, 50 would be rewritten, 148 replacements, 6 with collisions, 2 skipped`.
  The report remains at `.claude/docs/codemod-env.txt` for Task 3.
- Step 2: `grep -E 'skipped:|collision:' .claude/docs/codemod-env.txt` printed exactly the six planned collision lines and two planned skipped lines.
  `grep '→' .claude/docs/codemod-env.txt | awk -F'→' '{print $2}' | sort | uniq -c` printed `148  env` as the only target.
- Step 3: the non-dry-run codemod exited 0 and printed `Summary: 625 files scanned, 50 rewritten, 148 replacements, 6 with collisions, 2 skipped`.
  Before formatting, `git diff --shortstat -- src` printed `50 files changed, 194 insertions(+), 144 deletions(-)`.
  The planned formatter pipeline excluded the five already-unformatted files, ran `deno.exe fmt` on the other 45 rewritten files, and printed `Checked 45 files`; the shortstat afterward was `50 files changed, 194 insertions(+), 145 deletions(-)`.
  The only formatter-only line removal was the split `const dir =` in `src/core/appdirs.ts`, joined onto the rewritten environment line.
- Type check: from `src`, `../package/dist/bin/tools/x86_64/deno.exe check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` exited 0 and printed `Check quarto.ts`.
  `git diff --check` passed; the diff stat lists exactly the 50 rewritten files.
- Deviations: used the Windows `.cmd` launcher and `.exe` formatter as required; no implementation changes beyond the codemod and its formatting.
- Outstanding: none in Task 2. Tasks 3–4 remain unticked for later sessions; no maintainer-reserved steps occur in this plan.
