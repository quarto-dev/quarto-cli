# PR 02c: the ratchet blames only the PR's own increase and says what to change

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a pull request fails the Runtime Boundary job only for counts it raised itself, only for a `Deno.*` API with a curated, equivalent `src/deno_ral` replacement, and every finding says what to change; everything else is a warning for the maintainer; main keeps the absolute baseline gate.
**Phase:** 0.
**Depends on:** PR 02 (landed, #15135).
**Unblocks:** every PR that changes a count (00a, 00b, 00c, 01, 02b, 03–09, 14b, 20b): they may be prepared in parallel but land after this one, so their own counts are checked by the new rule.
**Branch:** `rt/02c-ratchet-pr-delta`.
**Suggested executor:** Sonnet: the plan fixes every interface, message and test; the counting refactor is guarded by an exact-totals check.
**Size:** S (9 files: the tool, its unit test, the workflow, 6 plan/README docs touched by text edits).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

PR 02 compares absolute counts per scope with `tools/runtime-boundary-baseline.json`.
On 2026-10-21 #15134 merged 20 minutes after the ratchet; its checks had run on a base without it, so its six new `Deno.*` calls in two test files went unchecked.
main went red, and because `pull_request` runs check out the merge commit, every open PR failed for an increase it did not make (#15136: run 39636363899).
The baseline was raised on main in `8599166fb` (`tests` 826 → 832) to recover.

Three defects remain:

1. Absolute comparison on PRs: any overflow on main fails every PR until a maintainer fixes main. The merge race recurs whenever a PR merges without a run against current main.
2. The `::error` always says "Application code must use src/deno_ral/", but `src/deno_ral` has no replacement for most `Deno.*` APIs yet: no `readTextFile`/`writeTextFile`/`makeTempDir`/`remove` (PR 09), no `env` (PR 14), only a thin `call()` for processes (PR 08). Even the covered areas are partial: `platform.ts` has `os`/`arch` but not `Deno.build.target`; `deno_ral/fs.ts` has `existsSync` but not `exists`; `tests/asserts.ts` has no `assertFalse`. A contributor bug fix that adds `Deno.readTextFileSync` in `src` fails with no remedy available.
3. Nothing tells the maintainer, at review time, that a PR needs a baseline bump before merge.

Decided 2026-10-22: the committed baseline stays as a main-only gate (push runs compare absolute counts); PR runs compare the merge commit with its first parent; increases with no replacement are warnings plus a job-summary block addressed to the maintainer, who pushes the baseline bump into the PR before merging.

### Scope

In:
- Per-file counting keyed by Deno API (`Deno.<a>` or `Deno.<a>.<b>`) and by counted std specifier, with absolute totals unchanged.
- `--against <rev>`: delta mode comparing the working tree with `<rev>` over the changed files; per scope, increases net out against decreases of the same Deno API or the same std module before any finding is attributed.
- `kRalDenoReplacements`: exact, hand-curated API keys whose `deno_ral` replacement is equivalent; an increase of one is the only error in PR mode.
- `kStdSuggestions`: std module → a `deno_ral` (or `tests/asserts.ts`) module worth checking. std increases are always warnings: whether a wrapper is a working replacement depends on symbols, submodule semantics (`path/posix`) and type exports, which a name check cannot establish (design review, 2026-10-22).
- Annotations on the added line where one is found; a job summary with the per-scope delta, what to change, and the maintainer block with the expected post-merge counts.
- `--accept-increase` replaces `--accept-tests-increase` and accepts any scope (an uncovered `src` increase needs it too).
- Workflow: `fetch-depth: 2`, `--against HEAD^1` on `pull_request`, absolute mode on `push` and `workflow_dispatch`.
- Docs: README row, ratchet sentence and landing order; the flag rename in live plans; the rule that a PR adding a replacement also adds its map entry.

Out:
- PR comments (fork PRs have a read-only token; `pull_request_target` is not worth its security surface for text the job summary already carries).
- Branch protection or merge-queue changes.
- The review-time skill (beads child "Skill: handling a Runtime Boundary failure on a PR", written after this lands).
- Delta reporting on push runs (the absolute gate plus `git log` is enough for a maintainer).

### Interfaces

All in `tools/check-runtime-boundary.ts`. Existing exports keep their signatures except `acceptTestsIncrease`, which becomes `acceptIncrease`.

```typescript
/** Per-file counts. `deno` maps the API key to its occurrences: "build.os" for `Deno.build.os`,
 * "readTextFileSync" for `Deno.readTextFileSync(`, "" for a `Deno.` followed by no identifier,
 * so the sum equals the old \bDeno\. count. `std` lists counted std specifiers (allow-listed excluded), in source order, duplicates kept. */
export interface FileCounts {
  deno: Record<string, number>;
  std: string[];
}
export function countText(text: string): FileCounts;

/** The scopes a repository-relative path (forward slashes) is counted in: same exts, exclude, include and kSkip rules as countScope. */
export function scopesOf(rel: string): string[];

/** The std module of a specifier, "@std/" stripped so equivalent spellings agree:
 * "fs/ensure-dir", "@std/fs", "jsr:@std/fs@1.0.16/walk" -> "fs"; "testing/asserts" -> "testing";
 * "jsr:/@std/assert" and "https://deno.land/std@0.93.0/assert/assert_object_match.ts" -> "assert";
 * "@std/path", "path" -> "path". */
export function stdModuleOf(specifier: string): string;

/** Keyed by exact API key. A PR that adds a deno_ral replacement adds its keys here. */
export const kRalDenoReplacements: Readonly<Record<string, { hint: string; scopes?: readonly string[] }>>;
/** Keyed by stdModuleOf(). `module` is repository-relative. A suggestion only: never turns a finding into an error. */
export const kStdSuggestions: Readonly<Record<string, { module: string; scopes?: readonly string[] }>>;

export function denoReplacement(api: string, scope: string): string | undefined;
export function stdSuggestion(specifier: string, scope: string): string | undefined;

export interface FileChange {
  path: string;          // repository-relative, forward slashes, verbatim (no git quoting)
  before: string | null; // text at the base revision, null only when the path is absent there
  after: string | null;  // text in the working tree, null if deleted
  addedLines: number[];  // 1-based line numbers in `after` that the diff adds
}
export interface Finding {
  scope: string;
  file: string;
  kind: "deno" | "std";
  name: string;          // API key, or the std specifier as written
  delta: number;         // > 0 (deno: this file's increase of the API; std: 1)
  line?: number;         // first added line containing the occurrence
  replacement?: string;  // deno only; set = covered = error
  suggestion?: string;   // std only: module from kStdSuggestions
}
export interface DeltaReport {
  deltas: Record<string, BoundaryCounts>; // per scope, after minus before, over the changed files; may be negative
  findings: Finding[];
}
export function diffChanges(changes: FileChange[]): DeltaReport;

/** Parses `git diff -U0` output for one file into the added line numbers of the new side. */
export function parseAddedLines(diff: string): number[];

/** Changed and untracked files under any scope, working tree vs `rev`, renames split into delete + add.
 * Throws Error("check-runtime-boundary: <rev> is not a commit") for an unknown revision and
 * Error("check-runtime-boundary: git <args> failed: <stderr>") for any other failing git call. */
export async function gitChanges(root: string, rev: string): Promise<FileChange[]>;

export interface Annotation { message: string; file: string; line?: number }
export interface Rendered {
  errors: Annotation[];
  warnings: Annotation[];
  notices: string[];
  summary: string;   // markdown for GITHUB_STEP_SUMMARY
  failed: boolean;   // errors.length > 0
}
/** `current` is measure() of the working tree (the merge result on CI), so `current - deltas` is the base. */
export function renderDelta(report: DeltaReport, current: Baseline, baseline: Baseline): Rendered;

/** The current counts for every scope, raised or lowered. */
export function acceptIncrease(current: Baseline): Baseline;
```

Map contents at this PR (only what is replaced on main today):

```typescript
export const kRalDenoReplacements = {
  "build.os": { hint: "os (or isWindows, isMac, isLinux) from src/deno_ral/platform.ts" },
  "build.arch": { hint: "arch from src/deno_ral/platform.ts" },
};
export const kStdSuggestions = {
  "path": { module: "src/deno_ral/path.ts" },
  "fs": { module: "src/deno_ral/fs.ts" },
  "testing": { module: "tests/asserts.ts", scopes: ["tests"] },
  "assert": { module: "tests/asserts.ts", scopes: ["tests"] },
};
```

Attribution rules for `diffChanges`:
- Deno: only when the scope's `denoCalls` delta is > 0 (ratchet semantics: a PR that lowers a scope's total is never flagged). Then, per API key, `net = Σ(after − before)` over the changed files; only an API with `net > 0` produces findings: one per file whose own change for that API is positive, with that file's `delta`.
- std: only when the scope's `stdImportFiles` delta is > 0. Then, per std module (`stdModuleOf`), `net` = files of the changed set importing it after minus before; only a module with `net > 0` produces findings: one per file that imports it after but not before, `delta: 1`, `name` the file's first specifier of that module, `suggestion` from `stdSuggestion`. Moving an import between files therefore nets out, as for Deno APIs. When the std-file delta is positive but no module nets positive (an import split across more files), one finding per newly counted file with its first counted specifier, so the maintainer block still appears.
- `line`: first entry of `addedLines` whose text contains `Deno.<api>` (deno) or the specifier (std); else undefined.

Messages (exact; `<...>` substituted; `README` is `dev-docs/runtime-migration/README.md`):

| Case | Kind | Text |
|---|---|---|
| covered Deno API | error | `<scope>: +<delta> Deno.<api> in <file>; use <hint> instead (runtime boundary, see README)` |
| uncovered Deno API | warning | `<scope>: +<delta> Deno.<api> in <file>; src/deno_ral has no replacement yet, so nothing to change in this PR. A maintainer accepts the new count before merging (see the job summary).` |
| std import, with suggestion | warning | `<scope>: <file> now imports the standard library directly (<specifier>); if <module> exports what this file uses with the same behaviour, import it from there. Otherwise nothing to change in this PR: a maintainer accepts the new count before merging (see the job summary).` |
| std import, no suggestion | warning | `<scope>: <file> now imports the standard library directly (<specifier>); there is no runtime-layer replacement for it yet, so nothing to change in this PR. A maintainer accepts the new count before merging (see the job summary).` |
| PR mode, base above baseline | notice | `main is above tools/runtime-boundary-baseline.json (<scope> <label> <base> > <baseline>); not caused by this PR, a maintainer fixes main` |
| push mode, rise | error | `<scope>: <label> rose from <baseline> to <current> on main. A merged PR raised it without updating the baseline: if the new calls have no replacement, run 'quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-increase' on main and commit tools/runtime-boundary-baseline.json; otherwise replace them (see README)` |

`<label>` is the existing `kFieldLabels` text.

Job summary (PR mode), exact structure:

```markdown
## Runtime boundary

| scope | Deno.* calls | std-import files |
|---|---|---|
| tests | +6 | 0 |

### What to change

- `src/core/x.ts` line 12: use os (or isWindows, isMac, isLinux) from src/deno_ral/platform.ts instead of Deno.build.os

### Maintainer action before merging

This PR raises counts (warnings above). Where a warning suggests a module, check whether the PR should use it; accept the rest. Before merging, update the branch with `main`, then run

    quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-increase

and push the `tools/runtime-boundary-baseline.json` change to this PR. Expected counts after merge: tests 832 / 177.
```

Table rows only for scopes with a non-zero delta; signed numbers (`+6`, `-2`, `0`); "What to change" only with errors (`line <n>` omitted when unknown); "Maintainer action" only with warnings, listing every scope with a warning as `<scope> <denoCalls> / <stdImportFiles>` from `current`, comma-separated.
With no rows: `No count changed in this PR.` under the heading.

### CLI contract

- No flag: absolute mode, as PR 02, with the push-mode error text; exit 1 on a rise.
- `--against <rev>`: delta mode; exit 1 if any error, else 0; exit 2 with the `gitChanges` message for an unknown revision or a failing git call. The summary goes to `GITHUB_STEP_SUMMARY` through `stepSummary`; when that returns false (local runs), it is printed to stdout after the annotations, so a local run shows the maintainer block too.
- `--update-baseline`: `lowerBaseline`, exit 0. `--update-baseline --accept-increase`: `acceptIncrease`, a `::warning` per raised field (existing wording, flag name updated), exit 0.
- `--accept-increase` without `--update-baseline`, and `--against` together with `--update-baseline`: exit 2 with a usage line.

### Files

- Modify: `tools/check-runtime-boundary.ts` (everything above; `countScope` uses the same predicate as `scopesOf` and sums `countText`; `hasStdImport` stays exported as `countText(text).std.length > 0`).
- Modify: `tests/unit/tools/check-runtime-boundary.test.ts` (new tests; `acceptTestsIncrease raises tests only` becomes `acceptIncrease writes the current counts`).
- Modify: `.github/workflows/runtime-boundary.yml`.
- Modify: `dev-docs/runtime-migration/README.md` (Phase 0 row, ratchet sentence, Phase 0 landing order), `_TEMPLATE.md` (flag name; landing-order line; map rule), `01-quick-fixes-from-spike.md`, `05-deps-deno-dom-jsr.md`, `14b-coverage-first.md` (flag name), `02-runtime-boundary-check.md` (one header line).
- Not modified: `REVIEW-*.md` and the execution logs inside `02-runtime-boundary-check.md` (history).

### Acceptance criteria

- `quarto run --dev tools/check-runtime-boundary.ts` on main prints the same five rows as before the change (src 994/49, src-js 7/0, resources 10/1, package/src 240/3, tests 832/177 at `8599166fb`) and exits 0.
- Replaying #15134 (Verification 2) exits 0 with five warnings and the maintainer block; replaying #15136 on the broken main (Verification 3) exits 0 with the "main is above" notice and no warning.
- A covered increase (Verification 4) exits 1 with the error text and an annotation on the added line; an unknown `--against` revision exits 2.
- The CLI contract holds, checked by Verification 5.
- All `check-runtime-boundary` unit tests pass; the test file still holds exactly one literal `Deno.` match and no literal std import.

## Review Focus

1. A renamed file (delete + add, same text): net zero, no finding.
2. An existing `Deno.build.os` moved between files while an unrelated uncovered call is added: only the uncovered warning, no `build.os` error.
3. A file moved from a counted path into an excluded one (`tests/docs/`): negative delta, no finding.
4. main already above the baseline and a PR with no own increase: exit 0, one notice, no error.
5. A new untracked file with a non-ASCII name (`src/café.ts`) in a local run: counted under its verbatim path.

Each has a test in Task 2 or Task 4.

## Plan

Every test builds `Deno.` and import keywords from the file's existing `DENO`/`FROM`/`IMPORT` constants, so the test file's own count does not move.
New exports are pure functions: their first run fails at module load because the export does not exist, which is a characterisation start, not RED; say so in commit messages, don't claim TDD.

### Task 1: per-file counting with unchanged totals

**Files:** `tools/check-runtime-boundary.ts`, `tests/unit/tools/check-runtime-boundary.test.ts`

**Interfaces:** Produces `FileCounts`, `countText`, `scopesOf`, `stdModuleOf`; `countScope`, `measure`, `hasStdImport` keep their signatures.

- [x] **Step 1: Write the tests**
  - `countText - keys Deno APIs by one or two identifiers`: `DENO + "build.os"`, `DENO + "build.target"`, twice `DENO + "readTextFileSync(p)"`, `DENO + "\n"` → `deno` equals `{ "build.os": 1, "build.target": 1, readTextFileSync: 2, "": 1 }`.
  - `countText - never swallows a following Deno. prefix`: `DENO + DENO + "build.os"` → `deno` equals `{ "Deno.build": 1, "build.os": 1 }` (two occurrences, as `\bDeno\.` counts).
  - `countText - lists counted std specifiers, not allow-listed ones`: imports from `"fs/ensure-dir"`, `"async"`, `"path"` (namespace form) and `"jsr:@std/fs"` (`import type`) → `std` equals `["fs/ensure-dir", "path", "jsr:@std/fs"]`.
  - `stdModuleOf - normalises every specifier form`: every example of its doc comment.
  - `scopesOf - follows each scope's rules`: `src/core/a.ts` → `["src"]`; `src/resources/scripts/x.ts` → `["resources"]`; `src/resources/formats/html/a.js` → `["resources"]`; `src/x.js` → `["src-js"]`; `tests/docs/a.ts` → `[]`; `tests/unit/a.test.ts` → `["tests"]`; `src/vendor/a.ts` → `[]`; `tests/node_modules/a.ts` → `[]`.
  - The existing tests stay unchanged and must keep passing.
- [x] **Step 2: Run them**: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts` → module-load failure on the missing exports.
- [x] **Step 3: Implement** `countText` (Deno: `/\bDeno\.(?=(\w*)(?:\.(\w+))?)/g`, the key read inside a lookahead so no `Deno.` prefix is consumed and the match count equals the old `\bDeno\.` count; std: the existing specifier regex over comment-blanked text, filtered by `isAllowListedStdImport`), `stdModuleOf`, `scopesOf` (one predicate shared with `countScope`); `countScope` sums `countText`.
- [x] **Step 4: Run the tests** → all pass. Then `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` → the five rows of the Acceptance criteria, unchanged.
- [x] **Step 5: Commit** (see Dev workflow): message `Count runtime boundary occurrences per file, per Deno API and per std import`.

### Task 2: delta over changed files, replacement maps, findings

**Files:** same two.

**Interfaces:** Consumes Task 1. Produces `kRalDenoReplacements`, `kStdSuggestions`, `denoReplacement`, `stdSuggestion`, `FileChange`, `Finding`, `DeltaReport`, `diffChanges`.

- [x] **Step 1: Write the tests** (`FileChange[]` built by hand with explicit `addedLines`)
  - `stdSuggestion - by module, scope-limited`: `"testing/asserts"` in `tests` → `"tests/asserts.ts"`; in `src` → undefined; `"jsr:@std/fs@1.0.16/walk"` and `"fs/walk"` → both `"src/deno_ral/fs.ts"`; `"fmt/colors"` → undefined.
  - `denoReplacement - exact keys only`: `"build.os"` → the hint; `"build.target"` → undefined; `"build"` → undefined.
  - `diffChanges - an uncovered increase is a finding without replacement`: `tests/unit/a.test.ts` before `""`, after two `DENO + "mkdirSync(x)"` lines on lines 3 and 5, `addedLines: [3, 5]` → `deltas.tests.denoCalls === 2`; one finding `{ scope: "tests", file: "tests/unit/a.test.ts", kind: "deno", name: "mkdirSync", delta: 2, line: 3 }` without `replacement`.
  - `diffChanges - a covered increase carries the replacement`: `src/core/a.ts` gains `DENO + "build.os"` → finding `replacement === kRalDenoReplacements["build.os"].hint`.
  - `diffChanges - a renamed file is net zero` (Review Focus 1): delete `src/a.ts` (2 calls) + add `src/b.ts` (same text) → `deltas.src.denoCalls === 0`, no finding.
  - `diffChanges - a moved covered call does not hide behind an unrelated increase` (Review Focus 2): `src/a.ts` loses `DENO + "build.os"`, `src/b.ts` gains `DENO + "build.os"` and `DENO + "cwd()"` → exactly one finding, `name: "cwd"`, no `replacement`.
  - `diffChanges - a file moved into an excluded path lowers the count` (Review Focus 3): delete `tests/unit/x.ts` (1 call), add `tests/docs/x.ts` → `deltas.tests.denoCalls === -1`, no finding.
  - `diffChanges - every module a newly counted file imports is reported, never as an error`: `src/core/a.ts` before no import, after imports from `"fmt/colors"` then `"path"` → `deltas.src.stdImportFiles === 1`; two findings, `fmt/colors` without `suggestion` and `path` with `suggestion: "src/deno_ral/path.ts"`, neither with `replacement`.
  - `diffChanges - a moved std import nets out`: `src/a.ts` loses its only std import (`"path"`), `src/b.ts` gains `"path"`, `src/c.ts` gains `"fmt/colors"` → `deltas.src.stdImportFiles === 1`; exactly one finding, `name: "fmt/colors"`.
  - `diffChanges - an import split across more files still reports`: `src/a.ts` before imports `"path"` and `"fs/exists"`, after imports only `"path"`; `src/b.ts` (new) imports `"fs/exists"` → per-module nets are 0, `deltas.src.stdImportFiles === 1`; exactly one finding for `src/b.ts`, `name: "fs/exists"`. Task 3's maintainer-block test uses this report too: with `current.src = { denoCalls: 994, stdImportFiles: 50 }` the summary contains `Expected counts after merge: src 994 / 50.`
- [x] **Step 2: Run them** (same command) → module-load failure on the missing exports.
- [x] **Step 3: Implement** per the attribution rules.
- [x] **Step 4: Run the tests** → all pass.
- [x] **Step 5: Commit**: `Attribute runtime boundary increases to files and to working deno_ral replacements`.

### Task 3: rendering annotations and the job summary

**Files:** same two.

**Interfaces:** Consumes Task 2. Produces `Annotation`, `Rendered`, `renderDelta`.

- [x] **Step 1: Write the tests** (exact strings from the Messages table and the summary layout)
  - `renderDelta - uncovered increases: warnings and maintainer block, not failed`: deltas `tests` +6/0, two uncovered findings (`tests/unit/a.test.ts` `writeTextFileSync` +4, `tests/unit/b.test.ts` `mkdirSync` +2), `current.tests = { denoCalls: 832, stdImportFiles: 177 }`, baseline equal to `current` minus the deltas → `failed === false`; two warnings with the uncovered text; summary contains `| tests | +6 | 0 |`, `### Maintainer action before merging`, `Expected counts after merge: tests 832 / 177.`, and no `### What to change`.
  - `renderDelta - covered increase: error with line, failed`: one finding `{ scope: "src", file: "src/core/x.ts", kind: "deno", name: "build.os", delta: 1, line: 12, replacement: <hint> }` → `failed === true`; `errors[0]` equals `{ message: "src: +1 Deno.build.os in src/core/x.ts; use os (or isWindows, isMac, isLinux) from src/deno_ral/platform.ts instead (runtime boundary, see dev-docs/runtime-migration/README.md)", file: "src/core/x.ts", line: 12 }`; summary has the `### What to change` bullet of the layout.
  - `renderDelta - a std import with a suggestion is a warning naming the module`: finding `{ scope: "tests", file: "tests/unit/c.test.ts", kind: "std", name: "testing/asserts", delta: 1, suggestion: "tests/asserts.ts" }` → `failed === false`; one warning `tests: tests/unit/c.test.ts now imports the standard library directly (testing/asserts); if tests/asserts.ts exports what this file uses with the same behaviour, import it from there. Otherwise nothing to change in this PR: a maintainer accepts the new count before merging (see the job summary).`
  - `renderDelta - main above baseline, PR adds nothing` (Review Focus 4): no findings, zero deltas, `current.tests.denoCalls = 832`, `baseline.tests.denoCalls = 826` → `failed === false`, one notice `main is above tools/runtime-boundary-baseline.json (tests Deno.* calls 832 > 826); not caused by this PR, a maintainer fixes main`, summary contains `No count changed in this PR.`
- [x] **Step 2: Run them** → module-load failure on `renderDelta`.
- [x] **Step 3: Implement** `renderDelta` (base = `current - deltas` per field for the notice).
- [x] **Step 4: Run the tests** → all pass.
- [x] **Step 5: Commit**: `Render runtime boundary findings as annotations and a job summary`.

### Task 4: git plumbing, CLI and workflow

**Files:** the tool, its unit test, `.github/workflows/runtime-boundary.yml`.

**Interfaces:** Consumes Tasks 1–3. Produces `parseAddedLines`, `gitChanges`, `acceptIncrease`, the CLI contract.

- [x] **Step 1: Write the tests**
  - `parseAddedLines - reads hunk headers`: a `-U0` diff with hunks `@@ -3,0 +4,2 @@`, `@@ -10 +12 @@`, `@@ -20,3 +23,0 @@` → `[4, 5, 12]`.
  - `gitChanges - tracked, deleted and untracked files, verbatim paths` (Review Focus 5): in a temp dir from `createTempContext`, run git through `execProcess` from `src/core/process.ts` (`git init`, then `git -c user.name=t -c user.email=t@example.com commit`); commit `src/quarto.ts`, `src/a.ts`, `src/gone.ts`; modify `src/a.ts`, delete `src/gone.ts`, add untracked `tests/unit/new.test.ts` and `src/café.ts` → `gitChanges(root, "HEAD")` returns four changes keyed by those exact paths, `before === null` exactly for the two untracked ones, `after === null` exactly for `src/gone.ts`, `addedLines` of an untracked file equal to all its lines.
  - `gitChanges - unknown revision`: same repo, `gitChanges(root, "no-such-rev")` rejects with message `check-runtime-boundary: no-such-rev is not a commit`.
  - `acceptIncrease writes the current counts` (replaces `acceptTestsIncrease raises tests only`, whose behaviour this PR removes): `acceptIncrease(current)` deep-equals `current` for one scope above and one below a baseline.
- [x] **Step 2: Run them** → module-load failure on the new exports.
- [x] **Step 3: Implement** `parseAddedLines` and `gitChanges`, every call through `execProcess` with `cwd: root` and its result checked:
  1. `git rev-parse --verify --quiet <rev>^{commit}`: failure → the "is not a commit" error.
  2. `git diff -z --name-only --no-renames <rev> --` and `git ls-files -z --others --exclude-standard`: split on NUL; keep paths where `scopesOf` is non-empty.
  3. `git ls-tree -z -r --name-only <rev> -- <paths>`: the set of paths present at `<rev>`; `before` is null exactly for paths outside it, otherwise `git show <rev>:<path>` must succeed.
  4. `after`: the file read from disk, null if it does not exist.
  5. `addedLines`: `git diff -U0 --no-renames <rev> -- <path>` through `parseAddedLines`; for an untracked file, every line.
  Any other failing call → the "git <args> failed" error. Then `acceptIncrease` and the CLI contract in `import.meta.main`: delta mode runs `measure`, `gitChanges`, `diffChanges`, `renderDelta`, prints through `error`/`warning`/`notice` from `src/tools/github.ts` (plain lines outside Actions), appends the summary with `stepSummary` and prints it to stdout when that returns false; `--accept-tests-increase` is removed.
- [x] **Step 4: Change the workflow**: `actions/checkout@v6` gets `with: fetch-depth: 2`; the check step becomes

```yaml
      - name: Check runtime boundary
        shell: bash
        env:
          EVENT_NAME: ${{ github.event_name }}
        run: |
          if [ "$EVENT_NAME" = "pull_request" ]; then
            # The checkout is the merge commit: HEAD^1 is the base branch tip.
            quarto run --dev tools/check-runtime-boundary.ts --against HEAD^1
          else
            quarto run --dev tools/check-runtime-boundary.ts
          fi
```

  and the header comment states the two modes.
- [x] **Step 5: Run the tests** → all `check-runtime-boundary` tests pass.
- [x] **Step 6: Commit**: `Check pull requests against their base and accept increases in any scope` (stage the three files).

### Task 5: docs

**Files:** README, `_TEMPLATE.md`, `01-quick-fixes-from-spike.md`, `05-deps-deno-dom-jsr.md`, `14b-coverage-first.md`, `02-runtime-boundary-check.md`.

- [x] **Step 1:** README:
  - Phase 0 table, after the 02 row: `| 02c | [02c-ratchet-pr-delta-and-guidance.md](02c-ratchet-pr-delta-and-guidance.md) | PR runs compare with the base branch; findings name a working replacement or ask the maintainer to accept; `--accept-increase` | 02 | Sonnet | S | planned |`.
  - Phase 0 heading: `(PR 02 first, then 02c, then 00a → 00b, then 03–06 in parallel, then 07)`, and one sentence under it: "Every PR that changes a count lands after 02c; preparing it earlier is fine."
  - The ratchet sentence near line 30 gains: "PR runs count only the PR's own increase (PR 02c); main keeps the absolute baseline."
- [x] **Step 2:** Replace every *invocation* of `--accept-tests-increase` by `--accept-increase` in README, `_TEMPLATE.md`, 01, 05, 14b. In `_TEMPLATE.md`, extend the "Landing order" line with "02c lands before any other count-changing PR", and add: "A PR that adds an equivalent `deno_ral` replacement for a `Deno.*` API adds its exact keys (e.g. `readTextFileSync`) to `kRalDenoReplacements` in `tools/check-runtime-boundary.ts` in the same change, which turns later increases of that API into errors; a PR that adds a std seam may add a `kStdSuggestions` entry (suggestions never fail a PR)." In 02, add under the header: "**Amended by:** PR 02c (PR-mode comparison, replacement maps, `--accept-increase`)."
- [x] **Step 3:** `grep -rln -- "--accept-tests-increase" dev-docs/runtime-migration tools .github` prints only `REVIEW-*.md`, `02-runtime-boundary-check.md` and this plan.
- [x] **Step 4: Commit**: `docs: runtime migration, PR 02c ratchet modes and replacement map rule` (stage the six files).

## Verification

Run from the branch worktree; `Q` is `package/dist/bin/quarto` (`quarto.cmd` on Windows).

1. Unit tests: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts` → all pass.
2. Replay #15134 on the ratchet commit, in a scratch worktree, with `BRANCH_TREE` the branch worktree: `git worktree add --detach ../rb-a cf768e183 && cd ../rb-a && git merge --no-edit 32bffe280 && cp "$BRANCH_TREE/tools/check-runtime-boundary.ts" tools/ && "$BRANCH_TREE/$Q" run --dev tools/check-runtime-boundary.ts --against HEAD^1; echo "exit=$?"` → five warnings (`tests/unit/path.test.ts`: `makeTempDirSync`, `mkdirSync`, `writeTextFileSync`, `removeSync`, +1 each; `tests/unit/project/project-context-input-files.test.ts`: `mkdirSync` +2), the maintainer line `tests 832 / 177` printed, `exit=0`. Copying the tool makes the tree dirty: `--against HEAD^1` then also counts the tool's own diff, which is outside every scope, so the result is unaffected.
3. Replay #15136 on the broken main: same with base `360bb7245` and head `4a18e9d4a` → one notice `main is above ... (tests Deno.* calls 832 > 826)`, no warning, `exit=0`.
4. Covered increase: on the branch, add `export const o = Deno.build.os;` at the end of `src/core/lib/text.ts`, commit, run `--against HEAD~1` → the covered error with the added line number, `exit=1`; then `--against no-such-rev` → `exit=2`; `git reset --hard HEAD~1` (the probe commit only).
5. CLI contract: absolute mode prints the Acceptance rows and `OK: no count exceeds the baseline.`, `exit=0`; `--accept-increase` alone → `exit=2`; `--against HEAD --update-baseline` → `exit=2`; `--update-baseline --accept-increase` → `exit=0` and `git diff --stat tools/runtime-boundary-baseline.json` empty on an unchanged tree.
6. Remove the scratch worktrees (`git worktree remove --force ../rb-a`, likewise for the #15136 one) after checking `git -C ../rb-a status --short` lists only the copied tool.
7. CI: the PR's own Runtime Boundary run is green and its summary shows only the PR's own delta.

## Review checklist

- [ ] `measure()` totals on main are identical before and after (Task 1 Step 4, Verification 5).
- [ ] Every message matches the Messages table verbatim; the summary matches the layout.
- [ ] Deno findings exist only when the scope's delta and the API's per-scope net are both positive; std findings only when the scope's std-file delta is positive.
- [ ] `kRalDenoReplacements` holds only exact keys with an equivalent replacement on main (`build.os`, `build.arch`; not `build.target`); no std finding can be an error.
- [ ] Git output is NUL-delimited; every git result is checked; an unknown revision exits 2.
- [ ] The test file still has exactly one literal `Deno.` match and no literal std import.
- [ ] The workflow passes `github.event_name` through `env`, not inline in the script.
- [ ] No live plan invokes `--accept-tests-increase`.

## Risks and rollback

- A PR with a merge conflict has no merge commit; GitHub does not run `pull_request` workflows for it, as before.
- A changed checkout (PR head instead of merge commit) would make `HEAD^1` the PR's own parent: Verification 7 shows the summary for the right diff; rollback is reverting the workflow step to the absolute command, which restores PR 02's behaviour exactly.
- A map entry added before its replacement works turns contributor PRs red with a hint that does not compile: Deno keys are added only by the PR that ships the replacement (template rule); std findings are never errors.
- std increases with a real replacement now pass with a warning where PR 02 failed them: the maintainer review (job summary) is the gate for them until PR 22 and PR 23 bring the std counts down.

## Decisions needed

1. **Covered-API rule applies to `tests` too.** The 2026-10-22 decision made `tests` warning-only until PR 09. This plan applies one rule to every scope: uncovered increases warn (all of #15134's calls), covered ones fail (`Deno.build.os`/`arch` only, today). Effect on tests: stricter only where an equivalent replacement exists, and PRs 08/09/14 tighten it through their map entries instead of a scope switch. Recommendation: accept; the alternative is a `kWarnOnlyScopes = ["tests"]` constant removed by PR 09.
2. **std imports never fail a PR** (design review round 2, 2026-10-22). PR 02 failed every new std import; this plan warns, with a suggested module. Two review rounds showed a mechanical "covered" verdict for std imports is unreliable: symbol subsets (`tests/asserts.ts` lacks `assertFalse`), submodule semantics (`path/posix` `normalize` vs the platform one) and type-only exports. Cost: new `testing/asserts` imports in tests, the most common case, need a maintainer bump instead of failing. Recommendation: accept; std counts are brought down by PR 22 and PR 23, not by this gate.

## Dev workflow

- Worktree on `rt/02c-ratchet-pr-delta` from `upstream/main`; push to `upstream`; the PR targets `main` on `quarto-dev/quarto-cli`.
- Commits: stage explicit paths, write the message to a file and `git commit -F <file>`, never amend, never skip hooks.
- Tracker: beads `quarto-cli-81ld.53` (private; never cite it in commits or the PR).

## Execution log

(The executor appends dated entries: commands run and their quoted output, deviations from the plan, open questions.)

### 2026-10-22: Task 1

- Absolute counts before Task 1 (`quarto.cmd run --dev tools/check-runtime-boundary.ts`, exit 0): src 994/49, src-js 7/0, resources 10/1, package/src 240/3, tests 832/177.
- Step 2 (characterisation start, not RED): the new test imports fail type-checking at module load: `has no exported member named 'stdModuleOf'`, likewise `countText`, `scopesOf`.
- Step 4: `unit/tools/check-runtime-boundary.test.ts` → `ok | 16 passed | 0 failed`. Counts after Task 1: identical to before (994/49, 7/0, 10/1, 240/3, 832/177), `OK: no count exceeds the baseline.`
- Deviation: none in the tool. A first draft of the test put the literal `Deno.build` key in an expected object, which raised the tests count by 2 (834); the key is now built from `DENO`, the test file again holds one literal match (`writeFixture`).

### 2026-10-22: Task 2

- Step 2 (characterisation start, not RED): type-check failure at module load, `has no exported member` for `denoReplacement`, `diffChanges`, `FileChange`, `kRalDenoReplacements`, `stdSuggestion`.
- Step 4: `unit/tools/check-runtime-boundary.test.ts` → `ok | 26 passed | 0 failed`; the test file still holds one literal `Deno.` match.
- Deviation: none.

### 2026-10-22: Task 3

- Step 2 (characterisation start, not RED): type-check failure at module load, `has no exported member 'renderDelta'`.
- Step 4: `unit/tools/check-runtime-boundary.test.ts` → `ok | 30 passed | 0 failed`; the test file still holds one literal `Deno.` match.
- Deviation: none.

### 2026-10-22: review fix after Task 3

- Defect: `countText` and the empty counts in `diffChanges` used `{}`, so a `Deno.constructor` in a comment read the inherited function and made the scope total a string (NaN delta, no findings, a covered increase passing); `Deno.__proto__` was lost. Reproduced by the new test before the fix: `"function Object() { [native code] }1"` instead of `1` (assertion failure, a real RED). Fix: null-prototype dictionaries. `unit/tools/check-runtime-boundary.test.ts` → 31 passed, counts unchanged (994/49, 7/0, 10/1, 240/3, 832/177).

### 2026-10-22: Task 4

- Step 2 (characterisation start, not RED): the first run of the new tests failed at module load for the missing exports (`parseAddedLines`, `gitChanges`, `acceptIncrease`).
- Step 5: `unit/tools/check-runtime-boundary.test.ts` → `ok | 34 passed | 0 failed`; the test file holds one literal `Deno.` match and no literal std import. Smoke run: `--against HEAD` prints the five rows and `No count changed in this PR.`, exit 0; `--against no-such-rev` prints `check-runtime-boundary: no-such-rev is not a commit`, exit 2.
- Deviation: the `--update-baseline --accept-increase` warning now reads `<scope> baseline raised from X to Y (<label>); list the new occurrences in the PR description` (the old text named test files, and the flag now accepts any scope).
- Deviation: `--against` without a revision exits 2 with a usage line (not in the plan; the alternative is an undefined revision reaching git).
- Note: the tool now imports `src/core/process.ts` (via `execProcess`), which pulls the `async` import-map module; a first `quarto run --dev` downloads `@std/async` from jsr like the other std modules.

### 2026-10-22: Task 5

- Step 3: `grep -rln -- "--accept-tests-increase" dev-docs/runtime-migration tools .github` → `02-runtime-boundary-check.md`, `02c-ratchet-pr-delta-and-guidance.md`, `REVIEW-2026-10-21-windows-extraction.md`, `REVIEW-2026-10-21-windows.md` (the expected set: history, the plan, and the two `REVIEW-*` files).
- Deviation: the `_TEMPLATE.md` tooling-table sentence "the `--accept-tests-increase` flag lets a PR that adds tests raise the `tests` count on purpose" was rewritten to describe `--accept-increase` for any scope and `--against`, since a bare rename would have left it false. The "Landing order" line is the Phase 1 bullet in `_TEMPLATE.md`; the 02c sentence was appended there.
