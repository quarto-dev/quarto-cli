# PR 19: `platform.ts` extension with real `runtime()` detection, `main.ts`, remove `Deno.permissions`; version/consoleSize/inspect/uid/noColor/build/import.meta.main

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `src/deno_ral/platform.ts` with `runtime()` (real runtime detection), `consoleColumns()`, `inspect()`, `isRootUser()`, `noColor()`, add `src/deno_ral/main.ts` with `isMainModule(import.meta)`, and replace every `Deno.version`, `Deno.consoleSize`, `Deno.inspect`, `Deno.uid`, `Deno.noColor`, `Deno.build`, `import.meta.main` and `Deno.permissions` site in `src/`, `package/src` and `tests/` with the layer, without changing any user-visible behaviour.
**Phase:** 1.
**Depends on:** PR 08 (`exec`, `execPath` in `process.ts`), PR 09 (`temp.ts`, `fs.ts` for the write probe and the tests), PR 02 (ratchet; `tests/asserts.ts`).
**Unblocks:** PR 23, PR 25, PR 27b, PR 34.
**Branch:** `rt/19-ral-platform-main-permissions`.
**Suggested executor:** Sonnet.
Every replacement is a one-line substitution with a known target; the two judgement calls (`isWritable`, `isMainModule` under bundling) are decided below.
**Size:** M by file count (README row says S; M is right): 2 layer files, 2 tests with 2 fixtures, about 22 call-site files.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 3.3 row "`Deno.addSignalListener`, `Deno.consoleSize`, `Deno.execPath`, `Deno.build`, `Deno.inspect`, `Deno.uid`, `Deno.permissions`" and row `import.meta.main`; section 11 module plan rows `platform.ts` (extend with runtime name/version, `consoleColumns()`, `inspect()`), `main.ts` (`isMainModule(import.meta)`), `permissions` (remove; replace with a filesystem check).
Signals, `execPath`, `args` are PR 08.

Verified sites (`main` at `b86f98d`; `grep -rn 'Deno\.\(version\|consoleSize\|inspect\|uid\|noColor\|build\|permissions\)' src tests package/src tools --include=*.ts` and `grep -rn 'import\.meta\.main' ...`):

| API | Site | Replacement |
|---|---|---|
| `Deno.version.deno` | `src/command/check/check.ts:274` (and label `"Deno"` at 305) | `runtime().version`; label unchanged until PR 34 |
| `Deno.consoleSize().columns` | `src/core/log.ts:490-497` | `consoleColumns() ?? 130` |
| `Deno.inspect(value)` | `src/publish/confluence/confluence-logger.ts:17` | `inspect(value)` |
| `Deno.uid()` | `tests/utils.ts:283`, `tests/unit/project/project-detect-denied-path.test.ts:51`, `tests/smoke/project/project-detect-denied-config.test.ts:24` | `isRootUser()` |
| `Deno.noColor` | `src/core/lib/external/colors.ts:25-35` (browser-shared module; reads `globalThis.Deno` through an `any` local) | runtime-neutral global probe (Task 4) |
| `Deno.build.os` | `src/deno_ral/fs.ts:182,196`; `src/core/lib/errors.ts:25-41` (browser-shared); `tests/unit/chrome-launch-fixtures.ts:36`, `tests/smoke/typst-gather/typst-gather.test.ts:472`, `tests/smoke/issues/9133/9133.test.ts:3`, `tests/smoke/create/create.test.ts:74` | `isWindows` from `platform.ts` (errors.ts: global probe) |
| `Deno.build.arch` | `src/tools/impl/tinytex.ts:266`, `src/tools/impl/tinytex-info.ts:56`, `src/core/resources.ts:34`, `package/src/common/config.ts:100` | `arch` from `platform.ts` (already exported) |
| `Deno.build.target` | `package/src/common/compile-quarto-latexmk.ts:58,107` | none: PR 39 deletes the file (decision 9) |
| `Deno.build.*` in `src/resources/extension-subtrees/julia-engine/**` (4 sites) | subtree | none (decision 7) |
| `Deno.permissions.query({ name: "write", path })` | `src/tools/impl/tinytex.ts:630-634` (`isWritable`, used once at line 68 as a macOS prereq for `/usr/local/bin`) | real write probe, warning only (Task 3) |
| `import.meta.main` | `src/quarto.ts:220`, `package/src/bld.ts:55`, `package/src/common/import-report/{explain-import-chain:148,find-bad-types-constants:22,explain-all-cycles:152,find-bad-imports:53,report-risky-files:45,report-bundle-async-cycles:800}.ts` | `isMainModule(import.meta)` |
| `import.meta.main` elsewhere | `src/command/render/latexmk/quarto-latexmk.ts:128` (PR 39 deletes the standalone entry, decision 9); `src/resources/scripts/check-usage.ts:3`, `src/resources/scripts/empty.ts:1` (user-script fixtures run by `quarto run`, PR 35); `src/resources/tools/ast-diagram/main.ts:58`, `tools/render-all-formats.ts:136`, `tools/sass-variable-explainer/_attic/print-dependency-graph.ts:108` (dev tools, PR 35); `tests/tools/check-gha-log.ts:114` (PR 23) | out of scope here |

**`isWritable` is a no-op today, and stays non-blocking.** Under `--allow-all` (which every launcher passes) `Deno.permissions.query` always answers `"granted"`, so the macOS prerequisite "`/usr/local/bin` is writable" has never stopped an install.
That is correct behaviour: `afterInstall` tries `QUARTO_TEXLIVE_BINPATH` or `suggestUserBinPaths()` (`src/core/path.ts:339-356`; `/usr/local/bin` is only one candidate) and only warns when `tlmgr path add` fails for all of them (`tinytex.ts:390-425`).
Turning the prerequisite into a real check would make `quarto install tinytex` hard-exit (`src/tools/tools.ts:158-166`) on Macs where it works today (review S8).
So the `Deno.permissions` call is replaced by a real write probe whose only effect is a warning; the prerequisite still returns `true`.

**`runtime()` does real detection** (vocabulary): `typeof Deno !== "undefined" && "version" in Deno` → `deno`; else `process.versions.bun` → `bun`; else `node`.
Written against `globalThis`, so PR 27b only adds the Node-bundle shim marker and nothing else in this function changes.

**`isMainModule` must hold under both runtimes and is used for one entry in the CLI.** Deno and Node ≥ 24.2 set `import.meta.main`; otherwise `fileURLToPath(meta.url)` is compared with `process.argv[1]` through `realpath`.
A test that asserts `isMainModule(import.meta) === false` for the test file itself is wrong under `node --test <file>` (each file is the entry there), so the test runs two tiny fixture scripts as child processes instead.
Bundle caveat: in a single-file bundle every inlined module shares the bundle's `import.meta`, so `isMainModule(import.meta)` is true in every bundled module that calls it.
Inside the CLI graph only `src/quarto.ts` calls it (the `package/src` scripts are separate entry points, never bundled; `quarto-latexmk.ts`, the other entry that would have been bundled by `compile-quarto-latexmk.ts`, is deleted by PR 39).
The docstring records this; PR 25's checklist keeps it true.

### Scope

In: the table rows with a replacement, `main.ts`, the two tests and their fixtures, rules doc, baseline.
Out: subtree files; `quarto run` script fixtures and `tools/*.ts` dev scripts (PR 35); `quarto-latexmk.ts` and `compile-quarto-latexmk.ts` (PR 39 deletes them); `Deno.args`/`Deno.execPath`/signals (PR 08); the `"Deno"` label and the strict version `"2.7.14"` in `check.ts` (PR 34 adds the runtime row); any change to what `quarto install tinytex` does.

### Interfaces

`src/deno_ral/platform.ts` (extended; existing exports unchanged; vocabulary):

```ts
export const isWindows: boolean; export const isMac: boolean; export const isLinux: boolean; export const os: string; export const arch: string; // existing

/** The JavaScript runtime executing Quarto and its version, detected from
 * globals: a `Deno` global with `version` → deno (Deno.version.deno);
 * `process.versions.bun` → bun; otherwise node (process.versions.node). */
export function runtime(): { name: "deno" | "node" | "bun"; version: string };
/** Terminal width in columns, or undefined when stdout is not a terminal. Never throws. */
export function consoleColumns(): number | undefined;
/** Debug representation of any value (like util.inspect / Deno.inspect). */
export function inspect(value: unknown, options?: { depth?: number; colors?: boolean }): string;
/** True when the process runs as uid 0. Always false on Windows. */
export function isRootUser(): boolean;
/** True when colour output is disabled (NO_COLOR set, or the runtime says so). */
export function noColor(): boolean;
```

`src/deno_ral/main.ts` (new; vocabulary):

```ts
/** True when `meta` belongs to the module the process was started with
 * (the `if (import.meta.main)` idiom), on Deno and Node: `meta.main` when
 * defined (Deno, Node 24.2+), otherwise `fileURLToPath(meta.url)` compared
 * with `process.argv[1]`, both through `realpath`. False for non-`file:`
 * URLs or when `process.argv[1]` is unset.
 * Caveat: in a single-file bundle every inlined module sees the bundle's
 * import.meta, so this is true in all of them. Within the CLI bundle only
 * src/quarto.ts may call it. */
export function isMainModule(meta: ImportMeta): boolean;
```

`src/tools/impl/tinytex.ts` (changed):

```ts
/** True when this process can create a file in `dir`. Exported for its test. */
export function isDirWritable(dir: string): boolean;
```

### Files

- Modify: `src/deno_ral/platform.ts` (add 5 functions).
- Create: `src/deno_ral/main.ts`.
- Create: `tests/unit/ral/platform.test.ts`, `tests/unit/ral/fixtures/main-entry.ts`, `tests/unit/ral/fixtures/main-importer.ts`, `tests/unit/tools/tinytex-writable.test.ts`.
- Modify: `src/command/check/check.ts:274`, `src/core/log.ts:490-497`, `src/publish/confluence/confluence-logger.ts:1,17`, `src/core/lib/external/colors.ts:25-35`, `src/core/lib/errors.ts:25-41`, `src/deno_ral/fs.ts:182,196`, `src/tools/impl/tinytex.ts:63-72,266,630-634`, `src/tools/impl/tinytex-info.ts:56`, `src/core/resources.ts:33-37`, `src/quarto.ts:220`.
- Modify: `package/src/common/config.ts:100`, `package/src/bld.ts:55`, six files under `package/src/common/import-report/`.
- Modify: `tests/utils.ts:283`, `tests/unit/project/project-detect-denied-path.test.ts:51`, `tests/smoke/project/project-detect-denied-config.test.ts:24`, `tests/unit/chrome-launch-fixtures.ts:36`, `tests/smoke/typst-gather/typst-gather.test.ts:472`, `tests/smoke/issues/9133/9133.test.ts:3`, `tests/smoke/create/create.test.ts:74`.
- Modify: `src/resources/editor/tools/vs-code.mjs`, `src/resources/editor/tools/yaml/web-worker.js` (regenerated by `dev-call build-artifacts`), `.claude/rules/typescript/deno-ral.md`, `tools/runtime-boundary-baseline.json`.

### Acceptance criteria

- `grep -rn 'Deno\.\(version\|consoleSize\|inspect\|uid\|noColor\|build\|permissions\)' src tests package/src --include=*.ts | grep -v '^src/deno_ral/platform.ts' | grep -v extension-subtrees | grep -v 'compile-quarto-latexmk.ts'` prints nothing.
- `grep -rn 'import\.meta\.main' src/quarto.ts src/command package/src --include=*.ts | grep -v 'render/latexmk/quarto-latexmk.ts'` prints nothing.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts unit/tools/tinytex-writable.test.ts` passes.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/check/ -name '*.test.ts') unit/project/project-detect-denied-path.test.ts smoke/project/project-detect-denied-config.test.ts unit/chrome-launch.test.ts smoke/create/create.test.ts` passes.
- `package/dist/bin/quarto check` still prints `Deno version 2.7.14: OK` (or the version PR 00a pinned); `package/dist/bin/quarto --version` still works (proves `isMainModule` is true for the entry module); `package/src/quarto-bld --help` still lists commands (proves `bld.ts`).
- `quarto install tinytex` behaviour unchanged: no new exit path; the prerequisite returns `true` (Task 3 step 4).
- `grep -n 'Deno\.' src/resources/editor/tools/vs-code.mjs src/resources/editor/tools/yaml/web-worker.js` prints nothing after `dev-call build-artifacts`.
- Baselines lower for `src`, `resources` (the two regenerated editor bundles, 1 each), `package/src`, `tests`.

## Plan

### Task 1: `platform.ts` extension and `main.ts`, with a unit test

**Files:**
- Modify: `src/deno_ral/platform.ts`
- Create: `src/deno_ral/main.ts`
- Create: `tests/unit/ral/platform.test.ts`, `tests/unit/ral/fixtures/main-entry.ts`, `tests/unit/ral/fixtures/main-importer.ts`

- [ ] **Step 1: Write the fixtures**

`tests/unit/ral/fixtures/main-entry.ts`:

```ts
/*
 * main-entry.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Fixture for tests/unit/ral/platform.test.ts: prints whether this module
 * is the entry module.
 */

import { isMainModule } from "../../../../src/deno_ral/main.ts";

console.log(`entry:main=${isMainModule(import.meta)}`);
```

`tests/unit/ral/fixtures/main-importer.ts`:

```ts
/*
 * main-importer.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Fixture for tests/unit/ral/platform.test.ts: imports main-entry.ts, so
 * that module is not the entry when this one is run.
 */

import "./main-entry.ts";
import { isMainModule } from "../../../../src/deno_ral/main.ts";

console.log(`importer:main=${isMainModule(import.meta)}`);
```

- [ ] **Step 2: Write the failing test**

```ts
/*
 * platform.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Contract for src/deno_ral/platform.ts and main.ts on every runtime (PR 27b
 * reruns it on Node).
 */

import { assert, assertEquals, assertMatch } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import {
  arch,
  consoleColumns,
  inspect,
  isRootUser,
  isWindows,
  noColor,
  os,
  runtime,
} from "../../../src/deno_ral/platform.ts";
import { isMainModule } from "../../../src/deno_ral/main.ts";
import { fromFileUrl } from "../../../src/deno_ral/path.ts";
import { exec, execPath } from "../../../src/deno_ral/process.ts";

// Runs a fixture as the entry module with the runtime running this test.
async function runFixture(name: string): Promise<string[]> {
  const script = fromFileUrl(new URL(`./fixtures/${name}`, import.meta.url));
  const args = runtime().name === "deno"
    ? ["run", "--no-lock", "--allow-all", script]
    : [script]; // Node strips types by default from 23.6 / 22.18
  const out = await exec(execPath(), { args });
  const decoder = new TextDecoder();
  assert(out.success, decoder.decode(out.stderr));
  return decoder.decode(out.stdout).trim().split(/\r?\n/);
}

unitTest("platform - runtime() detects the running runtime", async () => {
  const rt = runtime();
  const g = globalThis as { Deno?: { version?: { deno?: string } } };
  const denoVersion = g.Deno?.version?.deno;
  if (denoVersion !== undefined) {
    assertEquals(rt, { name: "deno", version: denoVersion });
  } else {
    assert(rt.name === "node" || rt.name === "bun", rt.name);
  }
  assertMatch(rt.version, /^\d+\.\d+\.\d+/);
  await Promise.resolve();
});

unitTest("platform - os and arch are the known values", async () => {
  assert(["windows", "darwin", "linux"].includes(os), os);
  assert(["x86_64", "aarch64"].includes(arch), arch);
  assertEquals(isWindows, os === "windows");
  await Promise.resolve();
});

unitTest("platform - consoleColumns never throws and is undefined or positive", async () => {
  const cols = consoleColumns();
  assert(cols === undefined || cols > 0, String(cols));
  await Promise.resolve();
});

unitTest("platform - inspect renders nested objects like a debugger would", async () => {
  const s = inspect({ a: 1, b: { c: "x" } });
  assert(s.includes("a: 1"), s);
  assert(s.includes('c: "x"') || s.includes("c: 'x'"), s);
  const shallow = inspect({ a: { b: { c: { d: 1 } } } }, { depth: 1 });
  assert(!shallow.includes("d: 1"), shallow);
  await Promise.resolve();
});

unitTest("platform - isRootUser is boolean and false on Windows", async () => {
  const root = isRootUser();
  assertEquals(typeof root, "boolean");
  if (isWindows) assertEquals(root, false);
  await Promise.resolve();
});

unitTest("platform - noColor is boolean", async () => {
  assertEquals(typeof noColor(), "boolean");
  await Promise.resolve();
});

unitTest("main - isMainModule reads meta.main and rejects non-file URLs", async () => {
  assertEquals(isMainModule({ main: true } as unknown as ImportMeta), true);
  assertEquals(isMainModule({ main: false } as unknown as ImportMeta), false);
  assertEquals(
    isMainModule({ url: "file:///nonexistent/rt19-not-main.ts" } as unknown as ImportMeta),
    false,
  );
  assertEquals(isMainModule({ url: "https://example.com/x.ts" } as unknown as ImportMeta), false);
  await Promise.resolve();
});

unitTest("main - isMainModule is true for the entry module only", async () => {
  assertEquals(await runFixture("main-entry.ts"), ["entry:main=true"]);
  assertEquals(await runFixture("main-importer.ts"), [
    "entry:main=false",
    "importer:main=true",
  ]);
});
```

(`inspect` accepts both quote styles because `util.inspect` on Node prints `'x'`.)

- [ ] **Step 3: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts` Expected: type-check errors `Module '"../../../src/deno_ral/platform.ts"' has no exported member 'runtime'` and `Module not found ".../src/deno_ral/main.ts"`.

- [ ] **Step 4: Implement**

Replace `src/deno_ral/platform.ts` with:

```ts
/*
 * platform.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 *
 * Platform and runtime facts. The only module that may read Deno.build,
 * Deno.version, Deno.consoleSize, Deno.uid, Deno.noColor, Deno.inspect.
 */

export const isWindows = Deno.build.os === "windows";
export const isMac = Deno.build.os === "darwin";
export const isLinux = Deno.build.os === "linux";

export const os = Deno.build.os;

export const arch = Deno.build.arch;

export function runtime(): { name: "deno" | "node" | "bun"; version: string } {
  const g = globalThis as {
    Deno?: { version?: { deno?: string } };
    process?: { versions?: Record<string, string | undefined> };
  };
  if (typeof g.Deno !== "undefined" && "version" in g.Deno) {
    return { name: "deno", version: g.Deno.version?.deno ?? "unknown" };
  }
  const versions = g.process?.versions ?? {};
  if (versions.bun !== undefined) {
    return { name: "bun", version: versions.bun };
  }
  return { name: "node", version: versions.node ?? "unknown" };
}

export function consoleColumns(): number | undefined {
  try {
    // Throws when stdout is not a terminal ("Inappropriate ioctl for device").
    return Deno.consoleSize().columns;
  } catch {
    return undefined;
  }
}

export function inspect(
  value: unknown,
  options?: { depth?: number; colors?: boolean },
): string {
  return Deno.inspect(value, {
    depth: options?.depth ?? 4,
    colors: options?.colors ?? false,
  });
}

export function isRootUser(): boolean {
  // Deno.uid() is null on Windows.
  return Deno.uid() === 0;
}

export function noColor(): boolean {
  return Deno.noColor;
}
```

Create `src/deno_ral/main.ts`:

```ts
/*
 * main.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import process from "node:process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * True when `meta` is the entry module's import.meta, replacing the
 * `if (import.meta.main)` idiom, on Deno and Node. Deno (and Node 24.2+) set
 * `import.meta.main`; when it is defined it is the answer. Otherwise the
 * module's path is compared with `process.argv[1]`, both through `realpath`
 * so a symlinked launcher still matches. (`node:` imports resolve on Deno
 * too, so this module has no runtime branch.)
 *
 * Caveat: in a single-file bundle every inlined module sees the bundle's
 * import.meta, so this is true in all of them. Within the CLI bundle only
 * src/quarto.ts may call it.
 */
export function isMainModule(meta: ImportMeta): boolean {
  const main = (meta as { main?: boolean }).main;
  if (main !== undefined) {
    return main === true;
  }
  const entry = process.argv[1];
  if (!entry || !meta.url?.startsWith("file:")) {
    return false;
  }
  return canonical(fileURLToPath(meta.url)) === canonical(entry);
}

function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
```

- [ ] **Step 5: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts` Expected: `........` then `ok | 8 passed | 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add src/deno_ral/platform.ts src/deno_ral/main.ts tests/unit/ral/platform.test.ts tests/unit/ral/fixtures/main-entry.ts tests/unit/ral/fixtures/main-importer.ts
git commit -m "deno_ral: runtime() detection, consoleColumns(), inspect(), isRootUser(), noColor(); main.ts isMainModule()"
```

### Task 2: `src/` call sites that import the layer directly

**Files:** `src/command/check/check.ts`, `src/core/log.ts`, `src/publish/confluence/confluence-logger.ts`, `src/deno_ral/fs.ts`, `src/tools/impl/tinytex-info.ts`, `src/core/resources.ts`, `src/quarto.ts`

- [ ] **Step 1: `check.ts:274`**

Add to the imports: `import { runtime } from "../../deno_ral/platform.ts";` and replace line 274:

```ts
  const denoVersion = runtime().version;
```

Leave line 305 (`[denoVersion, "2.7.14", "Deno"]`) as is; PR 34 turns it into a runtime row.

- [ ] **Step 2: `log.ts:490-497`**

Add `consoleColumns` to the existing `../deno_ral/platform.ts` import (or add the import if the file has none) and replace the function:

```ts
const getColumns = () => {
  return consoleColumns() ?? 130;
};
```

- [ ] **Step 3: `confluence-logger.ts`**

```ts
import { debug, error, info, warning } from "../../deno_ral/log.ts";
import { inspect } from "../../deno_ral/platform.ts";
```

Line 17:

```ts
  logger[level](`${prefixedMessage} ${inspect(value)}`);
```

- [ ] **Step 4: `src/deno_ral/fs.ts:182,196`**

Add `import { isWindows } from "./platform.ts";` and replace both `if (Deno.build.os !== "windows") {` with `if (!isWindows) {`.

- [ ] **Step 5: `tinytex-info.ts:56` and `resources.ts:33-37`**

`tinytex-info.ts`: add `arch` to its `../../deno_ral/platform.ts` import; line 56: `` const linuxPath = join(basePath, `bin/${arch}-linux`); ``

`resources.ts`: add `import { arch } from "../deno_ral/platform.ts";`; lines 33–37:

```ts
export function architectureToolsPath(binary: string) {
  const archBinaryPath = join(arch, binary);
  return toolsPath(binary, archBinaryPath);
}
```

- [ ] **Step 6: `src/quarto.ts:220`**

Add `import { isMainModule } from "./deno_ral/main.ts";` and replace `if (import.meta.main) {` with `if (isMainModule(import.meta)) {`.

- [ ] **Step 7: Type-check and smoke**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` Expected: exit 0.

Run: `package/dist/bin/quarto --version` → prints the dev version (`99.9.9`).
`package/dist/bin/quarto check 2>&1 | grep 'Deno version'` → `      Deno version 2.7.14: OK` (the pinned version).

- [ ] **Step 8: Commit**

```bash
git add src/command/check/check.ts src/core/log.ts src/publish/confluence/confluence-logger.ts src/deno_ral/fs.ts src/tools/impl/tinytex-info.ts src/core/resources.ts src/quarto.ts
git commit -m "replace Deno.version/consoleSize/inspect/build and import.meta.main with deno_ral platform/main"
```

### Task 3: `tinytex.ts`: `Deno.build.arch` and a non-blocking write probe

**Files:**
- Create: `tests/unit/tools/tinytex-writable.test.ts`
- Modify: `src/tools/impl/tinytex.ts:63-72,266,630-634`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * tinytex-writable.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { isDirWritable, tinyTexInstallable } from "../../../src/tools/impl/tinytex.ts";
import { chmodSync, removeSync } from "../../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { isRootUser, isWindows } from "../../../src/deno_ral/platform.ts";

unitTest("tinytex - isDirWritable probes the file system", async () => {
  const dir = makeTempDirSync({ prefix: "quarto-writable" });
  try {
    assertEquals(isDirWritable(dir), true);
    assertEquals(isDirWritable(`${dir}/missing`), false);
  } finally {
    removeSync(dir, { recursive: true });
  }
  await Promise.resolve();
});

unitTest(
  "tinytex - a read-only directory is not writable",
  async () => {
    const dir = makeTempDirSync({ prefix: "quarto-readonly" });
    try {
      chmodSync(dir, 0o555);
      assertEquals(isDirWritable(dir), false);
    } finally {
      chmodSync(dir, 0o755);
      removeSync(dir, { recursive: true });
    }
    await Promise.resolve();
  },
  // chmod does not restrict root, and Windows ignores the mode bits.
  { ignore: isWindows || isRootUser() },
);

unitTest("tinytex - the macOS bin-dir prerequisite never blocks an install", async () => {
  for (const prereq of tinyTexInstallable.prereqs) {
    // deno-lint-ignore no-explicit-any
    assertEquals(await prereq.check({} as any), true);
  }
});
```

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/tinytex-writable.test.ts` Expected: type-check error `Module '"../../../src/tools/impl/tinytex.ts"' has no exported member 'isDirWritable'`.

- [ ] **Step 2: Line 266**

Add `arch` to the file's `platform.ts` import and change the template to `` `${arch}-${platformOs}` ``.

- [ ] **Step 3: Replace `isWritable` (lines 630–634) and the prerequisite (lines 63–72)**

Add `import { makeTempFileSync } from "../../deno_ral/temp.ts";` and `removeSync` to the existing `../../deno_ral/fs.ts` import, then replace `isWritable` with:

```ts
// True when this process can create a file in `dir`. Replaces a runtime
// permissions query that always answered "granted" under --allow-all.
export function isDirWritable(dir: string): boolean {
  try {
    const probe = makeTempFileSync({ dir, prefix: ".quarto-write-probe-" });
    removeSync(probe);
    return true;
  } catch {
    return false;
  }
}
```

and the prerequisite with:

```ts
  prereqs: [{
    check: () => {
      // Never blocks: the old permissions query always passed, and
      // afterInstall already falls back to other bin directories and warns
      // when none works (see the "Updating Path" step below).
      if (!isDirWritable("/usr/local/bin")) {
        warning(
          "/usr/local/bin is not writable; TinyTeX will try other directories on your PATH for its commands.",
        );
      }
      return Promise.resolve(true);
    },
    os: ["darwin"],
    message: "The directory /usr/local/bin is not writable.",
  }],
```

(`warning` is already imported from `../../deno_ral/log.ts` at line 6.
`InstallPreReq.check` is `(context: InstallContext) => Promise<boolean>`, `src/tools/types.ts:31`.)

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/tools/ -name '*.test.ts')` Expected: `ok | N passed | 0 failed` (the read-only case is ignored on Windows and as root).

- [ ] **Step 5: Commit**

```bash
git add src/tools/impl/tinytex.ts tests/unit/tools/tinytex-writable.test.ts
git commit -m "tinytex: real write probe instead of Deno.permissions, warning only; arch from platform.ts"
```

No changelog entry: an install that worked keeps working; the new warning only appears where `/usr/local/bin` is not writable, and the install proceeds exactly as before.

### Task 4: Browser-shared modules under `src/core/lib/`

These two files run in the browser (YAML intelligence web worker) and must not import `src/deno_ral/`; they probe globals.

**Files:** `src/core/lib/external/colors.ts:25-35`, `src/core/lib/errors.ts:25-41`, the two regenerated editor bundles

- [ ] **Step 1: `colors.ts` lines 25–35**

```ts
// Runtime-neutral probe: Deno exposes `noColor`; Node (and browsers running
// this module) fall back to the NO_COLOR convention. Written with optional
// chaining on the global so the runtime-boundary check does not count it.
const runtimeGlobals = globalThis as unknown as {
  Deno?: { noColor?: boolean };
  process?: { env?: Record<string, string | undefined> };
};
const noColor = typeof runtimeGlobals.Deno?.noColor === "boolean"
  ? runtimeGlobals.Deno.noColor
  : runtimeGlobals.process?.env !== undefined
  ? runtimeGlobals.process.env.NO_COLOR !== undefined
  : true;
```

The final branch keeps the previous default (`true` when no runtime info is available, i.e. in the browser colours stay off).

Delete the old lines 25–35 (`let Deno: any; try { Deno = globalThis.Deno } ...` and the `const noColor = ...` that followed).

- [ ] **Step 2: `errors.ts` lines 25–41**

```ts
function platformHasNonAsciiCharacters(): boolean {
  // This module is shared with browser code, so it cannot import
  // deno_ral/platform.ts; probe the runtime globals instead and assume a
  // browser (non-ASCII is fine) when neither is present.
  const g = globalThis as unknown as {
    Deno?: { build?: { os?: string } };
    process?: { platform?: string };
  };
  if (g.Deno?.build?.os !== undefined) {
    return g.Deno.build.os !== "windows";
  }
  if (g.process?.platform !== undefined) {
    return g.process.platform !== "win32";
  }
  return true;
}
```

- [ ] **Step 3: Regenerate the editor bundles and verify**

Run: `grep -n 'Deno\.' src/core/lib/external/colors.ts src/core/lib/errors.ts` → nothing (the probes use `Deno?.`).
Run: `package/dist/bin/quarto dev-call build-artifacts` Run: `git diff --stat src/resources/editor` Expected: `vs-code.mjs` and `yaml/web-worker.js` change only in the two probe functions (`git diff src/resources/editor | grep '^[-+]' | grep -v '^[-+][-+]'` shows only lines from those functions); `grep -n 'Deno\.' src/resources/editor/tools/vs-code.mjs src/resources/editor/tools/yaml/web-worker.js` prints nothing.

- [ ] **Step 4: Commit**

```bash
git add src/core/lib/external/colors.ts src/core/lib/errors.ts src/resources/editor
git commit -m "core/lib: probe runtime globals for noColor and platform without Deno.* member access"
```

### Task 5: `package/src`

**Files:** `package/src/common/config.ts:100`, `package/src/bld.ts:55`, `package/src/common/import-report/*.ts`

- [ ] **Step 1: `config.ts:100`**

Add `import { arch as hostArch } from "../../../src/deno_ral/platform.ts";` (the file already has a local variable `arch`, hence the alias) and change line 100 to:

```ts
  const cmdArch = arch || getEnv("QUARTO_OS", hostArch);
```

- [ ] **Step 2: `import.meta.main` in `bld.ts:55` and the six import-report scripts**

In each file add `import { isMainModule } from "<rel>/src/deno_ral/main.ts";` (`bld.ts`: `../../src/deno_ral/main.ts`; files under `package/src/common/import-report/`: `../../../../src/deno_ral/main.ts`) and replace `if (import.meta.main) {` with `if (isMainModule(import.meta)) {`.
These are separate entry points run with `quarto run --dev`/`deno run`, never bundled, so the bundle caveat does not apply.

- [ ] **Step 3: Verify `quarto-bld` still dispatches**

Run: `package/src/quarto-bld --help | head -5` → prints the command list (`configure`, `update-html-dependencies`, ...).
Run: `package/dist/bin/quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts | head -3` → the report starts (output may be empty when nothing is bad; exit code 0).
Run: `grep -rn 'import\.meta\.main\|Deno\.build' package/src --include=*.ts | grep -v compile-quarto-latexmk.ts` → nothing.

- [ ] **Step 4: Commit**

```bash
git add package/src/common/config.ts package/src/bld.ts package/src/common/import-report
git commit -m "package/src: isMainModule and platform.ts instead of import.meta.main / Deno.build"
```

### Task 6: `tests/`

**Files:** `tests/utils.ts:283`, `tests/unit/project/project-detect-denied-path.test.ts:51`, `tests/smoke/project/project-detect-denied-config.test.ts:24`, `tests/unit/chrome-launch-fixtures.ts:36`, `tests/smoke/typst-gather/typst-gather.test.ts:472`, `tests/smoke/issues/9133/9133.test.ts:3`, `tests/smoke/create/create.test.ts:74`

- [ ] **Step 1: `Deno.uid()` → `isRootUser()`**

`tests/utils.ts`: add `isRootUser` to the existing `../src/deno_ral/platform.ts` import (line 13); line 283: `export const canMakeUnreadableDir = isWindows || !isRootUser();`

`project-detect-denied-path.test.ts:51`: import `isRootUser` from `../../../src/deno_ral/platform.ts`; `const ignore = isWindows || isRootUser();`

`project-detect-denied-config.test.ts:24`: import `isRootUser` from `../../../src/deno_ral/platform.ts`; `if (!isWindows && !isRootUser()) {`

- [ ] **Step 2: `Deno.build.os === "windows"` → `isWindows`**

In each of `chrome-launch-fixtures.ts:36`, `typst-gather.test.ts:472`, `9133.test.ts:3` (`!== "windows"` → `!isWindows`), `create.test.ts:74`, add `import { isWindows } from "<rel>/src/deno_ral/platform.ts";` when absent (`grep -n isWindows <file>` first) and substitute.

- [ ] **Step 3: Run the touched tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/project-detect-denied-path.test.ts smoke/project/project-detect-denied-config.test.ts unit/chrome-launch.test.ts smoke/issues/9133/9133.test.ts smoke/create/create.test.ts smoke/typst-gather/typst-gather.test.ts` Expected: `ok | N passed | 0 failed` (denied-path tests are ignored when running as root, as before).

- [ ] **Step 4: Commit**

```bash
git add tests/utils.ts tests/unit/project/project-detect-denied-path.test.ts tests/smoke/project/project-detect-denied-config.test.ts tests/unit/chrome-launch-fixtures.ts tests/smoke/typst-gather/typst-gather.test.ts tests/smoke/issues/9133/9133.test.ts tests/smoke/create/create.test.ts
git commit -m "tests: isRootUser()/isWindows from platform.ts instead of Deno.uid/Deno.build"
```

### Task 7: Ratchet and docs

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → lower counts for `src`, `resources` (−2), `package/src`, `tests`.
- [ ] **Step 2:** `.claude/rules/typescript/deno-ral.md` table: replace the `platform.ts` row and add `main.ts`:

```markdown
| `platform.ts` | Platform and runtime facts | `isWindows`, `isMac`, `isLinux`, `os`, `arch`, `runtime`, `consoleColumns`, `inspect`, `isRootUser`, `noColor` |
| `main.ts` | Entry-module detection (CLI bundle: `src/quarto.ts` only) | `isMainModule(import.meta)` |
```

- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet baseline after platform/main; document platform.ts and main.ts"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts $(find unit/tools/ -name '*.test.ts')` → pass (`platform.test.ts`: `ok | 8 passed | 0 failed`).
- The Task 6 test command → pass.
- `package/dist/bin/quarto check` → `Deno version <pinned>: OK` line present.
- `package/src/quarto-bld --help` → command list.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes.
- Acceptance greps empty.

## Review checklist

- [ ] `platform.ts` is the only file reading `Deno.version/consoleSize/inspect/uid/noColor/build` (plus the two guarded `Deno?.` probes in `core/lib`).
- [ ] `runtime()` detects through `globalThis` exactly as the vocabulary states; PR 27b only adds the shim marker.
- [ ] `inspect` defaults (`depth: 4`, `colors: false`) match `Deno.inspect`'s, so Confluence trace output is unchanged.
- [ ] The TinyTeX prerequisite always resolves `true`; the probe cleans up its temp file; no changelog entry.
- [ ] `isMainModule` is tested through child processes (entry vs imported), not by asserting on the test module; its docstring states the bundle caveat; within `src/` only `src/quarto.ts` calls it.
- [ ] `quarto-latexmk.ts` and `compile-quarto-latexmk.ts` untouched (PR 39 deletes them).
- [ ] No `tools/*.ts` or `src/resources/scripts/*.ts` touched (PR 35 territory).
- [ ] `src/resources/editor` bundle diff limited to the two probe functions.
- [ ] New tests use `tests/asserts.ts` and `deno_ral` temp/fs/process; no `Deno.`.

## Risks and rollback

- `isRootUser()` on Windows returns false where `Deno.uid()` returned `null`; the three tests compared against `0`, so semantics are preserved.
- The fixture-based `isMainModule` test needs the runtime to run a `.ts` file directly; on Node that is the default from 23.6/22.18 (type stripping), and PR 31's CI uses Node 26.
  Under Node 22.12–22.17 it would need `--experimental-strip-types`; not a supported configuration for the Node harness.
- The `colors.ts` rewrite changes nothing on Deno; in the browser bundle it keeps `noColor = true`.
- Rollback: revert the seven commits.

## Decisions needed

None.
Not changed because: the first draft made the TinyTeX `/usr/local/bin` prerequisite a real, blocking check and called it a fix; that would hard-exit installs that work today (review S8, `afterInstall` already handles a non-writable directory), so it is replaced by a warning-only probe that keeps today's outcome.
