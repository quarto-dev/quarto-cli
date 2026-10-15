# PR 27: `fs.ts`, `temp.ts` and `errors.ts` on `node:` APIs; `walk`/`expandGlob` without `@std/fs`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement `src/deno_ral/fs.ts`, `src/deno_ral/temp.ts` and `src/deno_ral/errors.ts` on `node:fs`, `node:fs/promises`, `node:os` and `node:crypto`, including Quarto's own `walk`, `walkSync`, `expandGlob`, `expandGlobSync`, `ensureDir(Sync)`, `existsSync`, `copy(Sync)`, `moveSync`, `emptyDirSync` and `EOL`, so the filesystem layer has one implementation that runs on Deno 2 today and on Node after the flip.
**Phase:** 2. **Depends on:** PR 25 (boundary at zero: every caller already imports `src/deno_ral/fs.ts`, `temp.ts`, `errors.ts`). **Unblocks:** PR 32.
**Branch:** `rt/27-ral-fs-on-node-apis`.
**Suggested executor:** Opus. The walk/glob semantics and the error mapping need judgement; the per-function rewrites are mechanical but numerous.
**Size:** L (4 source files rewritten, ~50 exported functions, 3 new test files, 1 tooling edit).
**Ships on:** Deno; the whole existing suite must stay green. The Node job (`.github/workflows/test-node-bundle.yml`, PR 26) must still render the spike documents; `node tools/node-bundle/build.mjs --check-shim` prints a smaller member list after this PR.

## Spec

### Context

Assessment section 11, module plan row `fs.ts`: "`walk`/`expandGlob` stay re-exported from `@std/fs` until the flip, then are reimplemented on `node:fs`". Section 3.4: "`@std/fs` uses `Deno.*` internally. Re-implement the handful of helpers in the runtime layer on `node:fs`". Design rule 6: "Write each module on `node:` APIs and run it on Deno 2."

After PR 09–13 and PR 25, application code calls `readTextFileSync`, `statSync`, `walkSync`, `expandGlobSync` from `src/deno_ral/fs.ts`, which still delegates to `Deno.*` and to `fs/walk`, `fs/expand-glob`, `fs/copy`, `fs/move`, `fs/ensure-dir`, `fs/exists`, `fs/eol`, `fs/empty-dir` from `@std/fs` 1.0.16. This PR replaces those bodies. The public signatures (shared vocabulary in `_TEMPLATE.md`) do not change, so no caller changes.

Verified in this sandbox on Node 22.22 and the pinned Deno 2.7.14 (`node:fs` compat): `readdirSync({ withFileTypes })` with `isSymbolicLink()`, `realpathSync.native`, `statSync` (`mtime`, `birthtime`, `mode`), `openSync(path, "wx")` → `EEXIST`, `rmSync` → `ENOENT` for a missing path and `ERR_FS_EISDIR` for a directory without `recursive`, `utimesSync`, `truncateSync`, `chmodSync`, `symlinkSync`, `readlinkSync` behave identically on both runtimes.

`@std/fs` semantics this PR preserves (read from the 1.0.16 sources: `walk.ts`, `expand_glob.ts`, `copy.ts`, `move.ts`, `ensure_dir.ts`, `empty_dir.ts`, `exists.ts`, `eol.ts`):

- `walk(root, { maxDepth = Infinity, includeFiles = true, includeDirs = true, includeSymlinks = true, followSymlinks = false, canonicalize = true, exts, match, skip })`: yields the root first (when `includeDirs` and it passes `exts`/`match`/`skip`); stops when `maxDepth < 1` or the root matches `skip`; for each entry: symlink + `!followSymlinks` → yield as a symlink entry (no descent); symlink + `followSymlinks` → `realPath`, re-`lstat`, path becomes the real path when `canonicalize`; directories recurse with `maxDepth - 1`; files yield when `includeFiles` and the filters pass. `exts` are normalised to a leading dot. `skip`/`match` test the **full path** (`path.match(regex)`), not the name. Throws the underlying error (NotFound for a missing root, PermissionDenied for an unreadable directory: `src/project/project-context.ts` tags that error).
- `expandGlob(glob, { root = cwd, exclude = [], includeDirs = true, extended = true, globstar = true, caseInsensitive = false, followSymlinks = false, canonicalize = true })`: splits the glob into segments; the non-glob leading segments form the fixed root; a missing fixed root yields nothing (NotFound swallowed, other errors thrown); `**` walks with `maxDepth: globstar ? Infinity : 1` and `skip: excludePatterns`; other segments match entry **names** one level down; results per segment are de-duplicated by path and sorted by path; trailing `/` keeps directories only; `includeDirs: false` drops directories; `exclude` globs are resolved against the root and compiled with `globToRegExp`. Yielded paths are absolute. The `?()` extglob in `**/README.?([Rrq])md` and the `**` globstar in `src/project/project-context.ts` `projectHiddenIgnoreGlob` come from `globToRegExp` (`@std/path`, pure TypeScript, kept).
- `copy(src, dest, { overwrite = false, preserveTimestamps = false })`: refuses to copy a directory into itself (`isSubdir`) with an Error; `dest` existing and `!overwrite` → AlreadyExists; a directory onto a non-directory → Error; symlinks are recreated as symlinks; directories are created with `ensureDir` and recursed; `preserveTimestamps` copies `atime`/`mtime`.
- `moveSync(src, dest, { overwrite = false })`: a directory into its own subdirectory → Error; `overwrite` removes `dest` first (NotFound ignored); otherwise an existing `dest` → AlreadyExists; then `rename`. (Quarto's cross-device fallback is `safeMoveSync`, kept.)
- `ensureDir(Sync)`: `mkdir -p`; an existing non-directory → Error `Ensure path exists, expected 'dir', got 'file'`.
- `existsSync(path)`: `statSync` succeeds → true (follows symlinks: a dangling link is false); NotFound → false; PermissionDenied → true (the path exists but is not readable); other errors thrown.
- `emptyDirSync(dir)`: creates it, or removes every entry inside it.
- `EOL` is `"\r\n"` on Windows, `"\n"` elsewhere; `LF = "\n"`; `format(content, eol)` normalises all line endings to `eol`.

### Scope

In:
- Rewrite `src/deno_ral/fs.ts`, `src/deno_ral/temp.ts`, `src/deno_ral/errors.ts`, `src/deno_ral/original-real-path.ts` on `node:` APIs; no `Deno.*` and no `@std/fs` import remains in them.
- Keep every helper the file exports today (`isSubdir`, `toPathString`, `safeMoveSync`, `safeRemoveSync`, `safeExistsFileSync`, `UnsafeRemovalError`, `safeRemoveDirSync`, `safeModeFromFile`, `safeChmodSync`, `ensureUserWritable`, `getFileInfoType`, `PathType`, `WalkEntry`, `ExpandGlobOptions`, `CopyOptions`).
- Unit tests for walk/glob semantics and the Node-specific behaviours under `tests/unit/deno-ral/`.
- Shrink `tools/node-bundle/deno-shim.js` by the members this PR makes unused.

Out:
- Any caller change (signatures unchanged). If a caller breaks, the PR 09 contract test was incomplete: add the missing case to the PR 09 test file and fix the implementation here.
- `src/deno_ral/path.ts` (stays on `@std/path`; it is pure).
- `env.ts`, `process.ts`, `net.ts`, `http.ts`, `watch.ts`, `kv.ts` (PR 28–30).
- Removing `fs/` entries from `src/import_map.json` or `@jsr/std__fs` from `package.json` (other std packages may still depend on it; PR 37 prunes).

### Interfaces

All signatures are the shared vocabulary (`_TEMPLATE.md`, "`fs.ts`", "`temp.ts`", "`errors.ts`") plus the additions PR 09 made (its Interfaces section): `FsFile`, `OpenOptions`, `open`, `openSync`, `create`, `symlink`, `realPath`, `chmod`; `readDirSync` returns `DirEntry[]`; `readTextFileSync`/`readTextFile` append `\nPath: <path>` to a read error's message once (`errorWithPath`); `errors.ts` exports `isConnectionError` (EPIPE, ENOTCONN, ECONNABORTED, ECONNRESET, ECONNREFUSED). All unchanged. Types added or made explicit by this PR, previously re-exported from `@std/fs`:

```ts
export interface WalkEntry extends DirEntry { path: string; }
export interface WalkOptions {
  maxDepth?: number; includeFiles?: boolean; includeDirs?: boolean; includeSymlinks?: boolean;
  followSymlinks?: boolean; canonicalize?: boolean; exts?: string[]; match?: RegExp[]; skip?: RegExp[];
}
export interface ExpandGlobOptions {
  root?: string; exclude?: string[]; includeDirs?: boolean; extended?: boolean; globstar?: boolean;
  caseInsensitive?: boolean; followSymlinks?: boolean; canonicalize?: boolean;
}
export interface CopyOptions { overwrite?: boolean; preserveTimestamps?: boolean; }
export interface MoveOptions { overwrite?: boolean; }
export function walk(root: string | URL, options?: WalkOptions): AsyncIterableIterator<WalkEntry>;
export function walkSync(root: string | URL, options?: WalkOptions): IterableIterator<WalkEntry>;
export function expandGlob(glob: string | URL, options?: ExpandGlobOptions): AsyncIterableIterator<WalkEntry>;
export function expandGlobSync(glob: string | URL, options?: ExpandGlobOptions): IterableIterator<WalkEntry>;
export function ensureDir(dir: string | URL): Promise<void>;
export function ensureDirSync(dir: string | URL): void;
export function existsSync(path: string | URL): boolean;
export function copy(src: string | URL, dest: string | URL, options?: CopyOptions): Promise<void>;
export function copySync(src: string | URL, dest: string | URL, options?: CopyOptions): void;
export function moveSync(src: string | URL, dest: string | URL, options?: MoveOptions): void;
export function emptyDirSync(dir: string | URL): void;
export const EOL: "\n" | "\r\n"; export const LF: "\n"; export const CRLF: "\r\n";
export function format(content: string, eol: "\n" | "\r\n"): string;
```

Error behaviour (note: a `Deno.errors.AlreadyExists` constructed by `@std/fs` has no `code`, verified on Deno 2.7.14, which is why `errors.ts` keeps the guarded `instanceof` fallback for the remaining Deno-native paths): every function throws the `node:fs` error unchanged (an `Error` with `code` set to `ENOENT`, `EEXIST`, `EACCES`, `EPERM`, `ENOTEMPTY`, …). `errors.ts` predicates recognise the `code`; no Quarto error class is introduced. Rationale: after PR 25 there is no `instanceof Deno.errors.X` left in `src/` (Task 1 verifies this with a grep that must print 0), so classes have no consumer. `copy`/`moveSync`/`ensureDir` throw errors constructed here with the same `code` values (`EEXIST`, `ENOTSUP`) so the predicates apply to them too.

### Files

- Modify: `src/deno_ral/errors.ts` (entire body)
- Modify: `src/deno_ral/fs.ts` (entire body)
- Modify: `src/deno_ral/temp.ts` (entire body)
- Modify: `src/deno_ral/original-real-path.ts` (entire body: `fs.realpathSync.native`)
- Modify: `tools/node-bundle/build.mjs:` the `--check-shim` block (also print unused members)
- Modify: `tools/node-bundle/deno-shim.js` (delete the members reported unused)
- Test: `tests/unit/deno-ral/fs-walk-glob.test.ts` (new)
- Test: `tests/unit/deno-ral/fs-node-semantics.test.ts` (new)
- Test: `tests/unit/deno-ral/errors.test.ts`, `fs.test.ts`, `temp.test.ts` (from PR 09; unchanged, must pass). Assumes PR 09 landed with these names; if they differ, the contract is whatever `ls tests/unit/deno-ral/` shows.

### Acceptance criteria

- `grep -n "Deno\." src/deno_ral/fs.ts src/deno_ral/temp.ts src/deno_ral/errors.ts src/deno_ral/original-real-path.ts` prints nothing except inside `errors.ts`'s guarded `globalThis.Deno` check.
- `grep -n '"fs/' src/deno_ral/fs.ts` prints nothing (no `@std/fs` import).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/` passes.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/ unit/project/ unit/render/ unit/path.test.ts unit/file-permissions.test.ts smoke/render/` passes.
- `quarto run --dev tools/check-runtime-boundary.ts` stays at zero.
- `node tools/node-bundle/build.mjs --check-shim` succeeds and lists fewer referenced members than on `main`.
- The PR 26 CI job renders `simple.qmd`, the website and `jupyter.qmd` with an empty normalised diff.

## Plan

### Task 1: Confirm the error-class decision and rewrite `errors.ts`

**Files:**
- Modify: `src/deno_ral/errors.ts`
- Test: `tests/unit/deno-ral/errors.test.ts` (PR 09)

- [ ] **Step 1: Verify no `instanceof Deno.errors` consumer remains**

Run: `grep -rn "instanceof Deno.errors" src/ package/src tests/ --include=*.ts | grep -v "src/deno_ral/" | wc -l`
Expected: `0`. If not 0, PR 25's ratchet was bypassed: convert each site to the matching predicate from `src/deno_ral/errors.ts` first (same mechanical change as PR 10–13) and commit that separately.

- [ ] **Step 2: Add a Node-code test case to the PR 09 contract test**

Append to `tests/unit/deno-ral/errors.test.ts`:

```ts
import { readFileSync as nodeReadFileSync, mkdirSync as nodeMkdirSync } from "node:fs";

unitTest("errors - predicates recognise node:fs error codes", async () => {
  try {
    nodeReadFileSync("/definitely/not/here/quarto-rt27");
    fail("expected ENOENT");
  } catch (e) {
    assert(isNotFound(e), "ENOENT -> isNotFound");
    assert(!isAlreadyExists(e));
  }
  const dir = makeTempDirSync({ prefix: "rt27-errors-" });
  try {
    nodeMkdirSync(dir);
    fail("expected EEXIST");
  } catch (e) {
    assert(isAlreadyExists(e), "EEXIST -> isAlreadyExists");
  } finally {
    removeSync(dir, { recursive: true });
  }
  const perm = Object.assign(new Error("denied"), { code: "EPERM" });
  assert(isPermissionDenied(perm));
  assert(isAddrInUse(Object.assign(new Error("x"), { code: "EADDRINUSE" })));
  assert(isConnectionRefused(Object.assign(new Error("x"), { code: "ECONNREFUSED" })));
  assert(!isNotFound(new Error("plain")));
  assert(!isNotFound("not an error"));
});
```

(Imports: `fail`, `assert` from `../../asserts.ts`; `makeTempDirSync` from `../../../src/deno_ral/temp.ts`; `removeSync` from `../../../src/deno_ral/fs.ts`; the five predicates from `../../../src/deno_ral/errors.ts`. Add whichever the file does not import yet.)

- [ ] **Step 3: Run it; the Deno-era predicates may already pass (Deno 2 sets `code`), either way continue**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/errors.test.ts`
Expected: PASS or FAIL depending on the PR 09 body; the next step makes the body code-first.

- [ ] **Step 4: Implement**

```ts
/*
 * errors.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Error predicates for the runtime layer. node:fs, node:net and
 * node:child_process throw plain Errors carrying a `code`; Deno 2 sets the
 * same `code` on its own error classes. Predicates check the code first and
 * fall back to the Deno class only while a Deno-native path still exists
 * (Deno.Kv until PR 30, the bundle's temporary shim until PR 33).
 */

function codeOf(e: unknown): string | undefined {
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

// deno-lint-ignore no-explicit-any
function denoErrors(): Record<string, any> | undefined {
  // deno-lint-ignore no-explicit-any
  const d = (globalThis as any).Deno;
  return d && d.errors ? d.errors : undefined;
}

function isDenoError(e: unknown, name: string): boolean {
  const errs = denoErrors();
  const cls = errs?.[name];
  return typeof cls === "function" && e instanceof cls;
}

export function isNotFound(e: unknown): boolean {
  return codeOf(e) === "ENOENT" || isDenoError(e, "NotFound");
}

export function isAlreadyExists(e: unknown): boolean {
  return codeOf(e) === "EEXIST" || isDenoError(e, "AlreadyExists");
}

export function isPermissionDenied(e: unknown): boolean {
  const code = codeOf(e);
  return code === "EACCES" || code === "EPERM" ||
    isDenoError(e, "PermissionDenied");
}

export function isAddrInUse(e: unknown): boolean {
  return codeOf(e) === "EADDRINUSE" || isDenoError(e, "AddrInUse");
}

export function isConnectionRefused(e: unknown): boolean {
  return codeOf(e) === "ECONNREFUSED" || isDenoError(e, "ConnectionRefused");
}

// The socket-teardown errors src/core/http.ts maybeDisplaySocketError ignores
// (PR 09 addition; same name and semantics).
export function isConnectionError(e: unknown): boolean {
  const code = codeOf(e);
  return code === "EPIPE" || code === "ENOTCONN" || code === "ECONNABORTED" ||
    code === "ECONNRESET" || code === "ECONNREFUSED" ||
    isDenoError(e, "BrokenPipe") || isDenoError(e, "NotConnected") ||
    isDenoError(e, "ConnectionAborted") || isDenoError(e, "ConnectionReset") ||
    isDenoError(e, "ConnectionRefused");
}

// Appends "\nPath: <path>" unless the message already ends with it (PR 09
// semantics; from the former core/deno/monkey-patch.ts read-error annotation).
export function errorWithPath(e: Error, path: string): Error {
  const suffix = `\nPath: ${path}`;
  if (!e.message.endsWith(suffix)) {
    e.message = e.message + suffix;
  }
  return e;
}
```

If PR 09's `errors.ts` exported more names than these (check with `grep -n "^export" src/deno_ral/errors.ts` before overwriting), keep them with the same code-first pattern.

- [ ] **Step 5: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/errors.test.ts`
Expected: all green, including `errors - predicates recognise node:fs error codes`.

- [ ] **Step 6: Commit**

```bash
git add src/deno_ral/errors.ts tests/unit/deno-ral/errors.test.ts
git commit -m "deno_ral/errors: code-first predicates for node: errors"
```

### Task 2: Node-semantics test for the plain fs calls

**Files:**
- Create: `tests/unit/deno-ral/fs-node-semantics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * fs-node-semantics.test.ts
 *
 * Behaviours of src/deno_ral/fs.ts that differ between a naive node:fs
 * mapping and Deno's semantics. The PR 09 contract test covers the common
 * cases; this file pins the corners.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertThrows } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { isNotFound } from "../../../src/deno_ral/errors.ts";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readDirSync,
  readTextFileSync,
  realPathSync,
  removeSync,
  statSync,
  symlinkSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";

function scratch(): string {
  return makeTempDirSync({ prefix: "rt27-fs-" });
}

unitTest("fs - readDirSync is sorted by name on every runtime", async () => {
  const dir = scratch();
  for (const name of ["zeta.txt", "alpha.txt", "Mid.txt", "beta"]) {
    if (name === "beta") mkdirSync(join(dir, name));
    else writeTextFileSync(join(dir, name), name);
  }
  const names = [...readDirSync(dir)].map((e) => e.name);
  assertEquals(names, ["Mid.txt", "alpha.txt", "beta", "zeta.txt"]);
  const beta = [...readDirSync(dir)].find((e) => e.name === "beta")!;
  assert(beta.isDirectory && !beta.isFile && !beta.isSymlink);
  removeSync(dir, { recursive: true });
});

unitTest("fs - removeSync without recursive refuses a non-empty directory", async () => {
  const dir = scratch();
  writeTextFileSync(join(dir, "a.txt"), "a");
  assertThrows(() => removeSync(dir));
  assert(existsSync(dir));
  removeSync(join(dir, "a.txt"));
  removeSync(dir); // empty now: allowed, like Deno.removeSync
  assert(!existsSync(dir));
});

unitTest("fs - removeSync on a missing path is NotFound", async () => {
  const dir = scratch();
  try {
    removeSync(join(dir, "missing"));
    assert(false, "expected a throw");
  } catch (e) {
    assert(isNotFound(e), `expected NotFound, got ${e}`);
  }
  removeSync(dir, { recursive: true });
});

unitTest("fs - writeTextFileSync honours append and create:false", async () => {
  const dir = scratch();
  const f = join(dir, "x.txt");
  writeTextFileSync(f, "1");
  writeTextFileSync(f, "2", { append: true });
  assertEquals(readTextFileSync(f), "12");
  writeTextFileSync(f, "3", { create: false });
  assertEquals(readTextFileSync(f), "3", "create:false truncates an existing file");
  try {
    writeTextFileSync(join(dir, "nope.txt"), "x", { create: false });
    assert(false, "expected NotFound");
  } catch (e) {
    assert(isNotFound(e));
  }
  removeSync(dir, { recursive: true });
});

unitTest("fs - statSync follows symlinks, lstatSync does not", async () => {
  if (isWindows) return; // symlink creation needs privileges on Windows CI
  const dir = scratch();
  const target = join(dir, "t.txt");
  writeTextFileSync(target, "t");
  const link = join(dir, "l.txt");
  symlinkSync(target, link);
  assert(statSync(link).isFile && !statSync(link).isSymlink);
  assert(lstatSync(link).isSymlink && !lstatSync(link).isFile);
  assertEquals(realPathSync(link), realPathSync(target));
  assert(statSync(target).mtime instanceof Date);
  assertEquals(typeof statSync(target).size, "number");
  removeSync(dir, { recursive: true });
});

unitTest("fs - existsSync is false for a dangling symlink", async () => {
  if (isWindows) return;
  const dir = scratch();
  symlinkSync(join(dir, "gone.txt"), join(dir, "dangling"));
  assert(!existsSync(join(dir, "dangling")));
  assert(lstatSync(join(dir, "dangling")).isSymlink);
  removeSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run it and see what fails on the PR 09 implementation**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/fs-node-semantics.test.ts`
Expected: all cases may already pass on the PR 09 (Deno) body; the file is the contract for the Node body written in Task 3.

- [ ] **Step 3: Commit the test**

```bash
git add tests/unit/deno-ral/fs-node-semantics.test.ts
git commit -m "tests: pin node-sensitive fs semantics for deno_ral/fs"
```

### Task 3: Rewrite the plain calls, `temp.ts` and `original-real-path.ts`

**Files:**
- Modify: `src/deno_ral/fs.ts` (plain calls section; walk/glob come in Task 4)
- Modify: `src/deno_ral/temp.ts`
- Modify: `src/deno_ral/original-real-path.ts`

- [ ] **Step 1: Replace `original-real-path.ts`**

```ts
/*
 * original-real-path.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Symlink-resolving realpath, separate from fs.ts realPathSync (which only
 * normalises, because of Windows UNC handling). Used by safeRemoveDirSync to
 * compare paths that external tools (knitr) may have resolved.
 */
import { realpathSync } from "node:fs";

export const originalRealPathSync = (path: string | URL): string =>
  realpathSync.native(path);
```

- [ ] **Step 2: Replace `temp.ts`**

```ts
/*
 * temp.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Temporary files and directories: <dir ?? os.tmpdir()>/<prefix><12 hex><suffix>.
 * Retries 5 times (the retry loop from the former core/deno/monkey-patch.ts,
 * kept for parity with PR 09; collisions are now 48-bit random).
 */
import { closeSync, mkdirSync, openSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { isAlreadyExists } from "./errors.ts";
import { debug } from "./log.ts";

export interface TempOptions {
  dir?: string;
  prefix?: string;
  suffix?: string;
}

const kMaxAttempts = 5;

function candidate(options?: TempOptions): string {
  return join(
    options?.dir ?? tmpdir(),
    `${options?.prefix ?? ""}${randomBytes(6).toString("hex")}${options?.suffix ?? ""}`,
  );
}

// PR 09 contract: 5 attempts, each failure debug-logged, the last error
// rethrown. (The PR 09 test "a missing parent directory fails after the
// retries" expects ENOENT to be retried too, so every error is retried.)
function withAttempts<T>(fn: () => T): T {
  let last: unknown;
  for (let i = 0; i < kMaxAttempts; i++) {
    try {
      return fn();
    } catch (e) {
      last = e;
      debug(`Error attempting to create temp file: ${e instanceof Error ? e.message : e}` + (isAlreadyExists(e) ? " (exists)" : ""));
    }
  }
  throw last;
}

async function withAttemptsAsync<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < kMaxAttempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      debug(`Error attempting to create temp file: ${e instanceof Error ? e.message : e}` + (isAlreadyExists(e) ? " (exists)" : ""));
    }
  }
  throw last;
}

export function makeTempDirSync(options?: TempOptions): string {
  return withAttempts(() => {
    const path = candidate(options);
    mkdirSync(path, { mode: 0o700 });
    return path;
  });
}

export function makeTempDir(options?: TempOptions): Promise<string> {
  return withAttemptsAsync(async () => {
    const path = candidate(options);
    await mkdir(path, { mode: 0o700 });
    return path;
  });
}

export function makeTempFileSync(options?: TempOptions): string {
  return withAttempts(() => {
    const path = candidate(options);
    closeSync(openSync(path, "wx", 0o600));
    return path;
  });
}

export function makeTempFile(options?: TempOptions): Promise<string> {
  return withAttemptsAsync(async () => {
    const path = candidate(options);
    const handle = await open(path, "wx", 0o600);
    await handle.close();
    return path;
  });
}
```

- [ ] **Step 3: Rewrite the plain-call section of `fs.ts`**

Replace everything in `src/deno_ral/fs.ts` above the first Quarto helper (`getFileInfoType`) with the block below, and keep the helpers (they already call the layer's own functions after PR 25; if one still names `Deno.`, replace it with the layer function of the same name). The walk/glob/copy/move/ensure/empty/EOL functions are added in Task 4; until then, keep the `@std/fs` re-exports for them so the suite stays green between commits.

```ts
/*
 * fs.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Filesystem layer on node:fs. Runs on Node and on Deno 2 (node compat).
 * Plain calls keep Deno's names (see dev-docs/runtime-migration/_TEMPLATE.md).
 */

import * as nodeFs from "node:fs";
import * as nodeFsp from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Readable, Writable } from "node:stream";
import { basename, isAbsolute, join, normalize, resolve, SEP as SEPARATOR } from "./path.ts";
import { isWindows } from "./platform.ts";
import { errorWithPath, isNotFound, isPermissionDenied } from "./errors.ts";
import { debug } from "./log.ts";
import { originalRealPathSync } from "./original-real-path.ts";

export interface FileInfo {
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  mtime: Date | null;
  atime: Date | null;
  birthtime: Date | null;
  mode: number | null;
}

export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

export interface WriteOptions {
  append?: boolean;
  create?: boolean;
  mode?: number;
}

export interface OpenOptions {
  read?: boolean;
  write?: boolean;
  append?: boolean;
  create?: boolean;
  truncate?: boolean;
  mode?: number;
}

export interface FsFile {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  read(p: Uint8Array): Promise<number | null>;
  write(p: Uint8Array): Promise<number>;
  writeSync(p: Uint8Array): number;
  close(): void;
}

export function toPathString(pathUrl: string | URL): string {
  return pathUrl instanceof URL ? fileURLToPath(pathUrl) : pathUrl;
}

function fileInfo(st: nodeFs.Stats): FileInfo {
  return {
    isFile: st.isFile(),
    isDirectory: st.isDirectory(),
    isSymlink: st.isSymbolicLink(),
    size: st.size,
    mtime: st.mtime,
    atime: st.atime,
    birthtime: st.birthtime,
    mode: isWindows ? null : st.mode,
  };
}

function dirEntry(d: nodeFs.Dirent): DirEntry {
  return {
    name: d.name,
    isFile: d.isFile(),
    isDirectory: d.isDirectory(),
    isSymlink: d.isSymbolicLink(),
  };
}

// Deno: create defaults to true, append false.
function writeFlag(options?: WriteOptions): string {
  if (options?.create === false) return options.append ? "a" : "r+";
  return options?.append ? "a" : "w";
}

function writeSyncImpl(path: string | URL, data: string | Uint8Array, options?: WriteOptions): void {
  const flag = writeFlag(options);
  if (flag === "r+") {
    // create: false without append: must truncate but not create.
    const fd = nodeFs.openSync(toPathString(path), "r+");
    try {
      nodeFs.ftruncateSync(fd, 0);
      nodeFs.writeSync(fd, data as Uint8Array | string, 0);
    } finally {
      nodeFs.closeSync(fd);
    }
    return;
  }
  nodeFs.writeFileSync(toPathString(path), data, { flag, mode: options?.mode });
}

async function writeImpl(path: string | URL, data: string | Uint8Array, options?: WriteOptions): Promise<void> {
  const flag = writeFlag(options);
  if (flag === "r+") {
    const handle = await nodeFsp.open(toPathString(path), "r+");
    try {
      await handle.truncate(0);
      await handle.write(data as Uint8Array | string, 0);
    } finally {
      await handle.close();
    }
    return;
  }
  await nodeFsp.writeFile(toPathString(path), data, { flag, mode: options?.mode });
}

export function readTextFileSync(path: string | URL): string {
  try {
    return nodeFs.readFileSync(toPathString(path), "utf8");
  } catch (e) {
    throw e instanceof Error ? errorWithPath(e, toPathString(path)) : e;
  }
}
export async function readTextFile(path: string | URL): Promise<string> {
  try {
    return await nodeFsp.readFile(toPathString(path), "utf8");
  } catch (e) {
    throw e instanceof Error ? errorWithPath(e, toPathString(path)) : e;
  }
}
export function readFileSync(path: string | URL): Uint8Array {
  return new Uint8Array(nodeFs.readFileSync(toPathString(path)));
}
export async function readFile(path: string | URL): Promise<Uint8Array> {
  return new Uint8Array(await nodeFsp.readFile(toPathString(path)));
}
export function writeTextFileSync(path: string | URL, data: string, options?: WriteOptions): void {
  writeSyncImpl(path, data, options);
}
export function writeTextFile(path: string | URL, data: string, options?: WriteOptions): Promise<void> {
  return writeImpl(path, data, options);
}
export function writeFileSync(path: string | URL, data: Uint8Array, options?: WriteOptions): void {
  writeSyncImpl(path, data, options);
}
export function writeFile(path: string | URL, data: Uint8Array, options?: WriteOptions): Promise<void> {
  return writeImpl(path, data, options);
}
export function statSync(path: string | URL): FileInfo {
  return fileInfo(nodeFs.statSync(toPathString(path)));
}
export async function stat(path: string | URL): Promise<FileInfo> {
  return fileInfo(await nodeFsp.stat(toPathString(path)));
}
export function lstatSync(path: string | URL): FileInfo {
  return fileInfo(nodeFs.lstatSync(toPathString(path)));
}
export async function lstat(path: string | URL): Promise<FileInfo> {
  return fileInfo(await nodeFsp.lstat(toPathString(path)));
}
export function mkdirSync(path: string | URL, options?: { recursive?: boolean; mode?: number }): void {
  nodeFs.mkdirSync(toPathString(path), { recursive: options?.recursive ?? false, mode: options?.mode });
}
export async function mkdir(path: string | URL, options?: { recursive?: boolean; mode?: number }): Promise<void> {
  await nodeFsp.mkdir(toPathString(path), { recursive: options?.recursive ?? false, mode: options?.mode });
}
// Deno.removeSync: a non-empty directory without `recursive` throws; a
// symlink is unlinked, never followed.
export function removeSync(path: string | URL, options?: { recursive?: boolean }): void {
  const p = toPathString(path);
  if (options?.recursive) {
    nodeFs.rmSync(p, { recursive: true, force: false });
    return;
  }
  if (nodeFs.lstatSync(p).isDirectory()) {
    nodeFs.rmdirSync(p);
  } else {
    nodeFs.unlinkSync(p);
  }
}
export async function remove(path: string | URL, options?: { recursive?: boolean }): Promise<void> {
  const p = toPathString(path);
  if (options?.recursive) {
    await nodeFsp.rm(p, { recursive: true, force: false });
    return;
  }
  if ((await nodeFsp.lstat(p)).isDirectory()) {
    await nodeFsp.rmdir(p);
  } else {
    await nodeFsp.unlink(p);
  }
}
export function renameSync(oldPath: string | URL, newPath: string | URL): void {
  nodeFs.renameSync(toPathString(oldPath), toPathString(newPath));
}
export function rename(oldPath: string | URL, newPath: string | URL): Promise<void> {
  return nodeFsp.rename(toPathString(oldPath), toPathString(newPath));
}
export function copyFileSync(from: string | URL, to: string | URL): void {
  nodeFs.copyFileSync(toPathString(from), toPathString(to));
}
export function copyFile(from: string | URL, to: string | URL): Promise<void> {
  return nodeFsp.copyFile(toPathString(from), toPathString(to));
}
// Sorted by name: Node's readdir order is filesystem order (PR 09 contract).
export function readDirSync(path: string | URL): DirEntry[] {
  return nodeFs.readdirSync(toPathString(path), { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(dirEntry);
}
export async function* readDir(path: string | URL): AsyncIterable<DirEntry> {
  const entries = await nodeFsp.readdir(toPathString(path), { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) yield dirEntry(e);
}
export function symlinkSync(target: string | URL, path: string | URL, options?: { type?: "file" | "dir" }): void {
  nodeFs.symlinkSync(toPathString(target), toPathString(path), options?.type);
}
export function symlink(target: string | URL, path: string | URL, options?: { type?: "file" | "dir" }): Promise<void> {
  return nodeFsp.symlink(toPathString(target), toPathString(path), options?.type);
}
// Resolves symlinks (Deno.realPath semantics; tinytex.ts relies on it).
export function realPath(path: string | URL): Promise<string> {
  return nodeFsp.realpath(toPathString(path));
}
export function chmod(path: string | URL, mode: number): Promise<void> {
  return nodeFsp.chmod(toPathString(path), mode);
}

// ---------------------------------------------------------------- open / create (PR 09 additions)

class NodeFsFile implements FsFile {
  #fd: number;
  #path: string;
  constructor(fd: number, path: string) {
    this.#fd = fd;
    this.#path = path;
  }
  get readable(): ReadableStream<Uint8Array> {
    return Readable.toWeb(nodeFs.createReadStream(this.#path, { fd: this.#fd, autoClose: true })) as ReadableStream<Uint8Array>;
  }
  get writable(): WritableStream<Uint8Array> {
    return Writable.toWeb(nodeFs.createWriteStream(this.#path, { fd: this.#fd, autoClose: true })) as WritableStream<Uint8Array>;
  }
  read(p: Uint8Array): Promise<number | null> {
    return new Promise((resolve, reject) => {
      nodeFs.read(this.#fd, p, 0, p.length, null, (err, n) => (err ? reject(err) : resolve(n === 0 ? null : n)));
    });
  }
  write(p: Uint8Array): Promise<number> {
    return new Promise((resolve, reject) => {
      nodeFs.write(this.#fd, p, 0, p.length, null, (err, n) => (err ? reject(err) : resolve(n)));
    });
  }
  writeSync(p: Uint8Array): number {
    return nodeFs.writeSync(this.#fd, p);
  }
  close(): void {
    try {
      nodeFs.closeSync(this.#fd);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EBADF") throw e; // already closed by a stream
    }
  }
}

// Deno.open flag semantics: read-only by default; write+create+truncate -> "w";
// append -> "a"; write without truncate/create -> "r+".
function openFlags(options?: OpenOptions): string {
  const o = options ?? { read: true };
  if (o.append) return o.read ? "a+" : "a";
  if (o.write && (o.truncate || o.create)) return o.read ? "w+" : "w";
  if (o.write) return "r+";
  return "r";
}

export function openSync(path: string | URL, options?: OpenOptions): FsFile {
  const p = toPathString(path);
  return new NodeFsFile(nodeFs.openSync(p, openFlags(options), options?.mode), p);
}
export async function open(path: string | URL, options?: OpenOptions): Promise<FsFile> {
  return openSync(path, options);
}
export async function create(path: string | URL): Promise<FsFile> {
  const p = toPathString(path);
  return new NodeFsFile(nodeFs.openSync(p, "w+"), p);
}
export function readLinkSync(path: string | URL): string {
  return nodeFs.readlinkSync(toPathString(path));
}
// Normalises without resolving symlinks (the former monkey-patch for Windows
// UNC paths, quarto-vscode#67). originalRealPathSync resolves symlinks.
// Same body as core/path.ts normalizePath, inlined because core/path.ts
// imports this module (a cycle would leave `normalizePath` undefined at
// module-evaluation time on Node).
export function realPathSync(path: string | URL): string {
  let file = toPathString(path);
  if (!isAbsolute(file)) {
    file = join(process.cwd(), file);
  }
  file = normalize(file);
  // some runtimes (e.g. nodejs) create paths w/ lowercase drive letters
  return file.replace(/^\w:\\/, (m: string) => m[0].toUpperCase() + ":\\");
}
export function chmodSync(path: string | URL, mode: number): void {
  nodeFs.chmodSync(toPathString(path), mode);
}
export function utimeSync(path: string | URL, atime: number | Date, mtime: number | Date): void {
  nodeFs.utimesSync(toPathString(path), atime, mtime);
}
export function truncateSync(path: string | URL, len?: number): void {
  nodeFs.truncateSync(toPathString(path), len ?? 0);
}

export function existsSync(path: string | URL): boolean {
  try {
    nodeFs.statSync(toPathString(path));
    return true;
  } catch (e) {
    if (isNotFound(e)) return false;
    if (isPermissionDenied(e)) return true;
    throw e;
  }
}

export function ensureDirSync(dir: string | URL): void {
  const p = toPathString(dir);
  try {
    const info = nodeFs.statSync(p);
    if (!info.isDirectory()) {
      throw new Error(`Ensure path exists, expected 'dir', got '${getFileInfoType(fileInfo(info))}'`);
    }
  } catch (e) {
    if (!isNotFound(e)) throw e;
    nodeFs.mkdirSync(p, { recursive: true });
  }
}

export async function ensureDir(dir: string | URL): Promise<void> {
  const p = toPathString(dir);
  try {
    const info = await nodeFsp.stat(p);
    if (!info.isDirectory()) {
      throw new Error(`Ensure path exists, expected 'dir', got '${getFileInfoType(fileInfo(info))}'`);
    }
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await nodeFsp.mkdir(p, { recursive: true });
  }
}

export function emptyDirSync(dir: string | URL): void {
  const p = toPathString(dir);
  try {
    for (const entry of readDirSync(p)) {
      nodeFs.rmSync(join(p, entry.name), { recursive: true, force: false });
    }
  } catch (e) {
    if (!isNotFound(e)) throw e;
    nodeFs.mkdirSync(p, { recursive: true });
  }
}

export const LF = "\n" as const;
export const CRLF = "\r\n" as const;
export const EOL: "\n" | "\r\n" = isWindows ? CRLF : LF;
export function format(content: string, eol: "\n" | "\r\n"): string {
  return content.replace(/\r?\n/g, eol);
}

// If the realPathSync of the runtime is ever needed (symlink-resolving), use
// originalRealPathSync from ./original-real-path.ts.
export { originalRealPathSync };
```

Keep `fs/walk`, `fs/expand-glob`, `fs/copy`, `fs/move` re-exports for one more commit (Task 4 replaces them). The former `isSubdir`/`safe*` helpers follow unchanged.

- [ ] **Step 4: Run the contract tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/ unit/ral/`
Expected: all green, including `fs-node-semantics.test.ts` and PR 09's `temp.test.ts` (`makeTempFileSync({ prefix: "a", suffix: ".txt" })` yields `<tmp>/a<hex>.txt`).

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/fs.ts src/deno_ral/temp.ts src/deno_ral/original-real-path.ts
git commit -m "deno_ral: fs plain calls and temp files on node:fs"
```

### Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`

**Files:**
- Create: `tests/unit/deno-ral/fs-walk-glob.test.ts`
- Modify: `src/deno_ral/fs.ts` (append the section; delete the `fs/*` re-exports)

- [ ] **Step 1: Write the failing test**

```ts
/*
 * fs-walk-glob.test.ts
 *
 * walk/expandGlob semantics Quarto relies on (src/project/project-context.ts
 * projectHiddenIgnoreGlob, src/core/path.ts resolvePathGlobs,
 * src/extension/extension.ts, src/command/render/cmd.ts).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "../../asserts.ts";
import { globToRegExp, join, SEP } from "../../../src/deno_ral/path.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { kSkipHidden } from "../../../src/core/path.ts";
import {
  copySync,
  ensureDirSync,
  expandGlob,
  expandGlobSync,
  lstatSync,
  moveSync,
  readTextFileSync,
  removeSync,
  symlinkSync,
  walk,
  walkSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";
import { isAlreadyExists } from "../../../src/deno_ral/errors.ts";

// project/
//   _quarto.yml  index.qmd  README.md  README.Rmd  _draft.qmd
//   .hidden/secret.qmd  _private/x.qmd  posts/a.qmd  posts/b.md
//   renv/library/loop -> ../../renv   (symlink loop)   [not on Windows]
//   node_modules/pkg/index.qmd
function fixture(): string {
  const root = makeTempDirSync({ prefix: "rt27-walk-" });
  const dir = join(root, "project");
  const files: Record<string, string> = {
    "_quarto.yml": "project:\n  type: website\n",
    "index.qmd": "# hi",
    "README.md": "readme",
    "README.Rmd": "readme",
    "_draft.qmd": "draft",
    ".hidden/secret.qmd": "s",
    "_private/x.qmd": "x",
    "posts/a.qmd": "a",
    "posts/b.md": "b",
    "node_modules/pkg/index.qmd": "n",
  };
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, ...rel.split("/"));
    ensureDirSync(join(full, ".."));
    writeTextFileSync(full, content);
  }
  if (!isWindows) {
    ensureDirSync(join(dir, "renv", "library"));
    symlinkSync(join(dir, "renv"), join(dir, "renv", "library", "loop"), { type: "dir" });
  }
  return dir;
}

function rel(dir: string, paths: string[]): string[] {
  return paths.map((p) => p.slice(dir.length + 1).replaceAll("\\", "/")).sort();
}

unitTest("walkSync - skip regexes on the full path, no symlink following, includeDirs", async () => {
  const dir = fixture();
  const ignores = ["**/node_modules/**", "**/_*", "**/_*/**", "**/.*", "**/.*/**", "**/README.?([Rrq])md"];
  const entries = [...walkSync(dir, {
    includeDirs: true,
    followSymlinks: false,
    skip: [kSkipHidden].concat(ignores.map((g) => globToRegExp(join(dir, g) + SEP))),
  })];
  const files = rel(dir, entries.filter((e) => e.isFile).map((e) => e.path));
  // Verified against @std/fs 1.0.16 on Deno 2.7.14: the "**/_*" + SEP regex
  // also matches files (globstar regexes accept an end-of-string after the
  // separator), so _quarto.yml and _draft.qmd are skipped, as are the READMEs
  // and everything under node_modules; the node_modules directory entry
  // itself is yielded because the skip regex needs a path *below* it.
  assertEquals(files, ["index.qmd", "posts/a.qmd", "posts/b.md"]);
  const dirs = rel(dir, entries.filter((e) => e.isDirectory).map((e) => e.path));
  assertEquals(
    dirs.filter((d) => d !== ""),
    isWindows ? ["node_modules", "posts"] : ["node_modules", "posts", "renv", "renv/library"],
  );
  assert(entries[0].path === dir && entries[0].isDirectory, "root yielded first");
  if (!isWindows) {
    const loop = entries.find((e) => e.name === "loop");
    assert(loop && loop.isSymlink && !loop.isDirectory, "symlink yielded as a symlink, not followed");
  }
  removeSync(join(dir, ".."), { recursive: true });
});

unitTest("walk (async) - same entries as walkSync, includeDirs false, maxDepth", async () => {
  const dir = fixture();
  const asyncEntries: string[] = [];
  for await (const e of walk(dir, { includeDirs: false, followSymlinks: false, skip: [kSkipHidden] })) {
    asyncEntries.push(e.path);
  }
  const syncEntries = [...walkSync(dir, { includeDirs: false, followSymlinks: false, skip: [kSkipHidden] })].map((e) => e.path);
  assertEquals(rel(dir, asyncEntries), rel(dir, syncEntries));
  assert(!asyncEntries.some((p) => p.includes(".hidden")));
  const shallow = [...walkSync(dir, { maxDepth: 1, includeDirs: false })].map((e) => e.path);
  assertEquals(rel(dir, shallow), ["README.Rmd", "README.md", "_draft.qmd", "_quarto.yml", "index.qmd"]);
  assertEquals([...walkSync(dir, { maxDepth: 0 })].length, 1, "maxDepth 0 yields only the root");
  removeSync(join(dir, ".."), { recursive: true });
});

unitTest("walkSync - exts and match filters, missing root throws NotFound", async () => {
  const dir = fixture();
  const qmd = [...walkSync(dir, { exts: ["qmd"], followSymlinks: false, skip: [kSkipHidden] })].map((e) => e.path);
  assertEquals(rel(dir, qmd), ["_draft.qmd", "_private/x.qmd", "index.qmd", "node_modules/pkg/index.qmd", "posts/a.qmd"]);
  const readmes = [...walkSync(dir, { match: [/README/] })].map((e) => e.path);
  assertEquals(rel(dir, readmes), ["README.Rmd", "README.md"]);
  let threw = false;
  try {
    [...walkSync(join(dir, "nope"))];
  } catch (e) {
    threw = (e as { code?: string }).code === "ENOENT";
  }
  assert(threw, "missing root throws ENOENT");
  removeSync(join(dir, ".."), { recursive: true });
});

unitTest("expandGlobSync - globstar, extglob, exclude, includeDirs, trailing slash", async () => {
  const dir = fixture();
  const all = [...expandGlobSync("**/*.qmd", { root: dir, globstar: true, extended: true, exclude: ["**/node_modules/**", "**/_*/**"] })];
  // No exclude for dot directories here, so .hidden/secret.qmd is matched
  // (verified against @std/fs 1.0.16); "**/_*/**" removes _private/x.qmd only.
  assertEquals(rel(dir, all.map((e) => e.path)), [".hidden/secret.qmd", "_draft.qmd", "index.qmd", "posts/a.qmd"]);
  for (const e of all) assert(e.path.startsWith(dir), "paths are absolute");
  const readmes = [...expandGlobSync("README.?([Rrq])md", { root: dir, extended: true })];
  assertEquals(rel(dir, readmes.map((e) => e.path)), ["README.Rmd", "README.md"]);
  const dirsOnly = [...expandGlobSync("*/", { root: dir })].map((e) => e.name).sort();
  assertEquals(dirsOnly, isWindows ? [".hidden", "_private", "node_modules", "posts"] : [".hidden", "_private", "node_modules", "posts", "renv"]);
  const noDirs = [...expandGlobSync("*", { root: dir, includeDirs: false })].map((e) => e.name).sort();
  assertEquals(noDirs, ["README.Rmd", "README.md", "_draft.qmd", "_quarto.yml", "index.qmd"]);
  const absolute = [...expandGlobSync(join(dir, "posts", "*.md"))].map((e) => e.name);
  assertEquals(absolute, ["b.md"]);
  assertEquals([...expandGlobSync("missing-dir/**/*.qmd", { root: dir })].length, 0, "missing fixed root yields nothing");
  // duplicates collapse and results are sorted (PR 09 ordering contract)
  const dup = [...expandGlobSync("{posts,posts}/*.qmd", { root: dir, extended: true })].map((e) => e.name);
  assertEquals(dup, ["a.qmd"]);
  removeSync(join(dir, ".."), { recursive: true });
});

unitTest("expandGlob (async) - matches expandGlobSync", async () => {
  const dir = fixture();
  const a: string[] = [];
  for await (const e of expandGlob("**/*.{qmd,md}", { root: dir, exclude: ["**/.*/**", "**/node_modules/**"] })) a.push(e.path);
  const s = [...expandGlobSync("**/*.{qmd,md}", { root: dir, exclude: ["**/.*/**", "**/node_modules/**"] })].map((e) => e.path);
  assertEquals(rel(dir, a), rel(dir, s));
  assertEquals(rel(dir, s), ["README.md", "_draft.qmd", "_private/x.qmd", "index.qmd", "posts/a.qmd", "posts/b.md"]);
  removeSync(join(dir, ".."), { recursive: true });
});

unitTest("copySync and moveSync - overwrite, AlreadyExists, directories, symlinks", async () => {
  const dir = fixture();
  const out = join(dir, "..", "copy");
  copySync(join(dir, "posts"), out);
  assertEquals(readTextFileSync(join(out, "a.qmd")), "a");
  let threw = false;
  try {
    copySync(join(dir, "posts"), out);
  } catch (e) {
    threw = isAlreadyExists(e);
  }
  assert(threw, "copy onto existing dest without overwrite is AlreadyExists");
  writeTextFileSync(join(dir, "posts", "a.qmd"), "a2");
  copySync(join(dir, "posts"), out, { overwrite: true });
  assertEquals(readTextFileSync(join(out, "a.qmd")), "a2");
  if (!isWindows) {
    copySync(join(dir, "renv"), join(dir, "..", "renv-copy"));
    assert(lstatSync(join(dir, "..", "renv-copy", "library", "loop")).isSymlink, "symlinks are copied as symlinks");
  }
  moveSync(out, join(dir, "..", "moved"));
  assertEquals(readTextFileSync(join(dir, "..", "moved", "a.qmd")), "a2");
  threw = false;
  try {
    moveSync(join(dir, "posts"), join(dir, "..", "moved"));
  } catch (e) {
    threw = isAlreadyExists(e);
  }
  assert(threw, "move onto existing dest without overwrite is AlreadyExists");
  moveSync(join(dir, "posts"), join(dir, "..", "moved"), { overwrite: true });
  assertEquals(readTextFileSync(join(dir, "..", "moved", "b.md")), "b");
  removeSync(join(dir, ".."), { recursive: true });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/fs-walk-glob.test.ts`
Expected: the `@std/fs`-backed functions mostly pass on Deno; `copySync ... symlinks` and the `ENOENT` code check may fail (Deno's `@std/fs` throws `Deno.errors.NotFound`, which carries `code` in Deno 2, so this may pass too). Either way, the test is the contract for the next step.

- [ ] **Step 3: Implement**

Delete the `fs/walk`, `fs/expand-glob`, `fs/copy`, `fs/move`, `fs/ensure-dir`, `fs/exists`, `fs/eol`, `fs/empty-dir` imports and re-exports from `src/deno_ral/fs.ts`, add `import { globToRegExp, isGlob, joinGlobs, SEPARATOR_PATTERN } from "@std/path";` (`isAbsolute` is already imported from `./path.ts`) and append:

```ts
// ---------------------------------------------------------------- walk (port of @std/fs 1.0.16 walk.ts)

export interface WalkEntry extends DirEntry {
  path: string;
}

export interface WalkOptions {
  maxDepth?: number;
  includeFiles?: boolean;
  includeDirs?: boolean;
  includeSymlinks?: boolean;
  followSymlinks?: boolean;
  canonicalize?: boolean;
  exts?: string[];
  match?: RegExp[];
  skip?: RegExp[];
}

function include(path: string, exts?: string[], match?: RegExp[], skip?: RegExp[]): boolean {
  if (exts && !exts.some((ext) => path.endsWith(ext))) return false;
  if (match && !match.some((pattern) => !!path.match(pattern))) return false;
  if (skip && skip.some((pattern) => !!path.match(pattern))) return false;
  return true;
}

function walkEntrySync(path: string): WalkEntry {
  path = normalize(path);
  const info = statSync(path);
  return { path, name: basename(path), isFile: info.isFile, isDirectory: info.isDirectory, isSymlink: info.isSymlink };
}

async function walkEntry(path: string): Promise<WalkEntry> {
  path = normalize(path);
  const info = await stat(path);
  return { path, name: basename(path), isFile: info.isFile, isDirectory: info.isDirectory, isSymlink: info.isSymlink };
}

function normalizeExts(exts?: string[]): string[] | undefined {
  return exts?.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));
}

export function* walkSync(root: string | URL, options?: WalkOptions): IterableIterator<WalkEntry> {
  const {
    maxDepth = Infinity, includeFiles = true, includeDirs = true, includeSymlinks = true,
    followSymlinks = false, canonicalize = true, match, skip,
  } = options ?? {};
  const exts = normalizeExts(options?.exts);
  const rootPath = toPathString(root);
  if (maxDepth < 0) return;
  if (includeDirs && include(rootPath, exts, match, skip)) {
    yield walkEntrySync(rootPath);
  }
  if (maxDepth < 1 || !include(rootPath, undefined, undefined, skip)) return;
  for (const entry of readDirSync(rootPath)) {
    let path = join(rootPath, entry.name);
    let { isSymlink, isDirectory } = entry;
    if (isSymlink) {
      if (!followSymlinks) {
        if (includeSymlinks && include(path, exts, match, skip)) {
          yield { path, ...entry };
        }
        continue;
      }
      const realPath = originalRealPathSync(path);
      if (canonicalize) path = realPath;
      ({ isSymlink, isDirectory } = lstatSync(realPath));
    }
    if (isSymlink || isDirectory) {
      yield* walkSync(path, { maxDepth: maxDepth - 1, includeFiles, includeDirs, includeSymlinks, followSymlinks, canonicalize, exts, match, skip });
    } else if (includeFiles && include(path, exts, match, skip)) {
      yield { path, ...entry };
    }
  }
}

export async function* walk(root: string | URL, options?: WalkOptions): AsyncIterableIterator<WalkEntry> {
  const {
    maxDepth = Infinity, includeFiles = true, includeDirs = true, includeSymlinks = true,
    followSymlinks = false, canonicalize = true, match, skip,
  } = options ?? {};
  const exts = normalizeExts(options?.exts);
  const rootPath = toPathString(root);
  if (maxDepth < 0) return;
  if (includeDirs && include(rootPath, exts, match, skip)) {
    yield await walkEntry(rootPath);
  }
  if (maxDepth < 1 || !include(rootPath, undefined, undefined, skip)) return;
  for await (const entry of readDir(rootPath)) {
    let path = join(rootPath, entry.name);
    let { isSymlink, isDirectory } = entry;
    if (isSymlink) {
      if (!followSymlinks) {
        if (includeSymlinks && include(path, exts, match, skip)) {
          yield { path, ...entry };
        }
        continue;
      }
      const realPath = await nodeFsp.realpath(path);
      if (canonicalize) path = realPath;
      ({ isSymlink, isDirectory } = await lstat(realPath));
    }
    if (isSymlink || isDirectory) {
      yield* walk(path, { maxDepth: maxDepth - 1, includeFiles, includeDirs, includeSymlinks, followSymlinks, canonicalize, exts, match, skip });
    } else if (includeFiles && include(path, exts, match, skip)) {
      yield { path, ...entry };
    }
  }
}

// ---------------------------------------------------------------- expandGlob (port of @std/fs 1.0.16 expand_glob.ts)

export interface ExpandGlobOptions {
  root?: string;
  exclude?: string[];
  includeDirs?: boolean;
  extended?: boolean;
  globstar?: boolean;
  caseInsensitive?: boolean;
  followSymlinks?: boolean;
  canonicalize?: boolean;
}

interface SplitPath {
  segments: string[];
  isAbsolute: boolean;
  hasTrailingSep: boolean;
  winRoot?: string;
}

function splitGlob(path: string): SplitPath {
  const s = SEPARATOR_PATTERN.source;
  const segments = path.replace(new RegExp(`^${s}|${s}$`, "g"), "").split(SEPARATOR_PATTERN);
  const abs = isAbsolute(path);
  const split: SplitPath = { segments, isAbsolute: abs, hasTrailingSep: path.match(new RegExp(`${s}$`)) !== null };
  if (isWindows && abs) split.winRoot = segments.shift();
  return split;
}

function comparePath(a: WalkEntry, b: WalkEntry): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

interface GlobPlan {
  segments: string[];
  hasTrailingSep: boolean;
  includeDirs: boolean;
  globOptions: { extended: boolean; globstar: boolean; caseInsensitive: boolean };
  excludePatterns: RegExp[];
  fixedRoot: string;
  followSymlinks: boolean;
  canonicalize: boolean;
}

function planGlob(glob: string | URL, options?: ExpandGlobOptions): GlobPlan {
  const {
    exclude = [], includeDirs = true, extended = true, globstar = true,
    caseInsensitive = false, followSymlinks = false, canonicalize = true,
  } = options ?? {};
  const { segments, isAbsolute: isGlobAbsolute, hasTrailingSep, winRoot } = splitGlob(toPathString(glob));
  const root = options?.root ?? (isGlobAbsolute ? (winRoot ?? "/") : process.cwd());
  const globOptions = { extended, globstar, caseInsensitive };
  const absRoot = isGlobAbsolute ? root : resolve(root);
  const excludePatterns = exclude.map((p) => resolve(absRoot, p)).map((s) => globToRegExp(s, globOptions));
  let fixedRoot = isGlobAbsolute ? (winRoot ?? "/") : absRoot;
  while (segments.length > 0 && !isGlob(segments[0])) {
    fixedRoot = joinGlobs([fixedRoot, segments.shift()!], globOptions);
  }
  return { segments, hasTrailingSep, includeDirs, globOptions, excludePatterns, fixedRoot, followSymlinks, canonicalize };
}

function finishGlob(plan: GlobPlan, matches: WalkEntry[]): WalkEntry[] {
  if (plan.hasTrailingSep) matches = matches.filter((e) => e.isDirectory);
  if (!plan.includeDirs) matches = matches.filter((e) => !e.isDirectory);
  return matches;
}

export function* expandGlobSync(glob: string | URL, options?: ExpandGlobOptions): IterableIterator<WalkEntry> {
  const plan = planGlob(glob, options);
  const shouldInclude = (path: string) => !plan.excludePatterns.some((p) => !!path.match(p));
  let fixedRootInfo: WalkEntry;
  try {
    fixedRootInfo = walkEntrySync(plan.fixedRoot);
  } catch (e) {
    if (isNotFound(e)) return;
    throw e;
  }
  function* advanceMatch(walkInfo: WalkEntry, globSegment: string): IterableIterator<WalkEntry> {
    if (!walkInfo.isDirectory) return;
    if (globSegment === "..") {
      const parentPath = joinGlobs([walkInfo.path, ".."], plan.globOptions);
      if (shouldInclude(parentPath)) yield walkEntrySync(parentPath);
      return;
    }
    if (globSegment === "**") {
      yield* walkSync(walkInfo.path, { skip: plan.excludePatterns, maxDepth: plan.globOptions.globstar ? Infinity : 1, followSymlinks: plan.followSymlinks, canonicalize: plan.canonicalize });
      return;
    }
    const globPattern = globToRegExp(globSegment, plan.globOptions);
    for (const entry of walkSync(walkInfo.path, { maxDepth: 1, skip: plan.excludePatterns, followSymlinks: plan.followSymlinks })) {
      if (entry.path !== walkInfo.path && entry.name.match(globPattern)) yield entry;
    }
  }
  let currentMatches: WalkEntry[] = [fixedRootInfo];
  for (const segment of plan.segments) {
    const next = new Map<string, WalkEntry>();
    for (const current of currentMatches) {
      for (const m of advanceMatch(current, segment)) next.set(m.path, m);
    }
    currentMatches = [...next.values()].sort(comparePath);
  }
  yield* finishGlob(plan, currentMatches);
}

export async function* expandGlob(glob: string | URL, options?: ExpandGlobOptions): AsyncIterableIterator<WalkEntry> {
  const plan = planGlob(glob, options);
  const shouldInclude = (path: string) => !plan.excludePatterns.some((p) => !!path.match(p));
  let fixedRootInfo: WalkEntry;
  try {
    fixedRootInfo = await walkEntry(plan.fixedRoot);
  } catch (e) {
    if (isNotFound(e)) return;
    throw e;
  }
  async function* advanceMatch(walkInfo: WalkEntry, globSegment: string): AsyncIterableIterator<WalkEntry> {
    if (!walkInfo.isDirectory) return;
    if (globSegment === "..") {
      const parentPath = joinGlobs([walkInfo.path, ".."], plan.globOptions);
      if (shouldInclude(parentPath)) yield await walkEntry(parentPath);
      return;
    }
    if (globSegment === "**") {
      yield* walk(walkInfo.path, { skip: plan.excludePatterns, maxDepth: plan.globOptions.globstar ? Infinity : 1, followSymlinks: plan.followSymlinks, canonicalize: plan.canonicalize });
      return;
    }
    const globPattern = globToRegExp(globSegment, plan.globOptions);
    for await (const entry of walk(walkInfo.path, { maxDepth: 1, skip: plan.excludePatterns, followSymlinks: plan.followSymlinks })) {
      if (entry.path !== walkInfo.path && entry.name.match(globPattern)) yield entry;
    }
  }
  let currentMatches: WalkEntry[] = [fixedRootInfo];
  for (const segment of plan.segments) {
    const next = new Map<string, WalkEntry>();
    for (const current of currentMatches) {
      for await (const m of advanceMatch(current, segment)) next.set(m.path, m);
    }
    currentMatches = [...next.values()].sort(comparePath);
  }
  yield* finishGlob(plan, currentMatches);
}

// ---------------------------------------------------------------- copy / move (port of @std/fs 1.0.16 copy.ts, move.ts)

export interface CopyOptions {
  overwrite?: boolean;
  preserveTimestamps?: boolean;
}

export interface MoveOptions {
  overwrite?: boolean;
}

function codedError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

function ensureValidCopySync(src: string, dest: string, options: CopyOptions & { isFolder?: boolean }): FileInfo | undefined {
  let destStat: FileInfo;
  try {
    destStat = lstatSync(dest);
  } catch (e) {
    if (isNotFound(e)) return undefined;
    throw e;
  }
  if (options.isFolder && !destStat.isDirectory) {
    throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'`);
  }
  if (!options.overwrite) throw codedError(`'${dest}' already exists`, "EEXIST");
  return destStat;
}

function copyFileEntrySync(src: string, dest: string, options: CopyOptions): void {
  ensureValidCopySync(src, dest, options);
  nodeFs.copyFileSync(src, dest);
  if (options.preserveTimestamps) {
    const info = nodeFs.statSync(src);
    nodeFs.utimesSync(dest, info.atime, info.mtime);
  }
}

function copySymlinkSync(src: string, dest: string, options: CopyOptions): void {
  const originSrcFilePath = nodeFs.readlinkSync(src);
  const type = lstatSync(src).isDirectory ? "dir" : "file";
  if (ensureValidCopySync(src, dest, options)) nodeFs.unlinkSync(dest);
  nodeFs.symlinkSync(originSrcFilePath, dest, isWindows ? type : undefined);
  if (options.preserveTimestamps) {
    const info = nodeFs.lstatSync(src);
    nodeFs.lutimesSync(dest, info.atime, info.mtime);
  }
}

function copyDirSync(src: string, dest: string, options: CopyOptions): void {
  const destStat = ensureValidCopySync(src, dest, { ...options, isFolder: true });
  if (!destStat) ensureDirSync(dest);
  if (options.preserveTimestamps) {
    const info = nodeFs.statSync(src);
    nodeFs.utimesSync(dest, info.atime, info.mtime);
  }
  for (const entry of readDirSync(src)) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, basename(srcPath));
    if (entry.isSymlink) copySymlinkSync(srcPath, destPath, options);
    else if (entry.isDirectory) copyDirSync(srcPath, destPath, options);
    else if (entry.isFile) copyFileEntrySync(srcPath, destPath, options);
  }
}

export function copySync(src: string | URL, dest: string | URL, options: CopyOptions = {}): void {
  const s = resolve(toPathString(src));
  const d = resolve(toPathString(dest));
  if (s === d) throw new Error("Source and destination cannot be the same");
  const info = lstatSync(s);
  if (info.isDirectory && isSubdir(s, d)) {
    throw new Error(`Cannot copy '${s}' to a subdirectory of itself: '${d}'`);
  }
  if (info.isSymlink) copySymlinkSync(s, d, options);
  else if (info.isDirectory) copyDirSync(s, d, options);
  else if (info.isFile) copyFileEntrySync(s, d, options);
}

// The async variant delegates to the sync walk per entry; Quarto's two
// `copy()` callers copy small trees (resources, extension installs).
export async function copy(src: string | URL, dest: string | URL, options: CopyOptions = {}): Promise<void> {
  copySync(src, dest, options);
}

function isSamePath(src: string, dest: string): boolean {
  return resolve(src) === resolve(dest);
}

export function moveSync(src: string | URL, dest: string | URL, options: MoveOptions = {}): void {
  const s = toPathString(src);
  const d = toPathString(dest);
  const info = statSync(s);
  if (info.isDirectory && (isSubdir(s, d) || isSamePath(s, d))) {
    throw codedError(`Cannot move '${s}' to a subdirectory of itself, '${d}'.`, "ENOTSUP");
  }
  if (options.overwrite) {
    if (isSamePath(s, d)) return;
    try {
      nodeFs.rmSync(d, { recursive: true, force: false });
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  } else {
    let exists = true;
    try {
      nodeFs.lstatSync(d);
    } catch {
      exists = false;
    }
    if (exists) throw codedError(`'${d}' already exists`, "EEXIST");
  }
  nodeFs.renameSync(s, d);
}
```

`isSubdir` is the existing helper in the same file. `process.cwd()` is used for the default glob root because `deno_ral/process.ts` imports `fs.ts` indirectly (log) and a cycle must be avoided; `process` is a global on Node and on Deno 2.

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/ unit/ral/`
Expected: all green.

- [ ] **Step 5: Run the callers that depend on walk/glob**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/ unit/path.test.ts unit/filter-paths.test.ts unit/extension/ smoke/project/ smoke/extensions/`
Expected: all green. (If `smoke/extensions/` does not exist, use `ls tests/smoke` to pick the extension and project directories.)

- [ ] **Step 6: Commit**

```bash
git add src/deno_ral/fs.ts tests/unit/deno-ral/fs-walk-glob.test.ts
git commit -m "deno_ral/fs: walk, expandGlob, copy and move on node:fs (no @std/fs)"
```

### Task 5: Shrink the shim and report unused members

**Files:**
- Modify: `tools/node-bundle/build.mjs` (`--check-shim` block)
- Modify: `tools/node-bundle/deno-shim.js`

- [ ] **Step 1: Report unused shim members**

In `tools/node-bundle/build.mjs`, after `const missing = ...`, add:

```js
  const unused = [...defined].filter((m) => !used.has(m) && m !== "errors").sort();
  if (unused.length) console.log(`shim: ${unused.length} members defined but no longer referenced (delete them):\n  ${unused.join("\n  ")}`);
```

- [ ] **Step 2: Build and delete the unused members**

Run: `npm ci && node tools/node-bundle/build.mjs --check-shim`
Expected: `0 missing` and a list of unused members (expected after this PR: the `readTextFileSync`…`truncateSync` family, `makeTemp*`, `cwd`/`chdir` only if PR 08 already moved them; members still used by remaining `@std/*` packages stay). Delete exactly the listed `Deno.<name> = ...` lines from `deno-shim.js`, rebuild, confirm `0 missing` again.

- [ ] **Step 3: Render on Node**

Run:
```bash
tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd
tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/website
```
Expected: `Output created: simple.html` and the website renders without `Deno is not defined` or shim errors.

- [ ] **Step 4: Commit**

```bash
git add tools/node-bundle/build.mjs tools/node-bundle/deno-shim.js
git commit -m "node-bundle: report and drop shim members made unused by deno_ral/fs"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/ unit/ral/` → green (contract tests from PR 09 plus the two new files).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ smoke/render/ smoke/project/` → green.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/file-permissions.test.ts unit/render-shared-output-dir.test.ts unit/sass-cache.test.ts` → green (chmod, copy, temp dirs).
- `quarto run --dev tools/check-runtime-boundary.ts` → zero.
- `grep -c "Deno\." src/deno_ral/fs.ts src/deno_ral/temp.ts src/deno_ral/original-real-path.ts` → `0` for each; `grep -c '"fs/' src/deno_ral/fs.ts` → `0`.
- `node tools/node-bundle/build.mjs --check-shim` → `0 missing`; the two spike renders above succeed.
- Manual: `package/dist/bin/quarto render tests/docs/websites/book` (a book, exercising walk/glob/copy) and `package/dist/bin/quarto create project website /tmp/rt27-site --no-prompt` (ensureDir, copy, ensureUserWritable).
- Windows: run `cd tests; $env:QUARTO_TESTS_NO_CONFIG="true"; .\run-tests.ps1 --agent unit/deno-ral/` on a Windows machine or let the CI matrix run; the UNC `realPathSync` behaviour is unchanged (`normalizePath`).

## Review checklist

- [ ] No `Deno.` in `fs.ts`, `temp.ts`, `original-real-path.ts`; `errors.ts` only reads `globalThis.Deno` behind a guard.
- [ ] No import from `fs/`, `@std/fs` or `jsr:@std/fs` anywhere in `src/deno_ral/`.
- [ ] `readDirSync`/`readDir` sort by name; `walk` therefore yields deterministically.
- [ ] `removeSync` without `recursive` refuses non-empty directories and unlinks symlinks instead of following them.
- [ ] `existsSync` returns `true` on `EACCES`/`EPERM` and `false` on a dangling symlink.
- [ ] `expandGlob*` yields absolute, de-duplicated, sorted paths; a missing fixed root yields nothing; other errors propagate.
- [ ] `walk` `skip`/`match` test the full path (not the name), `exts` get a leading dot, symlinks are yielded as symlinks when `followSymlinks: false`.
- [ ] `copySync` recreates symlinks, refuses copying into a subdirectory of the source, honours `overwrite` and `preserveTimestamps`.
- [ ] `moveSync` throws `EEXIST` without `overwrite` and `ENOTSUP` for a move into its own subtree.
- [ ] `temp.ts` builds `<dir>/<prefix><hex><suffix>` and retries only on `EEXIST`.
- [ ] The shim lost members, none were added.

## Risks and rollback

- **Semantic drift in walk/glob** shows up as changed project input discovery (files missing from a website render, extension not found). The new tests encode `projectHiddenIgnoreGlob` and `resolvePathGlobs` usage; `smoke/project/` and `smoke/extensions/` cover the callers. Rollback: `git revert` the walk/glob commit; the `@std/fs` re-exports return and still run on Deno.
- **`realPathSync` on Node:** behaviour is unchanged by design (normalise only). `originalRealPathSync` now uses `realpathSync.native`, which on Windows returns `\\?\`-free paths for normal drives; if a UNC path regression appears in `safeRemoveDirSync`, fall back to `realpathSync` (non-native) in `original-real-path.ts`.
- **Performance:** `copy()` is now synchronous under the hood; the two `copy` callers copy small trees. If a profile shows regressions, port `copyDirSync` to `fs/promises` one-to-one.
- **Whole-PR rollback:** revert the five commits; no caller changed.

## Decisions needed

None. The no-error-classes decision is backed by the Task 1 grep; reopen it only if that grep is not zero.
