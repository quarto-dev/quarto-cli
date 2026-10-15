# PR 00c: One-time notice that `.ts`/`.js` scripts will move from Deno to Node

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `quarto run`, a project `pre-render`/`post-render` step or an `ipynb-filters` entry runs a `.ts` or `.js` script on Deno, Quarto prints, once per process, a warning that Quarto 1.12 runs such scripts on Node and links the migration page; `QUARTO_RUN_DENO_NOTICE=0` silences it.
**Phase:** 0. **Depends on:** 02 (landing order; this PR adds no `Deno.*` and keeps the ratchet unchanged). **Unblocks:** PR 35 (the notice text and the migration page name are the contract PR 35 fulfils); must ship in the 1.11 stable release (review decision 2).
**Branch:** `rt/00c-quarto-run-deprecation-notice`.
**Suggested executor:** Sonnet. One small module, one call site, a fixture project and two tests, all specified below.
**Size:** S (10 files: 1 new module, 1 call site, 1 unit test, 1 smoke test, 4 fixture files, the test runners, the changelog).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`REVIEW-2026-10-15.md` decision 2: 1.11 ships on Deno with a deprecation notice for `quarto run`; 1.12 ships on Node, where PR 35 runs `.ts`/`.js`/`.mjs`/`.mts` scripts with Node's type stripping, a `Deno` global shim for the common calls and `stdlib/*` modules, and `quarto install deno` as the escape hatch. Users wrote scripts against `Deno.*` and `stdlib/*` for years (`docs/projects/scripts.html#deno-scripts` on quarto.org). The notice gives them one stable release of warning.

Where `.ts`/`.js` scripts run today (verified): every caller goes through `handlerForScript` (`src/core/run/run.ts:16`), and `denoRunHandler` (`src/core/run/deno.ts:17-76`) is the handler for `.js`/`.ts`. Its callers are `quarto run <script>` (`src/command/run/run.ts:34-41`, reached from `src/quarto.ts:136-139`), project `pre-render`/`post-render` scripts (`src/command/render/project.ts:963-990`, extension-provided scripts included) and `ipynb-filters` (`src/core/jupyter/jupyter-filters.ts:64`). `quarto run --dev <script>` (repository tooling under `tools/`, `options.dev === true`) is internal and gets no notice.

Behaviour:

- Once per Quarto process: a project with both a `pre-render` and a `post-render` `.ts` script prints the notice once.
- Printed with `warning()` (three one-line calls, `llm-docs/error-messages.md`), so `--quiet` and `QUARTO_LOG_LEVEL` above `WARNING` hide it like any warning.
- `QUARTO_RUN_DENO_NOTICE=0` or `false` (any case, surrounding spaces ignored) disables it; unset, empty or any other value shows it.
- The text names the migration page `https://quarto.org/docs/projects/scripts-deno-to-node.html`. The page itself is created in `quarto-dev/quarto-web` (`docs/projects/scripts-deno-to-node.qmd`) before 1.11 ships; see the docs list in Task 4.

The test runners set `QUARTO_RUN_DENO_NOTICE=0` so the many fixtures with `.ts` project scripts (`tests/docs/project/prepost/*`, `tests/docs/websites/drafts/drafts-preprocessor`, `tests/docs/search/issue-10285`) do not trip `noErrorsOrWarnings` verifiers; the new smoke test sets it back to `1` for its own subprocesses.

### Scope

In: `src/core/run/deno-notice.ts`, one call in `src/core/run/deno.ts`, unit and smoke tests with a fixture project, `QUARTO_RUN_DENO_NOTICE=0` in `tests/run-tests.sh`, `tests/run-tests.ps1` and `tests/run-parallel-tests.sh`, a changelog entry, the quarto-web docs list in the PR description.

Out: any change to how scripts run (PR 35); a notice for `.py`, `.R`, `.lua` scripts (unchanged by the migration); a persisted "shown once per user" marker (see Decisions).

### Interfaces

`src/core/run/deno-notice.ts` (new):

```ts
/** Environment variable that disables the notice when set to "0" or "false". */
export const kRunDenoNoticeEnv = "QUARTO_RUN_DENO_NOTICE";

/** quarto.org page explaining how to move scripts from Deno to Node (created in quarto-web). */
export const kRunDenoMigrationUrl = "https://quarto.org/docs/projects/scripts-deno-to-node.html";

/** False for "0" and "false" (case-insensitive, trimmed); true otherwise, including undefined and "". */
export function denoRunNoticeEnabled(value: string | undefined): boolean;

/** The three lines of the notice for `script` (as given by the caller). */
export function denoRunNoticeLines(script: string): string[];

/** Returns a function that logs the notice through `log` the first time it is called with the notice
 * enabled (per `readEnv`), and does nothing on later calls. */
export function makeDenoRunNotice(
  readEnv: () => string | undefined,
  log: (line: string) => void,
): (script: string) => void;

/** The process-wide instance: reads QUARTO_RUN_DENO_NOTICE, logs with warning(). */
export const showDenoRunNotice: (script: string) => void;
```

Notice text (exact):

```
WARNING: Script 'pre.ts' runs on Deno. Starting with Quarto 1.12, TypeScript and JavaScript scripts run on Node instead.
WARNING: Scripts that use the Deno API (Deno.*) or 'stdlib/*' imports may need changes; see https://quarto.org/docs/projects/scripts-deno-to-node.html
WARNING: Set QUARTO_RUN_DENO_NOTICE=0 to hide this notice.
```

### Files

- Create: `src/core/run/deno-notice.ts`
- Modify: `src/core/run/deno.ts:21-35` (call `showDenoRunNotice(script)` unless `options?.dev`)
- Test: `tests/unit/run/deno-notice.test.ts` (new)
- Test: `tests/smoke/run/run-deno-notice.test.ts` (new)
- Create: `tests/docs/project/prepost/deno-notice/_quarto.yml`, `index.qmd`, `pre.ts`, `post.ts`
- Modify: `tests/run-tests.sh:70`, `tests/run-tests.ps1:60`, `tests/run-parallel-tests.sh:3`
- Modify: `news/changelog-1.11.md` (`## Commands`, new `### \`run\`` after `### \`check\``)
- Modify: `dev-docs/runtime-migration/README.md` (PR 00c row status)

### Acceptance criteria

- `quarto render tests/docs/project/prepost/deno-notice` with `QUARTO_RUN_DENO_NOTICE=1` prints the first notice line exactly once (the project has a pre-render and a post-render `.ts` script) and succeeds.
- The same render with `QUARTO_RUN_DENO_NOTICE=0` prints no notice line.
- `quarto run tests/docs/project/prepost/deno-notice/pre.ts` prints the notice once; `quarto run --dev tools/check-runtime-boundary.ts` prints none.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run/deno-notice.test.ts $(find smoke/run -name '*.test.ts') smoke/project/project-prepost.test.ts` → all passed (`smoke/run/` includes the new `run-deno-notice.test.ts`).
- `quarto run --dev tools/check-runtime-boundary.ts` → `OK` with unchanged counts (the new module uses `getenv` from `src/core/env.ts`, not `Deno.env`; the new tests and fixtures add no `Deno.` occurrence to a counted scope).

## Plan

### Task 1: The notice module

**Files:**
- Create: `src/core/run/deno-notice.ts`
- Test: `tests/unit/run/deno-notice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/run/deno-notice.test.ts`:

```ts
/*
 * deno-notice.test.ts
 *
 * The one-time notice printed when a .ts/.js script runs on Deno
 * (src/core/run/deno-notice.ts).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertStringIncludes } from "../../asserts.ts";
import {
  denoRunNoticeEnabled,
  denoRunNoticeLines,
  kRunDenoMigrationUrl,
  kRunDenoNoticeEnv,
  makeDenoRunNotice,
} from "../../../src/core/run/deno-notice.ts";

// deno-lint-ignore require-await
unitTest("deno-notice - enabled unless 0 or false", async () => {
  assert(denoRunNoticeEnabled(undefined));
  assert(denoRunNoticeEnabled(""));
  assert(denoRunNoticeEnabled("1"));
  assert(denoRunNoticeEnabled("yes"));
  assert(!denoRunNoticeEnabled("0"));
  assert(!denoRunNoticeEnabled("false"));
  assert(!denoRunNoticeEnabled(" FALSE "));
});

// deno-lint-ignore require-await
unitTest("deno-notice - text names the script, Node, the page and the switch", async () => {
  const lines = denoRunNoticeLines("pre.ts");
  assertEquals(lines.length, 3);
  assertEquals(
    lines[0],
    "Script 'pre.ts' runs on Deno. Starting with Quarto 1.12, TypeScript and JavaScript scripts run on Node instead.",
  );
  assertStringIncludes(lines[1], kRunDenoMigrationUrl);
  assertEquals(lines[2], `Set ${kRunDenoNoticeEnv}=0 to hide this notice.`);
  assertEquals(kRunDenoMigrationUrl, "https://quarto.org/docs/projects/scripts-deno-to-node.html");
});

// deno-lint-ignore require-await
unitTest("deno-notice - logs once per instance, never when disabled", async () => {
  const logged: string[] = [];
  const notice = makeDenoRunNotice(() => undefined, (l) => logged.push(l));
  notice("pre.ts");
  notice("post.ts");
  assertEquals(logged.length, 3);
  assertStringIncludes(logged[0], "'pre.ts'");

  const silent: string[] = [];
  const disabled = makeDenoRunNotice(() => "0", (l) => silent.push(l));
  disabled("pre.ts");
  assertEquals(silent, []);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run/deno-notice.test.ts`
Expected: FAIL at type-check time, `Module not found ".../src/core/run/deno-notice.ts"`.

- [ ] **Step 3: Implement**

Create `src/core/run/deno-notice.ts`:

```ts
/*
 * deno-notice.ts
 *
 * One-time notice that TypeScript and JavaScript scripts run by `quarto run`,
 * project pre-render/post-render steps and ipynb-filters run on Deno today and
 * on Node from Quarto 1.12 (dev-docs/runtime-migration/00c-quarto-run-deprecation-notice.md).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { warning } from "../../deno_ral/log.ts";
import { getenv } from "../env.ts";

export const kRunDenoNoticeEnv = "QUARTO_RUN_DENO_NOTICE";

export const kRunDenoMigrationUrl =
  "https://quarto.org/docs/projects/scripts-deno-to-node.html";

export function denoRunNoticeEnabled(value: string | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false";
}

export function denoRunNoticeLines(script: string): string[] {
  return [
    `Script '${script}' runs on Deno. Starting with Quarto 1.12, TypeScript and JavaScript scripts run on Node instead.`,
    `Scripts that use the Deno API (Deno.*) or 'stdlib/*' imports may need changes; see ${kRunDenoMigrationUrl}`,
    `Set ${kRunDenoNoticeEnv}=0 to hide this notice.`,
  ];
}

export function makeDenoRunNotice(
  readEnv: () => string | undefined,
  log: (line: string) => void,
): (script: string) => void {
  let shown = false;
  return (script: string) => {
    if (shown || !denoRunNoticeEnabled(readEnv())) {
      return;
    }
    shown = true;
    for (const line of denoRunNoticeLines(script)) {
      log(line);
    }
  };
}

export const showDenoRunNotice = makeDenoRunNotice(
  () => {
    const value = getenv(kRunDenoNoticeEnv, "");
    return value === "" ? undefined : value;
  },
  (line) => warning(line),
);
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run/deno-notice.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/core/run/deno-notice.ts tests/unit/run/deno-notice.test.ts
git commit -m "Add the notice that .ts/.js scripts will run on Node in Quarto 1.12"
```

### Task 2: Show it from the Deno run handler

**Files:**
- Modify: `src/core/run/deno.ts`
- Create: `tests/docs/project/prepost/deno-notice/_quarto.yml`, `index.qmd`, `pre.ts`, `post.ts`
- Test: `tests/smoke/run/run-deno-notice.test.ts`

- [ ] **Step 1: Create the fixture project**

`tests/docs/project/prepost/deno-notice/_quarto.yml`:
```yaml
project:
  type: default
  output-dir: _output
  pre-render: pre.ts
  post-render: post.ts
```
`tests/docs/project/prepost/deno-notice/index.qmd`:
```markdown
---
title: "deno-notice"
---

The pre-render and post-render scripts are TypeScript, run on Deno.
```
`tests/docs/project/prepost/deno-notice/pre.ts`:
```ts
console.log("deno-notice pre-render");
```
`tests/docs/project/prepost/deno-notice/post.ts`:
```ts
console.log("deno-notice post-render");
```

- [ ] **Step 2: Write the failing smoke test**

Create `tests/smoke/run/run-deno-notice.test.ts`:

```ts
/*
 * run-deno-notice.test.ts
 *
 * .ts scripts run on Deno print a one-time notice about the move to Node in
 * Quarto 1.12; QUARTO_RUN_DENO_NOTICE=0 hides it. The test runners set it to 0
 * for the whole suite, so these tests set it explicitly for their subprocess.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "../../../src/deno_ral/path.ts";
import { existsSync, safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { execProcess } from "../../../src/core/process.ts";
import { assert, assertEquals } from "../../asserts.ts";
import { docs, quartoDevCmd } from "../../utils.ts";
import { quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import { unitTest } from "../../test.ts";

const projectDir = docs("project/prepost/deno-notice");
const kNoticeRe = /runs on Deno\. Starting with Quarto 1\.12/g;

async function quarto(args: string[], notice: string) {
  const result = await execProcess(
    {
      cmd: quartoDevCmd(),
      args,
      ...quartoSpawnEnvOptions({
        QUARTO_RUN_DENO_NOTICE: notice,
        QUARTO_LOG_LEVEL: "INFO",
      }),
    },
    undefined,
    undefined,
    undefined,
    true,
  );
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  return { success: result.success, output, count: (output.match(kNoticeRe) ?? []).length };
}

const cleanup = () => {
  for (const dir of ["_output", ".quarto"]) {
    const path = join(projectDir, dir);
    if (existsSync(path)) {
      safeRemoveSync(path, { recursive: true });
    }
  }
  return Promise.resolve();
};

unitTest("run-deno-notice - pre and post .ts scripts print the notice once", async () => {
  const { success, output, count } = await quarto(["render", projectDir], "1");
  assert(success, output);
  assert(output.includes("deno-notice pre-render"), output);
  assert(output.includes("deno-notice post-render"), output);
  assertEquals(count, 1, output);
}, { teardown: cleanup });

unitTest("run-deno-notice - QUARTO_RUN_DENO_NOTICE=0 hides it", async () => {
  const { success, output, count } = await quarto(["render", projectDir], "0");
  assert(success, output);
  assertEquals(count, 0, output);
}, { teardown: cleanup });

unitTest("run-deno-notice - quarto run prints it", async () => {
  const { success, output, count } = await quarto(["run", join(projectDir, "pre.ts")], "1");
  assert(success, output);
  assertEquals(count, 1, output);
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/run/run-deno-notice.test.ts`
Expected: the first and third tests FAIL with `Values are not equal` (`0` actual, `1` expected); the second passes.

- [ ] **Step 4: Call the notice from the handler**

In `src/core/run/deno.ts` add the import after line 15 (`import { quartoConfig } from "../quarto.ts";`):
```ts
import { showDenoRunNotice } from "./deno-notice.ts";
```
and replace lines 27-28
```ts
    // add deno std library (one time initialize cache on demand)
    const denoDir = initDenoCache();
```
with
```ts
    // user scripts (not repository tooling run with --dev) move to Node in 1.12
    if (!options?.dev) {
      showDenoRunNotice(script);
    }

    // add deno std library (one time initialize cache on demand)
    const denoDir = initDenoCache();
```

- [ ] **Step 5: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/run/run-deno-notice.test.ts unit/run/deno-notice.test.ts`
Expected: `6 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/core/run/deno.ts tests/smoke/run/run-deno-notice.test.ts tests/docs/project/prepost/deno-notice
git commit -m "Print the Deno-to-Node notice when a .ts/.js script runs

Covers quarto run, project pre-render/post-render and ipynb-filters
(all go through denoRunHandler); quarto run --dev is excluded."
```

### Task 3: Keep the suite quiet

**Files:**
- Modify: `tests/run-tests.sh:70`, `tests/run-tests.ps1:60`, `tests/run-parallel-tests.sh:3`

- [ ] **Step 1: Set the switch in the runners**

In `tests/run-tests.sh` after line 70 (`export QUARTO_DEBUG=true`) add:
```bash
# fixtures run .ts project scripts; the Deno-to-Node notice (PR 00c) would trip
# noErrorsOrWarnings verifiers. smoke/run/run-deno-notice.test.ts re-enables it.
export QUARTO_RUN_DENO_NOTICE=0
```
In `tests/run-tests.ps1` after line 60 (`$Env:QUARTO_DEBUG = "true"`) add:
```powershell
# fixtures run .ts project scripts; the Deno-to-Node notice (PR 00c) would trip
# noErrorsOrWarnings verifiers. smoke/run/run-deno-notice.test.ts re-enables it.
$Env:QUARTO_RUN_DENO_NOTICE = "0"
```
In `tests/run-parallel-tests.sh` replace `quarto run run-parallel-tests.ts $*` with:
```bash
QUARTO_RUN_DENO_NOTICE=0 quarto run run-parallel-tests.ts $*
```

- [ ] **Step 2: Run the suites that run .ts project scripts**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/run -name '*.test.ts') smoke/project/project-prepost.test.ts smoke/website/drafts.test.ts $(find smoke/search -name '*.test.ts')`
Expected: all passed, and `run-deno-notice.test.ts` still passes (its overlay sets the variable to `1` and `0` explicitly).

- [ ] **Step 3: Commit**

```bash
git add tests/run-tests.sh tests/run-tests.ps1 tests/run-parallel-tests.sh
git commit -m "Silence the Deno-to-Node script notice in the test runners"
```

### Task 4: Changelog, docs list, status

**Files:**
- Modify: `news/changelog-1.11.md`
- Modify: `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Open the PR as a draft and get its number**

Run: `git push -u origin rt/00c-quarto-run-deprecation-notice && gh pr create --draft --fill && gh pr view --json number -q .number`
Expected: the PR number (for example `15102`).

- [ ] **Step 2: Add the changelog entry**

In `news/changelog-1.11.md`, under `## Commands`, after the `### \`check\`` entries, add:
```markdown
### `run`

- ([#15102](https://github.com/quarto-dev/quarto-cli/pull/15102)): `quarto run`, project `pre-render`/`post-render` scripts and `ipynb-filters` now print a one-time warning when they run a TypeScript or JavaScript script on Deno: starting with Quarto 1.12 these scripts run on Node, and scripts that use the `Deno` API or `stdlib/*` imports may need changes (see <https://quarto.org/docs/projects/scripts-deno-to-node.html>). Set `QUARTO_RUN_DENO_NOTICE=0` to hide the warning.
```
(with the PR number from Step 1).

- [ ] **Step 3: Put the documentation list in the PR description**

Add to the PR description (these are `quarto-dev/quarto-web` changes, tracked there, required before 1.11 ships):
```markdown
Documentation (quarto-web):
- New page `docs/projects/scripts-deno-to-node.qmd` (URL https://quarto.org/docs/projects/scripts-deno-to-node.html): what changes in 1.12 (Node runs .ts/.js/.mjs/.mts scripts; type stripping limits: no enum, parameter properties, runtime namespace), the Deno API calls the compatibility shim covers, `stdlib/*` support, `quarto install deno` to keep running on Deno, and `QUARTO_RUN_DENO_NOTICE=0`.
- `docs/projects/scripts.qmd`, section "Deno Scripts": a callout linking the new page.
- `docs/advanced/environment-vars.qmd` (or the page listing Quarto's environment variables): `QUARTO_RUN_DENO_NOTICE`.
```

- [ ] **Step 4: Set the PR 00c row to `in progress` and commit**

```bash
git add news/changelog-1.11.md dev-docs/runtime-migration/README.md
git commit -m "Changelog: Deno-to-Node notice for .ts/.js scripts"
git push
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run/deno-notice.test.ts $(find smoke/run -name '*.test.ts')` → all passed.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/project/project-prepost.test.ts smoke/website/drafts.test.ts` → passed (suite-wide silence works).
- By hand: `package/dist/bin/quarto run tests/docs/project/prepost/deno-notice/pre.ts` prints the three `WARNING:` lines and `deno-notice pre-render`; with `QUARTO_RUN_DENO_NOTICE=0` only the script output.
- `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` → `OK`, counts unchanged, and no notice.

## Review checklist

- [ ] The notice is printed from `denoRunHandler.run` only, before the script starts, and never for `options.dev`.
- [ ] Once per process: `makeDenoRunNotice` keeps the flag in its closure; `showDenoRunNotice` is the only process-wide instance.
- [ ] Three `warning()` calls, each one line, none starting with `\n` (`llm-docs/error-messages.md`).
- [ ] `0`/`false` disable it; nothing else does.
- [ ] No `Deno.` in the new module, tests or fixtures (`getenv` from `src/core/env.ts`).
- [ ] The URL is exactly `https://quarto.org/docs/projects/scripts-deno-to-node.html` in the code, the test, the changelog and the docs list.
- [ ] The three test runners set `QUARTO_RUN_DENO_NOTICE=0`.

## Risks and rollback

- Users who run project scripts on every render see the warning on every render. Intended: it is a deprecation with a switch. If feedback says it is too noisy, Decision 1's alternative is a small follow-up.
- A downstream tool that parses Quarto's stderr strictly could see new lines. Warnings already go there; the switch covers it.
- The migration page must exist when 1.11 ships; until then the URL 404s. The PR description's docs list is the tracker; the release checklist owner checks it.
- Rollback: revert the commits; no data or configuration is written.

## Decisions needed

1. **Once per process vs. once per user.** This plan prints once per Quarto process. A persisted marker (for example a file in `quartoDataDir()`) would show it once per user, but would be shared across Quarto versions installed side by side (review S7) and is easy to miss in CI logs. Recommendation: once per process (this plan), with `QUARTO_RUN_DENO_NOTICE=0` for users who have read it.
