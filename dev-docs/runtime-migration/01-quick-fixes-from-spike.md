# PR 01: Quick fixes from the Node spike

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the two runtime-neutral fixes the spike found: `with { type: "json" }` on the two dynamic JSON imports, and a deterministic (sorted) order for the bslib Sass files.
**Phase:** 0. **Depends on:** none. **Unblocks:** PR 26 (the Node bundle job needs both).
**Branch:** `rt/01-quick-fixes-from-spike`.
**Suggested executor:** Sonnet. Both changes are mechanical; the only judgement is in the test design, which this plan spells out.
**Size:** S (4 files: 2 source edits, 1 source refactor, 1 new unit test).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` section 10, findings 2 and 3:

- `src/core/lib/yaml-intelligence/yaml-intelligence.ts:1209-1212` and `src/core/lib/yaml-intelligence/parsing.ts:57-60` use the legacy import-assertion form `{ assert: { type: "json" } }` on a dynamic `import()`. Node 22 rejects `assert`. Verified in this sandbox with the project's own Deno (2.7.14, `package/dist/bin/tools/x86_64/deno`): a dynamic JSON import with `{ assert: ... }` **fails at runtime on Deno too** (`TypeError: Attempted to load JSON module without specifying "type": "json" attribute`), while `{ with: ... }` works, and `deno check` accepts both. The code path is not reached by the Deno CLI (`parsing.ts:41-42` says the branch "should never run in the CLI"; the CLI initialises tree-sitter through `src/core/schema/deno-init-tree-sitter.ts` and `setTreeSitter`). It runs inside the esbuild bundles for the IDE (`src/resources/editor/tools/yaml/web-worker.js`, `src/resources/editor/tools/vs-code.mjs`), where esbuild (0.28.1, `package/dist/bin/tools/x86_64/esbuild`) inlines the JSON module and drops the attribute. Verified: esbuild bundles both spellings with exit 0, and the committed bundles contain no `type: "json"` text. So the change is a pure spelling fix with no effect on built artifacts.
- `src/format/html/format-html-shared.ts:119-141` (`bslibComponentRules`) concatenates every file in `src/resources/formats/html/bslib/bslib-scss/` and `src/resources/formats/html/bslib/components/scss/` in whatever order `Deno.readDirSync` yields. That order is filesystem-dependent (Linux ext4 hash order, macOS APFS sorted, Node a different order again). The spike saw eight CSS rules move between runtimes. Sorting the entries by name makes the output identical everywhere.

### Scope

In:
- the two `assert` → `with` edits;
- `bslibComponentRules` reads directory entries sorted by name, through a small exported helper so the behaviour is unit-testable;
- one new unit test file.

Out:
- any other `Deno.readDirSync` ordering dependency (PR 09 gives `readDirSync` in `src/deno_ral/fs.ts` a sorted contract for all callers);
- the `// import localDescriptor from "./protocol.json" assert { type: "json" };` comment in `src/core/cri/deno-cri/devtools.js:13` (commented out, dead);
- changelog entry (no user-visible behaviour change; CSS rule order inside the compiled theme does not change any computed style because the moved rules select disjoint components).

### Interfaces

`src/format/html/format-html-shared.ts` gains one exported helper and `bslibComponentRules` is reimplemented on it:

```ts
/**
 * Concatenate the contents of every regular file directly inside each of
 * `dirs`, in directory order first and then by file name (byte-wise `<`
 * comparison, so the result does not depend on the locale or on the order
 * the filesystem returns entries). Subdirectories are ignored.
 */
export function concatenateDirFiles(dirs: string[]): string;

export const bslibComponentRules = (): string; // unchanged signature; now `concatenateDirFiles([bslib-scss, components/scss])`
```

### Files

- Modify: `src/core/lib/yaml-intelligence/yaml-intelligence.ts:1209-1212` (`assert` → `with`)
- Modify: `src/core/lib/yaml-intelligence/parsing.ts:57-60` (`assert` → `with`)
- Modify: `src/format/html/format-html-shared.ts:119-141` (sorted read via `concatenateDirFiles`)
- Test: `tests/unit/format-html-bslib-order.test.ts` (new)

### Acceptance criteria

- `grep -rn 'assert: { type: "json" }' src --include=*.ts` prints nothing; `grep -rn 'with: { type: "json" }' src --include=*.ts` prints exactly the two sites.
- `package/dist/bin/quarto dev-call build-artifacts` completes and `git status --short src/resources/editor` is empty (the bundles do not change).
- `concatenateDirFiles` returns file contents in sorted-name order regardless of creation order (unit test).
- `bslibComponentRules()` starts with the contents of `bslib-scss/bslib.scss` and the five `bslib-scss` files precede the nine `components/scss` files (unit test).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/format-html-bslib-order.test.ts smoke/site/render-site-themes.test.ts smoke/render/render-html.test.ts` is green.

## Plan

### Task 1: `assert` → `with` on the two dynamic JSON imports

**Files:**
- Modify: `src/core/lib/yaml-intelligence/yaml-intelligence.ts:1209-1212`
- Modify: `src/core/lib/yaml-intelligence/parsing.ts:57-60`

- [ ] **Step 1: Confirm the two sites (and only those two)**

Run: `grep -rn 'assert: { type: "json" }' src --include=*.ts`
Expected:
```
src/core/lib/yaml-intelligence/parsing.ts:59:    { assert: { type: "json" } }
src/core/lib/yaml-intelligence/yaml-intelligence.ts:1211:      { assert: { type: "json" } }
```

- [ ] **Step 2: Edit `yaml-intelligence.ts`**

Replace lines 1209-1212:

```ts
    const resourceModule = (await import(
      "../../../resources/editor/tools/yaml/yaml-intelligence-resources.json",
      { assert: { type: "json" } }
    )).default as Record<string, unknown>;
```

with:

```ts
    const resourceModule = (await import(
      "../../../resources/editor/tools/yaml/yaml-intelligence-resources.json",
      { with: { type: "json" } }
    )).default as Record<string, unknown>;
```

- [ ] **Step 3: Edit `parsing.ts`**

Replace lines 57-60:

```ts
  const treeSitterYamlJson = (await import(
    "../../../resources/editor/tools/yaml/tree-sitter-yaml.json",
    { assert: { type: "json" } }
  )).default as { data: number[] };
```

with:

```ts
  const treeSitterYamlJson = (await import(
    "../../../resources/editor/tools/yaml/tree-sitter-yaml.json",
    { with: { type: "json" } }
  )).default as { data: number[] };
```

- [ ] **Step 4: Type-check both files**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/lib/yaml-intelligence/yaml-intelligence.ts src/core/lib/yaml-intelligence/parsing.ts`
(on macOS use `tools/aarch64/deno` or `tools/x86_64/deno`; on Windows `package\dist\bin\tools\x86_64\deno.exe`)
Expected: `Check .../yaml-intelligence.ts`, `Check .../parsing.ts`, exit 0.

- [ ] **Step 5: Rebuild the IDE bundles and confirm they are byte-identical**

Run: `package/dist/bin/quarto dev-call build-artifacts && git status --short src/resources/editor`
Expected: the command finishes without `Failure:` lines and `git status` prints nothing for `src/resources/editor` (esbuild inlines the JSON, so the attribute spelling never reaches the bundle). If `build-artifacts` also rewrites `src/resources/schema/json-schemas.json` or `src/resources/types/` with no content change, that is unrelated to this PR; `git diff --stat` must show those files with 0 insertions/deletions or they must be reverted with `git checkout -- <file>`.

- [ ] **Step 6: Commit**

```bash
git add src/core/lib/yaml-intelligence/yaml-intelligence.ts src/core/lib/yaml-intelligence/parsing.ts
git commit -m "Use 'with' import attributes on dynamic JSON imports

Node rejects the legacy 'assert' spelling and Deno 2 ignores it at
runtime. The attribute never reaches the esbuild bundles (JSON is
inlined), so the IDE artifacts are unchanged."
```

### Task 2: Deterministic bslib Sass ordering

**Files:**
- Modify: `src/format/html/format-html-shared.ts:119-141`
- Test: `tests/unit/format-html-bslib-order.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/format-html-bslib-order.test.ts`:

```ts
/*
 * format-html-bslib-order.test.ts
 *
 * The bslib component Sass is the concatenation of every file in two
 * resource directories. Deno.readDirSync returns entries in filesystem
 * order (hash order on ext4, sorted on APFS, different again on Node), so
 * the concatenation must sort by name to be deterministic.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { createTempContext } from "../../src/core/temp.ts";
import {
  bslibComponentRules,
  concatenateDirFiles,
} from "../../src/format/html/format-html-shared.ts";
import { formatResourcePath } from "../../src/core/resources.ts";

// deno-lint-ignore require-await
unitTest("concatenateDirFiles - sorts by file name, not creation order", async () => {
  const temp = createTempContext();
  try {
    const dir1 = temp.createDir();
    const dir2 = temp.createDir();
    // write in deliberately non-sorted order
    Deno.writeTextFileSync(join(dir1, "zeta.scss"), "Z1");
    Deno.writeTextFileSync(join(dir1, "alpha.scss"), "A1");
    Deno.writeTextFileSync(join(dir1, "mid.scss"), "M1");
    Deno.mkdirSync(join(dir1, "mixins"));
    Deno.writeTextFileSync(join(dir1, "mixins", "ignored.scss"), "IGNORED");
    Deno.writeTextFileSync(join(dir2, "b.scss"), "B2");
    Deno.writeTextFileSync(join(dir2, "a.scss"), "A2");

    assertEquals(
      concatenateDirFiles([dir1, dir2]),
      ["A1", "M1", "Z1", "A2", "B2"].join("\n"),
    );
    // directory order is preserved: dir2 first puts its files first
    assertEquals(
      concatenateDirFiles([dir2, dir1]),
      ["A2", "B2", "A1", "M1", "Z1"].join("\n"),
    );
  } finally {
    temp.cleanup();
  }
});

// deno-lint-ignore require-await
unitTest("bslibComponentRules - bslib-scss files precede components/scss files, each sorted", async () => {
  const bslibDir = formatResourcePath("html", "bslib");
  const first = Deno.readTextFileSync(
    join(bslibDir, "bslib-scss", "bslib.scss"),
  );
  const rules = bslibComponentRules();
  assert(
    rules.startsWith(first),
    "output must start with bslib-scss/bslib.scss (first sorted name of the first directory)",
  );

  const sortedNames = (dir: string) =>
    [...Deno.readDirSync(dir)]
      .filter((e) => e.isFile)
      .map((e) => e.name)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const expected = [
    ...sortedNames(join(bslibDir, "bslib-scss")).map((n) =>
      Deno.readTextFileSync(join(bslibDir, "bslib-scss", n))
    ),
    ...sortedNames(join(bslibDir, "components", "scss")).map((n) =>
      Deno.readTextFileSync(join(bslibDir, "components", "scss", n))
    ),
  ].join("\n");
  assertEquals(rules, expected);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/format-html-bslib-order.test.ts`
Expected: FAIL at type-check time with `TS2305 ... has no exported member 'concatenateDirFiles'` (the runner passes `--check` for unit tests).

- [ ] **Step 3: Implement `concatenateDirFiles` and use it**

In `src/format/html/format-html-shared.ts`, replace lines 119-141:

```ts
export const bslibComponentRules = () => {
  const bslibDistDir = formatResourcePath(
    "html",
    join("bslib"),
  );

  const bslibDirs = [
    join(bslibDistDir, "bslib-scss"),
    join(bslibDistDir, "components", "scss"),
  ];

  const scss = [];
  for (const bsLibDir of bslibDirs) {
    for (
      const walk of Deno.readDirSync(bsLibDir)
    ) {
      if (walk.isFile) {
        const contents = Deno.readTextFileSync(join(bsLibDir, walk.name));
        scss.push(contents);
      }
    }
  }

  return scss.join("\n");
};
```

with:

```ts
/**
 * Concatenate the contents of every regular file directly inside each of
 * `dirs`, in directory order first and then by file name (byte-wise `<`
 * comparison, so the result does not depend on the locale or on the order
 * the filesystem returns entries). Subdirectories are ignored.
 */
export function concatenateDirFiles(dirs: string[]): string {
  const scss: string[] = [];
  for (const dir of dirs) {
    const names = [...Deno.readDirSync(dir)]
      .filter((entry) => entry.isFile)
      .map((entry) => entry.name)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const name of names) {
      scss.push(Deno.readTextFileSync(join(dir, name)));
    }
  }
  return scss.join("\n");
}

export const bslibComponentRules = () => {
  const bslibDistDir = formatResourcePath(
    "html",
    join("bslib"),
  );

  return concatenateDirFiles([
    join(bslibDistDir, "bslib-scss"),
    join(bslibDistDir, "components", "scss"),
  ]);
};
```

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/format-html-bslib-order.test.ts`
Expected: two dots and a tally line `2 passed`.

- [ ] **Step 5: Render a themed HTML document and check the CSS still compiles**

Run: `package/dist/bin/quarto render tests/docs/callouts.qmd --to html --output-dir /tmp/rt01 && ls /tmp/rt01/callouts_files/libs/bootstrap/`
Expected: render succeeds; the directory contains `bootstrap-*.min.css` (the compiled theme that includes the bslib rules). Remove `/tmp/rt01` afterwards.

- [ ] **Step 6: Commit**

```bash
git add src/format/html/format-html-shared.ts tests/unit/format-html-bslib-order.test.ts
git commit -m "Sort bslib component Sass files before concatenating

Deno.readDirSync order is filesystem dependent, so the compiled theme CSS
differed between machines and runtimes. Reading the entries sorted by
name makes the output deterministic."
```

## Verification

Before opening the PR:

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/format-html-bslib-order.test.ts` → `2 passed`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/site/render-site-themes.test.ts smoke/render/render-html.test.ts smoke/yaml-intelligence/` → all passed (theme compilation, HTML render, and the YAML intelligence tests that load the IDE code).
- `package/dist/bin/quarto dev-call build-artifacts && git status --short src/resources/editor` → empty.
- `grep -rn 'assert: { type' src --include=*.ts` → empty.
- `package/dist/bin/tools/x86_64/deno lint src/format/html/format-html-shared.ts src/core/lib/yaml-intelligence/parsing.ts src/core/lib/yaml-intelligence/yaml-intelligence.ts` → `Checked 3 files`.
- Set the PR 01 row in `dev-docs/runtime-migration/README.md` to `in progress` in the PR; the merger sets it to `merged`.

## Review checklist

- [ ] Exactly two `with: { type: "json" }` sites, no other spelling left in `src/`.
- [ ] The rebuilt IDE bundles (`src/resources/editor/tools/yaml/web-worker.js`, `src/resources/editor/tools/vs-code.mjs`, `yaml-intelligence.js`) are not part of the diff.
- [ ] `concatenateDirFiles` sorts with a byte-wise comparator (no `localeCompare`), skips subdirectories (the `components/scss/mixins/` directory), and keeps the two-directory order `bslib-scss` then `components/scss`.
- [ ] The unit test writes files in non-sorted order so it would catch a regression to filesystem order.
- [ ] No `Deno.*` calls were added outside the two helpers that already used them (the PR 02 ratchet count for `src/` must not rise: `bslibComponentRules` had 2 `Deno.` calls, `concatenateDirFiles` has 2).

## Risks and rollback

- Risk: a theme's CSS rule order changes on machines whose filesystem returned a non-sorted order. The bslib component rules select disjoint components (`.accordion`, `.card`, `.sidebar`, `.value-box`, ...), so cascade order between those files does not change computed styles. If a visual regression is reported, `git revert` the second commit; the first commit is independent.
- Risk: none for the `with` change on Deno (the branch is not executed by the CLI) or in the bundles (JSON inlined). If an editor integration that consumes `vs-code.mjs` or `web-worker.js` from a different build pipeline breaks, the fix is in that pipeline, not here.
