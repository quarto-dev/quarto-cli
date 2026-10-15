# PR 14: `deno_ral/env.ts` and codemod of all `Deno.env` uses in `src/`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/deno_ral/env.ts` (the `env` object from the shared vocabulary) with its unit test, then run the codemod's `env` rule over all of `src/` so that no application file reads or writes environment variables through `Deno.env`.
**Phase:** 1. **Depends on:** PR 09 (the codemod and its `env` rule), PR 02 (ratchet); lands after PRs 08, 22 and 10–13 (landing order below). **Unblocks:** PR 23, PR 24, PR 25, PR 27b.
**Branch:** `rt/14-ral-env`.
**Suggested executor:** Sonnet. One 50-line module, one test, one codemod run, six alias fixes with the exact edits given below.
**Size:** L by file count, mechanical. 1 new module, 1 new test, 50 files rewritten by the codemod (149 replacements), 6 more edited by hand with an alias import (17 sites).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 11, module plan row `env.ts`: "new: `Deno.env.get/set/delete/toObject` (253 sites); `process.env` on Node. Dotenv loading in `core/quarto.ts` keeps using it." Order of work step 4: "`env.ts` codemod (two days). Mechanical." The 253 figure spans `src/` (176), `package/src` (48, PR 24) and `tests/` (27, PR 23).

Measured on `main` at `b86f98d` (2026-10-15) with `grep -rhoE '\bDeno\.env\.[a-zA-Z]+' <dir> --include=*.ts | sort | uniq -c` (per directory: sites / files):

| Directory | Sites | Files | Notes |
|---|---|---|---|
| `src/core` | 80 | 27 | `platform.ts` 15, `appdirs.ts` 10, `typst.ts` 4, `temp.ts` 4, `resources.ts` 4, `jupyter/capabilities.ts` 4, `git.ts` 4, `main.ts` 3, `log.ts` 3, … |
| `src/command` | 38 | 13 | `render/project.ts` 6, `render/pandoc.ts` 5 (incl. the only `toObject`, line 1405), `create/editor.ts` 5, `render/render-files.ts` 4, … |
| `src/tools` | 15 | 3 | `github.ts` 11, `impl/tinytex.ts` 3, `impl/verapdf.ts` 1 |
| `src/publish` | 11 | 6 | `posit-connect-cloud/posit-connect-cloud.ts` 3, `confluence/confluence.ts` 3, `rsconnect/rsconnect.ts` 2, … |
| `src/execute` | 9 | 3 | `environment.ts` 7, `rmd.ts` 1, `jupyter/jupyter-kernel.ts` 1 |
| `src/quarto-core` | 5 | 2 | `dotenv.ts` 3 (`delete`, `get`, `set`), `profile.ts` 2 |
| `src/project` | 5 | 2 | `project-profile.ts` 4, `serve/serve.ts` 1 |
| `src/quarto.ts` | 5 | 1 | lines 62, 165, 167, 212, 214 |
| `src/config` | 1 | 1 | `constants.ts` |
| `src/resources` | 7 | 2 | all in the julia-engine subtree: excluded (see PR 13's exclusion table) |
| `src/format`, `src/extension`, `src/preview`, `src/inspect`, `src/render`, `src/webui` | 0 | 0 | |
| **In scope** | **169** | **58** | by method: `get` 146, `set` 19, `delete` 3, `toObject` 1 (`rg -o`). Two of the 169 are comment text (`src/core/platform.ts:17`, `src/core/sass/analyzer/declaration-types.ts:84`, the latter a file with no other site), so the code sites are **167 in 57 files** |

How the environment is used today, verified:

- `src/quarto-core/dotenv.ts:42-72` (`dotenvSetVariables`) reads `_environment*` files with `@std/dotenv`'s `load({ envPath })`, which returns a record and does not export to the process; the function then sets each variable that is not already set with `Deno.env.set(key, conf[key])`, records it, and on re-run backs out with `dotenvVariablesSet.forEach(Deno.env.delete)` (line 44, the method passed as a callback, so the layer's `env.delete` must not depend on `this`).
- `src/core/quarto.ts:60-77` (`quartoConfig.dotenv`) also uses `load()` to read `share/env/env.defaults` and the dev `.env`; it returns the record and never touches `Deno.env`. Nothing to change there; the file has no `Deno.env` site.
- `src/quarto.ts:160-217` saves `oldEnv`, applies a caller-supplied `env` record with `Deno.env.set`, and restores with `Deno.env.delete`/`set` in `finally`.
- `src/command/render/pandoc.ts:1405` snapshots `Deno.env.toObject()` for `QUARTO_CAPTURE_RENDER_COMMAND`.
- `src/core/platform.ts:17-27`: `isRStudio()` has a test override precisely because `Deno.env.set` in parallel tests races; the layer keeps the process-global semantics (one environment per process), so that override stays.

Files where a binding named `env` exists (the codemod reports these and leaves every `Deno.env` in them untouched; fixed by alias in Task 3). Six files, 17 code sites, confirmed by running PR 09's codemod logic on `b86f98d`:

| File | Local `env` | `Deno.env` sites |
|---|---|---|
| `src/quarto.ts` | parameter `env?: Record<string, string>` of `passThroughPandoc` (87), `passThroughTypst` (105), `quarto` (125) | 62, 165, 167, 212, 214 |
| `src/command/render/project.ts` | `const env: Record<string, string>` at 320 and 839 | 324, 326 and four more |
| `src/core/jupyter/kernels.ts` | `const env = Deno.env.get("VIRTUAL_ENV")` at 39 | 39 |
| `src/publish/posit-connect-cloud/api/index.ts` | `const env = Deno.env.get(...)` at 65; parameters `env: EnvironmentConfig` at 351, 376, 451 | 65 |
| `src/publish/posit-connect-cloud/posit-connect-cloud.ts` | `const env = getEnvironmentConfig()` at 69 and 108 | 74, 362, 602 |
| `src/command/call/axe/cmd.ts` | parameter `env: (key: string) => string \| undefined = (key) => Deno.env.get(key)` at 307: the default value refers to `Deno.env`, and rewriting it to `env.get` would make the default read the parameter itself | 307 |

`src/core/performance/metrics.ts` has one `Deno.env.get` (line 63) but is skipped whole while it assigns to `Deno.readTextFileSync`; PR 20b replaces that assignment with `onFileRead`. If PR 20b has landed first, the codemod rewrites it here; otherwise PR 25 converts it.

Property keys named `env:` (`serve.ts:454`, `jupyter-kernel.ts:188`, `pandoc.ts:316,1404`, `crossref.ts:127`, `run/deno.ts:31`, `ci-info.ts:46`, `jupyter/capabilities.ts:257`) are not bindings and do not collide; the codemod's collision check ignores property names.

### Scope

In: `src/deno_ral/env.ts`; `tests/unit/ral/env.test.ts`; `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src` (whole tree; the tool skips PR 09's `kCodemodExclusions`, `node_modules`, `*.d.ts`, `*.ejs.ts`); the six alias fixes; `deno fmt`; baseline; rules doc row.
Out: `package/src` (48 sites, PR 24), `tests/` (27 sites, PR 23), the julia-engine subtree (7 sites), any non-env `Deno.*` call.

### Landing order and conflict protocol

Phase 1 lands in the order 08 → 22 → 10–13 → 14 (README, review finding S10). PRs 10–13 cover disjoint directories, but PR 08, PR 22 and PR 14 edit the import blocks of many of the same files (34–38 files overlap), and the codemod inserts its import after the last import, the same anchor every one of them uses. Conflicts in this PR are therefore expected and are resolved mechanically, never by hand-merging a codemodded hunk:

1. `git rebase origin/main`; for every conflicted file under this PR's directories, `git checkout origin/main -- <file>` (reset the file to `main`).
2. Re-run the codemod on exactly those files: `quarto run --dev tools/codemod-deno-ral.ts --rules <this PR's rules> --file <file> [--file <file>...]`.
3. Re-apply this PR's hand edits for those files (each is listed with its exact code below), then `package/dist/bin/tools/x86_64/deno fmt <file>...`.
4. `git add` the files and `git rebase --continue`; run the type check and the dry run of Task 1 again (it must report `0 replacements` for the PR's directories once the hand edits are back).

This works because PR 09's collision detection is symbol-based and reuses existing alias imports: a re-run over a partly migrated file finishes it and does not report the layer's own imports as collisions.

### Interfaces

`src/deno_ral/env.ts` (complete):

```ts
/*
 * env.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Process environment. Implemented on Deno.env here; PR 27b reimplements it
 * on process.env behind the same object and the same unit test
 * (tests/unit/ral/env.test.ts).
 *
 * The methods are plain functions (no `this`): callers pass them as callbacks
 * (quarto-core/dotenv.ts: `names.forEach(env.delete)`).
 */

// Deno.env throws on an empty name or one containing "=" or NUL, while
// Node's process.env silently returns undefined (or stores garbage). The
// layer validates itself so both runtimes behave the same (PR 27b keeps this
// function and swaps only the four calls).
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

Alias convention for the six colliding files: `import { env as runtimeEnv } from "<rel>/deno_ral/env.ts";` and `Deno.env.` → `runtimeEnv.` in those files only. Local bindings are never renamed.

### Files

- Create: `src/deno_ral/env.ts`
- Test: `tests/unit/ral/env.test.ts`
- Modify (codemod): 50 files across `src/core`, `src/command`, `src/tools`, `src/publish`, `src/execute`, `src/quarto-core`, `src/project`, `src/config`
- Modify (hand, alias): `src/quarto.ts`, `src/command/render/project.ts`, `src/core/jupyter/kernels.ts`, `src/publish/posit-connect-cloud/api/index.ts`, `src/publish/posit-connect-cloud/posit-connect-cloud.ts`, `src/command/call/axe/cmd.ts`
- Modify: `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`

### Acceptance criteria

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts` → `ok | 5 passed | 0 failed`.
- AST check: `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src --dry-run | tail -1` → `0 would be rewritten, 0 replacements, 0 with collisions` (and `2 skipped`, or `1 skipped` if PR 20b landed first).
- Text check, comment lines excluded:

  ```bash
  rg -n '\bDeno\.env\b' src -g '*.ts' -g '!src/deno_ral/**' -g '!src/resources/**' -g '!src/core/performance/metrics.ts' \
    | rg -v '^[^:]+:[0-9]+:\s*(//|/\*|\*)'
  ```
  prints nothing (the two comment lines `src/core/platform.ts:17` and `src/core/sass/analyzer/declaration-types.ts:84` are filtered; PR 25 rewrites them).
- `quarto run --dev tools/check-runtime-boundary.ts` passes with the `src` scope count exactly 166 lower than before this PR (149 codemod replacements + 17 alias-fixed sites; 167 if PR 20b landed first).
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.
- The tests in Verification pass.

## Plan

Assumes PR 09 landed (`tools/codemod-deno-ral.ts` with the `env` rule, tested on `tools/codemod/fixtures/env-basic` and `env-collision`). In the prescribed order PRs 08, 22 and 10–13 have landed; the `env` rule only touches `Deno.env`, and a file that another PR has already rewritten just gains a second `deno_ral` import (or, on a conflict, follows the protocol above).

### Task 1: `src/deno_ral/env.ts` with its unit test

**Files:**
- Create: `src/deno_ral/env.ts`
- Test: `tests/unit/ral/env.test.ts`

- [ ] **Step 1: Write the failing test**

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
import { assert, assertEquals, assertThrows } from "testing/asserts";
import { env } from "../../../src/deno_ral/env.ts";

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

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts`
Expected: fails with `Module not found "file:///.../src/deno_ral/env.ts"`.

- [ ] **Step 3: Implement**

Create `src/deno_ral/env.ts` with the exact content shown under Interfaces.

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts`
Expected: `ok | 5 passed | 0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/env.ts tests/unit/ral/env.test.ts
git commit -m "deno_ral/env: process environment object with unit test"
```

### Task 2: Codemod `src/`

- [ ] **Step 1: Dry run**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src --dry-run > /tmp/codemod-env.txt; tail -1 /tmp/codemod-env.txt`
Expected: `Summary: 624 files scanned, 50 would be rewritten, 149 replacements, 6 with collisions, 2 skipped` (measured with PR 09's codemod logic on `b86f98d`; 624 is the number of `.ts` files under `src/` outside the skip list and moves only if files are added or removed). 50 = the 57 files with code sites, minus the 6 colliding files (the name `env` is blocked for a whole file), minus `metrics.ts` (skipped). 149 = 167 code sites − 17 in the colliding files (`quarto.ts` 5, `render/project.ts` 6, `kernels.ts` 1, `api/index.ts` 1, `posit-connect-cloud.ts` 3, `axe/cmd.ts` 1) − 1 in `metrics.ts`. The two skipped files are `src/core/deno/monkey-patch.ts` and `src/core/performance/metrics.ts`; if PR 20b landed first, the line reads `51 would be rewritten, 150 replacements, 6 with collisions, 1 skipped`. If the numbers differ, recount with `rg -c 'Deno\.env' <file>` on the six files before continuing.

- [ ] **Step 2: Review the report**

Run: `grep -E 'skipped|collision' /tmp/codemod-env.txt`
Expected exactly these six collision lines (plus the skipped lines):
```
src/quarto.ts:87: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
src/command/render/project.ts:320: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
src/core/jupyter/kernels.ts:39: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
src/publish/posit-connect-cloud/api/index.ts:65: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
src/publish/posit-connect-cloud/posit-connect-cloud.ts:69: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
src/command/call/axe/cmd.ts:307: collision: local binding 'env' conflicts with deno_ral/env.ts; left as Deno.*
```
(The order follows the walk; the line number is the first conflicting identifier the tool finds. Six files is the invariant.)

Run: `grep '→' /tmp/codemod-env.txt | awk -F'→' '{print $2}' | sort | uniq -c`
Expected: a single target, `env`.

- [ ] **Step 3: Rewrite, format, type-check**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src | tail -1`
Expected: `Summary: 624 files scanned, 50 rewritten, 149 replacements, 6 with collisions, 2 skipped`.

Run: `git diff --name-only | xargs package/dist/bin/tools/x86_64/deno fmt`
Expected: only files under `src/` changed.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "src: codemod Deno.env to deno_ral/env (mechanical)"
```

### Task 3: Alias fixes for the six colliding files

**Files:**
- Modify: `src/quarto.ts`, `src/command/render/project.ts`, `src/core/jupyter/kernels.ts`, `src/publish/posit-connect-cloud/api/index.ts`, `src/publish/posit-connect-cloud/posit-connect-cloud.ts`

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

The resulting lines read, for example, `src/core/jupyter/kernels.ts:39`: `const env = runtimeEnv.get("VIRTUAL_ENV");`, `src/command/call/axe/cmd.ts:307`: `env: (key: string) => string | undefined = (key) => runtimeEnv.get(key),` and `src/quarto.ts:212-214`:

```ts
        runtimeEnv.delete(key);
      } else {
        runtimeEnv.set(key, value);
```

- [ ] **Step 2: Verify and commit**

Run the text check from Acceptance criteria.
Expected: empty.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

```bash
git add src/quarto.ts src/command/render/project.ts src/core/jupyter/kernels.ts src/publish/posit-connect-cloud/api/index.ts src/publish/posit-connect-cloud/posit-connect-cloud.ts src/command/call/axe/cmd.ts
git commit -m "Alias deno_ral env import in files with a local env binding"
```

### Task 4: Tests, docs, ratchet, commit

- [ ] **Step 1: Unit tests around environment handling**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts unit/environment.test.ts unit/dotenv-config.test.ts unit/binary-mode-strip-env.test.ts $(find unit/core/ -name '*.test.ts') $(find unit/tools/ -name '*.test.ts') $(find unit/jupyter/ -name '*.test.ts') $(find unit/project/ -name '*.test.ts') unit/github-actions-reporting.test.ts unit/chrome-launch.test.ts unit/preview-compatibility.test.ts`
Expected: `0 failed`.

- [ ] **Step 2: Smoke tests that set or read environment variables (profiles, dotenv files, pre/post render scripts, drafts, check, run)**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/env/ -name '*.test.ts') smoke/website/drafts-env.test.ts smoke/project/project-prepost.test.ts smoke/project/project-simple.test.ts smoke/render/render-html.test.ts smoke/render/render-cli-metadata-file.test.ts $(find smoke/check/ -name '*.test.ts') $(find smoke/run/ -name '*.test.ts') smoke/jupyter/issue-10097.test.ts smoke/render/render-r.test.ts`
Expected: `0 failed` (Jupyter/R tests skip without their prerequisites; note it).

- [ ] **Step 3: Manual dotenv check**

```bash
d=$(mktemp -d) && cd "$d" && printf 'project:\n  type: default\n' > _quarto.yml && printf 'MY_DOTENV_VAR=hello\n' > _environment && printf -- '---\ntitle: t\n---\n\n`r Sys.getenv("MY_DOTENV_VAR")`\n' > index.qmd && package/dist/bin/quarto render index.qmd --to md 2>&1 | tail -2; cat index.md | tail -3
```
Expected (with R available): the rendered `index.md` contains `hello`, proving `dotenvSetVariables` still exports the file's variables to child processes through `env.set`. Without R, instead run `QUARTO_LOG_LEVEL=DEBUG package/dist/bin/quarto render index.qmd --to html 2>&1 | grep -c 'MY_DOTENV_VAR'` → `0` is fine as long as the render succeeds; the smoke test `smoke/env/` covers the variable plumbing.

- [ ] **Step 4: Docs and ratchet**

In `.claude/rules/typescript/deno-ral.md`, add to the module table:

```
| `env.ts` | Process environment | `env.get`, `env.set`, `env.delete`, `env.toObject` |
```

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts`
Expected: passes; `git diff tools/runtime-boundary-baseline.json` shows the `src` count lower by exactly 166 (167 with PR 20b first) and no increase in any scope.

- [ ] **Step 5: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "Lower runtime boundary baseline after env codemod; document deno_ral/env"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts` → `ok | 5 passed | 0 failed`.
- Task 4 steps 1–2 → `0 failed`.
- The AST check and the text check from Acceptance criteria → as stated.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- Manual: `QUARTO_PROFILE=x package/dist/bin/quarto render tests/docs/test.qmd` works; `package/dist/bin/quarto check` shows the same environment-dependent rows (Python/R paths) as before; `QUARTO_CAPTURE_RENDER_COMMAND=$(mktemp -d) package/dist/bin/quarto render tests/docs/test.qmd` writes the capture directory (the `toObject` snapshot).

## Review checklist

- [ ] `env.ts` methods do not use `this`.
- [ ] `git diff` contains only `Deno.env.` → `env.` (or `runtimeEnv.`) rewrites and import lines.
- [ ] `src/quarto-core/dotenv.ts:44` still passes `env.delete` as a callback and the back-out loop still works (`smoke/env/`, `smoke/project/project-prepost.test.ts`).
- [ ] The six alias files kept their local `env` bindings unchanged.
- [ ] `src/core/platform.ts` test override (`_setIsRStudioForTest`) is untouched.
- [ ] No `package/src` or `tests/` file changed (they are PR 24 / PR 23).
- [ ] Baseline only decreased, by 166 under `src/` (167 with PR 20b first).
- [ ] `env.get`/`set`/`delete` validate the name before touching the runtime; the validation case is in the test.

## Risks and rollback

- The codemod blocks the name `env` for a whole file when any binding named `env` exists in it, which is why the six files are fixed by alias rather than by hand-rewriting single lines; if the dry run reports a seventh file, apply the same alias recipe. A re-run after the alias fix reuses `runtimeEnv` (PR 09 alias reuse).
- `env.toObject()` returns a fresh object like `Deno.env.toObject()`; the Node implementation must also copy (`{ ...process.env }`) so that mutation does not write through, which the unit test enforces.
- Name validation: code that called `Deno.env.get("")` and caught a Deno-specific error now gets a `TypeError` from the layer; no such caller exists in `src/` (all names are literals or come from YAML keys, which are non-empty).
- Rollback: `git revert` the four commits; `env.ts` is additive.

## Decisions needed

None. Review items closed here: the sixth collision (`axe/cmd.ts:307`), counts (58 files with matches, 57 with code; 167 code sites; dry run 50 / 149), comment hits in the greps (`platform.ts:17`, `declaration-types.ts:84`; filtered, PR 25 rewrites them), key validation pinned by the contract (TypeError on empty, `=` or NUL names on every runtime), landing order and the reset-and-re-run protocol.
