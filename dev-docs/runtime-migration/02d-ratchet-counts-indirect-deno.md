# PR 02d: the ratchet counts Deno reached indirectly

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `countText` counts `Deno?.x`, `globalThis["Deno"]` and a bare `globalThis.Deno` the way it counts `Deno.x`, so code cannot stay out of the ratchet by spelling the access differently.
**Phase:** 0.
**Depends on:** PR 02c (merged).
**Unblocks:** none; every later PR is checked by the stricter count once this lands.
**Branch:** `rt/02d-ratchet-counts-indirect-deno`.
**Suggested executor:** Sonnet: one regex and its key extraction, with every case fixed by the tests below.
**Size:** S (4 files: the tool, its unit test, the baseline, README).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

The ratchet counts `\bDeno\.` (`tools/check-runtime-boundary.ts:118`).
PR 09's plan had a unit test read `(globalThis as any)["Deno"]?.errors` only so that the `tests` count stayed flat; review caught it (PR 09 execution log, "Review of Tasks 1–3").
The current regex misses three spellings of the same access:

1. optional chaining, `Deno?.errors` (also `globalThis.Deno?.build.os`, `(globalThis as any).Deno?.errors`);
2. bracket access, `globalThis["Deno"]?.errors`, `globalThis['Deno']`;
3. a bare `globalThis.Deno` that aliases the namespace (`Deno = globalThis.Deno;`).

`globalThis.Deno.cwd()` is already counted: `\b` matches between `.` and `D`.
`typeof Deno`, the string `"Deno"`, and `["Deno"]` as an array element or a property of any object other than `globalThis` are not access to the namespace and stay uncounted.

Measured on `main` at `364ee3bae` with the regex below (a scratch script over `git ls-files`, scoped with `scopesOf`): no optional-chaining or bracket hit outside the excluded paths; three bare hits, `src/core/lib/external/colors.ts:28` (`src`) and the generated bundles `src/resources/editor/tools/vs-code.mjs:25954`, `src/resources/editor/tools/yaml/web-worker.js:25968` (`resources`).
`src/deno_ral/` stays exempt (`kSrcExclusions`): its `(globalThis as any).Deno?.errors` in `errors.ts` is the layer's own runtime check.

### Scope

In: the counting regex and key extraction in `countText`, the `FileCounts` doc comment, unit tests, the baseline (`src` 991 → 992, `resources` 10 → 12), the README row.
Out: new exclusions; replacement-map entries; any change to how findings are attributed or reported (they consume `countText`'s keys unchanged).

### Interfaces

No signature changes. `FileCounts.deno` keys indirect access like direct access: `Deno?.errors` and `globalThis["Deno"]?.errors` key as `"errors"`, a bare `globalThis.Deno` or `globalThis["Deno"]` as `""`.

### Files

- Modify: `tools/check-runtime-boundary.ts:109-130` (`FileCounts` doc comment, `kDenoRe`, the key in `countText`)
- Modify: `tests/unit/tools/check-runtime-boundary.test.ts` (two tests after "countText never swallows a following prefix")
- Modify: `tools/runtime-boundary-baseline.json`
- Modify: `dev-docs/runtime-migration/README.md` (row in "The sequence")

### Acceptance criteria

- `tests/unit/tools/check-runtime-boundary.test.ts` passes, including the two new tests and the existing `countText` tests unchanged.
- `quarto run --dev tools/check-runtime-boundary.ts` on the branch: `src` 992, `resources` 12, other scopes unchanged, and no "rose" message.

## Plan

### Task 1: count indirect access

**Files:** `tools/check-runtime-boundary.ts`, `tests/unit/tools/check-runtime-boundary.test.ts`

- [x] **Step 1: Write the failing test.** Insert after the test "countText never swallows a following prefix". The fixtures build the name at run time, like the file's existing `DENO` constant, so the test file itself is not counted:

  ```typescript
  const DENO_ID = DENO.slice(0, -1);

  // deno-lint-ignore require-await
  unitTest("check-runtime-boundary - countText counts optional-chaining, bracket and globalThis access", async () => {
    const text = [
      `${DENO_ID}?.errors`,
      `${DENO_ID}?.errors?.NotFound`,
      `globalThis.${DENO_ID}?.build.os`,
      `(globalThis as any).${DENO_ID}?.errors`,
      `(globalThis as any)["${DENO_ID}"]?.errors`,
      `globalThis['${DENO_ID}']`,
      `${DENO_ID} = globalThis.${DENO_ID};`,
      `globalThis.${DENO_ID}.cwd()`,
    ].join("\n");
    assertEquals(countText(text).deno, { errors: 3, "errors.NotFound": 1, "build.os": 1, "": 2, cwd: 1 });
  });

  // deno-lint-ignore require-await
  unitTest("check-runtime-boundary - countText ignores the name outside an access", async () => {
    const text = [
      `typeof ${DENO_ID} === "undefined"`,
      `const s = "${DENO_ID}";`,
      `${DENO_ID}Kv.open()`,
      `my${DENO_ID}.x`,
      `const names = ["${DENO_ID}"];`,
      `obj["${DENO_ID}"].x`,
    ].join("\n");
    assertEquals(countText(text).deno, {});
  });
  ```

- [x] **Step 2: Run it and see it fail.** From `tests/`: `QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts`.
  Expected: the first new test fails on `assertEquals` with the actual value `{ cwd: 1 }` (only `globalThis.Deno.cwd()` is counted today); the second passes (it guards against over-counting and is not RED).

- [x] **Step 3: Implement.** In `tools/check-runtime-boundary.ts`, replace the `FileCounts` doc comment, `kDenoRe` and its comment, and the key line in `countText`:

  ```typescript
  /** Per-file counts. `deno` maps the API key to its occurrences: "build.os" for `Deno.build.os`,
   * "readTextFileSync" for `Deno.readTextFileSync(`, "" for a `Deno.` followed by no identifier.
   * Indirect access keys the same way: `Deno?.errors` and `globalThis["Deno"]?.errors` as "errors",
   * a bare `globalThis.Deno` or `globalThis["Deno"]` as "". `std` lists counted std specifiers
   * (allow-listed excluded), in source order, duplicates kept. */
  ```

  ```typescript
  // Three alternatives: `Deno.` or `Deno?.`; `globalThis["Deno"]` (any quote, also `globalThis?.[`);
  // a bare `globalThis.Deno` not followed by an access (the first alternative counts that one).
  // The globalThis receiver may be cast, `(globalThis as any)`; requiring it keeps `["Deno"]` in an
  // array or on another object uncounted. The key is read inside a lookahead so a following
  // `Deno.` is never consumed.
  const kDenoRe =
    /\bDeno\??\.(?=(\w*)(?:\??\.(\w+))?)|\bglobalThis(?:\s+as\s+\w+\s*\))?\s*(?:\?\.)?\[\s*["'`]Deno["'`]\s*\](?:\??\.)?(?=(\w*)(?:\??\.(\w+))?)|\bglobalThis(?:\s+as\s+\w+\s*\))?\s*\??\.\s*Deno\b(?!\??\.)/g;
  ```

  ```typescript
    for (const match of text.matchAll(kDenoRe)) {
      const first = match[1] ?? match[3] ?? "";
      const second = match[2] ?? match[4];
      const key = first + (second ? "." + second : "");
      deno[key] = (deno[key] ?? 0) + 1;
    }
  ```

- [x] **Step 4: Run the tests.** Same command as Step 2. Expected: the `--agent` tally reports no failure; the existing tests "countText keys Deno APIs by one or two identifiers", "countText never swallows a following prefix" and "inherited property names count as ordinary Deno API keys" pass unchanged.

- [x] **Step 5: Commit.** `git add tools/check-runtime-boundary.ts tests/unit/tools/check-runtime-boundary.test.ts`, message "Runtime boundary: count Deno reached through optional chaining and globalThis".

### Task 2: baseline and README

**Files:** `tools/runtime-boundary-baseline.json`, `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Run the check.** `quarto run --dev tools/check-runtime-boundary.ts` from the repository root. Expected rows: `src 992 (baseline 991)`, `resources 12 (baseline 10)`, every other count equal to its baseline, and "rose" messages for `src` and `resources`. Different numbers mean `main` moved: re-run the Context measurement and record it in the execution log.
- [ ] **Step 2: Update the baseline.** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-increase`; then re-run Step 1's command and expect no "rose" message.
- [ ] **Step 3: README row.** In "The sequence", set the `02d` row's status from `planned` to `in progress` (the row landed with this plan).
- [ ] **Step 4: Commit.** `git add tools/runtime-boundary-baseline.json dev-docs/runtime-migration/README.md dev-docs/runtime-migration/02d-ratchet-counts-indirect-deno.md`, message "Runtime boundary: baseline for indirect Deno access (src +1, resources +2)".

## Verification

- `QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts` from `tests/`: no failure.
- `quarto run --dev tools/check-runtime-boundary.ts`: no "rose" or "fell" message.
- The PR description lists the three newly counted lines from Context, as the `--accept-increase` warning asks.

## Review checklist

- [ ] `typeof Deno`, a `"Deno"` string, `DenoKv`, `myDeno.x`, `["Deno"]` in an array and `obj["Deno"]` stay uncounted (second new test); bracket access counts only on a `globalThis` receiver.
- [ ] `globalThis.Deno.cwd()` counts once, not twice (the bare alternative's negative lookahead).
- [ ] The keys of indirect access match the keys of direct access, so `kRalDenoReplacements` findings apply to both (`globalThis.Deno?.build.os` keys as `build.os`).
- [ ] No file outside the four in Files changed.
- [ ] No new helper duplicates an existing one (`tests/utils.ts`, `tests/verify.ts`, `tests/unit/**/utils.ts`, `src/`).
- [ ] No code outside `src/deno_ral/` reaches `Deno` indirectly to stay out of the ratchet count.
- [ ] Comments in `src/` and `tests/` state the current reason only, with no plan or PR numbers.

## Risks and rollback

A false positive raises a count a PR did not really raise; it shows as a "rose" finding on an unrelated line and is fixed by tightening the regex with a test case.
Rollback: revert the PR; the baseline goes back with it.

## Execution log

### Task 1: count indirect access

Step 0 checks: `kDenoRe` at `tools/check-runtime-boundary.ts:118` was `/\bDeno\.(?=(\w*)(?:\.(\w+))?)/g`, `FileCounts` and `countText` at lines 109-130, baseline `src` 991 and `resources` 10.
The plan's code adds no helper duplicating one in `tests/` or `src/` (it reuses the file's `DENO` constant), reaches Deno through `globalThis` only inside fixture strings, and its comments cite no plan or PR numbers.
Setup: `./configure.cmd` ran; `package/dist/bin/quarto.cmd` exists.

Step 2 (RED), from `tests/`: `$env:QUARTO_TESTS_NO_CONFIG="true"; pwsh -File run-tests.ps1 --agent unit/tools/check-runtime-boundary.test.ts`

```text
[unit] > check-runtime-boundary - countText counts optional-chaining, bracket and globalThis access => ./test.ts:794:8
Values are not equal.
    [Diff] Actual / Expected
+   {
+     "": 2,
+     "build.os": 1,
+     "errors.NotFound": 1,
-   [Object: null prototype] {
      cwd: 1,
+     errors: 3,
    }
FAILED | 42 passed | 1 failed (12s)
```

The actual value is `{ cwd: 1 }`; the second new test passed.

Step 4 (GREEN), same command:

```text
ok | 43 passed | 0 failed (14s)
```
