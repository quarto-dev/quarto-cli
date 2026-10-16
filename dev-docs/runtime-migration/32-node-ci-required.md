# PR 32: Node CI matrix required (bucketed), prerequisite-aware parity with Deno

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the full unit and smoke suites on Node in the same 20 timing-based buckets the Deno matrix uses (Linux and Windows on every pull request, macOS nightly), measure parity with Deno per OS from JUnit reports that tell a prerequisite skip from a pass and identify a test by file and name, make the Node matrix the required gate, and move the full Deno matrix to a nightly run once Node is required.
**Phase:** 2. **Depends on:** PR 27, 27b, 28, 29, 30 (the layer on `node:` APIs), PR 31 (`run-tests-node.sh`/`.ps1`, `tests/run-parallel-tests.mjs`, the runner Spike V chose), PR 14b (preview, daemon, pipe and process-group tests in the suite), the Julia engine subtree pull of decision 7 for an empty allowlist (until then the allowlist may hold Julia entries only), Spike #2 (a) for the optional dual-runtime job. **Unblocks:** PR 33 (the flip).
**Branch:** `rt/32-node-ci-required`.
**Suggested executor:** Opus. Workflow plumbing across two reusable workflows, the JUnit post-processing and the parity rules need care; the scripts are small.
**Size:** M (3 workflows, 4 runner scripts, `tests/test.ts`, 2 scripts and their tests, 1 launcher, docs).
**Ships on:** Deno until PR 33. The Node matrix becomes required at the end of this PR; from then on the full Deno matrix runs nightly and a small Deno job stays per PR (`main` still ships Deno until PR 33).

## Spec

### Context

Assessment section 7, Phase 2 exit: "test suite green on Deno" and, for Phase 3, "CI runs the full matrix … on Node; keep the Deno matrix alive in parallel until parity, then remove it." PR 26 created `.github/workflows/test-node-bundle.yml` (`node-unit`: bundled `tests/unit/ral/` against a shrinking known-failures list; `node-render`: allowed-failure renders); PR 31 created `tests/run-tests-node.sh`/`.ps1` and `tests/run-parallel-tests.mjs`.

Review findings on the earlier draft (B3, S12, Phase 2 report), all addressed:

- **Parity was overstated.** `tests/test.ts:767` reports a test whose prerequisite is missing (`prereq()` false: no TinyTeX, no Julia, no Chrome) as `warning("Skipped - …")` and the test **passes**; an environment gap on Node looked like a pass. Now `tests/test.ts` records each prerequisite skip in a sidecar file when `QUARTO_TEST_PREREQ_SKIPS` is set, the runner scripts rewrite those test cases in the JUnit report as `<skipped message="prerequisite not met"/>`, `junit.mjs` classifies them as `prereq`, and the parity report counts them separately and fails on a test that passed on Deno but was prerequisite-skipped on Node.
- **JUnit survived only for the last bucket.** Each runner invocation inside a bucket loop now writes its own report (`<dir>/<nnnn>.xml`), and the whole directory is uploaded per job.
- **Unbucketed three-OS suite on every PR (S12).** The draft ran the whole suite in one job per OS (the timing file sums to about 100 serial minutes on Linux). Now the Node matrix reuses `tests/timing-for-ci.txt` and `run-parallel-tests.mjs` to build the same 20 buckets as `test-smokes-parallel.yml`. Cost table below.
- **`parity-report` ran on `push`** despite "nightly/dispatch only": its `if:` is now `schedule || workflow_dispatch`.
- **macOS had no Deno baseline** (`test-smokes.yml`'s default runners are Linux and Windows; macOS is "reserved for scheduled built-version runs"): the nightly parity run includes Deno and Node on macOS.
- **B3, Julia.** The Julia engine (`src/resources/extension-subtrees/julia-engine`, 24 `Deno.` references, upstream-owned) is ported upstream and pulled before this PR completes (decision 7). Until the pull, the parity allowlist may contain Julia tests only (each line marked `julia`); `compare-junit.mjs` enforces it, and once the pulled `julia-engine.js` has no `Deno.` left it rejects any entry.
- **`node --test tools/node-bundle/`** (a directory) failed: every invocation uses the glob `"tools/node-bundle/*.test.mjs"`.
- **Parity could report success without evidence (`REVIEW-2026-10-16.md` R14, triage row 32).** `readReports` returned an empty set for a missing path, `compare` ignored the failed sets and `parity-compare` ran with `if: always()` whatever its upstream jobs did, so two empty inputs, a bucket that never uploaded, or the same failure on both sides all printed `parity: OK`; and a test was identified by its name alone, so two files registering the same name collapsed into one. Now the "Parity evidence" rule (Interfaces) holds: the job fails before comparing unless every test job it depends on succeeded, `compare-junit.mjs --buckets N` refuses a side with other than N bucket artifacts, an artifact without a report, a report without a test case or a case without a file, and `compare()` counts any failure on either side against `ok`. A test is identified as `<file> :: <name>` (`junit.mjs` `caseId`, PR 26): Deno's reports carry the file as `classname`, node:test's on Node 26 as a `file` attribute on every `<testcase>` (measured on Node 26.12.0; Node 22's reporter writes no file at all and two files' `[unit] > plain` are indistinguishable there, which is why `junit-finish.mjs` keeps a `--file` wrap for such a reporter), and a test with steps, which node:test writes as a `<testsuite>` without `file`, takes its steps' file.

**Parity criteria** (per OS; all must hold for Linux and Windows before the Node jobs are required, and are reported nightly for all three OSes):

1. **Suite green on Node.** Every Node bucket passes (per pull request: Linux and Windows).
2. **Pass-set parity.** Over the nightly runs, the set of tests (file plus name) that pass on Node equals the set that pass on Deno, the `skipped` (ignored) sets are equal, no test fails on either side, and no test that passed on Deno is prerequisite-skipped on Node. `tools/node-bundle/compare-junit.mjs` computes it, and only from complete evidence (the "Parity evidence" rule in Interfaces): every bucket of both runtimes uploaded a report and every test job succeeded, or the comparison is not made and the job fails.
3. **Render parity.** `dev-docs/feature-format-matrix/qmd-files/**/*.qmd` rendered to HTML with the Deno build and with the Node bundle gives an empty normalised diff (nightly).
4. **Bundle smoke.** The `node-render` job (PR 26) passes and is no longer allowed to fail; nightly, `smoke/` runs in binary mode against `tools/node-bundle/quarto-node`.

A **parity allowlist** `tools/node-bundle/node-parity-allowlist.txt` (one test per line as `<file> :: <name>`, or a bare name for every file, then `# <issue> julia`) tolerates a known Julia difference until the subtree pull; it must be empty once `julia-engine.js` is ported.

### CI cost (review S12)

Job counts per run; minutes from `tests/timing-for-ci.txt` (about 100 serial minutes of tests on Linux, split in 20 buckets of about 5 minutes plus about 10 minutes of provisioning each).

| When | Before this PR | After this PR, before PR 33 |
|---|---|---|
| Pull request | Deno: 20 buckets × 2 OS = 40 jobs | Node: 20 buckets × 2 OS = 40 jobs; Deno sanity: 1 job (`unit/`, `smoke/render/` on Linux); `node-render`: 1 job |
| Nightly | none for the suite | Deno: 20 × 3 OS = 60; Node macOS: 20; render parity: 3; Node binary mode: 1; compare: 1 |

Per pull request the job count stays at about 42 (from 40); macOS runs only nightly, as today's `test-smokes.yml` reserves it for scheduled runs. The per-file process cost of the Node runner (Spike V's measurement) is absorbed by the bucket sizes; if a Node bucket's wall time exceeds the slowest Deno bucket by more than 50 % on the first dispatch, raise `nBuckets` for the Node matrix (one input) and record it here.

### Scope

In:
- `tests/run-tests.sh`, `tests/run-tests.ps1`: `QUARTO_TEST_JUNIT` support (Deno `--junit-path`); all four runner scripts: the prerequisite sidecar and its JUnit rewrite.
- `tests/test.ts`: record prerequisite skips when `QUARTO_TEST_PREREQ_SKIPS` is set.
- `tools/node-bundle/junit.mjs` (PR 26, which already identifies a case by file and name): a `prereq` class; `tools/node-bundle/junit-finish.mjs` (new: prerequisite skips and the file wrap); `tools/node-bundle/compare-junit.mjs` (new) with its test; `tools/node-bundle/node-parity-allowlist.txt`.
- `.github/workflows/test-smokes.yml`: `test-runtime` input (`deno` | `node`), npm and bundle setup for `node`, one JUnit report per invocation, JUnit artifact.
- `.github/workflows/test-node-bundle.yml`: `node-buckets` (with an `N_BUCKETS` output) + `node-suite` (per PR, Linux and Windows), `deno-sanity` (per PR), nightly `deno-nightly`, `node-macos`, `render-parity`, `node-binary`, `parity-compare` (gated on its upstream jobs' results and on complete reports); `node-render` no longer allowed to fail; the `node-unit` job and its known-failures ratchet retired (the full suite replaces it); optional nightly `dual-runtime-smoke` (Spike #2 (a)).
- `.github/workflows/test-smokes-parallel.yml`: `pull_request` and `push` triggers removed (the Deno matrix runs nightly from `test-node-bundle.yml`).
- `tools/node-bundle/quarto-node.cmd` (Windows launcher for the bundle).
- `dev-docs/runtime-migration/node-bundle.md`: parity, required checks, nightly Deno.

Out:
- Removing Deno from CI altogether (PR 37).
- Linux arm64 runners (PR 34).
- Any change to test content; a parity gap is fixed in the PR that owns the module.

### Interfaces

Environment for every runner script (`run-tests.sh`, `run-tests.ps1`, `run-tests-node.sh`, `run-tests-node.ps1`):

- `QUARTO_TEST_JUNIT=<path>`: write a JUnit report of this invocation (Deno: `--junit-path`; Node: the PR 31 runner's JUnit reporter), and set `QUARTO_TEST_PREREQ_SKIPS=<path without .xml>.prereq.jsonl` for the run; afterwards, when the report exists, run `node tools/node-bundle/junit-finish.mjs <junit> --prereq <jsonl>`. Timing runs ignore it. (`--file <test file>` exists for a reporter that writes no file into its report, Node 22's; the CI runtime is Node 26, whose reporter does, so the runner scripts do not pass it.)
- `QUARTO_TEST_PREREQ_SKIPS=<path>`: `tests/test.ts` appends `{"name":"<test name as registered>"}` and a newline for each test whose `prereq()` returned false.

```js
// tools/node-bundle/junit.mjs (PR 26, extended)
/** cases: { file, name, outcome } per test case (PR 26); prereq: cases whose <skipped> message starts with
 *  "prerequisite" (written by junit-finish.mjs). The name sets stay for callers that know the file. */
export function parseJUnit(xml: string): {
  passed: Set<string>; failed: Set<string>; skipped: Set<string>; prereq: Set<string>;
  cases: { file: string; name: string; outcome: "passed" | "failed" | "skipped" | "prereq" }[];
};
export const caseId: (c: { file: string; name: string }) => string;   // "<file> :: <name>" (PR 26)

// tools/node-bundle/junit-finish.mjs
/** Rewrites each named test case into <testcase …><skipped message="prerequisite not met"/></testcase>. */
export function markPrerequisiteSkips(xml: string, names: Set<string>): string;
/** Wraps the report's content in <testsuite name="<normalised file>"> for a reporter that writes no file
 *  (Node 22); a file attribute, file suite or file-looking classname already inside wins in parseJUnit. */
export function stampTestFile(xml: string, file: string): string;
// CLI: node tools/node-bundle/junit-finish.mjs <junit.xml> [--prereq <skips.jsonl>] [--file <test file>]   (rewrites the XML in place)

// tools/node-bundle/compare-junit.mjs
/** Sets of case ids per outcome, the report count and the evidence problems of the input (see the rule below). */
export function readReports(pathOrDir: string, options?: { buckets?: number }): {
  passed: Set<string>; failed: Set<string>; skipped: Set<string>; prereq: Set<string>; files: number; problems: string[];
};
export function compare(deno, node, allowlist: Set<string>): {
  onlyDeno: string[]; onlyNode: string[]; skippedOnlyDeno: string[]; skippedOnlyNode: string[];
  prereqOnlyNode: string[];   // passed on Deno, prerequisite-skipped on Node: an environment gap, fails parity
  prereqOnlyDeno: string[];   // reported, does not fail
  failedDeno: string[];       // the baseline is red: fails parity, never allowlisted
  failedNode: string[];       // fails parity unless allowlisted (a Julia test)
  ok: boolean;
};
/** Allowlist lines: "<file> :: <name>  # <issue> julia" (or a bare name for every file). Problems: a line without the julia marker; any line once the Julia engine is ported. */
export function allowlistProblems(lines: string[], juliaPorted: boolean): string[];
// CLI: node tools/node-bundle/compare-junit.mjs --deno <xml|dir> --node <xml|dir> [--buckets <N>]
//        [--allowlist tools/node-bundle/node-parity-allowlist.txt] [--julia-engine src/resources/extension-subtrees/julia-engine]
// Exit 1 and "parity: NO EVIDENCE" on any evidence problem (nothing compared); "parity: DIFFERENCES" on a difference.
```

`juliaPorted` is computed by the CLI: no `Deno.` occurrence in any `*.js` under `--julia-engine`.

**Parity evidence (R14; owned here, PR 37 deletes the job).** The parity report is evidence only when it was computed from the whole suite on both runtimes, so each check below fails the `parity-compare` job rather than degrading the comparison:

| Check | Where | What fails it |
|---|---|---|
| Every upstream test job succeeded | the job's first step reads `needs.*.result` | any of `node-buckets`, `node-suite`, `node-macos`, `deno-nightly` not `success` (a failed, cancelled or skipped job, on any OS: the three parity rows share the inputs and the rule is one line) |
| Every bucket uploaded a report | `readReports(dir, { buckets: N })`, `N` from `node-buckets`'s `N_BUCKETS` output | other than `N` bucket directories under the downloaded artifacts of either runtime; a bucket directory with no `.xml`; no `.xml` at all; a missing path |
| Every report is readable | `readReports` | a report that parses to zero test cases (malformed, truncated or empty) |
| Every case has an identity | `readReports` | a case without a file (a reporter that writes none, such as Node 22's `node --test`, without the `--file` wrap; a `<testsuite>` of a test with steps takes its steps' file) |
| Failures count | `compare()` | any `failed` case on Deno (the baseline is not green) or on Node (unless allowlisted as Julia); the same failure on both sides is two failures, not a match |
| Identity is file plus name | `junit.mjs` `caseId` | two files registering the same test name are two tests; a name that passes in one file and fails in the other is one pass and one failure |

The file of a case, in order: the `file` attribute (node:test, Node 26, an absolute path), a file-looking `classname` (Deno, `./unit/a.test.ts`), the enclosing file suite (Vitest, the `--file` wrap), each normalised by `normalizeTestFile` to the path under `tests/` with forward slashes so that the two runtimes and the three OSes spell one file one way.

The download pattern matters: `junit-deno-<os>-d[0-9][0-9]` and `junit-node-<os>-n[0-9][0-9]`, not `d*`/`n*`, which would also match `denosanity` and `nbin` and make the bucket count wrong.

### Files

- Modify: `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`, `tests/test.ts`
- Modify: `tools/node-bundle/junit.mjs`, `tools/node-bundle/junit.test.mjs`
- Create: `tools/node-bundle/junit-finish.mjs`, `tools/node-bundle/compare-junit.mjs`, `tools/node-bundle/compare-junit.test.mjs`, `tools/node-bundle/node-parity-allowlist.txt`, `tools/node-bundle/quarto-node.cmd`
- Delete: `tools/node-bundle/run-unit-on-node.mjs`, `tools/node-bundle/known-failures.json` (the full suite replaces the bundled unit run; `build-test.mjs` and `node-test-adapter.mjs` stay for `tests/unit/ral/layer-script.ts`)
- Modify: `.github/workflows/test-smokes.yml`, `.github/workflows/test-node-bundle.yml`, `.github/workflows/test-smokes-parallel.yml`
- Modify: `dev-docs/runtime-migration/node-bundle.md`, `dev-docs/runtime-migration/README.md` (status)

### Acceptance criteria

- `node --test "tools/node-bundle/*.test.mjs"` passes (includes `junit.test.mjs` and `compare-junit.test.mjs`).
- A test whose prerequisite is missing appears in the JUnit report of both runtimes as `<skipped message="prerequisite not met"/>` (Task 1 step 5).
- A pull request runs `node-suite` in 20 buckets on Linux and Windows and uploads one `junit-node-<os>-n<NN>` artifact per job, each holding one XML per runner invocation.
- A `workflow_dispatch` of `Node Tests` runs the nightly jobs; `parity-compare` prints per-OS report counts and case counts (passed, failed, skipped, prereq) and `parity: OK` for Linux, macOS and Windows, with the allowlist holding only `julia` lines (or nothing once the subtree is pulled).
- `parity-compare` is red, with the reason in its log, when a `node-suite`, `node-macos`, `deno-nightly` or `node-buckets` job is not `success`, when a runtime has other than `N_BUCKETS` bucket artifacts or one without a report, when a report has no test case, when a case has no file, or when any test failed on either side (`compare-junit.test.mjs` covers each; Task 4 step 4 provokes the first two once).
- A test registered under the same name in two files is two entries in the parity output (`<file> :: <name>`), never one.
- `parity-report` jobs have `if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'`.
- No `continue-on-error: true` remains in `test-node-bundle.yml`; branch protection lists the Node bucket jobs, `node-render` and `deno-sanity` (documented command, executed by a maintainer).
- `test-smokes-parallel.yml` no longer triggers on `pull_request` or `push`.

## Plan

### Task 1: JUnit from every runner, with prerequisite skips marked

**Files:**
- Modify: `tests/test.ts`, `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`
- Modify: `tools/node-bundle/junit.mjs`, `tools/node-bundle/junit.test.mjs`
- Create: `tools/node-bundle/junit-finish.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tools/node-bundle/junit.test.mjs`:

```js
import { markPrerequisiteSkips, stampTestFile } from "./junit-finish.mjs";

test("markPrerequisiteSkips turns named passing cases into prerequisite skips", () => {
  const xml = `<testsuites><testsuite name="./smoke/a.test.ts">
<testcase name="[smoke] &gt; needs tinytex" classname="./smoke/a.test.ts" time="0.1"/>
<testcase name="[smoke] &gt; plain" classname="./smoke/a.test.ts" time="0.1"></testcase>
</testsuite></testsuites>`;
  const out = markPrerequisiteSkips(xml, new Set(["[smoke] > needs tinytex"]));
  const r = parseJUnit(out);
  assert.deepEqual([...r.prereq], ["[smoke] > needs tinytex"]);
  assert.deepEqual([...r.passed], ["[smoke] > plain"]);
  assert.deepEqual([...r.skipped], []);
});

test("stampTestFile wraps a report that has no file (Node 22's reporter) in a suite named after the file; an inner file wins", () => {
  const xml = `<testsuites>
	<testsuite name="[unit] > with sub" tests="1" failures="0"><testcase name="inner" time="0.001" classname="test"/></testsuite>
	<testcase name="[unit] > fails" classname="test" failure="boom"><failure message="boom"/></testcase>
	<testcase name="[unit] > bare"/>
	<testcase name="[unit] > deno" classname="./unit/other.test.ts"/>
</testsuites>`;
  const r = parseJUnit(stampTestFile(xml, ".\\unit\\a.test.ts"));
  assert.deepEqual(r.cases.map((c) => [c.name, c.file, c.outcome]), [
    ["[unit] > with sub", "unit/a.test.ts", "passed"],
    ["[unit] > with sub > inner", "unit/a.test.ts", "passed"],
    ["[unit] > fails", "unit/a.test.ts", "failed"],
    ["[unit] > bare", "unit/a.test.ts", "passed"],
    ["[unit] > deno", "unit/other.test.ts", "passed"],
  ]);
});
```

Run: `node --test tools/node-bundle/junit.test.mjs`
Expected: `ERR_MODULE_NOT_FOUND` for `./junit-finish.mjs`.

- [ ] **Step 2: Classify prerequisite skips in `junit.mjs`**

PR 26's `parseJUnit` records every case through `record(outcome, name, attrs)` and returns `{ passed, failed, skipped, cases }`. Add `prereq = new Set()` next to the three sets, let `record` accept the `"prereq"` outcome (`({ passed, failed, skipped, prereq })[outcome]`), return `{ passed, failed, skipped, prereq, cases }`, and replace the `else if (/<skipped\b/.test(body)) record("skipped", name, attrs);` line with:

```js
    else if (/<skipped\b[^>]*\bmessage="prerequisite/.test(body)) record("prereq", name, attrs);
    else if (/<skipped\b/.test(body)) record("skipped", name, attrs);
```

and extend the `summary` CLI line with `, prereq ${n("prereq")}`. The resulting file:

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
// enclosing file suite (Deno, Vitest, or the suite junit-finish.mjs --file
// adds for a reporter that writes none, such as Node 22's). `cases` carries
// both; the name sets are kept for callers that already know the file.
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
  const passed = new Set(), failed = new Set(), skipped = new Set(), prereq = new Set();
  const cases = [];
  const stack = []; // enclosing suites: { name: "" for file suites, file, test: the suite's own case if it is a test with steps }
  const prefixed = (name) => [...stack.map((s) => s.name).filter(Boolean), name].join(" > ");
  const record = (outcome, name, attrs) => {
    const own = attr(attrs, "file") ?? attr(attrs, "classname");
    const file = own && isTestFile(own) ? normalizeTestFile(own) : (stack.findLast((s) => s.file)?.file ?? "");
    ({ passed, failed, skipped, prereq })[outcome].add(name);
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
    else if (/<skipped\b[^>]*\bmessage="prerequisite/.test(body)) record("prereq", name, attrs);
    else if (/<skipped\b/.test(body)) record("skipped", name, attrs);
    else record("passed", name, attrs);
  }
  return { passed, failed, skipped, prereq, cases };
}

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain && process.argv[2] === "summary") {
  for (const f of process.argv.slice(3)) {
    const r = parseJUnit(fs.readFileSync(f, "utf8"));
    const n = (o) => r.cases.filter((c) => c.outcome === o).length;
    const noFile = r.cases.filter((c) => !c.file).length;
    console.log(`${f}: passed ${n("passed")}, failed ${n("failed")}, skipped ${n("skipped")}, prereq ${n("prereq")}${noFile ? ` (${noFile} without a file)` : ""}`);
  }
}
```

- [ ] **Step 3: Write `junit-finish.mjs`**

```js
// tools/node-bundle/junit-finish.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Post-processes the JUnit report of one runner invocation so that the parity
// report (compare-junit.mjs) can read it:
//  - prerequisite skips: tests/test.ts passes a test whose prereq() is false
//    (it prints "Skipped - <name>"), on Deno and on Node. With
//    QUARTO_TEST_PREREQ_SKIPS set it also records the name; those cases become
//    <skipped message="prerequisite not met"/> so an environment gap can be
//    told from a pass.
//  - file identity (--file, optional): a reporter that writes no file into its
//    report (Node 22's junit reporter; Node 26 writes file="" on every case)
//    gets the report of a single-file invocation wrapped in a <testsuite>
//    named after that file. A file attribute, a file suite or a file-looking
//    classname already inside takes precedence in junit.mjs, so the wrap is
//    harmless. The runner scripts do not pass it: the CI runtime is Node 26.
// Usage: node tools/node-bundle/junit-finish.mjs <junit.xml> [--prereq <skips.jsonl>] [--file <test file>]
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { isTestFile, normalizeTestFile } from "./junit.mjs";

const unescape = (s) => s.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const testcase = /<testcase\b((?:[^>"]|"[^"]*")*?)(\/>|>([\s\S]*?)<\/testcase>)/g;

export function markPrerequisiteSkips(xml, names) {
  return xml.replace(testcase, (whole, attrs) => {
    const m = attrs.match(/(?:^|\s)name="([^"]*)"/);
    if (!m || !names.has(unescape(m[1]))) return whole;
    return `<testcase${attrs.replace(/\/$/, "")}><skipped message="prerequisite not met"/></testcase>`;
  });
}

export function stampTestFile(xml, file) {
  const suite = `<testsuite name="${escape(normalizeTestFile(file))}">`;
  const m = xml.match(/<testsuites\b[^>]*>/);
  if (!m) return `<testsuites>${suite}${xml}</testsuite></testsuites>`;
  const end = xml.lastIndexOf("</testsuites>");
  const start = m.index + m[0].length;
  return xml.slice(0, start) + suite + xml.slice(start, end === -1 ? undefined : end) + "</testsuite>" + (end === -1 ? "" : xml.slice(end));
}

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  const [xmlPath, ...rest] = process.argv.slice(2);
  const arg = (n) => { const i = rest.indexOf(n); return i === -1 ? undefined : rest[i + 1]; };
  let xml = fs.readFileSync(xmlPath, "utf8");
  const jsonl = arg("--prereq");
  if (jsonl && fs.existsSync(jsonl)) {
    const names = new Set(fs.readFileSync(jsonl, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).name));
    xml = markPrerequisiteSkips(xml, names);
    console.log(`marked ${names.size} prerequisite skip(s) in ${xmlPath}`);
  }
  const file = arg("--file");
  if (file) {
    xml = stampTestFile(xml, file);
    console.log(`wrapped ${xmlPath} in a suite named ${normalizeTestFile(file)}`);
  }
  fs.writeFileSync(xmlPath, xml);
}
```

Run: `node --test tools/node-bundle/junit.test.mjs`
Expected: `# pass 5`, `# fail 0` (PR 26's three tests, the two above).

- [ ] **Step 4: Record prerequisite skips in `tests/test.ts`**

At the `else` branch that prints the skip (`tests/test.ts:767` on `main`), replace `warning(\`Skipped - ${test.name}\`);` with:

```ts
          warning(`Skipped - ${test.name}`);
          // Parity reporting (PR 32): the runner scripts mark these cases as
          // prerequisite skips in the JUnit report.
          const prereqSkips = env.get("QUARTO_TEST_PREREQ_SKIPS");
          if (prereqSkips) {
            writeTextFileSync(prereqSkips, JSON.stringify({ name: testName }) + "\n", { append: true });
          }
```

(`env` from `../src/deno_ral/env.ts`, `writeTextFileSync` from `../src/deno_ral/fs.ts`; `testName` is the name the test registered under, the one JUnit reports.)

- [ ] **Step 5: JUnit and the rewrite in the four runner scripts**

`tests/run-tests.sh`, after the `QUARTO_DENO_OPTIONS=` line:

```bash
QUARTO_JUNIT_ARGS=()
if [[ -n "$QUARTO_TEST_JUNIT" ]]; then
  QUARTO_JUNIT_ARGS=("--junit-path=$QUARTO_TEST_JUNIT")
  export QUARTO_TEST_PREREQ_SKIPS="${QUARTO_TEST_JUNIT%.xml}.prereq.jsonl"
  rm -f "$QUARTO_TEST_PREREQ_SKIPS"
fi
```

add `"${QUARTO_JUNIT_ARGS[@]}"` after `"${AGENT_REPORTER_ARGS[@]}"` on the final `deno test` line (the single-invocation case, not the timing loop), and before the final `exit`:

```bash
if [[ -n "$QUARTO_TEST_JUNIT" && -f "$QUARTO_TEST_JUNIT" ]]; then
  if command -v node > /dev/null; then
    node "$QUARTO_ROOT/tools/node-bundle/junit-finish.mjs" "$QUARTO_TEST_JUNIT" --prereq "$QUARTO_TEST_PREREQ_SKIPS"
  else
    echo "WARNING: node not found; prerequisite skips are not marked in $QUARTO_TEST_JUNIT"
  fi
fi
```

`tests/run-tests-node.sh`: the `QUARTO_TEST_JUNIT` export of `QUARTO_TEST_PREREQ_SKIPS` (same three lines, without `QUARTO_JUNIT_ARGS`; PR 31's `run_test_files` already passes the JUnit reporter) and the same post-run block before `exit`. The file identity needs nothing from the scripts: Deno writes it as `classname`, Node 26's reporter as `file`.

`tests/run-tests.ps1` and `tests/run-tests-node.ps1`: the PowerShell equivalents:

```powershell
if ($Env:QUARTO_TEST_JUNIT) {
  $Env:QUARTO_TEST_PREREQ_SKIPS = [System.IO.Path]::ChangeExtension($Env:QUARTO_TEST_JUNIT, ".prereq.jsonl")
  Remove-Item -ErrorAction SilentlyContinue $Env:QUARTO_TEST_PREREQ_SKIPS
}
```

(`run-tests.ps1` also adds `--junit-path=$($Env:QUARTO_TEST_JUNIT)` to its `deno test` invocation) and before `Exit`:

```powershell
if ($Env:QUARTO_TEST_JUNIT -and (Test-Path $Env:QUARTO_TEST_JUNIT)) {
  & node (Join-Path $Env:QUARTO_ROOT "tools" "node-bundle" "junit-finish.mjs") $Env:QUARTO_TEST_JUNIT --prereq $Env:QUARTO_TEST_PREREQ_SKIPS
}
```

- [ ] **Step 6: See a prerequisite skip in both reports**

Run (TinyTeX absent from `PATH` makes the PDF tests' prerequisite fail; pick any test with a `prereq` from `grep -rln "prereq:" tests/smoke | head -1`):
```bash
cd tests
T=$(grep -rln "prereq:" smoke | head -1); echo "$T"
QUARTO_TEST_JUNIT=/tmp/rt32-deno.xml QUARTO_TESTS_NO_CONFIG=true PATH=/usr/bin:/bin ./run-tests.sh --agent "$T"
QUARTO_TEST_JUNIT=/tmp/rt32-node.xml QUARTO_TESTS_NO_CONFIG=true PATH=/usr/bin:/bin:$(dirname "$(command -v node)") ./run-tests-node.sh --agent "$T"
node ../tools/node-bundle/junit.mjs summary /tmp/rt32-deno.xml /tmp/rt32-node.xml
grep -c 'message="prerequisite not met"' /tmp/rt32-deno.xml /tmp/rt32-node.xml
```
Expected: `marked N prerequisite skip(s)` after each run; the summaries agree and neither says `without a file` (Deno's `classname`, Node 26's `file`); both greps print the same non-zero count. (If the chosen test's prerequisite is met even with the reduced `PATH`, pick another file from the grep.)

- [ ] **Step 7: Commit**

```bash
git add tests/test.ts tests/run-tests.sh tests/run-tests.ps1 tests/run-tests-node.sh tests/run-tests-node.ps1 tools/node-bundle/junit.mjs tools/node-bundle/junit.test.mjs tools/node-bundle/junit-finish.mjs
git commit -m "tests: JUnit from every runner with the test file; prerequisite skips reported as skipped"
```

### Task 2: The parity comparison

**Files:**
- Create: `tools/node-bundle/compare-junit.mjs`, `tools/node-bundle/compare-junit.test.mjs`, `tools/node-bundle/node-parity-allowlist.txt`

- [ ] **Step 1: Write the failing test**

```js
// tools/node-bundle/compare-junit.test.mjs
// Copyright (C) 2026 Posit Software, PBC
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { allowlistProblems, compare, readReports } from "./compare-junit.mjs";

const set = (...a) => new Set(a);
const report = (o) => ({ passed: set(), failed: set(), skipped: set(), prereq: set(), ...o });
const f = (name) => `smoke/f.test.ts :: ${name}`;

test("compare reports asymmetric passes, skips and prerequisite gaps", () => {
  const deno = report({ passed: set(f("a"), f("b"), f("c"), f("deno only")), skipped: set(f("s")), prereq: set(f("p deno")) });
  const node = report({ passed: set(f("a"), f("b"), f("node only"), f("p deno")), skipped: set(f("s")), prereq: set(f("c")) });
  const d = compare(deno, node, new Set());
  assert.deepEqual(d.onlyDeno, [f("c"), f("deno only")]);
  assert.deepEqual(d.onlyNode, [f("node only"), f("p deno")]);
  assert.deepEqual(d.prereqOnlyNode, [f("c")]);
  assert.deepEqual(d.prereqOnlyDeno, [f("p deno")]);
  assert.equal(d.ok, false);
  // An allowlist entry names the file, or the bare name for every file.
  const tolerated = compare(deno, node, new Set([f("c"), "deno only", "node only", f("p deno")]));
  assert.equal(tolerated.ok, true);
});

test("compare: a failure on either side is never parity, even the same one on both", () => {
  const deno = report({ passed: set(f("a")), failed: set(f("x")) });
  const node = report({ passed: set(f("a")), failed: set(f("x")) });
  const d = compare(deno, node, new Set());
  assert.deepEqual(d.failedDeno, [f("x")]);
  assert.deepEqual(d.failedNode, [f("x")]);
  assert.equal(d.ok, false);
  // Two empty reports are "equal" sets too; the evidence check (readReports) is what rejects them.
  assert.equal(compare(report({}), report({}), new Set()).ok, true);
  // The allowlist tolerates a Node failure (a Julia test), never a Deno one.
  const julia = compare(deno, report({ passed: set(f("a")), failed: set(f("x")) }), new Set([f("x")]));
  assert.deepEqual(julia.failedNode, []);
  assert.deepEqual(julia.failedDeno, [f("x")]);
});

test("allowlist: julia lines only until the engine is ported, then nothing", () => {
  const lines = ["# comment", "", "[smoke] > julia engine renders  # quarto-dev/quarto-cli#1 julia", "[smoke] > other  # #2"];
  assert.deepEqual(allowlistProblems(lines, false), ["not a julia entry (decision 7 allows only those): [smoke] > other  # #2"]);
  assert.equal(allowlistProblems(lines.slice(0, 3), false).length, 0);
  assert.deepEqual(allowlistProblems(lines.slice(0, 3), true), [
    "the Julia engine is ported (no Deno. in julia-engine): remove [smoke] > julia engine renders  # quarto-dev/quarto-cli#1 julia",
  ]);
});

// ---- readReports: the evidence rules, on a download-artifact layout (one directory per bucket).
const xml = (file, cases) => `<testsuites><testsuite name="./${file}">${cases.map(([n, body = ""]) =>
  `<testcase name="${n}" classname="./${file}" time="0.1">${body}</testcase>`).join("")}</testsuite></testsuites>`;
function layout(buckets) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "junit-"));
  for (const [bucket, reports] of Object.entries(buckets)) {
    fs.mkdirSync(path.join(dir, bucket));
    for (const [name, content] of Object.entries(reports)) fs.writeFileSync(path.join(dir, bucket, name), content);
  }
  return dir;
}

test("readReports: identity is file plus name, so duplicate names in separate files stay distinct", () => {
  const dir = layout({ d01: { "0001.xml": xml("unit/a.test.ts", [["[unit] > plain"]]), "0002.xml": xml("unit/b.test.ts", [["[unit] > plain"], ["[unit] > fails", "<failure/>"]]) } });
  const r = readReports(dir, { buckets: 1 });
  assert.deepEqual(r.problems, []);
  assert.deepEqual([...r.passed].sort(), ["unit/a.test.ts :: [unit] > plain", "unit/b.test.ts :: [unit] > plain"]);
  assert.deepEqual([...r.failed], ["unit/b.test.ts :: [unit] > fails"]);
  assert.equal(r.files, 2);
});

test("readReports: a missing bucket, a missing path, an empty bucket, a malformed report and a case without a file are problems", () => {
  const one = layout({ d01: { "0001.xml": xml("unit/a.test.ts", [["t"]]) }, d02: { "0001.xml": xml("unit/b.test.ts", [["t"]]) } });
  assert.deepEqual(readReports(one, { buckets: 3 }).problems, [`expected 3 bucket artifacts under ${one}, found 2: d01, d02`]);
  assert.deepEqual(readReports(path.join(one, "missing")).problems, [`no reports at ${path.join(one, "missing")}`]);
  const empty = layout({ d01: {} });
  assert.deepEqual(readReports(empty, { buckets: 1 }).problems, ["bucket d01 holds no report", `no report under ${empty}`]);
  const bad = layout({ d01: { "0001.xml": "<testsuites></testsuites>", "0002.xml": `<testsuites><testcase name="t" classname="test"/></testsuites>` } });
  assert.deepEqual(readReports(bad, { buckets: 1 }).problems, [
    `malformed or empty report: ${path.join(bad, "d01", "0001.xml")}`,
    `1 test case(s) without a file in ${path.join(bad, "d01", "0002.xml")} (the runner stamps the file for single-file invocations)`,
  ]);
  // Without --buckets (a local comparison of two files) only the per-report rules apply.
  assert.deepEqual(readReports(path.join(one, "d01", "0001.xml")).problems, []);
});
```

Run: `node --test tools/node-bundle/compare-junit.test.mjs`
Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 2: Implement**

```js
// tools/node-bundle/compare-junit.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Pass-set parity between Deno and Node JUnit reports of the same OS
// (dev-docs/runtime-migration/32-node-ci-required.md). A test is identified
// by file and name ("<file> :: <name>", junit.mjs caseId). Directories are
// read recursively (one XML per runner invocation, one subdirectory per
// downloaded bucket artifact). The report is evidence only when it is
// complete: with --buckets N the directory must hold exactly N bucket
// directories, each with at least one report, every report must parse to at
// least one test case, and every case must carry a file; otherwise the
// comparison is not made and the run fails (R14).
// Usage: node tools/node-bundle/compare-junit.mjs --deno <xml|dir> --node <xml|dir>
//          [--buckets <N>] [--allowlist tools/node-bundle/node-parity-allowlist.txt]
//          [--julia-engine src/resources/extension-subtrees/julia-engine]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { caseId, parseJUnit } from "./junit.mjs";

function* files(p, ext) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    for (const d of fs.readdirSync(p).sort()) yield* files(path.join(p, d), ext);
  } else if (p.endsWith(ext)) yield p;
}

/** Sets of case ids per outcome, plus the evidence problems of the input. */
export function readReports(pathOrDir, { buckets } = {}) {
  const out = { passed: new Set(), failed: new Set(), skipped: new Set(), prereq: new Set(), files: 0, problems: [] };
  if (!fs.existsSync(pathOrDir)) {
    out.problems.push(`no reports at ${pathOrDir}`);
    return out;
  }
  if (buckets !== undefined) {
    if (!fs.statSync(pathOrDir).isDirectory()) out.problems.push(`${pathOrDir} is a file; --buckets expects a directory of bucket artifacts`);
    else {
      const dirs = fs.readdirSync(pathOrDir).filter((d) => fs.statSync(path.join(pathOrDir, d)).isDirectory()).sort();
      if (dirs.length !== buckets) out.problems.push(`expected ${buckets} bucket artifacts under ${pathOrDir}, found ${dirs.length}${dirs.length ? `: ${dirs.join(", ")}` : ""}`);
      for (const d of dirs) if ([...files(path.join(pathOrDir, d), ".xml")].length === 0) out.problems.push(`bucket ${d} holds no report`);
    }
  }
  for (const f of files(pathOrDir, ".xml")) {
    out.files++;
    const r = parseJUnit(fs.readFileSync(f, "utf8"));
    if (r.cases.length === 0) { out.problems.push(`malformed or empty report: ${f}`); continue; }
    const noFile = r.cases.filter((c) => !c.file).length;
    if (noFile) out.problems.push(`${noFile} test case(s) without a file in ${f} (the runner stamps the file for single-file invocations)`);
    for (const c of r.cases) out[c.outcome].add(caseId(c));
  }
  if (out.files === 0) out.problems.push(`no report under ${pathOrDir}`);
  // A test that passed in one invocation and failed in another counts as failed.
  for (const n of out.failed) out.passed.delete(n);
  return out;
}

/** An allowlist entry is "<file> :: <name>", or "<name>" alone for every file. */
const allowed = (allowlist, id) => allowlist.has(id) || allowlist.has(id.slice(id.indexOf(" :: ") + 4));

export function compare(deno, node, allowlist) {
  const diff = (a, b) => [...a].filter((x) => !b.has(x) && !allowed(allowlist, x)).sort();
  const onlyDeno = diff(deno.passed, node.passed);
  const onlyNode = diff(node.passed, deno.passed);
  const skippedOnlyDeno = diff(deno.skipped, node.skipped);
  const skippedOnlyNode = diff(node.skipped, deno.skipped);
  const prereqOnlyNode = [...node.prereq].filter((x) => deno.passed.has(x) && !allowed(allowlist, x)).sort();
  const prereqOnlyDeno = [...deno.prereq].filter((x) => node.passed.has(x)).sort();
  // Failures are never parity: the Deno baseline must be green (no allowlist),
  // a Node failure is a gap unless it is an allowed Julia test. A test that
  // fails on both sides is a failure on both lists, not a match.
  const failedDeno = [...deno.failed].sort();
  const failedNode = [...node.failed].filter((x) => !allowed(allowlist, x)).sort();
  const ok = !(onlyDeno.length || onlyNode.length || skippedOnlyDeno.length || skippedOnlyNode.length || prereqOnlyNode.length || failedDeno.length || failedNode.length);
  return { onlyDeno, onlyNode, skippedOnlyDeno, skippedOnlyNode, prereqOnlyNode, prereqOnlyDeno, failedDeno, failedNode, ok };
}

export function allowlistProblems(lines, juliaPorted) {
  const problems = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (juliaPorted) problems.push(`the Julia engine is ported (no Deno. in julia-engine): remove ${t}`);
    else if (!/#.*\bjulia\b/i.test(t)) problems.push(`not a julia entry (decision 7 allows only those): ${t}`);
  }
  return problems;
}

const entryName = (line) => line.replace(/\s+#.*$/, "").trim();

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; };
  const fail = (msg) => { console.log(`::error::${msg}`); console.log("parity: NO EVIDENCE"); process.exit(1); };
  if (!arg("--deno") || !arg("--node")) fail("usage: --deno <xml|dir> --node <xml|dir> [--buckets N] [--allowlist file] [--julia-engine dir]");
  let buckets;
  if (arg("--buckets") !== undefined) {
    buckets = Number(arg("--buckets"));
    if (!Number.isInteger(buckets) || buckets < 1) fail(`--buckets must be a positive integer, got "${arg("--buckets")}" (the bucket job did not report its count?)`);
  }
  const lines = arg("--allowlist") && fs.existsSync(arg("--allowlist")) ? fs.readFileSync(arg("--allowlist"), "utf8").split("\n") : [];
  const juliaDir = arg("--julia-engine") ?? "src/resources/extension-subtrees/julia-engine";
  const juliaPorted = [...files(juliaDir, ".js")].every((f) => !/\bDeno\./.test(fs.readFileSync(f, "utf8")));
  const problems = allowlistProblems(lines, juliaPorted);
  const allowlist = new Set(lines.filter((l) => l.trim() && !l.trim().startsWith("#")).map(entryName));
  const deno = readReports(arg("--deno"), { buckets });
  const node = readReports(arg("--node"), { buckets });
  const counts = (r) => `${r.files} report(s): passed ${r.passed.size}, failed ${r.failed.size}, skipped ${r.skipped.size}, prereq ${r.prereq.size}`;
  console.log(`deno: ${counts(deno)}\nnode: ${counts(node)}`);
  const section = (title, list) => { if (list.length) console.log(`${title} (${list.length}):\n  ${list.join("\n  ")}`); };
  section("deno evidence problems", deno.problems);
  section("node evidence problems", node.problems);
  if (deno.problems.length || node.problems.length) fail("incomplete or malformed test evidence; nothing was compared");
  const d = compare(deno, node, allowlist);
  if (allowlist.size) console.log(`allowlist (${allowlist.size}):\n  ${[...allowlist].join("\n  ")}`);
  section("failed on deno (the baseline is red)", d.failedDeno);
  section("failed on node", d.failedNode);
  section("only passing on deno", d.onlyDeno);
  section("only passing on node", d.onlyNode);
  section("skipped only on deno", d.skippedOnlyDeno);
  section("skipped only on node", d.skippedOnlyNode);
  section("prerequisite missing on node, passed on deno (environment gap)", d.prereqOnlyNode);
  section("prerequisite missing on deno, passed on node (informational)", d.prereqOnlyDeno);
  section("allowlist problems", problems);
  const ok = d.ok && problems.length === 0;
  console.log(ok ? "parity: OK" : "parity: DIFFERENCES");
  process.exit(ok ? 0 : 1);
}
```

`tools/node-bundle/node-parity-allowlist.txt`:

```
# One test per line as "<file> :: <name>" (file relative to tests/; a bare
# name covers every file), then "  # <issue> julia". Only Julia engine tests
# may be listed, and only until the julia-engine subtree is pulled with its
# Node port (decision 7); compare-junit.mjs enforces both rules.
# dev-docs/runtime-migration/32-node-ci-required.md
```

Run: `node --test tools/node-bundle/compare-junit.test.mjs`
Expected: `# pass 5`, `# fail 0`.

- [ ] **Step 3: Compare the two reports from Task 1, then break the evidence once**

Run: `node tools/node-bundle/compare-junit.mjs --deno /tmp/rt32-deno.xml --node /tmp/rt32-node.xml --allowlist tools/node-bundle/node-parity-allowlist.txt`
Expected: equal counts and `parity: OK`.

Run:
```bash
mkdir -p /tmp/rt32/deno/d01 /tmp/rt32/node/n01 && cp /tmp/rt32-deno.xml /tmp/rt32/deno/d01/0001.xml && cp /tmp/rt32-node.xml /tmp/rt32/node/n01/0001.xml
node tools/node-bundle/compare-junit.mjs --deno /tmp/rt32/deno --node /tmp/rt32/node --buckets 1; echo "exit $?"
node tools/node-bundle/compare-junit.mjs --deno /tmp/rt32/deno --node /tmp/rt32/node --buckets 2; echo "exit $?"
node tools/node-bundle/compare-junit.mjs --deno /tmp/rt32/deno --node /tmp/rt32/missing --buckets 1; echo "exit $?"
```
Expected: `parity: OK`, `exit 0`; then `expected 2 bucket artifacts under /tmp/rt32/deno, found 1: d01` (and the same for node), `parity: NO EVIDENCE`, `exit 1`; then `no reports at /tmp/rt32/missing`, `parity: NO EVIDENCE`, `exit 1`.

- [ ] **Step 4: Commit**

```bash
git add tools/node-bundle/compare-junit.mjs tools/node-bundle/compare-junit.test.mjs tools/node-bundle/node-parity-allowlist.txt
git commit -m "ci: pass-set parity by file and name, failures and incomplete evidence fail it, Julia-only allowlist"
```

### Task 3: `test-runtime` input and per-invocation JUnit in `test-smokes.yml`

**Files:**
- Modify: `.github/workflows/test-smokes.yml`

- [ ] **Step 1: Add the input (both `workflow_call` and `workflow_dispatch` blocks)**

```yaml
      test-runtime:
        description: "Test runner: deno (default) or node (tests/run-tests-node)"
        required: false
        type: string
        default: "deno"
```

- [ ] **Step 2: npm, the bundle and the JUnit directory**

Insert after the `- uses: ./.github/workflows/actions/quarto-dev` step:

```yaml
      - name: Install npm dependencies and build the Node bundle
        if: inputs.test-runtime == 'node'
        shell: bash
        run: |
          npm ci
          node tools/node-bundle/build.mjs --check-shim

      - name: JUnit directory
        shell: bash
        run: |
          mkdir -p "$RUNNER_TEMP/junit"
          echo "JUNIT_DIR=$RUNNER_TEMP/junit" >> "$GITHUB_ENV"
```

The existing "Install node (for Playwright, MECA)" step pins `node-version`; change it to `26` so the Node runs use the pinned runtime.

- [ ] **Step 3: Switch the four run steps to the chosen runner, one JUnit file per invocation**

"Run all Smoke Tests Linux":
```yaml
        run: |
          runner=./run-tests.sh
          if [ "${{ inputs.test-runtime }}" = "node" ]; then runner=./run-tests-node.sh; fi
          QUARTO_TEST_JUNIT="$JUNIT_DIR/0000.xml" "$runner"
```

"Run all Smoke Tests Windows":
```yaml
        run: |
          $runner = if ("${{ inputs.test-runtime }}" -eq "node") { "./run-tests-node.ps1" } else { "./run-tests.ps1" }
          $env:QUARTO_TEST_JUNIT = Join-Path $env:JUNIT_DIR "0000.xml"
          & $runner
          Exit $LASTEXITCODE
```

"Run Smoke Tests as a bucket on Linux": set `runner` as above before the loop, keep a counter, and replace `./run-tests.sh "$file"` (and the `echo ">>> ./run-tests.sh ${file}"`) with:

```bash
            n=$((n + 1))
            echo ">>> ${runner} ${file}"
            QUARTO_TEST_JUNIT="$JUNIT_DIR/$(printf '%04d' "$n").xml" "$runner" "$file"
```

(initialise `n=0` next to `haserror=0`).

"Run Smoke Tests as a bucket on Windows": `$runner` as above, `$n = 0` before the loop, and in the loop:

```powershell
            $n++
            Write-Host ">>> $runner ${file}"
            $env:QUARTO_TEST_JUNIT = Join-Path $env:JUNIT_DIR ("{0:D4}.xml" -f $n)
            & $runner $file
```

- [ ] **Step 4: Upload the JUnit directory**

Add before the "Upload test timing file" step:

```yaml
      - name: Upload JUnit reports
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: junit-${{ inputs.test-runtime || 'deno' }}-${{ runner.os }}-${{ inputs.label-tag || 'full' }}
          path: ${{ runner.temp }}/junit
          if-no-files-found: ignore
          retention-days: 14
```

- [ ] **Step 5: Validate and commit**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test-smokes.yml')); print('yaml ok')"`
Expected: `yaml ok`. A `workflow_dispatch` of `Smoke Tests` with defaults still runs Deno as before and uploads `junit-deno-<os>-full`.

```bash
git add .github/workflows/test-smokes.yml
git commit -m "ci: test-runtime input and one JUnit report per runner invocation"
```

### Task 4: The Node matrix, the nightly runs and the parity report

**Files:**
- Modify: `.github/workflows/test-node-bundle.yml`
- Create: `tools/node-bundle/quarto-node.cmd`
- Delete: `tools/node-bundle/run-unit-on-node.mjs`, `tools/node-bundle/known-failures.json`

- [ ] **Step 1: Fold the known-failures list into the allowlist, then retire the bundled unit job**

Run: `node -e 'const k=require("./tools/node-bundle/known-failures.json"); for (const os of ["linux","macos","windows"]) console.log(os, JSON.stringify(k[os]))'`
Expected: every section empty, or holding Julia-related entries only (PRs 27–30 and 27b removed theirs). Move any remaining entry to `tools/node-bundle/node-parity-allowlist.txt` as `<test name>  # <issue> julia`; a non-Julia entry left here is a Phase 2 gap: fix it in the owning PR before continuing. Then delete the `node-unit` job from the workflow, and:

```bash
git rm tools/node-bundle/run-unit-on-node.mjs tools/node-bundle/known-failures.json
```

(`build-test.mjs` and `node-test-adapter.mjs` stay: `tests/unit/ral/layer-script.ts` bundles fixtures with `build-test.mjs --script` on Node. That is the fixture mode of the builder contract in `26-node-build-job.md`, Interfaces, which PR 33 keeps when it rewrites `bundle()`.)

- [ ] **Step 2: Add the jobs**

Rename the workflow `name: Node Bundle` → `name: Node Tests`, add `schedule: [{ cron: "17 3 * * *" }]` to `on:`, remove `continue-on-error: true` from `node-render`, and append:

```yaml
  node-buckets:
    name: Node test buckets
    runs-on: ubuntu-latest
    outputs:
      BUCKETS: ${{ steps.buckets.outputs.BUCKETS }}
      N_BUCKETS: ${{ steps.buckets.outputs.N_BUCKETS }}
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 26
      - uses: ./.github/actions/merge-extension-tests
      - id: buckets
        working-directory: tests
        run: |
          BUCKETS=$(./run-parallel-tests.sh -n=20 --json-for-ci --timing-file=timing-for-ci.txt | jq -rc 'def lpad(n): tostring | if (n > length) then ((n - length) * "0") + . else . end; to_entries | map(.key |= tostring)| map({ num: .key| tonumber | (. + 1) | lpad(2), files: .value | tojson }) | {buckets: .}')
          if [ -z "$BUCKETS" ]; then echo "::error::Failed to create buckets"; exit 1; fi
          echo "BUCKETS=$BUCKETS" >> "$GITHUB_OUTPUT"
          # parity-compare checks that every bucket uploaded a report (R14).
          echo "N_BUCKETS=$(echo "$BUCKETS" | jq '.buckets | length')" >> "$GITHUB_OUTPUT"

  node-suite:
    name: Node bucket ${{ matrix.buckets.num }}
    needs: node-buckets
    strategy:
      fail-fast: false
      matrix: ${{ fromJSON(needs.node-buckets.outputs.BUCKETS) }}
    uses: ./.github/workflows/test-smokes.yml
    with:
      buckets: ${{ matrix.buckets.files }}
      test-runtime: node
      runners: '["ubuntu-latest", "windows-latest"]'
      label-tag: n${{ matrix.buckets.num }}
    secrets: inherit

  # main still ships Deno until PR 33: a small Deno job stays on every PR once
  # the full Deno matrix is nightly (Task 6).
  deno-sanity:
    name: Deno sanity (unit, smoke/render)
    uses: ./.github/workflows/test-smokes.yml
    with:
      buckets: '["unit/", "smoke/render/"]'
      test-runtime: deno
      runners: '["ubuntu-latest"]'
      label-tag: denosanity
    secrets: inherit

  # ---------------- nightly and on dispatch only
  deno-nightly:
    name: Deno bucket ${{ matrix.buckets.num }} (nightly)
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    needs: node-buckets
    strategy:
      fail-fast: false
      matrix: ${{ fromJSON(needs.node-buckets.outputs.BUCKETS) }}
    uses: ./.github/workflows/test-smokes.yml
    with:
      buckets: ${{ matrix.buckets.files }}
      test-runtime: deno
      runners: '["ubuntu-latest", "macos-latest", "windows-latest"]'
      label-tag: d${{ matrix.buckets.num }}
    secrets: inherit

  node-macos:
    name: Node bucket ${{ matrix.buckets.num }} (macOS, nightly)
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    needs: node-buckets
    strategy:
      fail-fast: false
      matrix: ${{ fromJSON(needs.node-buckets.outputs.BUCKETS) }}
    uses: ./.github/workflows/test-smokes.yml
    with:
      buckets: ${{ matrix.buckets.files }}
      test-runtime: node
      runners: '["macos-latest"]'
      label-tag: n${{ matrix.buckets.num }}
    secrets: inherit

  # always(): the job runs after a red bucket so that the log shows what is
  # missing, and fails (R14, "Parity evidence" in the plan): first on any
  # upstream job that is not green, then on incomplete reports, then on the
  # comparison. Only a job red for one of those reasons, with the reason in
  # its log, is the evidence that parity does not hold yet.
  parity-compare:
    name: Pass-set parity (${{ matrix.os }})
    if: always() && (github.event_name == 'schedule' || github.event_name == 'workflow_dispatch')
    needs: [node-buckets, node-suite, node-macos, deno-nightly]
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        os: [Linux, macOS, Windows]
    steps:
      - name: Require every test job to have succeeded
        env:
          NEEDS: ${{ toJSON(needs) }}
        run: |
          bad=$(echo "$NEEDS" | jq -r 'to_entries | map(select(.value.result != "success")) | map("\(.key): \(.value.result)") | join(", ")')
          if [ -n "$bad" ]; then echo "::error::parity is not evidence while a test job is not green: $bad"; exit 1; fi
          echo "all test jobs succeeded"
      - uses: actions/checkout@v6
        if: always()
      - uses: actions/setup-node@v6
        if: always()
        with:
          node-version: 26
      - uses: actions/download-artifact@v8
        if: always()
        with:
          pattern: junit-deno-${{ matrix.os }}-d[0-9][0-9]
          path: junit/deno
      - uses: actions/download-artifact@v8
        if: always()
        with:
          pattern: junit-node-${{ matrix.os }}-n[0-9][0-9]
          path: junit/node
      - name: Compare
        if: always()
        run: node tools/node-bundle/compare-junit.mjs --deno junit/deno --node junit/node --buckets "${{ needs.node-buckets.outputs.N_BUCKETS }}" --allowlist tools/node-bundle/node-parity-allowlist.txt

  render-parity:
    name: Feature-format HTML parity (${{ matrix.os }}, nightly)
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 26
          cache: npm
      - uses: ./.github/workflows/actions/quarto-dev
      - uses: astral-sh/setup-uv@20cfd1bf945f4377ade1205e4dbc17946fc9a30d # v10.0.1
        with:
          version: "0.12.10"
          enable-cache: true
          cache-dependency-glob: "tests/uv.lock"
      - name: Python environment
        working-directory: tests
        run: uv sync --frozen
      - uses: r-lib/actions/setup-r@v2
        with:
          r-version: "4.6.1"
          use-public-rspm: true
          windows-path-include-rtools: false
      - name: R packages
        working-directory: tests
        shell: Rscript {0}
        run: |
          if (!requireNamespace('renv', quietly = TRUE)) install.packages('renv')
          renv::restore()
      - name: Build the Node bundle
        shell: bash
        run: npm ci && node tools/node-bundle/build.mjs --check-shim
      - name: Render the feature-format documents to HTML on both runtimes
        shell: bash
        run: |
          source tests/.venv/bin/activate 2>/dev/null || source tests/.venv/Scripts/activate
          for runtime in deno node; do
            rm -rf "$RUNNER_TEMP/ff-$runtime"
            cp -r dev-docs/feature-format-matrix "$RUNNER_TEMP/ff-$runtime"
            if [ "$runtime" = deno ]; then q="$PWD/package/dist/bin/quarto"; else q="$PWD/tools/node-bundle/quarto-node"; fi
            if [ "$RUNNER_OS" = Windows ]; then q="$q.cmd"; fi
            find "$RUNNER_TEMP/ff-$runtime/qmd-files" -name '*.qmd' -not -name '_*' | sort | while read -r f; do
              echo "::group::$runtime: ${f#$RUNNER_TEMP/ff-$runtime/}"
              "$q" render "$f" --to html || echo "::warning::$runtime failed on $f"
              echo "::endgroup::"
            done
          done
      - name: Diff (normalised; .quarto excluded)
        shell: bash
        run: |
          for runtime in deno node; do
            node tools/node-bundle/normalize-html.mjs --root "$RUNNER_TEMP/ff-$runtime" "$RUNNER_TEMP/ff-$runtime"
          done
          if diff -r -x .quarto "$RUNNER_TEMP/ff-deno" "$RUNNER_TEMP/ff-node" > ff-render.diff; then
            echo "Node render identical to Deno render"
          else
            head -c 20000 ff-render.diff
            echo "::error::feature-format HTML differs between runtimes (see artifact)"
            exit 1
          fi
      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: ff-render-diff-${{ runner.os }}
          path: ff-render.diff
          if-no-files-found: ignore

  node-binary:
    name: smoke/ in binary mode against the Node bundle (nightly)
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    needs: node-buckets
    uses: ./.github/workflows/test-smokes.yml
    with:
      buckets: '["smoke/"]'
      test-runtime: node
      runners: '["ubuntu-latest"]'
      label-tag: nbin
    secrets: inherit
```

For `node-binary`, `test-smokes.yml` needs `QUARTO_TEST_BIN`: add an input `quarto-test-bin` (default empty) to `test-smokes.yml` that, when non-empty, is exported as `QUARTO_TEST_BIN` (resolved against the workspace) before the run steps, and pass `quarto-test-bin: tools/node-bundle/quarto-node` here.

- [ ] **Step 3: Add `tools/node-bundle/quarto-node.cmd`**

```bat
@echo off
rem tools/node-bundle/quarto-node.cmd  Copyright (C) 2026 Posit Software, PBC
setlocal
set "HERE=%~dp0"
for %%I in ("%HERE%..\..") do set "ROOT=%%~fI"
if not exist "%HERE%dist\quarto.mjs" ( echo quarto-node: dist\quarto.mjs not found; run: node tools\node-bundle\build.mjs 1>&2 & exit /b 1 )
if not defined QUARTO_BIN_PATH set "QUARTO_BIN_PATH=%ROOT%\package\dist\bin"
if not defined QUARTO_SHARE_PATH set "QUARTO_SHARE_PATH=%ROOT%\src\resources"
if not defined QUARTO_DEBUG set "QUARTO_DEBUG=false"
if not defined QUARTO_NODE set "QUARTO_NODE=node"
"%QUARTO_NODE%" --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 "%HERE%dist\quarto.mjs" %*
exit /b %ERRORLEVEL%
```

- [ ] **Step 4: Dispatch and read the results**

Push the branch, `gh workflow run "Node Tests" --ref rt/32-node-ci-required`, then `gh run watch`. Expected: `node-suite` green in all 20 buckets on Linux and Windows; `deno-sanity` green; the nightly jobs run (dispatch); `parity-compare` prints `all test jobs succeeded`, then `deno: 20 report(s): …` and `node: 20 report(s): …` (more reports than buckets when a bucket ran several invocations is fine; fewer bucket directories is not) and `parity: OK` for Linux, macOS and Windows; `render-parity` prints `Node render identical to Deno render` on each OS. Each failure is a parity gap: fix it in the PR that owns the module (preferred) or, for a Julia test only, add an allowlist line with the issue number; re-run.

Once, to see the evidence gate from the workflow side (the unit tests cover the rules; this checks the plumbing): in a scratch commit, keep one bucket from uploading its report (`if: always() && inputs.label-tag != 'n07'` on the "Upload JUnit reports" step of `test-smokes.yml`), dispatch, and read `parity-compare`: `all test jobs succeeded`, then `expected 20 bucket artifacts under junit/node, found 19: …` and `parity: NO EVIDENCE` on Linux and Windows (macOS is unaffected: `node-macos` uploads its own). Then make a bucket fail instead (`exit 1` after its run step): the first step fails with `node-suite: failure` on all three OSes. Drop the scratch commit.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/test-node-bundle.yml .github/workflows/test-smokes.yml tools/node-bundle/quarto-node.cmd
git commit -m "ci: bucketed Node matrix per PR; nightly Deno, macOS, render parity, binary mode and pass-set parity"
```

### Task 5: Dual-runtime smoke (only if Spike #2 (a) succeeded)

**Files:**
- Modify: `.github/workflows/test-node-bundle.yml`

- [ ] **Step 1: Check the spike result**

Run: `grep -n -A3 "### Spike #2" dev-docs/runtime-migration/SPIKES.md`
If the Results section records (a) as a failure, skip this task (PR 33 then keeps only "Deno as a tool", decision 1). Otherwise continue.

- [ ] **Step 2: Add the nightly job**

```yaml
  dual-runtime-smoke:
    name: Node bundle on Deno (${{ matrix.os }}, nightly)
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 26
          cache: npm
      - uses: ./.github/workflows/actions/quarto-dev
      - name: Build the bundle
        shell: bash
        run: npm ci && node tools/node-bundle/build.mjs --check-shim
      - name: Render the spike documents with the bundle on Deno and on Node
        shell: bash
        run: |
          DENO="$(ls package/dist/bin/tools/*/deno* | head -1)"
          export QUARTO_BIN_PATH="$PWD/package/dist/bin" QUARTO_SHARE_PATH="$PWD/src/resources"
          for rt in deno node; do cp -r dev-docs/runtime-migration/spike/tests "$RUNNER_TEMP/$rt"; done
          for doc in simple.qmd website; do
            "$DENO" run --allow-all --no-config --v8-flags=--enable-experimental-regexp-engine tools/node-bundle/dist/quarto.mjs render "$RUNNER_TEMP/deno/$doc"
            node --enable-experimental-regexp-engine tools/node-bundle/dist/quarto.mjs render "$RUNNER_TEMP/node/$doc"
          done
          for rt in deno node; do node tools/node-bundle/normalize-html.mjs --root "$RUNNER_TEMP/$rt" "$RUNNER_TEMP/$rt"; done
          diff -r -x .quarto "$RUNNER_TEMP/deno" "$RUNNER_TEMP/node" && echo "BUNDLE ON DENO IDENTICAL"
```

(The command line is the one Spike #2 recorded under "Results"; if it differs, use the recorded one.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test-node-bundle.yml
git commit -m "ci: nightly Node bundle on Deno (dual-runtime window, Spike #2)"
```

### Task 6: Make Node required; move the full Deno matrix to nightly

**Files:**
- Modify: `.github/workflows/test-smokes-parallel.yml`, `dev-docs/runtime-migration/node-bundle.md`, `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Preconditions**

Run:
```bash
grep -n "continue-on-error" .github/workflows/test-node-bundle.yml
grep -v '^#' tools/node-bundle/node-parity-allowlist.txt | grep -c . ; grep -v '^#' tools/node-bundle/node-parity-allowlist.txt | grep -vic julia
```
Expected: no `continue-on-error`; the allowlist count is 0, or every line is a Julia line (second count `0`). The last nightly `parity-compare` run printed `parity: OK` for all three OSes.

- [ ] **Step 2: The Deno matrix runs nightly once Node is required**

In `.github/workflows/test-smokes-parallel.yml`, delete the `pull_request:` and `push:` blocks from `on:` (keep `workflow_dispatch:` for manual runs). The nightly Deno matrix is `deno-nightly` in `test-node-bundle.yml` (three OSes, the same buckets); per PR, `deno-sanity` keeps a Deno signal while `main` ships Deno. This follows decision 4's intent (the Node runner is the measured, primary gate) and keeps CI cost flat (cost table in the Spec). PR 37 deletes the Deno jobs.

- [ ] **Step 3: Document the required checks and the parity criteria**

Append to `dev-docs/runtime-migration/node-bundle.md`:

```markdown
## Required status checks (PR 32)

The Node matrix is required on `main`. A maintainer with admin rights replaces
the Deno bucket checks with the Node ones in the branch protection rule
(Settings → Branches → `main` → "Require status checks to pass"), or with the
CLI, starting from the current list
(`gh api repos/quarto-dev/quarto-cli/branches/main/protection/required_status_checks --jq .contexts`):
remove the `Running Tests buckets NN / …` (Deno) entries and add, for NN = 01…20 and both OSes,
`Node bucket NN / Run smoke (ubuntu-latest)` and `Node bucket NN / Run smoke (windows-latest)`,
plus `Build and render on Node (ubuntu-latest)` and
`Deno sanity (unit, smoke/render) / Run smoke (ubuntu-latest)`:

```bash
gh api -X PATCH repos/quarto-dev/quarto-cli/branches/main/protection/required_status_checks \
  --input required-checks.json
```

where `required-checks.json` is `{"strict": false, "contexts": [ … ]}` with the full list. Job display
names come from `name:` in `.github/workflows/test-node-bundle.yml` and `test-smokes.yml`.

## Parity criteria

1. Every Node bucket green per PR (Linux, Windows).
2. Nightly, per OS (Linux, macOS, Windows): pass set and ignored-skip set equal to Deno's, no failure on either side, and no test that passes on Deno is prerequisite-skipped on Node (`compare-junit.mjs`, `parity-compare` job). A test is `<file> :: <name>`. The job is evidence only when it ran on complete inputs: it fails before comparing when any test job it depends on is not green, when a bucket of either runtime has no report, when a report has no test case or a case no file ("Parity evidence" in `32-node-ci-required.md`).
3. Nightly: empty normalised HTML diff for `dev-docs/feature-format-matrix/qmd-files` (`render-parity`).
4. `node-render` per PR and `node-binary` nightly green (the bundle itself).

`tools/node-bundle/node-parity-allowlist.txt` may hold Julia engine tests only,
and only until the julia-engine subtree is pulled with its Node port
(decision 7); `compare-junit.mjs` enforces it.

## Deno in CI after PR 32

The full Deno matrix runs nightly (`deno-nightly`, three OSes); per PR only
`deno-sanity` runs on Deno. PR 37 removes both, and `parity-compare`; the
Node jobs, the bucket generation and the `schedule:` trigger (the only
scheduled macOS run) stay: the resulting graph is in
`dev-docs/runtime-migration/37-ci-switch-and-deno-removal.md`, "The CI graph
after this PR".

**Protection of the still-shipping Deno runtime between this PR and PR 33
(owned by this plan; PR 33's acceptance refers here).** `REVIEW-2026-10-16.md`
decision 2, triage A3: `main` ships Deno until PR 33 lands, so from this PR
on a pull request is protected on Deno only by `deno-sanity` (`unit/` and
`smoke/render/` on Linux) and by the nightly `deno-nightly`. That reduction is
accepted (A3 option a) under one rule: **a pull request that touches
`src/deno_ral/`, the launchers or the build tooling dispatches `Node Tests`
on its branch before merge and links the run; PR 33 itself merges only with
one green `deno-nightly` run on its branch and `parity: OK` for the three
OSes from the same run, both linked in its PR description.** A red
`deno-sanity` is a blocker like any required check; a red `deno-nightly` the
next morning is fixed or reverted that day, since the nightly is the only
full evidence that `main` still ships. The rule ends with PR 37.
```

- [ ] **Step 4: Update the plan index and commit**

Set PR 32 to `merged` in `dev-docs/runtime-migration/README.md`.

```bash
git add .github/workflows/test-smokes-parallel.yml dev-docs/runtime-migration/node-bundle.md dev-docs/runtime-migration/README.md
git commit -m "ci: Node matrix required; full Deno matrix nightly; parity documented"
```

## Verification

- `node --test "tools/node-bundle/*.test.mjs"` → all pass.
- `python3 -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/test-smokes.yml', '.github/workflows/test-node-bundle.yml', '.github/workflows/test-smokes-parallel.yml']]; print('ok')"` → `ok`.
- A `workflow_dispatch` of `Smoke Tests` with default inputs behaves as before (Deno) and uploads `junit-deno-<os>-full` with one XML.
- A `workflow_dispatch` of `Node Tests`: 20 Node buckets × 2 OS green, `deno-sanity` green, `node-render` green; nightly jobs green; `parity-compare` `all test jobs succeeded`, 20 reports per runtime, `parity: OK` × 3; the two provoked runs of Task 4 step 4 red with `found 19` and `node-suite: failure`.
- Local: Task 1 step 6 (prerequisite skips marked, a file on every case on both runtimes) and Task 2 step 3 (`parity: OK`, then `NO EVIDENCE` twice).
- `tools/node-bundle/junit.mjs`, `junit-finish.mjs` and `compare-junit.mjs` as written in Tasks 1 and 2, with the five `compare-junit.test.mjs` cases and the two `junit.test.mjs` cases above, were run on Node 26.12.0 and on Node 22.22 while this plan was corrected (triage row 32); the `file` attribute of node:test's reporter was measured on 26.12.0 (present on every `<testcase>`, absent on the `<testsuite>` of a test with steps) and its absence on 22.22, on a real `node --test --test-reporter=junit` report of two files sharing a test name; the workflow steps were not run.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts` → green with `QUARTO_TEST_JUNIT` unset (no change to the default run).

## Review checklist

- [ ] `test-smokes.yml` defaults to `deno`; the `node` branch only adds `npm ci`, the bundle build and the runner switch; every invocation in a bucket loop writes its own JUnit file; the artifact name carries runtime, OS and label.
- [ ] `tests/test.ts` records prerequisite skips only when `QUARTO_TEST_PREREQ_SKIPS` is set; all four runner scripts set it next to `QUARTO_TEST_JUNIT` and rewrite the report afterwards.
- [ ] `compare-junit.mjs` identifies a test as `<file> :: <name>`, merges directories, treats pass-then-fail as failed, fails on any failure on either side, on asymmetric passes, ignored skips and Node prerequisite gaps, refuses incomplete evidence (`--buckets`, empty bucket, empty report, case without a file, missing path) with `parity: NO EVIDENCE`, and enforces the Julia-only allowlist (empty once `julia-engine.js` has no `Deno.`).
- [ ] `parity-compare` needs `node-buckets` and fails in its first step on any `needs.*.result` other than `success`; the download patterns are `d[0-9][0-9]`/`n[0-9][0-9]`; `--buckets` is `N_BUCKETS`; every runner script calls `junit-finish.mjs` after a JUnit run; `parseJUnit` takes the file from `file`, then `classname`, then the file suite.
- [ ] Nightly-only jobs carry `if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'`; none runs on `push`.
- [ ] macOS runs Deno and Node nightly (the Deno baseline exists for parity).
- [ ] The `node-unit` job, `run-unit-on-node.mjs` and `known-failures.json` are gone; no non-Julia entry was moved into the allowlist.
- [ ] No `continue-on-error: true` remains; `test-smokes-parallel.yml` has no `pull_request`/`push` trigger; `deno-sanity` runs per PR.
- [ ] Every `setup-node` uses `node-version: 26`; tooling tests use the `"tools/node-bundle/*.test.mjs"` glob.

## Risks and rollback

- **The Deno jobs are temporary; the Node ones are not.** PR 37 deletes `deno-sanity`, `deno-nightly` and `parity-compare` and keeps everything else in `test-node-bundle.yml`, `schedule:` included (its final graph is in PR 37, "The CI graph after this PR"): nothing here may be written so that removing the Deno jobs takes the macOS run or the required checks with it.
- **Nightly-only Deno coverage while `main` still ships Deno (between this PR and PR 33).** A Deno-only regression shows up the next morning instead of on the PR; `deno-sanity` catches the common paths (unit tests, `smoke/render/`). The nightly failure is triaged like a red `main`. If that window proves too risky, re-add `pull_request` to `test-smokes-parallel.yml` (one line) until PR 33 merges.
- **CI cost** stays near today's per PR (Spec table); nightly adds about 85 jobs. If macOS nightly queues for hours, run the macOS legs in 10 buckets (`-n=10` in a second `node-buckets` output) and record it here.
- **The evidence gate is strict on purpose.** One cancelled bucket, one runner that lost its artifact upload, or a `node-buckets` change of `-n` without the matching artifact count turns all three parity rows red with `NO EVIDENCE`; that is R14's point (a green report that was not computed from the whole suite is worse than a red one). The log names the cause in one line; a re-run of the failed bucket is the fix, never a relaxed check. A report from a reporter that writes no file (Node 22's) has no identity and is not parity evidence; the CI runtime is Node 26, and `junit-finish.mjs --file` covers a local run on an older Node.
- **Flaky parity** from timing-dependent tests shows as a test name in `only passing on …` that flips between nights. Use `dev-docs/debugging-flaky-tests.md`; the allowlist is not an escape hatch for non-Julia tests.
- **Windows Node suite** first runs per PR here; failures in `.cmd` spawning or path handling belong to PR 28/27 and are fixed there before Task 6.
- **Rollback:** restore `continue-on-error: true` on the Node jobs, restore the `pull_request`/`push` triggers of `test-smokes-parallel.yml`, and put the Deno bucket checks back in branch protection; nothing outside CI depends on this PR.

## Decisions needed

None. Decided above: per-PR Node on Linux and Windows with macOS nightly (as `test-smokes.yml` reserves macOS for scheduled runs), pass-set parity nightly, prerequisite skips reported through a sidecar and a JUnit rewrite (Deno's test API has no runtime skip, so the harness cannot mark them itself on both runtimes), the Julia-only allowlist rule tied to the subtree pull, the Deno matrix moving to nightly once Node is required with a per-PR Deno sanity job, and (R14) parity computed only from complete evidence (green upstream jobs, every bucket reported, every case identified by file and name, failures counted), the file read from the report itself (Deno's `classname`, Node 26's `file` attribute) rather than put into the test names, which must stay equal to Deno's for the comparison.
