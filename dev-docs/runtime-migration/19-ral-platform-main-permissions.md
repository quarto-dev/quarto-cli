# PR 19: `platform.ts` extension, `main.ts`, remove `Deno.permissions`; version/consoleSize/inspect/uid/noColor/build/import.meta.main

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `src/deno_ral/platform.ts` with `runtime()`, `consoleColumns()`, `inspect()`, `isRootUser()`, `noColor()`, add `src/deno_ral/main.ts` with `isMainModule(import.meta)`, and replace every `Deno.version`, `Deno.consoleSize`, `Deno.inspect`, `Deno.uid`, `Deno.noColor`, `Deno.build`, `import.meta.main` and `Deno.permissions` site in `src/`, `package/src` and `tests/` with the layer.
**Phase:** 1. **Depends on:** PR 08 (`args()`/`execPath()` in `process.ts`, used next to `isMainModule`), PR 02 (ratchet). **Unblocks:** PR 21, PR 25, PR 34.
**Branch:** `rt/19-ral-platform-main-permissions`.
**Suggested executor:** Sonnet. Every replacement is a one-line substitution with a known target; the only judgement call (the `isWritable` semantics) is decided below.
**Size:** S by nature of each edit but 23 files touched: 2 layer files, 1 test, 20 call-site files.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 3.3 row "`Deno.addSignalListener`, `Deno.consoleSize`, `Deno.execPath`, `Deno.build`, `Deno.inspect`, `Deno.uid`, `Deno.permissions`" and row `import.meta.main`; section 11 module plan rows `platform.ts` (extend with runtime name/version, `consoleColumns()`, `inspect()`), `main.ts` (`isMainModule(import.meta)`), `permissions` (remove; replace with a filesystem check). Signals, `execPath`, `args` are PR 08.

Verified sites (2026-10-14, `grep -rn 'Deno\.\(version\|consoleSize\|inspect\|uid\|noColor\|build\|permissions\)' src tests package/src tools --include=*.ts` and `grep -rn 'import\.meta\.main' ...`):

| API | Site | Replacement |
|---|---|---|
| `Deno.version.deno` | `src/command/check/check.ts:274` (and label `"Deno"` at 305) | `runtime().version`; label unchanged until PR 34 |
| `Deno.consoleSize().columns` | `src/core/log.ts:493` | `consoleColumns() ?? 130` |
| `Deno.inspect(value)` | `src/publish/confluence/confluence-logger.ts:17` | `inspect(value)` |
| `Deno.uid()` | `tests/utils.ts:283`, `tests/unit/project/project-detect-denied-path.test.ts:51`, `tests/smoke/project/project-detect-denied-config.test.ts:24` | `isRootUser()` |
| `Deno.noColor` | `src/core/lib/external/colors.ts:33-34` (browser-shared module; reads `globalThis.Deno` through an `any` local) | runtime-neutral global probe (Task 4) |
| `Deno.build.os` | `src/deno_ral/fs.ts:182,196`; `src/core/lib/errors.ts:33` (browser-shared); `tests/unit/chrome-launch-fixtures.ts:36`, `tests/smoke/typst-gather/typst-gather.test.ts:472`, `tests/smoke/issues/9133/9133.test.ts:3`, `tests/smoke/create/create.test.ts:74` | `isWindows` from `platform.ts` (errors.ts: global probe) |
| `Deno.build.arch` | `src/tools/impl/tinytex.ts:266`, `src/tools/impl/tinytex-info.ts:56`, `src/core/resources.ts:34`, `package/src/common/config.ts:100` | `arch` from `platform.ts` (already exported) |
| `Deno.build.target` | `package/src/common/compile-quarto-latexmk.ts:58,107` | local `denoCompileTarget()` built from `os`/`arch` (Task 5) |
| `Deno.build.*` in `src/resources/extension-subtrees/julia-engine/**` (4 sites) | subtree, out of scope | file upstream |
| `Deno.permissions.query({ name: "write", path })` | `src/tools/impl/tinytex.ts:630-634` (`isWritable`, used once at line 68 as a macOS prereq for `/usr/local/bin`) | real write probe (Task 5) |
| `import.meta.main` | `src/quarto.ts:220`, `src/command/render/latexmk/quarto-latexmk.ts:128`, `package/src/bld.ts:55`, `package/src/common/import-report/{explain-import-chain:148,find-bad-types-constants:22,explain-all-cycles:152,find-bad-imports:53,report-risky-files:45,report-bundle-async-cycles:800}.ts` | `isMainModule(import.meta)` |
| `import.meta.main` elsewhere | `src/resources/scripts/check-usage.ts:3`, `src/resources/scripts/empty.ts:1` (user-script fixtures run by `quarto run`, PR 35), `src/resources/tools/ast-diagram/main.ts:58` (dev tool run by `quarto run --dev`, PR 35), `tests/tools/check-gha-log.ts:114` (PR 23), `tools/render-all-formats.ts:136`, `tools/sass-variable-explainer/_attic/print-dependency-graph.ts:108` (dev tools, PR 35) | out of scope here |

About `isWritable`: under `--allow-all` (which every launcher passes) `Deno.permissions.query` always answers `"granted"`, so the prereq has been a no-op for years: on a Mac where `/usr/local/bin` is root-owned, `quarto install tinytex` proceeds and fails later in `tlmgr path add` with a permission error. The replacement probes the file system for real (create and remove a temp file in the directory), which makes the prereq message `The directory /usr/local/bin is not writable.` reachable. This is a behaviour improvement and gets a changelog entry.

### Scope

In: the table above (everything not marked out of scope), `main.ts`, unit test, rules doc, changelog line, baseline.
Out: subtree files; `quarto run` script fixtures and `tools/*.ts` dev scripts (PR 35 provides their runtime); `Deno.args`/`Deno.execPath`/signals (PR 08); the `"Deno"` label and the strict version `"2.7.14"` in `check.ts` (PR 34 adds the runtime row).

### Interfaces

`src/deno_ral/platform.ts` (extended; existing exports unchanged):

```ts
export const isWindows: boolean; export const isMac: boolean; export const isLinux: boolean; export const os: string; export const arch: string; // existing

/** Which JavaScript runtime is executing Quarto and its version (e.g. { name: "deno", version: "2.7.14" }). */
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

`src/deno_ral/main.ts` (new):

```ts
/** True when `meta` belongs to the module the process was started with
 * (the `if (import.meta.main)` idiom). Deno: `meta.main`. PR 28 adds the Node
 * branch (compare `meta.filename` with `process.argv[1]`). */
export function isMainModule(meta: ImportMeta): boolean;
```

`src/tools/impl/tinytex.ts` (changed, private):

```ts
/** True when a file can be created in `dir` by this process. */
function isWritable(dir: string): boolean;
```

### Files

- Modify: `src/deno_ral/platform.ts` (add 5 functions).
- Create: `src/deno_ral/main.ts`.
- Create: `tests/unit/deno-ral/platform.test.ts`.
- Modify: `src/command/check/check.ts:274`, `src/core/log.ts:493`, `src/publish/confluence/confluence-logger.ts:1,17`, `src/core/lib/external/colors.ts:25-35`, `src/core/lib/errors.ts:25-41`, `src/deno_ral/fs.ts:182,196`, `src/tools/impl/tinytex.ts:266,630-634`, `src/tools/impl/tinytex-info.ts:56`, `src/core/resources.ts:34`, `src/quarto.ts:220`, `src/command/render/latexmk/quarto-latexmk.ts:128`.
- Modify: `package/src/common/config.ts:100`, `package/src/common/compile-quarto-latexmk.ts:58,107`, `package/src/bld.ts:55`, six files under `package/src/common/import-report/`.
- Modify: `tests/utils.ts:283`, `tests/unit/project/project-detect-denied-path.test.ts:51`, `tests/smoke/project/project-detect-denied-config.test.ts:24`, `tests/unit/chrome-launch-fixtures.ts:36`, `tests/smoke/typst-gather/typst-gather.test.ts:472`, `tests/smoke/issues/9133/9133.test.ts:3`, `tests/smoke/create/create.test.ts:74`.
- Modify: `news/changelog-1.11.md`, `.claude/rules/typescript/deno-ral.md`, `tools/runtime-boundary-baseline.json`.

### Acceptance criteria

- `grep -rn 'Deno\.\(version\|consoleSize\|inspect\|uid\|noColor\|build\|permissions\)' src tests package/src --include=*.ts | grep -v '^src/deno_ral/platform.ts' | grep -v extension-subtrees` prints nothing.
- `grep -rn 'import\.meta\.main' src/quarto.ts src/command package/src` prints nothing.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/platform.test.ts` passes.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/ unit/project/project-detect-denied-path.test.ts smoke/project/project-detect-denied-config.test.ts unit/chrome-launch.test.ts smoke/create/create.test.ts` passes.
- `package/dist/bin/quarto check` still prints `Deno version 2.7.14: OK`; `package/dist/bin/quarto --version` still works (proves `isMainModule` is true for the entry module); `package/src/quarto-bld --help` still lists commands (proves `bld.ts`).
- Baseline lower for `src/`, `package/src`, `tests/`.

## Plan

### Task 1: `platform.ts` extension and `main.ts`, with a unit test

**Files:**
- Modify: `src/deno_ral/platform.ts`
- Create: `src/deno_ral/main.ts`
- Create: `tests/unit/deno-ral/platform.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * platform.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals, assertMatch } from "testing/asserts";
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

unitTest("platform - runtime() names the runtime and a semver-ish version", async () => {
  const rt = runtime();
  assert(["deno", "node", "bun"].includes(rt.name));
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
  assert(s.includes('c: "x"'), s);
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

unitTest("main - isMainModule is false for a test module and reads import.meta", async () => {
  // The test runner, not this file, is the entry module.
  assertEquals(isMainModule(import.meta), false);
  assertEquals(isMainModule({ main: true } as unknown as ImportMeta), true);
  await Promise.resolve();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/platform.test.ts`
Expected: type-check errors `Module '"../../../src/deno_ral/platform.ts"' has no exported member 'runtime'` and `Module not found ".../src/deno_ral/main.ts"`.

- [ ] **Step 3: Implement**

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
  return { name: "deno", version: Deno.version.deno };
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

/**
 * True when `meta` is the entry module's import.meta, replacing the
 * `if (import.meta.main)` idiom. Deno sets `import.meta.main`; Node does not,
 * and PR 28 adds that branch (compare meta.filename with process.argv[1]).
 */
export function isMainModule(meta: ImportMeta): boolean {
  return (meta as { main?: boolean }).main === true;
}
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/platform.test.ts`
Expected: `.......` then `ok | 7 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/platform.ts src/deno_ral/main.ts tests/unit/deno-ral/platform.test.ts
git commit -m "deno_ral: runtime(), consoleColumns(), inspect(), isRootUser(), noColor(); main.ts isMainModule()"
```

### Task 2: `src/` call sites that import the layer directly

**Files:** `src/command/check/check.ts`, `src/core/log.ts`, `src/publish/confluence/confluence-logger.ts`, `src/deno_ral/fs.ts`, `src/tools/impl/tinytex-info.ts`, `src/core/resources.ts`, `src/quarto.ts`, `src/command/render/latexmk/quarto-latexmk.ts`

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

- [ ] **Step 5: `tinytex-info.ts:56` and `resources.ts:34`**

`tinytex-info.ts`: add `arch` to its `../../deno_ral/platform.ts` import; line 56: `` const linuxPath = join(basePath, `bin/${arch}-linux`); ``

`resources.ts`: add `import { arch } from "../deno_ral/platform.ts";`; lines 33–37:

```ts
export function architectureToolsPath(binary: string) {
  const archBinaryPath = join(arch, binary);
  return toolsPath(binary, archBinaryPath);
}
```

- [ ] **Step 6: `src/quarto.ts:220` and `quarto-latexmk.ts:128`**

Both: add `import { isMainModule } from "<rel>/deno_ral/main.ts";` (`./deno_ral/main.ts` from `src/quarto.ts`, `../../../deno_ral/main.ts` from `src/command/render/latexmk/quarto-latexmk.ts`) and replace `if (import.meta.main) {` with `if (isMainModule(import.meta)) {`.

- [ ] **Step 7: Type-check and smoke**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: exit 0.

Run: `package/dist/bin/quarto --version` → prints the dev version (`99.9.9`). `package/dist/bin/quarto check 2>&1 | grep 'Deno version'` → `      Deno version 2.7.14: OK`. `package/dist/bin/quarto render tests/docs/smoke-all/2023/05/24/5657-raw.qmd --to pdf` exercises `quarto-latexmk`'s shared code (the `isMainModule` branch is only hit by the standalone binary; the import compiles either way).

- [ ] **Step 8: Commit**

```bash
git add src/command/check/check.ts src/core/log.ts src/publish/confluence/confluence-logger.ts src/deno_ral/fs.ts src/tools/impl/tinytex-info.ts src/core/resources.ts src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts
git commit -m "replace Deno.version/consoleSize/inspect/build and import.meta.main with deno_ral platform/main"
```

### Task 3: `tinytex.ts`: `Deno.build.arch` and the write probe

**Files:** `src/tools/impl/tinytex.ts:266,630-634`

- [ ] **Step 1: Line 266**

Add `arch` to the file's `platform.ts` import and change the template to `` `${arch}-${platformOs}` ``.

- [ ] **Step 2: Replace `isWritable` (lines 630–634)**

```ts
// True when this process can create a file in `dir`. Replaces a
// Deno.permissions query that always answered "granted" under --allow-all,
// which made the macOS /usr/local/bin prerequisite a no-op.
function isWritable(dir: string): boolean {
  try {
    const probe = Deno.makeTempFileSync({ dir, prefix: ".quarto-write-probe-" });
    Deno.removeSync(probe);
    return true;
  } catch {
    return false;
  }
}
```

(If PR 09/13 already landed, use `makeTempFileSync` from `src/deno_ral/temp.ts` and `removeSync` from `src/deno_ral/fs.ts` instead of the `Deno.` forms; do not add new `Deno.` calls to a file the codemod already cleaned.)

`InstallPreReq.check` (`src/tools/types.ts:31`) is typed `(context: InstallContext) => Promise<boolean>`, so the prereq at lines 66–69 becomes:

```ts
    check: () => {
      // bin must be writable on MacOS
      return Promise.resolve(isWritable("/usr/local/bin"));
    },
```

- [ ] **Step 3: Changelog**

Append to `news/changelog-1.11.md` under the `## Other fixes and improvements` (or equivalent) heading, following `.claude/rules/changelog.md`:

```markdown
- `quarto install tinytex` on macOS now really checks that `/usr/local/bin` is writable before installing, instead of always assuming it is.
```

- [ ] **Step 4: Type-check and test**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/` → pass.
Manual on macOS only: `sudo chown root /usr/local/bin && package/dist/bin/quarto install tinytex` → prints `The directory /usr/local/bin is not writable.` and stops; restore ownership afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/tools/impl/tinytex.ts news/changelog-1.11.md
git commit -m "tinytex: real write probe for /usr/local/bin instead of Deno.permissions; arch from platform.ts"
```

### Task 4: Browser-shared modules under `src/core/lib/`

These two files run in the browser (YAML intelligence web worker) and must not import `src/deno_ral/`; they probe globals.

**Files:** `src/core/lib/external/colors.ts:25-35`, `src/core/lib/errors.ts:25-41`

- [ ] **Step 1: `colors.ts` lines 25–35**

```ts
// Runtime-neutral probe: Deno exposes `noColor`; Node (and browsers running
// this module) fall back to the NO_COLOR convention. Written without a
// `Deno.` member expression so the runtime-boundary check does not count it.
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

- [ ] **Step 3: Verify the ratchet no longer counts them and the YAML intelligence bundle still builds**

Run: `grep -n 'Deno\.' src/core/lib/external/colors.ts src/core/lib/errors.ts` → nothing (the probes use `Deno?.`).
Run: `package/dist/bin/quarto dev-call build-artifacts` → completes; `git status --short src/resources/editor` shows no diff (the web-worker bundle is byte-identical except for these two functions; if it differs only there, commit it).

- [ ] **Step 4: Commit**

```bash
git add src/core/lib/external/colors.ts src/core/lib/errors.ts src/resources/editor
git commit -m "core/lib: probe runtime globals for noColor and platform without Deno.* member access"
```

### Task 5: `package/src`

**Files:** `package/src/common/config.ts:100`, `package/src/common/compile-quarto-latexmk.ts:58,107`, `package/src/bld.ts:55`, `package/src/common/import-report/*.ts`

- [ ] **Step 1: `config.ts:100`**

Add `import { arch as hostArch } from "../../../src/deno_ral/platform.ts";` (the file already has a local variable `arch`, hence the alias) and change line 100 to:

```ts
  const cmdArch = arch || getEnv("QUARTO_OS", hostArch);
```

- [ ] **Step 2: `compile-quarto-latexmk.ts`**

Add near the top:

```ts
import { arch, os } from "../../../src/deno_ral/platform.ts";

// The Rust-style target triple `deno compile --target` expects for the host.
// Replaces Deno.build.target, which has no equivalent outside Deno.
function denoCompileTarget(): string {
  const cpu = arch === "aarch64" ? "aarch64" : "x86_64";
  switch (os) {
    case "windows":
      return `${cpu}-pc-windows-msvc`;
    case "darwin":
      return `${cpu}-apple-darwin`;
    default:
      return `${cpu}-unknown-linux-gnu`;
  }
}
```

Lines 58 and 107: replace `Deno.build.target` with `denoCompileTarget()`.

- [ ] **Step 3: `import.meta.main` in `bld.ts:55` and the six import-report scripts**

In each file add `import { isMainModule } from "../../../src/deno_ral/main.ts";` (`bld.ts`: `../../src/deno_ral/main.ts`; files under `package/src/common/import-report/`: `../../../../src/deno_ral/main.ts`) and replace `if (import.meta.main) {` with `if (isMainModule(import.meta)) {`.

- [ ] **Step 4: Verify `quarto-bld` still dispatches**

Run: `package/src/quarto-bld --help | head -5` → prints the command list (`configure`, `update-html-dependencies`, ...).
Run: `package/dist/bin/tools/x86_64/deno run --allow-all --import-map=src/import_map.json package/src/common/import-report/find-bad-imports.ts src/quarto.ts | head -3` → the report starts (output may be empty when nothing is bad; exit code 0).
Run: `grep -rn 'import\.meta\.main\|Deno\.build' package/src --include=*.ts` → nothing.

- [ ] **Step 5: Commit**

```bash
git add package/src/common/config.ts package/src/common/compile-quarto-latexmk.ts package/src/bld.ts package/src/common/import-report
git commit -m "package/src: isMainModule and platform.ts instead of import.meta.main / Deno.build"
```

### Task 6: `tests/`

**Files:** `tests/utils.ts:283`, `tests/unit/project/project-detect-denied-path.test.ts:51`, `tests/smoke/project/project-detect-denied-config.test.ts:24`, `tests/unit/chrome-launch-fixtures.ts:36`, `tests/smoke/typst-gather/typst-gather.test.ts:472`, `tests/smoke/issues/9133/9133.test.ts:3`, `tests/smoke/create/create.test.ts:74`

- [ ] **Step 1: `Deno.uid()` → `isRootUser()`**

`tests/utils.ts`: add `isRootUser` to the existing `../src/deno_ral/platform.ts` import (line 13); line 283: `export const canMakeUnreadableDir = isWindows || !isRootUser();`

`project-detect-denied-path.test.ts:51`: import `isRootUser` from `../../../src/deno_ral/platform.ts`; `const ignore = isWindows || isRootUser();`

`project-detect-denied-config.test.ts:24`: import `isRootUser` from `../../../src/deno_ral/platform.ts`; `if (!isWindows && !isRootUser()) {`

- [ ] **Step 2: `Deno.build.os === "windows"` → `isWindows`**

In each of `chrome-launch-fixtures.ts:36`, `typst-gather.test.ts:472`, `9133.test.ts:3` (`!== "windows"` → `!isWindows`), `create.test.ts:74`, add `import { isWindows } from "<rel>/src/deno_ral/platform.ts";` when absent (`grep -n isWindows <file>` first; `typst-gather.test.ts` and `create.test.ts` may already import it) and substitute.

- [ ] **Step 3: Run the touched tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/project-detect-denied-path.test.ts smoke/project/project-detect-denied-config.test.ts unit/chrome-launch.test.ts smoke/issues/9133/9133.test.ts smoke/create/create.test.ts smoke/typst-gather/typst-gather.test.ts`
Expected: `ok | N passed | 0 failed` (denied-path tests are ignored when running as root, as before).

- [ ] **Step 4: Commit**

```bash
git add tests/utils.ts tests/unit/project/project-detect-denied-path.test.ts tests/smoke/project/project-detect-denied-config.test.ts tests/unit/chrome-launch-fixtures.ts tests/smoke/typst-gather/typst-gather.test.ts tests/smoke/issues/9133/9133.test.ts tests/smoke/create/create.test.ts
git commit -m "tests: isRootUser()/isWindows from platform.ts instead of Deno.uid/Deno.build"
```

### Task 7: Ratchet and docs

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → lower counts for `src/`, `package/src`, `tests/`.
- [ ] **Step 2:** `.claude/rules/typescript/deno-ral.md` table: replace the `platform.ts` row and add `main.ts`:

```markdown
| `platform.ts` | Platform and runtime facts | `isWindows`, `isMac`, `isLinux`, `os`, `arch`, `runtime`, `consoleColumns`, `inspect`, `isRootUser`, `noColor` |
| `main.ts` | Entry-module detection | `isMainModule(import.meta)` |
```

- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet baseline after platform/main; document platform.ts and main.ts"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/platform.test.ts` → `ok | 7 passed | 0 failed`.
- The Task 6 test command → pass.
- `package/dist/bin/quarto check` → `Deno version 2.7.14: OK` line present.
- `package/src/quarto-bld --help` → command list.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes.
- Acceptance greps empty.

## Review checklist

- [ ] `platform.ts` is the only file reading `Deno.version/consoleSize/inspect/uid/noColor/build` (plus the two guarded `Deno?.` probes in `core/lib`).
- [ ] `inspect` defaults (`depth: 4`, `colors: false`) match `Deno.inspect`'s, so Confluence trace output is unchanged.
- [ ] `isWritable` is a real probe and cleans up its temp file; changelog entry present.
- [ ] `denoCompileTarget()` yields the same triples `Deno.build.target` gave on CI runners (`x86_64-unknown-linux-gnu`, `x86_64-apple-darwin`, `aarch64-apple-darwin`, `x86_64-pc-windows-msvc`).
- [ ] No `tools/*.ts` or `src/resources/scripts/*.ts` touched (PR 35 territory).
- [ ] `src/resources/editor` bundle diff, if any, limited to the two probe functions.

## Risks and rollback

- `isRootUser()` on Windows returns false where `Deno.uid()` returned `null`; the three tests compared against `0`, so semantics are preserved.
- If `InstallableTool.prereqs[].check` is typed as returning `Promise<boolean>` only, the sync `isWritable` must be wrapped (Task 3 step 2 covers it).
- The `colors.ts` rewrite changes nothing on Deno; in the browser bundle it keeps `noColor = true`.
- Rollback: revert the seven commits.

## Decisions needed

None.
