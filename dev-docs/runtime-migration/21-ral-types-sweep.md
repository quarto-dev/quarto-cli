# PR 21: Replace the remaining `Deno.*` type references in signatures

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every `Deno.<Type>` used in a type position in `src/`, `package/src` and `tests/` with the corresponding type exported by `src/deno_ral/`, so that no signature outside the layer mentions a Deno type.
**Phase:** 1. **Depends on:** PR 08 (`ExitStatus`, `ExecOutput`, `ChildProcess`, `SpawnOptions`), PR 09 (`FileInfo`, `TempOptions`), PR 15 (`TcpConnection`), PR 17 (`FsEvent`), PR 18 (`KeyValueStore`), PR 02. **Unblocks:** PR 25.
**Branch:** `rt/21-ral-types-sweep`.
**Suggested executor:** Sonnet. Each site is a one-token type substitution whose target is fixed by the vocabulary; the only work is checking which sites earlier PRs already consumed.
**Size:** S. Up to 7 files and 14 sites if every earlier PR left its rows behind; typically a handful or none.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 11, design rule 3: Deno-specific types leak into signatures today (45 sites listed as `Deno.MakeTempOptions`, `Deno.Conn`, `Deno.CommandOutput`, `Deno.Kv`, `Deno.FsEvent`, `Deno.FileInfo`, `Deno.ChildProcess`...). "Order of work" step 6: replace the 45 `Deno.*` type references in signatures with the layer's types. The inventory below was taken on 2026-10-14 with:

```bash
grep -rnoE 'Deno\.(CommandOptions|CommandOutput|ChildProcess|FsEvent|FileInfo|Conn|Kv|MakeTempOptions|CommandStatus|TcpConn|RemoveOptions|ReadFileOptions|TestDefinition|FsFile|Reader|Writer|DirEntry|WriteFileOptions|MkdirOptions|Listener|HttpServer|ServeHandler|NetAddr|FsWatcher|OpenOptions|KvEntry|KvKey)\b' src package/src tests tools --include=*.ts | grep -v '^src/deno_ral/'
```

| File:line | Type | Owner PR | Layer replacement |
|---|---|---|---|
| `src/core/temp.ts:58,71,76,79` | `Deno.MakeTempOptions` | PR 10 (codemod `temp` rule rewrites the type; `10-codemod-fs-core.md` acceptance grep lists `MakeTempOptions`) | `TempOptions` from `src/deno_ral/temp.ts` |
| `src/core/temp-types.ts:11,13,14` | `Deno.MakeTempOptions` | PR 10 | `TempOptions` |
| `src/core/copy.ts:231,232` | `Deno.FileInfo` | PR 10 (`fs` rule maps `FileInfo`) | `FileInfo` from `src/deno_ral/fs.ts` |
| `src/core/qualified-path.ts:69` | `Deno.ReadFileOptions` | PR 10 (reported as a collision there) | parameter removed (no caller passes it; see Task 2) |
| `src/core/cri/launch.ts:134,139,146` | `Deno.CommandStatus` | PR 08 (`08-ral-process.md` Files list) | `ExitStatus` from `src/deno_ral/process.ts` |
| `src/webui/quarto-preview/build.ts:36` | `Deno.CommandOutput` | PR 08 | `ExecOutput` from `src/deno_ral/process.ts` |
| `package/src/util/cmd.ts:11` | `Deno.CommandStatus` | PR 08 (`CmdResult.status: ExitStatus`) | `ExitStatus` |
| `src/core/process.ts:12,16,48` | `Deno.ChildProcess`, `Deno.CommandOptions` | PR 08 | `ChildProcess`, `SpawnOptions` |
| `src/command/render/pandoc.ts:262` | `Deno.CommandOptions` | PR 08 | `SpawnOptions` |
| `src/execute/jupyter/jupyter-kernel.ts:63` | `Deno.ChildProcess` | PR 08 (PR 15 fallback) | `ChildProcess` |
| `src/execute/jupyter/jupyter-kernel.ts:261,377,466` | `Deno.Conn` | PR 15 | `TcpConnection` |
| `src/core/watch.ts:12,14`, `src/project/serve/watch.ts:110` | `Deno.FsEvent` | PR 17 | `FsEvent` |
| `src/core/cache/cache.ts:32`, `src/core/sass/cache.ts:20,27,173` | `Deno.Kv` | PR 18 | `KeyValueStore` |
| `src/deno_ral/fs.ts:34` (`getFileInfoType`), `:117` (`safeRemoveSync`) | `Deno.FileInfo`, `Deno.RemoveOptions` | PR 09 (inside the layer) | `FileInfo`, `{ recursive?: boolean }` |
| `src/core/deno/monkey-patch.ts:83-106` | `Deno.MakeTempOptions`, `Deno.ReadFileOptions` | PR 25 deletes the file | none |
| `tests/test.ts:545` | `Deno.TestDefinition` | PR 23 (`tests/harness.ts`) | `registerTest` definition type |
| `src/resources/extension-subtrees/julia-engine/**` (5 sites) | `Deno.CommandOutput`, `Deno.Conn`, `Deno.TcpConn`, `Deno.RemoveOptions` | subtree, out of scope | file upstream |

Every row has an owner among PRs 08, 09, 10, 15, 17, 18 (as their plans are written), so after they land this sweep is expected to find few or no sites. Its job is to prove that with the inventory grep (Task 1) and to convert any straggler with the replacement from the table; Task 2 gives the exact code for each row so an executor never has to look it up. The vocabulary fixes the names, so no coordination is needed.

Assumptions (vocabulary in `_TEMPLATE.md`): `src/deno_ral/temp.ts` exports `TempOptions { dir?, prefix?, suffix? }`; `src/deno_ral/fs.ts` exports `FileInfo`; `src/deno_ral/process.ts` exports `ExitStatus { success, code, signal }`, `ExecOutput extends ExitStatus { stdout, stderr }`, `ChildProcess`, `SpawnOptions`.

### Scope

In: the "this PR" rows and any leftover from the earlier-PR rows. Out: `Deno.errors.*` (value position; PR 10–13 `errors` rule), `monkey-patch.ts` (PR 25), `tests/test.ts:545` (PR 23), the julia-engine subtree.

### Interfaces

No new exports. Changed signatures:

```ts
// src/core/temp-types.ts
export interface TempContext {
  baseDir: string;
  createFileFromString: (content: string, options?: TempOptions) => string;
  createFile: (options?: TempOptions) => string;
  createDir: (options?: TempOptions) => string;
  cleanup: () => void;
  onCleanup: (handler: VoidFunction) => void;
}
// src/core/temp.ts
export function createTempContext(options?: TempOptions): TempContext;
// src/core/qualified-path.ts
export function readTextFile(t: QualifiedPath): Promise<string>;
// src/core/copy.ts (private)
function ensureValidCopySync(src: string, dest: string, options: InternalCopyOptions): FileInfo | undefined;
// src/core/cri/launch.ts (private)
async function waitForCdpEndpoint(port: number, timeout: number, exited: Promise<ExitStatus>, isReady: (list: unknown) => boolean): Promise<string | undefined>;
// package/src/util/cmd.ts
export interface CmdResult { status: ExitStatus; stdout: string; stderr: string; }
```

### Files

- Modify: `src/core/temp.ts:58,71,76,79`, `src/core/temp-types.ts:1-17`, `src/core/copy.ts:227-240`, `src/core/qualified-path.ts:69-71`, `src/core/cri/launch.ts:134,139,146`, `src/webui/quarto-preview/build.ts:36`, `package/src/util/cmd.ts:8-14`.
- Modify (only if leftovers): the earlier-PR rows.
- Modify: `tools/runtime-boundary-baseline.json`.

### Acceptance criteria

- The inventory grep above, excluding `src/deno_ral/`, `src/core/deno/monkey-patch.ts`, `tests/test.ts` and `extension-subtrees`, prints nothing.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0 (add `--unstable-ffi` if PR 20 has not landed).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/temp* unit/chrome-launch.test.ts unit/path.test.ts smoke/render/render-html.test.ts` → pass.
- `package/src/quarto-bld --help` works (compiles `package/src/util/cmd.ts`).

## Plan

### Task 1: Inventory on the actual branch

- [ ] **Step 1: Run the grep and diff against the table**

```bash
grep -rnoE 'Deno\.(CommandOptions|CommandOutput|ChildProcess|FsEvent|FileInfo|Conn|Kv|MakeTempOptions|CommandStatus|TcpConn|RemoveOptions|ReadFileOptions|TestDefinition|FsFile|Reader|Writer|DirEntry|WriteFileOptions|MkdirOptions|Listener|HttpServer|ServeHandler|NetAddr|FsWatcher|OpenOptions|KvEntry|KvKey)\b' src package/src tests tools --include=*.ts \
  | grep -v '^src/deno_ral/' | grep -v extension-subtrees | grep -v monkey-patch | grep -v 'tests/test.ts' | sort
```

Expected: nothing, or a subset of the table's rows. Paste the output in the PR description; Task 2 is run only for the files it lists (skip the steps whose file is absent from the output).

### Task 2: Replace, file by file (only the files Task 1 listed)

**Files:** as listed per step.

- [ ] **Step 1: `src/core/temp-types.ts`**

```ts
/*
 * temp-types.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import type { TempOptions } from "../deno_ral/temp.ts";

export interface TempContext {
  baseDir: string;
  createFileFromString: (
    content: string,
    options?: TempOptions,
  ) => string;
  createFile: (options?: TempOptions) => string;
  createDir: (options?: TempOptions) => string;
  cleanup: () => void;
  onCleanup: (handler: VoidFunction) => void;
}
```

- [ ] **Step 2: `src/core/temp.ts:58,71,76,79`**

Add `import type { TempOptions } from "../deno_ral/temp.ts";` (if PR 10 already imports `makeTempDirSync`/`makeTempFileSync` from that module, extend that import) and replace the four `Deno.MakeTempOptions` with `TempOptions`:

```ts
export function createTempContext(options?: TempOptions): TempContext {
```

```ts
    createFileFromString: (content: string, options?: TempOptions) => {
```

```ts
    createFile: (options?: TempOptions) => {
```

```ts
    createDir: (options?: TempOptions) => {
```

- [ ] **Step 3: `src/core/copy.ts:227-240`**

Add `import type { FileInfo } from "../deno_ral/fs.ts";` (merge into the existing `../deno_ral/fs.ts` import when there is one) and:

```ts
function ensureValidCopySync(
  src: string,
  dest: string,
  options: InternalCopyOptions,
): FileInfo | undefined {
  let destStat: FileInfo;
```

(`Deno.lstatSync` / `Deno.errors.NotFound` on lines 234–236 belong to PR 10; keep whatever form the file has.)

- [ ] **Step 4: `src/core/qualified-path.ts:69-71`**

`grep -rn 'readTextFile(' src --include=*.ts | grep -v 'Deno\.\|deno_ral'` shows no caller passing a second argument to this function (its only use is through the `QualifiedPath` API), so drop the parameter:

```ts
export function readTextFile(t: QualifiedPath) {
  return Deno.readTextFile(t.asAbsolute().value);
}
```

(If PR 10 landed, the body reads `readTextFile(t.asAbsolute().value)` from the layer; keep that.)

- [ ] **Step 5: `src/core/cri/launch.ts:134,139,146`**

Add `import type { ExitStatus } from "../../deno_ral/process.ts";` (merge with PR 08's `spawn` import if present) and replace the three `Deno.CommandStatus` with `ExitStatus`:

```ts
async function waitForCdpEndpoint(
  port: number,
  timeout: number,
  exited: Promise<ExitStatus>,
  isReady: (list: unknown) => boolean,
): Promise<string | undefined> {
  const interval = 50;
  const deadline = Date.now() + timeout;
  let dead: ExitStatus | undefined;
```

```ts
  const exitedMessage = (status: ExitStatus) =>
```

The value passed as `exited` is `child.status` from PR 08's `spawn()` (`Promise<ExitStatus>`); if the caller still holds a `Deno.ChildProcess`, PR 08 did not land for this file and its `Deno.Command` must be converted to `spawn(app, { args, stdout: "piped", stderr: "piped" })` here, with `child.status` passed through.

- [ ] **Step 6: `src/webui/quarto-preview/build.ts:36`**

Add `import type { ExecOutput } from "../../deno_ral/process.ts";` and:

```ts
  let output: ExecOutput;
```

The `new Deno.Command("git", { args: ["ls-files"] }).output()` on lines 38–39 is a value-position `Deno.Command` (PR 08's "16 direct sites"); if still present, replace with `output = await exec("git", { args: ["ls-files"] });` importing `exec` from the same module. Confirm the file is still run the same way: `grep -n 'build.ts' package/src/common/previewjs.ts`.

- [ ] **Step 7: `package/src/util/cmd.ts:8-14`**

```ts
import { debug, error, info } from "../../../src/deno_ral/log.ts";
import type { ExitStatus } from "../../../src/deno_ral/process.ts";

export interface CmdResult {
  status: ExitStatus;
  stdout: string;
  stderr: string;
}
```

`status: output` at line 51 stays valid because `ExecOutput extends ExitStatus` (if PR 08/24 already turned `runCmd` onto `exec`) or because `Deno.CommandOutput` is structurally an `ExitStatus` (`success`, `code`, `signal`) otherwise.

- [ ] **Step 8: Leftovers from Task 1**

For every extra line Task 1 printed, apply the table's replacement with the matching `import type { X } from "<rel>/deno_ral/<module>.ts";`.

- [ ] **Step 9: Type-check both trees and run tests**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0.
Run: `package/src/quarto-bld --help | head -3` → command list.
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/path.test.ts smoke/render/render-html.test.ts smoke/project/project-prepost.test.ts` → pass.
Run the Task 1 grep again → nothing.

- [ ] **Step 10: Commit**

```bash
git add src/core/temp.ts src/core/temp-types.ts src/core/copy.ts src/core/qualified-path.ts src/core/cri/launch.ts src/webui/quarto-preview/build.ts package/src/util/cmd.ts
git commit -m "types: replace remaining Deno.* type references with deno_ral types"
```

### Task 3: Ratchet

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → `denoCalls` lower for `src/` and `package/src` by exactly the number of lines Task 1 listed (zero lines means the baseline is unchanged and this step is a no-op).
- [ ] **Step 2: Commit**

```bash
git add tools/runtime-boundary-baseline.json
git commit -m "ratchet baseline after the Deno type sweep"
```

## Verification

- Task 1 grep → empty.
- `deno check` of `src/quarto.ts` → exit 0; `quarto-bld --help` → works.
- Tests listed in Task 2 step 9 → pass.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes.

## Review checklist

- [ ] Every replacement is a `type`-only import where the module is otherwise unused (no runtime import cycles added; `temp-types.ts` in particular must stay dependency-light).
- [ ] `qualified-path.readTextFile` parameter removal has no caller.
- [ ] No `Deno.` identifier in a type position remains outside `src/deno_ral/`, `monkey-patch.ts`, `tests/test.ts`, subtrees.
- [ ] Baseline decreased by the Task 1 count (or unchanged when Task 1 found nothing); no increase anywhere.

## Risks and rollback

- `TempOptions` lacks Deno's `MakeTempOptions` extra fields? Deno's are `dir`, `prefix`, `suffix`: identical.
- `ExitStatus.signal` is `string | null` where `Deno.CommandStatus.signal` is `Deno.Signal | null`; the only consumer (`exitedMessage`) prints `status.code`, so nothing narrows on it.
- Rollback: revert two commits.

## Decisions needed

None.
