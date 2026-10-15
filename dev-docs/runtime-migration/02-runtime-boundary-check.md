# PR 02: Runtime boundary ratchet in CI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A committed baseline of `Deno.*` call sites and direct std-library imports outside `src/deno_ral/`, a script that fails when any count rises, and a GitHub Actions job that runs it on every PR.
**Phase:** 0. **Depends on:** none. **Unblocks:** PR 08, 09, 14 (every codemod PR lowers this baseline) and PR 25 (sets it to zero).
**Branch:** `rt/02-runtime-boundary-check`.
**Suggested executor:** Sonnet. The script is small and fully specified below; the only judgement is matching the measured numbers.
**Size:** S (4 new files: script, baseline, unit test, workflow).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` section 11, "Order of work", step 1, and `README.md` ground rule 2: application code never calls `Deno.*` or imports the standard library directly; it goes through `src/deno_ral/`. Today that is a habit, not a check. The migration lowers the counts PR by PR (PRs 08-24), so a ratchet is needed: the allowed number is a committed baseline that can only go down.

The README's "Progress metric" table is the human-readable mirror of the baseline file; this PR does not change the README beyond the status column.

Measured in this sandbox on `main` at `a4d0979` with the script in Task 1 (the numbers below are the script's own output, so the first run of the committed script must reproduce them exactly):

| Scope | `Deno.*` call sites | Files with a direct std import |
|---|---|---|
| `src/` excluding `src/deno_ral/` and `src/vendor/` | 1,079 | 76 |
| `package/src` | 240 | 2 |
| `tests/` | 840 | 161 |

The std-import number for `src/` differs from the README's "71" because the README figure was taken with a narrower module list; the script's list (below) is the authoritative one from now on. Per module in `src/` the 76 files split as: `fmt` 27, `semver` 18, `encoding` 14, `testing` 9, `io` 8, `log` 5, `fs` 5, `flags` 5, `dotenv` 3, `crypto` 2, `async` 2, and one each for `xmlp`, `xml`, `streams`, `path`, `media_types`, `datetime`, `another_cookiejar` (a file can import several modules).

### Scope

In:
- `tools/check-runtime-boundary.ts`: counts per scope, compares with the baseline, exits 1 on any increase, `--update-baseline` rewrites the baseline with lower counts only.
- `tools/runtime-boundary-baseline.json`: the committed baseline.
- `tests/unit/tools/check-runtime-boundary.test.ts`: unit tests for the counting and comparison functions on temp fixtures.
- `.github/workflows/runtime-boundary.yml`: runs the script on pull requests and pushes to `main`.

Out:
- `.js`/`.mjs` files. Seven JS files under `src/` call `Deno.*` (`src/core/cri/deno-cri/chrome.js`, `external-request.js`, `src/core/lib/external/tree-sitter-deno.js`, `src/resources/js/graphviz-wasm.js`, and three built artifacts under `src/resources/editor/` and `src/resources/extension-subtrees/julia-engine/_extensions/`). The hand-written ones are covered by PR 08 (`deno-cri`) and PR 20; the built ones follow their sources. Counting them would make the baseline depend on `build-artifacts` output.
- A `deno lint` plugin (mentioned in the assessment as a later replacement for the grep).
- Any change to the counted code.

### Interfaces

`tools/check-runtime-boundary.ts` exports (so the unit test can import it without running the CLI part, which is guarded by `import.meta.main`):

```ts
/** One scope's counts. */
export interface BoundaryCounts {
  /** Number of `\bDeno\.` matches across all `.ts` files in the scope. */
  denoCalls: number;
  /** Number of `.ts` files in the scope containing at least one `from "<std-module>[/...]"` import. */
  stdImportFiles: number;
}

/** Keyed by scope name: "src", "package/src", "tests". */
export type Baseline = Record<string, BoundaryCounts>;

/** The std-library import-map names that must be imported through src/deno_ral/. */
export const kStdModules: readonly string[];

/** Count one scope. `dir` and `exclude` are relative to `root`, forward slashes. Skips node_modules and .venv. */
export function countScope(root: string, dir: string, exclude: string[]): BoundaryCounts;

/** Count every scope in kScopes under `root`. */
export function measure(root: string): Baseline;

/** Returns one message per scope/field whose current value exceeds the baseline (empty array = pass) and one per scope/field below it. */
export function compareToBaseline(current: Baseline, baseline: Baseline): { regressions: string[]; improvements: string[] };

/** Field-wise minimum of current and baseline (a baseline can only go down). */
export function lowerBaseline(current: Baseline, baseline: Baseline): Baseline;
```

CLI contract (`quarto run --dev tools/check-runtime-boundary.ts [--update-baseline] [--root <dir>]`), run from the repository root:

- prints a table of current counts against the baseline;
- exit 0 when no count exceeds the baseline; prints a `::notice::` line when a count is below the baseline (the PR that lowered it should run `--update-baseline`);
- exit 1 with one `::error::` line per regression (GitHub Actions turns these into annotations);
- `--update-baseline`: writes `lowerBaseline(current, baseline)` to `tools/runtime-boundary-baseline.json` (2-space JSON, trailing newline) and exits 0; it never raises a number;
- `--root <dir>`: repository root (default `Deno.cwd()`); the script exits 2 with a message if `<root>/src/quarto.ts` does not exist.

### Files

- Create: `tools/check-runtime-boundary.ts` (counting, comparison, CLI)
- Create: `tools/runtime-boundary-baseline.json` (baseline)
- Create: `tests/unit/tools/check-runtime-boundary.test.ts` (unit tests on temp fixtures)
- Create: `.github/workflows/runtime-boundary.yml` (CI job)
- Modify: `dev-docs/runtime-migration/README.md` (status column of the PR 02 row only)

### Acceptance criteria

- `quarto run --dev tools/check-runtime-boundary.ts` on the PR branch prints the three scopes with counts equal to the baseline and exits 0.
- Adding one `Deno.cwd()` call to any file under `src/command/` makes the same command exit 1 with `::error::src: Deno.* calls rose from 1079 to 1080 (baseline tools/runtime-boundary-baseline.json)`.
- `--update-baseline` after removing a `Deno.*` call lowers the corresponding number; after adding one it leaves the file unchanged.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts` passes (5 tests).
- The workflow runs on the PR and is green.

## Plan

### Task 1: The counting and comparison module

**Files:**
- Create: `tools/check-runtime-boundary.ts`
- Test: `tests/unit/tools/check-runtime-boundary.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/tools/check-runtime-boundary.test.ts`:

```ts
/*
 * check-runtime-boundary.test.ts
 *
 * Unit tests for the runtime boundary ratchet (tools/check-runtime-boundary.ts).
 * The fixtures are written to a temp directory so the tests do not depend on
 * the real counts in the repository.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";
import { createTempContext } from "../../../src/core/temp.ts";
import {
  compareToBaseline,
  countScope,
  lowerBaseline,
  measure,
} from "../../../tools/check-runtime-boundary.ts";

function writeFixture(root: string, rel: string, contents: string) {
  const path = join(root, ...rel.split("/"));
  ensureDirSync(join(root, ...rel.split("/").slice(0, -1)));
  Deno.writeTextFileSync(path, contents);
}

function makeRepo(root: string) {
  writeFixture(root, "src/quarto.ts", "export {};\n");
  // 2 Deno. calls and one direct std import
  writeFixture(
    root,
    "src/command/a.ts",
    'import { blue } from "fmt/colors";\nconst x = Deno.cwd();\nconst y = Deno.env.get("X");\nconsole.log(blue(x), y);\n',
  );
  // "DenoX." and "MyDeno." must not match \bDeno\.
  writeFixture(root, "src/core/b.ts", "const DenoX = { a: 1 }; console.log(DenoX.a);\n");
  // excluded directories
  writeFixture(root, "src/deno_ral/c.ts", 'import { walk } from "fs/walk";\nDeno.cwd();\n');
  writeFixture(root, "src/vendor/d.ts", "Deno.cwd();\n");
  // not a .ts file
  writeFixture(root, "src/e.js", "Deno.cwd();\n");
  // skipped tree
  writeFixture(root, "src/webui/node_modules/f.ts", "Deno.cwd();\n");
  writeFixture(root, "package/src/g.ts", 'import { readAll } from "io/read_all";\nDeno.exit(0);\n');
  writeFixture(root, "tests/h.test.ts", 'import { assert } from "testing/asserts";\nimport { x } from "@std/path";\n');
}

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - countScope counts Deno. calls and std-import files", async () => {
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    makeRepo(root);
    assertEquals(
      countScope(root, "src", ["src/deno_ral", "src/vendor"]),
      { denoCalls: 2, stdImportFiles: 1 },
    );
    assertEquals(countScope(root, "package/src", []), { denoCalls: 1, stdImportFiles: 1 });
    assertEquals(countScope(root, "tests", []), { denoCalls: 0, stdImportFiles: 1 });
  } finally {
    temp.cleanup();
  }
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - measure covers the three scopes", async () => {
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    makeRepo(root);
    assertEquals(measure(root), {
      "src": { denoCalls: 2, stdImportFiles: 1 },
      "package/src": { denoCalls: 1, stdImportFiles: 1 },
      "tests": { denoCalls: 0, stdImportFiles: 1 },
    });
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
  assertEquals(compareToBaseline(baseline, baseline), {
    regressions: [],
    improvements: [],
  });
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - a scope missing from the baseline is a regression", async () => {
  const current = { "src": { denoCalls: 1, stdImportFiles: 0 } };
  assertEquals(compareToBaseline(current, {}), {
    regressions: [
      "src: Deno.* calls rose from 0 to 1",
    ],
    improvements: [],
  });
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - lowerBaseline never raises a number", async () => {
  const baseline = { "src": { denoCalls: 10, stdImportFiles: 3 } };
  assertEquals(
    lowerBaseline({ "src": { denoCalls: 12, stdImportFiles: 1 } }, baseline),
    { "src": { denoCalls: 10, stdImportFiles: 1 } },
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
 * Counts, per scope, the `Deno.` call sites and the files that import a
 * standard-library module directly instead of through src/deno_ral/, and
 * fails when any count exceeds the committed baseline.
 *
 * Usage (from the repository root):
 *   quarto run --dev tools/check-runtime-boundary.ts
 *   quarto run --dev tools/check-runtime-boundary.ts --update-baseline
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

export const kBaselineRelPath = "tools/runtime-boundary-baseline.json";

/** Import-map names that application code must reach through src/deno_ral/. */
export const kStdModules: readonly string[] = [
  "fs",
  "path",
  "io",
  "log",
  "fmt",
  "encoding",
  "async",
  "streams",
  "crypto",
  "tar",
  "uuid",
  "datetime",
  "dotenv",
  "flags",
  "bytes",
  "semver",
  "media_types",
  "xml",
  "xmlp",
  "another_cookiejar",
  "testing",
  "@std/path",
];

const kScopes: Record<string, { dir: string; exclude: string[] }> = {
  "src": { dir: "src", exclude: ["src/deno_ral", "src/vendor"] },
  "package/src": { dir: "package/src", exclude: [] },
  "tests": { dir: "tests", exclude: [] },
};

const kDenoRe = /\bDeno\./g;
const kStdImportRe = new RegExp(
  `from\\s+"(${
    kStdModules.map((m) => m.replace("/", "\\/")).join("|")
  })(\\/[^"]*)?"`,
);
const kSkip = [/node_modules/, /\.venv/];

function isExcluded(rel: string, exclude: string[]): boolean {
  return exclude.some((e) => rel === e || rel.startsWith(e + "/"));
}

export function countScope(
  root: string,
  dir: string,
  exclude: string[],
): BoundaryCounts {
  let denoCalls = 0;
  let stdImportFiles = 0;
  for (
    const entry of walkSync(join(root, dir), {
      exts: [".ts"],
      includeDirs: false,
      skip: kSkip,
    })
  ) {
    const rel = relative(root, entry.path).replaceAll("\\", "/");
    if (isExcluded(rel, exclude)) {
      continue;
    }
    const text = Deno.readTextFileSync(entry.path);
    denoCalls += (text.match(kDenoRe) ?? []).length;
    if (kStdImportRe.test(text)) {
      stdImportFiles++;
    }
  }
  return { denoCalls, stdImportFiles };
}

export function measure(root: string): Baseline {
  const result: Baseline = {};
  for (const [name, scope] of Object.entries(kScopes)) {
    result[name] = countScope(root, scope.dir, scope.exclude);
  }
  return result;
}

const kFieldLabels: Record<keyof BoundaryCounts, string> = {
  denoCalls: "Deno.* calls",
  stdImportFiles: "std-import files",
};

export function compareToBaseline(
  current: Baseline,
  baseline: Baseline,
): { regressions: string[]; improvements: string[] } {
  const regressions: string[] = [];
  const improvements: string[] = [];
  for (const [scope, counts] of Object.entries(current)) {
    const base = baseline[scope] ?? { denoCalls: 0, stdImportFiles: 0 };
    for (const field of ["denoCalls", "stdImportFiles"] as const) {
      if (counts[field] > base[field]) {
        regressions.push(
          `${scope}: ${kFieldLabels[field]} rose from ${base[field]} to ${
            counts[field]
          }`,
        );
      } else if (counts[field] < base[field]) {
        improvements.push(
          `${scope}: ${kFieldLabels[field]} fell from ${base[field]} to ${
            counts[field]
          }`,
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

function readBaseline(path: string): Baseline {
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(Deno.readTextFileSync(path)) as Baseline;
}

function printTable(current: Baseline, baseline: Baseline) {
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(pad("scope", 14) + pad("Deno.* calls", 22) + "std-import files");
  for (const [scope, counts] of Object.entries(current)) {
    const base = baseline[scope];
    const cell = (field: keyof BoundaryCounts) =>
      `${counts[field]} (baseline ${base ? base[field] : "none"})`;
    console.log(
      pad(scope, 14) + pad(cell("denoCalls"), 22) + cell("stdImportFiles"),
    );
  }
}

if (import.meta.main) {
  const args = [...Deno.args];
  const rootIndex = args.indexOf("--root");
  const root = rootIndex >= 0 ? args[rootIndex + 1] : Deno.cwd();
  const update = args.includes("--update-baseline");

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
    const lowered = lowerBaseline(current, baseline);
    Deno.writeTextFileSync(
      baselinePath,
      JSON.stringify(lowered, null, 2) + "\n",
    );
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

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts`
Expected: five dots, `5 passed`.

- [ ] **Step 5: Lint the script**

Run: `package/dist/bin/tools/x86_64/deno lint tools/check-runtime-boundary.ts tests/unit/tools/check-runtime-boundary.test.ts`
Expected: `Checked 2 files`.

- [ ] **Step 6: Commit**

```bash
git add tools/check-runtime-boundary.ts tests/unit/tools/check-runtime-boundary.test.ts
git commit -m "Add runtime boundary ratchet script

Counts Deno.* call sites and direct std-library imports outside
src/deno_ral/ per scope and compares them with a committed baseline."
```

### Task 2: The baseline

**Files:**
- Create: `tools/runtime-boundary-baseline.json`

- [ ] **Step 1: Run the script without a baseline**

Run: `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"`
Expected (counts must match; if they do not, `main` moved since this plan was measured, and the printed numbers are the new truth):
```
Runtime boundary check (baseline: tools/runtime-boundary-baseline.json)
scope         Deno.* calls          std-import files
src           1079 (baseline none)  76 (baseline none)
package/src   240 (baseline none)   2 (baseline none)
tests         840 (baseline none)   161 (baseline none)
::error::src: Deno.* calls rose from 0 to 1079 (baseline tools/runtime-boundary-baseline.json). ...
::error::src: std-import files rose from 0 to 76 ...
::error::package/src: Deno.* calls rose from 0 to 240 ...
::error::package/src: std-import files rose from 0 to 2 ...
::error::tests: Deno.* calls rose from 0 to 840 ...
::error::tests: std-import files rose from 0 to 161 ...
exit=1
```

- [ ] **Step 2: Write the baseline**

Run: `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline && cat tools/runtime-boundary-baseline.json`
Expected file contents (`lowerBaseline` against an empty baseline keeps the current counts):

```json
{
  "src": {
    "denoCalls": 1079,
    "stdImportFiles": 76
  },
  "package/src": {
    "denoCalls": 240,
    "stdImportFiles": 2
  },
  "tests": {
    "denoCalls": 840,
    "stdImportFiles": 161
  }
}
```

- [ ] **Step 3: Confirm the check passes against the baseline**

Run: `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"`
Expected: the table with `(baseline 1079)` etc., then `OK: no count exceeds the baseline.` and `exit=0`.

- [ ] **Step 4: Prove the ratchet catches a regression**

Run:
```bash
echo 'const _rt02 = Deno.cwd();' >> src/command/utils.ts
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"
git checkout -- src/command/utils.ts
```
Expected: `::error::src: Deno.* calls rose from 1079 to 1080 (baseline tools/runtime-boundary-baseline.json). ...` and `exit=1`; the last command restores the file.

- [ ] **Step 5: Prove `--update-baseline` never raises**

Run:
```bash
echo 'const _rt02 = Deno.cwd();' >> src/command/utils.ts
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline
git checkout -- src/command/utils.ts
git diff --stat tools/runtime-boundary-baseline.json
```
Expected: the baseline file shows no diff (1079 stays 1079).

- [ ] **Step 6: Commit**

```bash
git add tools/runtime-boundary-baseline.json
git commit -m "Add runtime boundary baseline

Measured on main: src 1079 Deno.* calls / 76 std-import files,
package/src 240 / 2, tests 840 / 161."
```

### Task 3: The CI workflow

**Files:**
- Create: `.github/workflows/runtime-boundary.yml`
- Modify: `dev-docs/runtime-migration/README.md` (PR 02 row status)

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/runtime-boundary.yml` (same checkout/action pattern as `.github/workflows/test-bundle.yml`):

```yaml
# Runtime boundary ratchet for the Deno -> Node migration.
# Fails when the number of `Deno.*` call sites or direct std-library imports
# outside src/deno_ral/ rises above tools/runtime-boundary-baseline.json.
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

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts` → `5 passed`.
- `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` → `OK: no count exceeds the baseline.`, exit 0.
- Task 2 steps 4 and 5 (regression detected; baseline never raised).
- `package/dist/bin/tools/x86_64/deno lint tools/check-runtime-boundary.ts` → clean.
- The `Runtime Boundary` workflow is green on the PR.

## Review checklist

- [ ] Baseline numbers equal the script's output on the merge-base of the PR (re-run on `main` if the PR branch is behind).
- [ ] `kStdModules` lists exactly: fs, path, io, log, fmt, encoding, async, streams, crypto, tar, uuid, datetime, dotenv, flags, bytes, semver, media_types, xml, xmlp, another_cookiejar, testing, @std/path.
- [ ] `src/deno_ral` and `src/vendor` are excluded from `src`; `node_modules` and `.venv` are skipped everywhere.
- [ ] Only `.ts` files are counted (documented scope decision).
- [ ] `--update-baseline` uses `lowerBaseline` (field-wise minimum), never a plain overwrite.
- [ ] The workflow has `permissions: contents: read` and the same `paths` list in both triggers.
- [ ] The script itself lives in `tools/` (outside every counted scope) and may use `Deno.*` directly.

## Risks and rollback

- Two PRs that both lower the baseline can merge with a stale baseline on `main`; the check still passes (lower is not a failure) and prints a `::notice::`. The next codemod PR runs `--update-baseline`.
- The regex `\bDeno\.` also counts occurrences in comments and strings. That is intentional (the codemod PRs remove them as well) and the baseline was measured the same way.
- The job adds one `configure.sh` run per PR (about 3 minutes with the Deno cache restored by `quarto-dev`). If it is too slow, a follow-up can install Deno with `denoland/setup-deno` (pinned to the `DENO` version in `configuration`) and run `deno run --allow-read --import-map src/import_map.json tools/check-runtime-boundary.ts` directly; not part of this PR.
- Rollback: delete the workflow file; the script and baseline are inert without it.
