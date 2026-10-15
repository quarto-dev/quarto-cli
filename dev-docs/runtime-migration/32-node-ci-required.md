# PR 32: Node CI matrix (Linux, macOS, Windows) required, with parity criteria

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the full unit and smoke suites, the feature-format matrix and the Playwright integration run on Node on all three operating systems, define measurable parity with the Deno matrix, flip the Node job from allowed-failure to required, and document the branch-protection step.
**Phase:** 2. **Depends on:** PR 27, 28, 29, 30 (Node implementations), PR 31 (`run-tests-node`). **Unblocks:** PR 33 (the flip).
**Branch:** `rt/32-node-ci-required`.
**Suggested executor:** Sonnet. Workflow plumbing and a small comparison script; the criteria are fixed here.
**Size:** S (2 workflows, 2 runner scripts, 1 script, 1 doc).
**Ships on:** Deno; the Deno matrix stays the primary gate until this PR's last task makes the Node matrix required alongside it.

## Spec

### Context

Assessment section 7, Phase 2 exit: "test suite green on Deno" and, for Phase 3, "CI runs the full matrix (Linux, macOS, Windows, x64, arm64) on Node; keep the Deno matrix alive in parallel until parity, then remove it." README ground rule 1: "The full existing test suite is the gate until PR 32 makes the Node matrix required." PR 26 created `.github/workflows/test-node-bundle.yml` (Linux, `continue-on-error: true`, three spike documents); PR 31 created `tests/run-tests-node.sh`/`.ps1`.

The existing Deno smoke workflow `.github/workflows/test-smokes.yml` is reusable (`workflow_call`) and already provisions R, Python (uv), Julia, TinyTeX, Chrome headless shell, Playwright and Node 22 (`actions/setup-node@v6`, "Install node (for Playwright, MECA)"). `.github/workflows/test-ff-matrix.yml` calls it with the bucket `../dev-docs/feature-format-matrix/qmd-files/**/*.qmd`. The cheapest way to run everything on Node with the same environment is a `test-runtime` input on `test-smokes.yml` that switches the runner script and adds `npm ci`.

**Parity criteria** (all three must hold on every OS before `continue-on-error` is flipped):

1. **Pass-set parity.** For the full-suite job (no buckets) and for the feature-format bucket, the set of test case names with status `passed` in the Node JUnit report equals the set in the Deno JUnit report of the same OS, and the set of `skipped` cases is equal too. `tools/node-bundle/compare-junit.mjs` computes both and exits 1 on any difference. (`ignore`/`prereq` skips are per OS, hence the per-OS comparison.)
2. **Render parity.** `dev-docs/feature-format-matrix/qmd-files/**/*.qmd` rendered to HTML on both runtimes produces an empty diff after `tools/node-bundle/normalize-html.mjs` (PR 26). This catches output differences that smoke-all's verifications do not assert.
3. **Playwright parity.** `integration/playwright-tests.test.ts` (Linux and macOS; browser assertions are ignored on Windows CI, see `.claude/rules/testing/playwright-tests.md`) passes under `run-tests-node.sh`, and the preview WebSocket smoke from PR 29 passes on all three OSes.

A **parity allowlist** `tools/node-bundle/node-parity-allowlist.txt` (one test name per line, with a `#` comment naming the issue) lets a known difference be tolerated temporarily; the file must be empty when the job is made required, and the comparison prints its contents so reviewers see it.

### Scope

In:
- `test-smokes.yml`: `test-runtime` input (`deno` | `node`), JUnit artifact upload, Node bundle build when `node`.
- `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`: `QUARTO_TEST_JUNIT` support.
- `test-node-bundle.yml`: calls `test-smokes.yml` for the full suite on three runners with `test-runtime: node`, the feature-format bucket, a render-parity job, a parity-report job (nightly and `workflow_dispatch`: Deno run + comparison), `continue-on-error: false` at the end.
- `tools/node-bundle/compare-junit.mjs`, `tools/node-bundle/node-parity-allowlist.txt`.
- `dev-docs/runtime-migration/node-bundle.md`: parity section and the branch-protection step.

Out:
- Removing the Deno matrix (PR 37).
- arm64 runners (`macos-latest` is arm64 already; Linux arm64 is added with the installers in PR 34).
- Any change to test content; a parity gap is fixed in the PR that owns the module (27–31), not here.

### Interfaces

`tools/node-bundle/compare-junit.mjs <deno.xml> <node.xml> [--allowlist tools/node-bundle/node-parity-allowlist.txt]`: parses `<testcase name=… classname=…>` with child `<failure>`/`<skipped>` elements (Deno's `--junit-path` and Node's `--test-reporter=junit` both emit this shape); prints `passed: deno N, node M`, then `only passing on deno:` / `only passing on node:` / `skipped only on …` lists; exits 0 when all lists are empty or fully covered by the allowlist.

Environment: `QUARTO_TEST_JUNIT=<path>` makes `run-tests.sh` add `--junit-path=<path>` (Deno) and `run-tests-node.sh` add `--test-reporter=junit --test-reporter-destination=<path>` (Node) to the single-invocation runs; bucket loops and timing runs ignore it (several invocations would overwrite the file).

### Files

- Modify: `.github/workflows/test-smokes.yml` (inputs, three run steps, two new steps, one upload)
- Modify: `.github/workflows/test-node-bundle.yml` (jobs: `node-bundle` kept from PR 26/29/31, plus `node-suite`, `node-ff-matrix`, `render-parity`, `parity-report`)
- Modify: `tests/run-tests.sh:72` area and the final `deno test` line; `tests/run-tests.ps1:130` area and its `deno test` line; `tests/run-tests-node.sh` `run_node_test`; `tests/run-tests-node.ps1` `Run-NodeTest`
- Create: `tools/node-bundle/compare-junit.mjs`, `tools/node-bundle/node-parity-allowlist.txt`, `tools/node-bundle/compare-junit.test.mjs`
- Modify: `dev-docs/runtime-migration/node-bundle.md`, `dev-docs/runtime-migration/README.md` (status)

### Acceptance criteria

- `node --test tools/node-bundle/` passes (includes `compare-junit.test.mjs`).
- A `workflow_dispatch` of `Node Bundle` produces, per OS, `junit-node-<os>.xml` and (for the parity-report job) `junit-deno-<os>.xml`, and the comparison step prints no differences.
- The feature-format bucket passes on Node on all three OSes; the render-parity job prints `Node render identical to Deno render`.
- `integration/playwright-tests.test.ts` passes on Node on Linux and macOS.
- The workflow has no `continue-on-error: true` left; the repository's branch protection for `main` lists the Node jobs as required status checks (documented command executed by a maintainer; the PR description links the settings page).

## Plan

### Task 1: JUnit output from both runners and the comparison script

**Files:**
- Modify: `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`
- Create: `tools/node-bundle/compare-junit.mjs`, `tools/node-bundle/compare-junit.test.mjs`, `tools/node-bundle/node-parity-allowlist.txt`

- [ ] **Step 1: Write the failing test**

```js
// tools/node-bundle/compare-junit.test.mjs
// Copyright (C) 2026 Posit Software, PBC
import { test } from "node:test";
import assert from "node:assert/strict";
import { compare, parseJUnit } from "./compare-junit.mjs";

const deno = `<?xml version="1.0"?><testsuites><testsuite name="unit/a.test.ts">
<testcase name="[unit] &gt; a passes" classname="unit/a.test.ts"></testcase>
<testcase name="[unit] &gt; a fails" classname="unit/a.test.ts"><failure message="boom"/></testcase>
<testcase name="[unit] &gt; a skipped" classname="unit/a.test.ts"><skipped/></testcase>
<testcase name="[unit] &gt; deno only" classname="unit/a.test.ts"></testcase>
</testsuite></testsuites>`;
const node = `<?xml version="1.0"?><testsuites><testsuite name="unit/a.test.ts">
<testcase name="[unit] &gt; a passes" classname="unit/a.test.ts" time="0.1"/>
<testcase name="[unit] &gt; a fails" classname="unit/a.test.ts"><failure message="boom"/></testcase>
<testcase name="[unit] &gt; a skipped" classname="unit/a.test.ts"><skipped message="skip"/></testcase>
<testcase name="[unit] &gt; node only" classname="unit/a.test.ts"/>
</testsuite></testsuites>`;

test("parseJUnit classifies passed, failed and skipped", () => {
  const r = parseJUnit(deno);
  assert.deepEqual([...r.passed].sort(), ["[unit] > a passes", "[unit] > deno only"]);
  assert.deepEqual([...r.failed], ["[unit] > a fails"]);
  assert.deepEqual([...r.skipped], ["[unit] > a skipped"]);
});

test("compare reports asymmetric passes and honours the allowlist", () => {
  const diff = compare(parseJUnit(deno), parseJUnit(node), new Set());
  assert.deepEqual(diff.onlyDeno, ["[unit] > deno only"]);
  assert.deepEqual(diff.onlyNode, ["[unit] > node only"]);
  assert.deepEqual(diff.skippedOnlyDeno, []);
  assert.equal(diff.ok, false);
  const tolerated = compare(parseJUnit(deno), parseJUnit(node), new Set(["[unit] > deno only", "[unit] > node only"]));
  assert.equal(tolerated.ok, true);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tools/node-bundle/compare-junit.test.mjs`
Expected: `Cannot find module '.../compare-junit.mjs'`.

- [ ] **Step 3: Implement**

```js
// tools/node-bundle/compare-junit.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Pass-set parity between a Deno JUnit report (deno test --junit-path) and a
// Node one (node --test --test-reporter=junit). Usage:
//   node tools/node-bundle/compare-junit.mjs deno.xml node.xml [--allowlist tools/node-bundle/node-parity-allowlist.txt]
import fs from "node:fs";

const unescape = (s) => s.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export function parseJUnit(xml) {
  const passed = new Set(), failed = new Set(), skipped = new Set();
  // Self-closing testcases pass; otherwise look at the children up to </testcase>.
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const name = unescape((m[1].match(/\bname="([^"]*)"/) ?? [])[1] ?? "");
    const body = m[3] ?? "";
    if (/<(failure|error)\b/.test(body)) failed.add(name);
    else if (/<skipped\b/.test(body)) skipped.add(name);
    else passed.add(name);
  }
  return { passed, failed, skipped };
}

export function compare(deno, node, allowlist) {
  const diff = (a, b) => [...a].filter((x) => !b.has(x) && !allowlist.has(x)).sort();
  const onlyDeno = diff(deno.passed, node.passed);
  const onlyNode = diff(node.passed, deno.passed);
  const skippedOnlyDeno = diff(deno.skipped, node.skipped);
  const skippedOnlyNode = diff(node.skipped, deno.skipped);
  return { onlyDeno, onlyNode, skippedOnlyDeno, skippedOnlyNode, ok: !(onlyDeno.length || onlyNode.length || skippedOnlyDeno.length || skippedOnlyNode.length) };
}

export function readAllowlist(path) {
  if (!path || !fs.existsSync(path)) return new Set();
  return new Set(fs.readFileSync(path, "utf8").split("\n").map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").replace(/^.*\//, "/"))) {
  const [denoPath, nodePath] = process.argv.slice(2);
  const i = process.argv.indexOf("--allowlist");
  const allowlist = readAllowlist(i === -1 ? undefined : process.argv[i + 1]);
  const deno = parseJUnit(fs.readFileSync(denoPath, "utf8"));
  const node = parseJUnit(fs.readFileSync(nodePath, "utf8"));
  const d = compare(deno, node, allowlist);
  console.log(`passed: deno ${deno.passed.size}, node ${node.passed.size}; failed: deno ${deno.failed.size}, node ${node.failed.size}; skipped: deno ${deno.skipped.size}, node ${node.skipped.size}`);
  if (allowlist.size) console.log(`allowlist (${allowlist.size}):\n  ${[...allowlist].join("\n  ")}`);
  const section = (title, list) => { if (list.length) console.log(`${title} (${list.length}):\n  ${list.join("\n  ")}`); };
  section("only passing on deno", d.onlyDeno);
  section("only passing on node", d.onlyNode);
  section("skipped only on deno", d.skippedOnlyDeno);
  section("skipped only on node", d.skippedOnlyNode);
  console.log(d.ok ? "parity: OK" : "parity: DIFFERENCES");
  process.exit(d.ok ? 0 : 1);
}
```

`tools/node-bundle/node-parity-allowlist.txt`:

```
# One test name per line, exactly as the JUnit `name` attribute, with the
# issue that tracks the difference. Must be empty when the Node matrix is
# required (dev-docs/runtime-migration/32-node-ci-required.md).
```

- [ ] **Step 4: JUnit from the runners**

`tests/run-tests.sh`: after the `QUARTO_DENO_OPTIONS=` line add
```bash
QUARTO_JUNIT_ARGS=()
if [[ -n "$QUARTO_TEST_JUNIT" ]]; then QUARTO_JUNIT_ARGS=("--junit-path=$QUARTO_TEST_JUNIT"); fi
```
and add `"${QUARTO_JUNIT_ARGS[@]}"` after `"${AGENT_REPORTER_ARGS[@]}"` on the final `deno test` line (the generic case only, not the timing loop).

`tests/run-tests.ps1`: after `$QUARTO_DENO_OPTIONS=` add `$QUARTO_JUNIT_ARGS = if ($Env:QUARTO_TEST_JUNIT) { @("--junit-path=$($Env:QUARTO_TEST_JUNIT)") } else { @() }` and splat `@QUARTO_JUNIT_ARGS` on the `deno test` invocation.

`tests/run-tests-node.sh` `run_node_test`: build `JUNIT_ARGS=()` and when `QUARTO_TEST_JUNIT` is set, `JUNIT_ARGS=(--test-reporter=junit "--test-reporter-destination=$QUARTO_TEST_JUNIT")`; pass `"${JUNIT_ARGS[@]}"` after `"${REPORTER_ARGS[@]}"`. `tests/run-tests-node.ps1` `Run-NodeTest`: the same with `$JUNIT = if ($Env:QUARTO_TEST_JUNIT) { @("--test-reporter=junit", "--test-reporter-destination=$($Env:QUARTO_TEST_JUNIT)") } else { @() }`.

- [ ] **Step 5: Run**

Run:
```bash
node --test tools/node-bundle/
cd tests && QUARTO_TEST_JUNIT=/tmp/deno.xml QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts unit/text.test.ts
QUARTO_TEST_JUNIT=/tmp/node.xml QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/path.test.ts unit/text.test.ts
node ../tools/node-bundle/compare-junit.mjs /tmp/deno.xml /tmp/node.xml --allowlist ../tools/node-bundle/node-parity-allowlist.txt
```
Expected: tooling tests pass; both runs green; the comparison prints equal counts and `parity: OK`.

- [ ] **Step 6: Commit**

```bash
git add tools/node-bundle/compare-junit.mjs tools/node-bundle/compare-junit.test.mjs tools/node-bundle/node-parity-allowlist.txt tests/run-tests.sh tests/run-tests.ps1 tests/run-tests-node.sh tests/run-tests-node.ps1
git commit -m "ci: JUnit output from both runners and a pass-set parity comparison"
```

### Task 2: `test-runtime` input on `test-smokes.yml`

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

- [ ] **Step 2: Build the Node bundle and install npm deps when `node`**

Insert after the `- uses: ./.github/workflows/actions/quarto-dev` step:

```yaml
      - name: Install npm dependencies and build the Node bundle
        if: inputs.test-runtime == 'node'
        shell: bash
        run: |
          npm ci
          node tools/node-bundle/build.mjs --check-shim
          node --no-warnings tools/node-bundle/check-ts-syntax.mjs
```

- [ ] **Step 3: Switch the four run steps**

Replace `run: ./run-tests.ps1` in "Run all Smoke Tests Windows" with:
```yaml
        run: |
          $runner = if ("${{ inputs.test-runtime }}" -eq "node") { "./run-tests-node.ps1" } else { "./run-tests.ps1" }
          $env:QUARTO_TEST_JUNIT = "${{ runner.temp }}/junit-${{ inputs.test-runtime }}.xml"
          & $runner
          Exit $LASTEXITCODE
```
Replace `run: ./run-tests.sh` in "Run all Smoke Tests Linux" with:
```yaml
        run: |
          runner=./run-tests.sh
          if [ "${{ inputs.test-runtime }}" = "node" ]; then runner=./run-tests-node.sh; fi
          QUARTO_TEST_JUNIT="${{ runner.temp }}/junit-${{ inputs.test-runtime }}.xml" "$runner"
```
In the Linux bucket loop replace `./run-tests.sh "$file"` with `"$runner" "$file"` and set `runner` the same way before the loop; in the Windows bucket loop replace `./run-tests.ps1 $file` with `& $runner $file` after computing `$runner` as above. For the feature-format bucket (one bucket, one invocation) also export `QUARTO_TEST_JUNIT` before the call so the ff-matrix report exists: add `export QUARTO_TEST_JUNIT="${{ runner.temp }}/junit-${{ inputs.test-runtime }}.xml"` (bash) / `$env:QUARTO_TEST_JUNIT = …` (pwsh) at the top of the bucket steps; with several buckets only the last report survives, which is acceptable (parity is checked on the full-suite and ff-matrix calls, each a single bucket or none).

- [ ] **Step 4: Upload the JUnit report**

Add before the "Upload test timing file" step:

```yaml
      - name: Upload JUnit report
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: junit-${{ inputs.test-runtime || 'deno' }}-${{ runner.os }}-${{ inputs.label-tag || 'full' }}
          path: ${{ runner.temp }}/junit-*.xml
          if-no-files-found: ignore
          retention-days: 14
```

- [ ] **Step 5: Validate and commit**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test-smokes.yml')); print('yaml ok')"` (or `npx -y yaml-lint`).
Expected: `yaml ok`. A `workflow_dispatch` of `Smoke Tests` with defaults still runs Deno exactly as before (the input defaults to `deno`).

```bash
git add .github/workflows/test-smokes.yml
git commit -m "ci: test-runtime input so the smoke workflow can run on Node"
```

### Task 3: `test-node-bundle.yml` runs the suites on three OSes

**Files:**
- Modify: `.github/workflows/test-node-bundle.yml`

- [ ] **Step 1: Add the jobs**

Keep the PR 26/29/31 `node-bundle` job (now `matrix.os: [ubuntu-latest, macos-latest, windows-latest]`; on Windows the render and preview steps use `tools/node-bundle/quarto-node.cmd`, add that launcher: a `.cmd` with the same environment variables calling `node … dist\quarto.mjs %*`, and `check-deps`/`check-ts-syntax` run as is) and append:

```yaml
  node-suite:
    name: Full suite on Node
    uses: ./.github/workflows/test-smokes.yml
    with:
      test-runtime: node
      runners: '["ubuntu-latest", "macos-latest", "windows-latest"]'
      label-tag: node
    secrets: inherit

  node-ff-matrix:
    name: Feature-format matrix on Node
    uses: ./.github/workflows/test-smokes.yml
    with:
      test-runtime: node
      buckets: '[ "../dev-docs/feature-format-matrix/qmd-files/**/*.qmd" ]'
      runners: '["ubuntu-latest", "macos-latest", "windows-latest"]'
      label-tag: nodeff
    secrets: inherit

  render-parity:
    name: Feature-format HTML parity (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
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
      - name: Diff (normalised)
        shell: bash
        run: |
          node tools/node-bundle/normalize-html.mjs "$RUNNER_TEMP/ff-deno" "$RUNNER_TEMP/ff-node"
          if diff -r "$RUNNER_TEMP/ff-deno" "$RUNNER_TEMP/ff-node" > ff-render.diff; then
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

  parity-report:
    name: Pass-set parity with Deno
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' || github.event_name == 'push'
    needs: [node-suite, node-ff-matrix]
    uses: ./.github/workflows/test-smokes.yml
    with:
      test-runtime: deno
      runners: '["ubuntu-latest", "macos-latest", "windows-latest"]'
      label-tag: parity
    secrets: inherit

  parity-compare:
    name: Compare JUnit reports
    if: always() && needs.parity-report.result != 'skipped'
    needs: [node-suite, parity-report]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
      - uses: actions/download-artifact@v8
        with:
          pattern: junit-*
          path: junit
      - name: Compare per OS
        shell: bash
        run: |
          status=0
          for os in Linux macOS Windows; do
            deno=$(ls junit/junit-deno-$os-parity/junit-deno.xml 2>/dev/null || true)
            node=$(ls junit/junit-node-$os-node/junit-node.xml 2>/dev/null || true)
            if [ -z "$deno" ] || [ -z "$node" ]; then echo "::warning::missing report for $os"; status=1; continue; fi
            echo "::group::$os"
            node tools/node-bundle/compare-junit.mjs "$deno" "$node" --allowlist tools/node-bundle/node-parity-allowlist.txt || status=1
            echo "::endgroup::"
          done
          exit $status
```

Add `schedule: - cron: "0 3 * * *"` to the workflow's `on:` block so the parity report runs nightly without doubling every PR's cost.

- [ ] **Step 2: Add `tools/node-bundle/quarto-node.cmd`**

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

- [ ] **Step 3: Dispatch and read the results**

Push the branch, run `gh workflow run "Node Bundle (allowed failure)" --ref rt/32-node-ci-required`, then `gh run watch`. Expected: `node-suite` and `node-ff-matrix` green on three OSes; `render-parity` prints `Node render identical to Deno render` on each OS; `parity-compare` prints `parity: OK` for Linux, macOS and Windows. Each failure is a parity gap: file it against PR 27–31 and either fix it there (preferred) or add the test name to the allowlist with the issue number, then re-run.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test-node-bundle.yml tools/node-bundle/quarto-node.cmd
git commit -m "ci: full suite, feature-format matrix, render and pass-set parity on Node for three OSes"
```

### Task 4: Playwright on Node

**Files:**
- Modify: `.github/workflows/test-smokes.yml` (no change needed if Task 2 is complete: the full-suite run includes `integration/playwright-tests.test.ts` when buckets are empty and `quarto-install` is `dev`)

- [ ] **Step 1: Confirm the Playwright leg ran on Node**

In the `node-suite` Linux and macOS logs, find the group `Testing integration/playwright-tests.test.ts` (full runs include it: the provisioning steps are conditioned on `format('{0}', inputs.buckets) == ''`, which holds). Expected: the wrapper renders `docs/playwright/**/*.qmd` in-process on Node, runs `npx playwright test`, and reports pass. The render spawns use `quartoSpawnEnvOptions()` so binary mode is also valid: run once with `QUARTO_TEST_BIN` pointing at `tools/node-bundle/quarto-node` locally:

```bash
node tools/node-bundle/build.mjs
cd tests && QUARTO_TEST_BIN=$PWD/../tools/node-bundle/quarto-node QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh integration/playwright-tests.test.ts
```
Expected: `npx playwright test` passes (requires `npx playwright install` once).

- [ ] **Step 2: Preview server on Node under Playwright's browser**

The preview WebSocket smoke (PR 29, `node-bundle` job) covers the live-reload channel on all three OSes. No additional spec is added: the Playwright fixtures are served by Python's `http.server` by design (`.claude/rules/testing/playwright-tests.md`).

### Task 5: Make it required

**Files:**
- Modify: `.github/workflows/test-node-bundle.yml`, `dev-docs/runtime-migration/node-bundle.md`, `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Flip `continue-on-error`**

Remove `continue-on-error: true` from the `node-bundle` job and rename the workflow `name: Node Bundle (allowed failure)` → `name: Node Tests`. Confirm `tools/node-bundle/node-parity-allowlist.txt` contains only comments (`grep -v '^#' tools/node-bundle/node-parity-allowlist.txt | grep -c .` → `0`).

- [ ] **Step 2: Document the branch-protection step**

Append to `dev-docs/runtime-migration/node-bundle.md`:

```markdown
## Required status checks (PR 32)

The Node matrix is required on `main`. A maintainer with admin rights adds the
job names to the branch protection rule (Settings → Branches → `main` →
"Require status checks to pass" → search by job name), or with the CLI:

```bash
gh api -X PATCH repos/quarto-dev/quarto-cli/branches/main/protection/required_status_checks \
  -f strict=false \
  -f 'contexts[]=Build and render on Node (ubuntu-latest)' \
  -f 'contexts[]=Build and render on Node (macos-latest)' \
  -f 'contexts[]=Build and render on Node (windows-latest)' \
  -f 'contexts[]=Full suite on Node / Run smoke (ubuntu-latest)' \
  -f 'contexts[]=Full suite on Node / Run smoke (macos-latest)' \
  -f 'contexts[]=Full suite on Node / Run smoke (windows-latest)' \
  -f 'contexts[]=Feature-format matrix on Node / Run smoke (ubuntu-latest)' \
  -f 'contexts[]=Feature-format matrix on Node / Run smoke (macos-latest)' \
  -f 'contexts[]=Feature-format matrix on Node / Run smoke (windows-latest)' \
  -f 'contexts[]=Feature-format HTML parity (ubuntu-latest)' \
  -f 'contexts[]=Feature-format HTML parity (macos-latest)' \
  -f 'contexts[]=Feature-format HTML parity (windows-latest)'
```

(This PATCH replaces the list: include the existing Deno checks from
`gh api repos/quarto-dev/quarto-cli/branches/main/protection/required_status_checks --jq .contexts`
first.) Job display names come from `name:` in
`.github/workflows/test-node-bundle.yml`; the `Run smoke (<os>)` suffix is
`test-smokes.yml`'s job name, as the Deno checks already show.

## Parity criteria

1. Pass set and skip set equal to the Deno run per OS (`compare-junit.mjs`, nightly `parity-compare` job).
2. Empty normalised HTML diff for `dev-docs/feature-format-matrix/qmd-files` (`render-parity` job).
3. Playwright integration run green on Linux and macOS under `run-tests-node.sh`; preview WebSocket smoke green on all OSes.

`tools/node-bundle/node-parity-allowlist.txt` must stay empty while the
matrix is required; a temporary entry needs an issue link and a removal PR.
```

- [ ] **Step 3: Update the plan index and commit**

Set PR 32 to `merged` in `dev-docs/runtime-migration/README.md`.

```bash
git add .github/workflows/test-node-bundle.yml dev-docs/runtime-migration/node-bundle.md dev-docs/runtime-migration/README.md
git commit -m "ci: Node matrix required; parity criteria and branch protection documented"
```

## Verification

- `node --test tools/node-bundle/` → all pass.
- `python3 -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/test-smokes.yml', '.github/workflows/test-node-bundle.yml']]; print('ok')"` → `ok`.
- A `workflow_dispatch` of `Smoke Tests` with default inputs behaves exactly as before (Deno), and uploads `junit-deno-<os>-full`.
- A `workflow_dispatch` of `Node Tests`: `node-bundle` ×3, `node-suite` ×3, `node-ff-matrix` ×3, `render-parity` ×3 green; `parity-compare` prints `parity: OK` ×3.
- Local: the Task 1 step 5 comparison and the Task 4 step 1 Playwright run.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts` (Deno runner still works with the JUnit change when `QUARTO_TEST_JUNIT` is unset).

## Review checklist

- [ ] `test-smokes.yml` defaults to `deno`; the `node` branch only adds `npm ci`, the bundle build, the syntax check and the runner switch.
- [ ] All four run steps (Linux/Windows, full/bucket) honour `test-runtime`.
- [ ] JUnit artifacts are uploaded `if: always()` with distinct names per runtime, OS and label.
- [ ] `compare-junit.mjs` compares pass sets and skip sets; the allowlist is printed and empty.
- [ ] `render-parity` renders every non-underscore `.qmd` under `qmd-files` on both runtimes and fails on a non-empty normalised diff.
- [ ] Playwright runs under the Node runner on Linux and macOS (log group present).
- [ ] No `continue-on-error: true` remains; the required-checks command lists the exact job names shown in the Checks tab.

## Risks and rollback

- **CI cost doubles for the Node matrix** (and triples nightly with the parity Deno run). Mitigation: the parity Deno run is nightly/dispatch only; PR runs execute the Node suites once. Rollback: set `continue-on-error: true` on the Node jobs and remove them from required checks; nothing else depends on this PR.
- **Flaky parity** from timing-dependent tests shows as a test name in `only passing on …` that flips between runs. Use `dev-docs/debugging-flaky-tests.md`; an allowlist entry is the temporary escape hatch and must link an issue.
- **Windows Node suite** has never run before this PR; expect first-run failures in `.cmd` spawning or path handling. They belong to PR 28/27 and are fixed there before Task 5 runs.

## Decisions needed

- **Nightly vs per-PR parity comparison.** Recommendation (encoded above): per-PR runs execute the Node suites and the render parity (both must be green); the Deno-vs-Node JUnit comparison runs nightly and on dispatch, because every PR already runs the Deno suite in `Smoke Tests` and a green Node suite implies pass-set parity unless skips differ. Alternative: download the Deno JUnit from the PR's own `Smoke Tests` run via `actions/download-artifact` `run-id` lookup; more plumbing for the same signal.
