# PR 32: Node CI matrix required (bucketed), prerequisite-aware parity with Deno

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the full unit and smoke suites on Node in the same 20 timing-based buckets the Deno matrix uses (Linux and Windows on every pull request, macOS nightly), measure parity with Deno per OS from JUnit reports that tell a prerequisite skip from a pass, make the Node matrix the required gate, and move the full Deno matrix to a nightly run once Node is required.
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

**Parity criteria** (per OS; all must hold for Linux and Windows before the Node jobs are required, and are reported nightly for all three OSes):

1. **Suite green on Node.** Every Node bucket passes (per pull request: Linux and Windows).
2. **Pass-set parity.** Over the nightly runs, the set of test case names that pass on Node equals the set that pass on Deno, the `skipped` (ignored) sets are equal, and no test that passed on Deno is prerequisite-skipped on Node. `tools/node-bundle/compare-junit.mjs` computes it.
3. **Render parity.** `dev-docs/feature-format-matrix/qmd-files/**/*.qmd` rendered to HTML with the Deno build and with the Node bundle gives an empty normalised diff (nightly).
4. **Bundle smoke.** The `node-render` job (PR 26) passes and is no longer allowed to fail; nightly, `smoke/` runs in binary mode against `tools/node-bundle/quarto-node`.

A **parity allowlist** `tools/node-bundle/node-parity-allowlist.txt` (one JUnit test name per line, then `# <issue> julia`) tolerates a known Julia difference until the subtree pull; it must be empty once `julia-engine.js` is ported.

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
- `tools/node-bundle/junit.mjs` (PR 26): a `prereq` class; `tools/node-bundle/junit-prereq.mjs` (new); `tools/node-bundle/compare-junit.mjs` (new) with its test; `tools/node-bundle/node-parity-allowlist.txt`.
- `.github/workflows/test-smokes.yml`: `test-runtime` input (`deno` | `node`), npm and bundle setup for `node`, one JUnit report per invocation, JUnit artifact.
- `.github/workflows/test-node-bundle.yml`: `node-buckets` + `node-suite` (per PR, Linux and Windows), `deno-sanity` (per PR), nightly `deno-nightly`, `node-macos`, `render-parity`, `node-binary`, `parity-compare`; `node-render` no longer allowed to fail; the `node-unit` job and its known-failures ratchet retired (the full suite replaces it); optional nightly `dual-runtime-smoke` (Spike #2 (a)).
- `.github/workflows/test-smokes-parallel.yml`: `pull_request` and `push` triggers removed (the Deno matrix runs nightly from `test-node-bundle.yml`).
- `tools/node-bundle/quarto-node.cmd` (Windows launcher for the bundle).
- `dev-docs/runtime-migration/node-bundle.md`: parity, required checks, nightly Deno.

Out:
- Removing Deno from CI altogether (PR 37).
- Linux arm64 runners (PR 34).
- Any change to test content; a parity gap is fixed in the PR that owns the module.

### Interfaces

Environment for every runner script (`run-tests.sh`, `run-tests.ps1`, `run-tests-node.sh`, `run-tests-node.ps1`):

- `QUARTO_TEST_JUNIT=<path>`: write a JUnit report of this invocation (Deno: `--junit-path`; Node: the PR 31 runner's JUnit reporter), and set `QUARTO_TEST_PREREQ_SKIPS=<path without .xml>.prereq.jsonl` for the run; afterwards, when that file exists, run `node tools/node-bundle/junit-prereq.mjs <junit> <jsonl>`. Timing runs ignore it.
- `QUARTO_TEST_PREREQ_SKIPS=<path>`: `tests/test.ts` appends `{"name":"<test name as registered>"}` and a newline for each test whose `prereq()` returned false.

```js
// tools/node-bundle/junit.mjs (PR 26, extended)
/** prereq: test cases whose <skipped> message starts with "prerequisite" (written by junit-prereq.mjs). */
export function parseJUnit(xml: string): { passed: Set<string>; failed: Set<string>; skipped: Set<string>; prereq: Set<string> };

// tools/node-bundle/junit-prereq.mjs
/** Rewrites each named test case into <testcase …><skipped message="prerequisite not met"/></testcase>. */
export function markPrerequisiteSkips(xml: string, names: Set<string>): string;
// CLI: node tools/node-bundle/junit-prereq.mjs <junit.xml> <skips.jsonl>   (rewrites the XML in place)

// tools/node-bundle/compare-junit.mjs
export function readReports(pathOrDir: string): { passed: Set<string>; failed: Set<string>; skipped: Set<string>; prereq: Set<string> };
export function compare(deno, node, allowlist: Set<string>): {
  onlyDeno: string[]; onlyNode: string[]; skippedOnlyDeno: string[]; skippedOnlyNode: string[];
  prereqOnlyNode: string[];   // passed on Deno, prerequisite-skipped on Node: an environment gap, fails parity
  prereqOnlyDeno: string[];   // reported, does not fail
  ok: boolean;
};
/** Allowlist lines: "<test name>  # <issue> julia". Problems: a line without the julia marker; any line once the Julia engine is ported. */
export function allowlistProblems(lines: string[], juliaPorted: boolean): string[];
// CLI: node tools/node-bundle/compare-junit.mjs --deno <xml|dir> --node <xml|dir>
//        [--allowlist tools/node-bundle/node-parity-allowlist.txt] [--julia-engine src/resources/extension-subtrees/julia-engine]
```

`juliaPorted` is computed by the CLI: no `Deno.` occurrence in any `*.js` under `--julia-engine`.

### Files

- Modify: `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`, `tests/test.ts`
- Modify: `tools/node-bundle/junit.mjs`, `tools/node-bundle/junit.test.mjs`
- Create: `tools/node-bundle/junit-prereq.mjs`, `tools/node-bundle/compare-junit.mjs`, `tools/node-bundle/compare-junit.test.mjs`, `tools/node-bundle/node-parity-allowlist.txt`, `tools/node-bundle/quarto-node.cmd`
- Delete: `tools/node-bundle/run-unit-on-node.mjs`, `tools/node-bundle/known-failures.json` (the full suite replaces the bundled unit run; `build-test.mjs` and `node-test-adapter.mjs` stay for `tests/unit/ral/layer-script.ts`)
- Modify: `.github/workflows/test-smokes.yml`, `.github/workflows/test-node-bundle.yml`, `.github/workflows/test-smokes-parallel.yml`
- Modify: `dev-docs/runtime-migration/node-bundle.md`, `dev-docs/runtime-migration/README.md` (status)

### Acceptance criteria

- `node --test "tools/node-bundle/*.test.mjs"` passes (includes `junit.test.mjs` and `compare-junit.test.mjs`).
- A test whose prerequisite is missing appears in the JUnit report of both runtimes as `<skipped message="prerequisite not met"/>` (Task 1 step 5).
- A pull request runs `node-suite` in 20 buckets on Linux and Windows and uploads one `junit-node-<os>-n<NN>` artifact per job, each holding one XML per runner invocation.
- A `workflow_dispatch` of `Node Tests` runs the nightly jobs; `parity-compare` prints per-OS counts (passed, failed, skipped, prereq) and `parity: OK` for Linux, macOS and Windows, with the allowlist holding only `julia` lines (or nothing once the subtree is pulled).
- `parity-report` jobs have `if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'`.
- No `continue-on-error: true` remains in `test-node-bundle.yml`; branch protection lists the Node bucket jobs, `node-render` and `deno-sanity` (documented command, executed by a maintainer).
- `test-smokes-parallel.yml` no longer triggers on `pull_request` or `push`.

## Plan

### Task 1: JUnit from every runner, with prerequisite skips marked

**Files:**
- Modify: `tests/test.ts`, `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`
- Modify: `tools/node-bundle/junit.mjs`, `tools/node-bundle/junit.test.mjs`
- Create: `tools/node-bundle/junit-prereq.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tools/node-bundle/junit.test.mjs`:

```js
import { markPrerequisiteSkips } from "./junit-prereq.mjs";

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
```

Run: `node --test tools/node-bundle/junit.test.mjs`
Expected: `ERR_MODULE_NOT_FOUND` for `./junit-prereq.mjs`.

- [ ] **Step 2: Classify prerequisite skips in `junit.mjs`**

In `parseJUnit`, add `const prereq = new Set();`, return `{ passed, failed, skipped, prereq }`, and replace the `else if (/<skipped\b/.test(body)) skipped.add(name);` line with:

```js
    else if (/<skipped\b[^>]*\bmessage="prerequisite/.test(body)) prereq.add(name);
    else if (/<skipped\b/.test(body)) skipped.add(name);
```

- [ ] **Step 3: Write `junit-prereq.mjs`**

```js
// tools/node-bundle/junit-prereq.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// tests/test.ts passes a test whose prereq() is false (it prints
// "Skipped - <name>"), on Deno and on Node. With QUARTO_TEST_PREREQ_SKIPS set
// it also records the name; the runner scripts then call this script so the
// JUnit report shows those cases as <skipped message="prerequisite not met"/>
// and the parity report can tell an environment gap from a pass.
// Usage: node tools/node-bundle/junit-prereq.mjs <junit.xml> <skips.jsonl>
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const unescape = (s) => s.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, "&");

export function markPrerequisiteSkips(xml, names) {
  const re = /<testcase\b((?:[^>"]|"[^"]*")*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  return xml.replace(re, (whole, attrs) => {
    const m = attrs.match(/(?:^|\s)name="([^"]*)"/);
    if (!m || !names.has(unescape(m[1]))) return whole;
    return `<testcase${attrs.replace(/\/$/, "")}><skipped message="prerequisite not met"/></testcase>`;
  });
}

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  const [xmlPath, jsonlPath] = process.argv.slice(2);
  const names = new Set(
    fs.readFileSync(jsonlPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).name),
  );
  fs.writeFileSync(xmlPath, markPrerequisiteSkips(fs.readFileSync(xmlPath, "utf8"), names));
  console.log(`marked ${names.size} prerequisite skip(s) in ${xmlPath}`);
}
```

Run: `node --test tools/node-bundle/junit.test.mjs`
Expected: `# pass 3`, `# fail 0`.

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
if [[ -n "$QUARTO_TEST_JUNIT" && -s "$QUARTO_TEST_PREREQ_SKIPS" && -f "$QUARTO_TEST_JUNIT" ]]; then
  if command -v node > /dev/null; then
    node "$QUARTO_ROOT/tools/node-bundle/junit-prereq.mjs" "$QUARTO_TEST_JUNIT" "$QUARTO_TEST_PREREQ_SKIPS"
  else
    echo "WARNING: node not found; prerequisite skips are not marked in $QUARTO_TEST_JUNIT"
  fi
fi
```

`tests/run-tests-node.sh`: the `QUARTO_TEST_JUNIT` export of `QUARTO_TEST_PREREQ_SKIPS` (same three lines, without `QUARTO_JUNIT_ARGS`; PR 31's `run_test_files` already passes the JUnit reporter) and the same post-run block before `exit`.

`tests/run-tests.ps1` and `tests/run-tests-node.ps1`: the PowerShell equivalents:

```powershell
if ($Env:QUARTO_TEST_JUNIT) {
  $Env:QUARTO_TEST_PREREQ_SKIPS = [System.IO.Path]::ChangeExtension($Env:QUARTO_TEST_JUNIT, ".prereq.jsonl")
  Remove-Item -ErrorAction SilentlyContinue $Env:QUARTO_TEST_PREREQ_SKIPS
}
```

(`run-tests.ps1` also adds `--junit-path=$($Env:QUARTO_TEST_JUNIT)` to its `deno test` invocation) and before `Exit`:

```powershell
if ($Env:QUARTO_TEST_JUNIT -and (Test-Path $Env:QUARTO_TEST_PREREQ_SKIPS) -and (Test-Path $Env:QUARTO_TEST_JUNIT)) {
  & node (Join-Path $Env:QUARTO_ROOT "tools" "node-bundle" "junit-prereq.mjs") $Env:QUARTO_TEST_JUNIT $Env:QUARTO_TEST_PREREQ_SKIPS
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
Expected: `marked N prerequisite skip(s)` after each run; the summaries agree; both greps print the same non-zero count. (If the chosen test's prerequisite is met even with the reduced `PATH`, pick another file from the grep.)

- [ ] **Step 7: Commit**

```bash
git add tests/test.ts tests/run-tests.sh tests/run-tests.ps1 tests/run-tests-node.sh tests/run-tests-node.ps1 tools/node-bundle/junit.mjs tools/node-bundle/junit.test.mjs tools/node-bundle/junit-prereq.mjs
git commit -m "tests: JUnit from every runner; prerequisite skips reported as skipped"
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
import { allowlistProblems, compare } from "./compare-junit.mjs";

const set = (...a) => new Set(a);
const report = (o) => ({ passed: set(), failed: set(), skipped: set(), prereq: set(), ...o });

test("compare reports asymmetric passes, skips and prerequisite gaps", () => {
  const deno = report({ passed: set("a", "b", "c", "deno only"), skipped: set("s"), prereq: set("p deno") });
  const node = report({ passed: set("a", "b", "node only", "p deno"), skipped: set("s"), prereq: set("c") });
  const d = compare(deno, node, new Set());
  assert.deepEqual(d.onlyDeno, ["c", "deno only"]);
  assert.deepEqual(d.onlyNode, ["node only", "p deno"]);
  assert.deepEqual(d.prereqOnlyNode, ["c"]);
  assert.deepEqual(d.prereqOnlyDeno, ["p deno"]);
  assert.equal(d.ok, false);
  const tolerated = compare(deno, node, new Set(["c", "deno only", "node only", "p deno"]));
  assert.equal(tolerated.ok, true);
});

test("allowlist: julia lines only until the engine is ported, then nothing", () => {
  const lines = ["# comment", "", "[smoke] > julia engine renders  # quarto-dev/quarto-cli#1 julia", "[smoke] > other  # #2"];
  assert.deepEqual(allowlistProblems(lines, false), ["not a julia entry (decision 7 allows only those): [smoke] > other  # #2"]);
  assert.equal(allowlistProblems(lines.slice(0, 3), false).length, 0);
  assert.deepEqual(allowlistProblems(lines.slice(0, 3), true), [
    "the Julia engine is ported (no Deno. in julia-engine): remove [smoke] > julia engine renders  # quarto-dev/quarto-cli#1 julia",
  ]);
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
// (dev-docs/runtime-migration/32-node-ci-required.md). Directories are read
// recursively (one XML per runner invocation).
// Usage: node tools/node-bundle/compare-junit.mjs --deno <xml|dir> --node <xml|dir>
//          [--allowlist tools/node-bundle/node-parity-allowlist.txt]
//          [--julia-engine src/resources/extension-subtrees/julia-engine]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseJUnit } from "./junit.mjs";

function* files(p, ext) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    for (const d of fs.readdirSync(p).sort()) yield* files(path.join(p, d), ext);
  } else if (p.endsWith(ext)) yield p;
}

export function readReports(pathOrDir) {
  const out = { passed: new Set(), failed: new Set(), skipped: new Set(), prereq: new Set() };
  for (const f of files(pathOrDir, ".xml")) {
    const r = parseJUnit(fs.readFileSync(f, "utf8"));
    for (const k of Object.keys(out)) for (const n of r[k]) out[k].add(n);
  }
  // A test that passed in one invocation and failed in another counts as failed.
  for (const n of out.failed) out.passed.delete(n);
  return out;
}

export function compare(deno, node, allowlist) {
  const diff = (a, b) => [...a].filter((x) => !b.has(x) && !allowlist.has(x)).sort();
  const onlyDeno = diff(deno.passed, node.passed);
  const onlyNode = diff(node.passed, deno.passed);
  const skippedOnlyDeno = diff(deno.skipped, node.skipped);
  const skippedOnlyNode = diff(node.skipped, deno.skipped);
  const prereqOnlyNode = [...node.prereq].filter((x) => deno.passed.has(x) && !allowlist.has(x)).sort();
  const prereqOnlyDeno = [...deno.prereq].filter((x) => node.passed.has(x)).sort();
  const ok = !(onlyDeno.length || onlyNode.length || skippedOnlyDeno.length || skippedOnlyNode.length || prereqOnlyNode.length);
  return { onlyDeno, onlyNode, skippedOnlyDeno, skippedOnlyNode, prereqOnlyNode, prereqOnlyDeno, ok };
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
  const lines = arg("--allowlist") && fs.existsSync(arg("--allowlist")) ? fs.readFileSync(arg("--allowlist"), "utf8").split("\n") : [];
  const juliaDir = arg("--julia-engine") ?? "src/resources/extension-subtrees/julia-engine";
  const juliaPorted = [...files(juliaDir, ".js")].every((f) => !/\bDeno\./.test(fs.readFileSync(f, "utf8")));
  const problems = allowlistProblems(lines, juliaPorted);
  const allowlist = new Set(lines.filter((l) => l.trim() && !l.trim().startsWith("#")).map(entryName));
  const deno = readReports(arg("--deno"));
  const node = readReports(arg("--node"));
  const d = compare(deno, node, allowlist);
  const counts = (r) => `passed ${r.passed.size}, failed ${r.failed.size}, skipped ${r.skipped.size}, prereq ${r.prereq.size}`;
  console.log(`deno: ${counts(deno)}\nnode: ${counts(node)}`);
  if (allowlist.size) console.log(`allowlist (${allowlist.size}):\n  ${[...allowlist].join("\n  ")}`);
  const section = (title, list) => { if (list.length) console.log(`${title} (${list.length}):\n  ${list.join("\n  ")}`); };
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
# One JUnit test name per line, then "  # <issue> julia". Only Julia engine
# tests may be listed, and only until the julia-engine subtree is pulled with
# its Node port (decision 7); compare-junit.mjs enforces both rules.
# dev-docs/runtime-migration/32-node-ci-required.md
```

Run: `node --test tools/node-bundle/compare-junit.test.mjs`
Expected: `# pass 2`, `# fail 0`.

- [ ] **Step 3: Compare the two reports from Task 1**

Run: `node tools/node-bundle/compare-junit.mjs --deno /tmp/rt32-deno.xml --node /tmp/rt32-node.xml --allowlist tools/node-bundle/node-parity-allowlist.txt`
Expected: equal counts and `parity: OK`.

- [ ] **Step 4: Commit**

```bash
git add tools/node-bundle/compare-junit.mjs tools/node-bundle/compare-junit.test.mjs tools/node-bundle/node-parity-allowlist.txt
git commit -m "ci: pass-set parity with prerequisite gaps and a Julia-only allowlist"
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

  parity-compare:
    name: Pass-set parity (${{ matrix.os }})
    if: always() && (github.event_name == 'schedule' || github.event_name == 'workflow_dispatch')
    needs: [node-suite, node-macos, deno-nightly]
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        os: [Linux, macOS, Windows]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 26
      - uses: actions/download-artifact@v8
        with:
          pattern: junit-deno-${{ matrix.os }}-d*
          path: junit/deno
      - uses: actions/download-artifact@v8
        with:
          pattern: junit-node-${{ matrix.os }}-n*
          path: junit/node
      - name: Compare
        run: node tools/node-bundle/compare-junit.mjs --deno junit/deno --node junit/node --allowlist tools/node-bundle/node-parity-allowlist.txt

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

Push the branch, `gh workflow run "Node Tests" --ref rt/32-node-ci-required`, then `gh run watch`. Expected: `node-suite` green in all 20 buckets on Linux and Windows; `deno-sanity` green; the nightly jobs run (dispatch); `parity-compare` prints the four counts per runtime and `parity: OK` for Linux, macOS and Windows; `render-parity` prints `Node render identical to Deno render` on each OS. Each failure is a parity gap: fix it in the PR that owns the module (preferred) or, for a Julia test only, add an allowlist line with the issue number; re-run.

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
2. Nightly, per OS (Linux, macOS, Windows): pass set, ignored-skip set equal to Deno's, and no test that passes on Deno is prerequisite-skipped on Node (`compare-junit.mjs`, `parity-compare` job).
3. Nightly: empty normalised HTML diff for `dev-docs/feature-format-matrix/qmd-files` (`render-parity`).
4. `node-render` per PR and `node-binary` nightly green (the bundle itself).

`tools/node-bundle/node-parity-allowlist.txt` may hold Julia engine tests only,
and only until the julia-engine subtree is pulled with its Node port
(decision 7); `compare-junit.mjs` enforces it.

## Deno in CI after PR 32

The full Deno matrix runs nightly (`deno-nightly`, three OSes); per PR only
`deno-sanity` runs on Deno. PR 37 removes both.
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
- A `workflow_dispatch` of `Node Tests`: 20 Node buckets × 2 OS green, `deno-sanity` green, `node-render` green; nightly jobs green; `parity-compare` `parity: OK` × 3.
- Local: Task 1 step 6 (prerequisite skips marked on both runtimes) and Task 2 step 3.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts` → green with `QUARTO_TEST_JUNIT` unset (no change to the default run).

## Review checklist

- [ ] `test-smokes.yml` defaults to `deno`; the `node` branch only adds `npm ci`, the bundle build and the runner switch; every invocation in a bucket loop writes its own JUnit file; the artifact name carries runtime, OS and label.
- [ ] `tests/test.ts` records prerequisite skips only when `QUARTO_TEST_PREREQ_SKIPS` is set; all four runner scripts set it next to `QUARTO_TEST_JUNIT` and rewrite the report afterwards.
- [ ] `compare-junit.mjs` merges directories, treats pass-then-fail as failed, fails on asymmetric passes, ignored skips and Node prerequisite gaps, and enforces the Julia-only allowlist (empty once `julia-engine.js` has no `Deno.`).
- [ ] Nightly-only jobs carry `if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'`; none runs on `push`.
- [ ] macOS runs Deno and Node nightly (the Deno baseline exists for parity).
- [ ] The `node-unit` job, `run-unit-on-node.mjs` and `known-failures.json` are gone; no non-Julia entry was moved into the allowlist.
- [ ] No `continue-on-error: true` remains; `test-smokes-parallel.yml` has no `pull_request`/`push` trigger; `deno-sanity` runs per PR.
- [ ] Every `setup-node` uses `node-version: 26`; tooling tests use the `"tools/node-bundle/*.test.mjs"` glob.

## Risks and rollback

- **Nightly-only Deno coverage while `main` still ships Deno (between this PR and PR 33).** A Deno-only regression shows up the next morning instead of on the PR; `deno-sanity` catches the common paths (unit tests, `smoke/render/`). The nightly failure is triaged like a red `main`. If that window proves too risky, re-add `pull_request` to `test-smokes-parallel.yml` (one line) until PR 33 merges.
- **CI cost** stays near today's per PR (Spec table); nightly adds about 85 jobs. If macOS nightly queues for hours, run the macOS legs in 10 buckets (`-n=10` in a second `node-buckets` output) and record it here.
- **Flaky parity** from timing-dependent tests shows as a test name in `only passing on …` that flips between nights. Use `dev-docs/debugging-flaky-tests.md`; the allowlist is not an escape hatch for non-Julia tests.
- **Windows Node suite** first runs per PR here; failures in `.cmd` spawning or path handling belong to PR 28/27 and are fixed there before Task 6.
- **Rollback:** restore `continue-on-error: true` on the Node jobs, restore the `pull_request`/`push` triggers of `test-smokes-parallel.yml`, and put the Deno bucket checks back in branch protection; nothing outside CI depends on this PR.

## Decisions needed

None. Decided above: per-PR Node on Linux and Windows with macOS nightly (as `test-smokes.yml` reserves macOS for scheduled runs), pass-set parity nightly, prerequisite skips reported through a sidecar and a JUnit rewrite (Deno's test API has no runtime skip, so the harness cannot mark them itself on both runtimes), the Julia-only allowlist rule tied to the subtree pull, and the Deno matrix moving to nightly once Node is required with a per-PR Deno sanity job.
