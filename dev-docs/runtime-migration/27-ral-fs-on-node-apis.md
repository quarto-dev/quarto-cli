# PR 27: `fs.ts`, `temp.ts` and `errors.ts` on `node:` APIs; `walk`/`expandGlob` without `@std/fs`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement `src/deno_ral/fs.ts`, `src/deno_ral/temp.ts` and `src/deno_ral/errors.ts` on `node:fs`, `node:fs/promises`, `node:os` and `node:crypto`, including Quarto's own `walk`, `walkSync`, `expandGlob`, `expandGlobSync`, `ensureDir(Sync)`, `existsSync`, `copy(Sync)`, `moveSync`, `emptyDirSync` and `EOL`, so the filesystem layer has one implementation that runs on Deno 2 today and on Node after the flip.
**Phase:** 2. **Depends on:** PR 25 (boundary at zero: every caller already imports `src/deno_ral/fs.ts`, `temp.ts`, `errors.ts`; `original-real-path.ts` is deleted and `canonicalPathSync` replaces it), PR 26 (`tools/node-bundle/`: this PR edits the shim, and the `node-unit` job runs this PR's tests on real Node), PR 20b (`onFileRead` read-observer hook in `fs.ts`, kept here). Starts after Spike #2 closes (`SPIKES.md`). **Unblocks:** PR 27b, 31, 32.
**Branch:** `rt/27-ral-fs-on-node-apis`.
**Suggested executor:** Opus. The walk/glob semantics and the error mapping need judgement; the per-function rewrites are mechanical but numerous.
**Size:** S by file count, L by volume and judgement (3 source files rewritten, ~50 exported functions, 2 new test files, 1 extended, shim shrink).
**Ships on:** Deno; the whole existing suite must stay green. Node: the PR 26 `node-unit` job runs `tests/unit/ral/` (including this PR's new files) on real Node 26 on Linux and Windows; the entries for `fs`/`temp`/`errors` tests in `tools/node-bundle/known-failures.json` are removed by this PR, and none is added. `node tools/node-bundle/build.mjs --check-shim` reports `0 missing` and an empty `unused` list after the shim shrink.

## Spec

### Context

Assessment section 11, module plan row `fs.ts`: "`walk`/`expandGlob` stay re-exported from `@std/fs` until the flip, then are reimplemented on `node:fs`". Section 3.4: "`@std/fs` uses `Deno.*` internally. Re-implement the handful of helpers in the runtime layer on `node:fs`". Design rule 6: "Write each module on `node:` APIs and run it on Deno 2."

After PR 09–13 and PR 25, application code calls `readTextFileSync`, `statSync`, `walkSync`, `expandGlobSync` from `src/deno_ral/fs.ts`, which still delegates to `Deno.*` and to `fs/walk`, `fs/expand-glob`, `fs/copy`, `fs/move`, `fs/ensure-dir`, `fs/exists`, `fs/eol`, `fs/empty-dir` from `@std/fs` 1.0.16. This PR replaces those bodies. The public signatures (shared vocabulary in `_TEMPLATE.md`) do not change, so no caller changes.

Review findings on the earlier draft, all addressed here: it rewrote `src/deno_ral/original-real-path.ts`, which PR 25 deletes (this plan does not touch it); it never wrote the Node body of `canonicalPathSync`, which five PR 25 callers use (Task 3 writes it on `fs.realpathSync.native`); its temp-file loop retried every error while the vocabulary says `EEXIST` only (fixed); it made `copy()` synchronous on the claim that callers copy small trees, but `src/publish/gh-pages/gh-pages.ts:243` (`await copy(renderResult.baseDir, tempDir, { overwrite: true })`) copies a whole rendered site (both `copy` on `node:fs/promises` and `copySync` are provided); the async `walk` used `fsp.realpath` while the sync one used `realpathSync.native` (both now go through the layer's own `realPath`/`canonicalPathSync`, which use the same libuv `uv_fs_realpath`, and a test pins that they agree); it cited `tests/docs/websites/book`, which does not exist (`tests/docs/smoke-all/book/simple` is used).

Review of 2026-10-16 (`REVIEW-2026-10-16.md`, triage bucket C row 27), addressed here: `openFlags()`/`writeFlag()` translated Deno's independent `create`/`truncate`/`append` options into `node:fs` string flags that bundle them (`"w"` truncated a `{ write, create }` open and created a `{ write, truncate, create: false }` one; `"a"` created a missing file on append) and `{ create: false }` writes went through `"r+"` (R05): the layer now derives numeric flags (`openFlagBits()`, Interfaces, "Open flags"). `NodeFsFile` wrapped the same descriptor in a new `autoClose: true` stream on every getter access and `close()` swallowed `EBADF`, so a recycled descriptor could be closed (R06): the file is now the single owner of its descriptor and its streams close through it (Interfaces, "One descriptor owner"; triage decision A8). `copySymlink` picked the Windows link type from `lstat`, which describes the link, so every directory link became a file link (R19, a bug `@std/fs` 1.0.16 `copy.ts` has today): the type now comes from `stat` of the source with a dangling-link fallback (Task 4). The numeric flags, `writeFileSync(fd, data)` and the streams' `fs` option were checked on Node 26.12.0 and 22.22 (the Task 2 R05 and R06 cases, transliterated to `node:test` over the Task 3 bodies, pass on both; the second run was the re-read of the review's "Later validation" lines on 2026-10-16, which also removed the orphan tail of the test the R05 cases replaced and added the writer-closed-underneath and junction cases); on Deno 2.7.14 they are covered by the tests of Tasks 2 and 4, which run on both runtimes.

The normalising `realPathSync` that PR 09 introduced is gone from the vocabulary (PR 09 maps `Deno.realPathSync(` to `canonicalPathSync(`); this PR does not reintroduce it. `canonicalPathSync(path)` resolves symlinks, throws when `path` does not exist, and returns a path without the Windows `\\?\` prefix: libuv's `uv_fs_realpath` (behind both `fs.realpathSync.native` and `fs.promises.realpath`) strips `\\?\` and turns `\\?\UNC\` into `\\`, which is "removed by the runtime itself" in the vocabulary's words.

Verified in this sandbox on Node 22.22 and the pinned Deno 2.7.14 (`node:fs` compat): `readdirSync({ withFileTypes })` with `isSymbolicLink()`, `realpathSync.native`, `statSync` (`mtime`, `birthtime`, `mode`), `openSync(path, "wx")` → `EEXIST`, `rmSync` → `ENOENT` for a missing path and `ERR_FS_EISDIR` for a directory without `recursive`, `utimesSync`, `truncateSync`, `chmodSync`, `symlinkSync`, `readlinkSync` behave identically on both runtimes.

`@std/fs` semantics this PR preserves (read from the 1.0.16 sources: `walk.ts`, `expand_glob.ts`, `copy.ts`, `move.ts`, `ensure_dir.ts`, `empty_dir.ts`, `exists.ts`, `eol.ts`):

- `walk(root, { maxDepth = Infinity, includeFiles = true, includeDirs = true, includeSymlinks = true, followSymlinks = false, canonicalize = true, exts, match, skip })`: yields the root first (when `includeDirs` and it passes `exts`/`match`/`skip`); stops when `maxDepth < 1` or the root matches `skip`; for each entry: symlink + `!followSymlinks` → yield as a symlink entry (no descent); symlink + `followSymlinks` → `realPath`, re-`lstat`, path becomes the real path when `canonicalize`; directories recurse with `maxDepth - 1`; files yield when `includeFiles` and the filters pass. `exts` are normalised to a leading dot. `skip`/`match` test the **full path** (`path.match(regex)`), not the name. Throws the underlying error (NotFound for a missing root, PermissionDenied for an unreadable directory: `src/project/project-context.ts` tags that error).
- `expandGlob(glob, { root = cwd, exclude = [], includeDirs = true, extended = true, globstar = true, caseInsensitive = false, followSymlinks = false, canonicalize = true })`: splits the glob into segments; the non-glob leading segments form the fixed root; a missing fixed root yields nothing (NotFound swallowed, other errors thrown); `**` walks with `maxDepth: globstar ? Infinity : 1` and `skip: excludePatterns`; other segments match entry **names** one level down; results per segment are de-duplicated by path and sorted by path; trailing `/` keeps directories only; `includeDirs: false` drops directories; `exclude` globs are resolved against the root and compiled with `globToRegExp`. Yielded paths are absolute. The `?()` extglob in `**/README.?([Rrq])md` and the `**` globstar in `src/project/project-context.ts` `projectHiddenIgnoreGlob` come from `globToRegExp` (`@std/path`, pure TypeScript, kept).
- `copy(src, dest, { overwrite = false, preserveTimestamps = false })`: refuses to copy a directory into itself (`isSubdir`) with an Error; `dest` existing and `!overwrite` → AlreadyExists; a directory onto a non-directory → Error; symlinks are recreated as symlinks (on Windows with the type of the link's **target**, `statSync(src)`: a directory → `"dir"`, anything else or a dangling link → `"file"`; a junction, which `lstat` reports as a symlink and `readlink` resolves, is recreated as a directory symlink of that target; `@std/fs` 1.0.16 reads `lstat`, which describes the link itself, and so recreates every directory link as a file link: R19, not carried over); directories are created with `ensureDir` and recursed; `preserveTimestamps` copies `atime`/`mtime`.
- `moveSync(src, dest, { overwrite = false })`: a directory into its own subdirectory → Error; `overwrite` removes `dest` first (NotFound ignored); otherwise an existing `dest` → AlreadyExists; then `rename`. (Quarto's cross-device fallback is `safeMoveSync`, kept.)
- `ensureDir(Sync)`: `mkdir -p`; an existing non-directory → Error `Ensure path exists, expected 'dir', got 'file'`.
- `existsSync(path)`: `statSync` succeeds → true (follows symlinks: a dangling link is false); NotFound → false; PermissionDenied → true (the path exists but is not readable); other errors thrown.
- `emptyDirSync(dir)`: creates it, or removes every entry inside it.
- `EOL` is `"\r\n"` on Windows, `"\n"` elsewhere; `LF = "\n"`; `format(content, eol)` normalises all line endings to `eol`.

### Scope

In:
- Rewrite `src/deno_ral/fs.ts`, `src/deno_ral/temp.ts`, `src/deno_ral/errors.ts` on `node:` APIs; no `Deno.*` (outside `errors.ts`'s guarded fallback) and no `@std/fs` import remains in them. `canonicalPathSync` on `fs.realpathSync.native`; `realPath` on `fs.promises.realpath`; PR 20b's `onFileRead` hook kept.
- Keep every helper the file exports today (`isSubdir`, `toPathString`, `safeMoveSync`, `safeRemoveSync`, `safeExistsFileSync`, `UnsafeRemovalError`, `safeRemoveDirSync`, `safeModeFromFile`, `safeChmodSync`, `ensureUserWritable`, `getFileInfoType`, `PathType`, `WalkEntry`, `ExpandGlobOptions`, `CopyOptions`).
- Unit tests for walk/glob/copy semantics and the Node-specific behaviours under `tests/unit/ral/` (the directory the PR 26 `node-unit` job runs on real Node).
- Shrink `tools/node-bundle/deno-shim.mjs` by the members this PR makes unused; remove the now-passing `fs`/`temp`/`errors` entries from `tools/node-bundle/known-failures.json`.

Out:
- Any caller change (signatures unchanged). If a caller breaks, the PR 09 contract test was incomplete: add the missing case to the PR 09 test file and fix the implementation here.
- `src/deno_ral/original-real-path.ts` (deleted by PR 25) and the normalising `realPathSync` (removed from the vocabulary).
- `src/deno_ral/path.ts` (stays on `@std/path`; it is pure).
- `env.ts`, `platform.ts`, `tar.ts`, `log.ts` (PR 27b); `process.ts`, `net.ts`, `http.ts`, `watch.ts`, `kv.ts` (PR 28–30).
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
/** Symlinks resolved, Windows `\\?\` prefix removed (libuv), throws when `path` does not exist. Node: fs.realpathSync.native. */
export function canonicalPathSync(path: string | URL): string;
/** Async counterpart, same libuv call (fs.promises.realpath). */
export function realPath(path: string | URL): Promise<string>;
/** PR 20b: read-observer hook (core/performance/metrics.ts); returns the unsubscribe function. */
export function onFileRead(listener: (path: string) => void): () => void;
export interface MoveOptions { overwrite?: boolean; }
export function walk(root: string | URL, options?: WalkOptions): AsyncIterableIterator<WalkEntry>;
export function walkSync(root: string | URL, options?: WalkOptions): IterableIterator<WalkEntry>;
export function expandGlob(glob: string | URL, options?: ExpandGlobOptions): AsyncIterableIterator<WalkEntry>;
export function expandGlobSync(glob: string | URL, options?: ExpandGlobOptions): IterableIterator<WalkEntry>;
export function ensureDir(dir: string | URL): Promise<void>;
export function ensureDirSync(dir: string | URL): void;
export function existsSync(path: string | URL): boolean;
/** Async, on node:fs/promises: never blocks the event loop (gh-pages.ts:243 copies a whole site). */
export function copy(src: string | URL, dest: string | URL, options?: CopyOptions): Promise<void>;
/** Same semantics, synchronous. */
export function copySync(src: string | URL, dest: string | URL, options?: CopyOptions): void;
export function moveSync(src: string | URL, dest: string | URL, options?: MoveOptions): void;
export function emptyDirSync(dir: string | URL): void;
export const EOL: "\n" | "\r\n"; export const LF: "\n"; export const CRLF: "\r\n";
export function format(content: string, eol: "\n" | "\r\n"): string;
```

Error behaviour (note: a `Deno.errors.AlreadyExists` constructed by `@std/fs` has no `code`, verified on Deno 2.7.14, which is why `errors.ts` keeps the guarded `instanceof` fallback for the remaining Deno-native paths): every function throws the `node:fs` error unchanged (an `Error` with `code` set to `ENOENT`, `EEXIST`, `EACCES`, `EPERM`, `ENOTEMPTY`, …). `errors.ts` predicates recognise the `code`; no Quarto error class is introduced. Rationale: after PR 25 there is no `instanceof Deno.errors.X` left in `src/` (Task 1 verifies this with a grep that must print 0), so classes have no consumer. `copy`/`moveSync`/`ensureDir` throw errors constructed here with the same `code` values (`EEXIST`, `ENOTSUP`) so the predicates apply to them too.

Two rules this PR owns (review R05 and R06; PR 35's shim and any later `FsFile` implementation follow them):

**Open flags.** `node:fs` string flags bundle create, truncate and append (`"w"` is `O_WRONLY | O_CREAT | O_TRUNC`, `"a"` is `O_WRONLY | O_CREAT | O_APPEND`); Deno's options are independent. The layer derives a numeric flag set and implies nothing:

```ts
/**
 * Numeric node:fs open flags from Deno-style options. Access: O_RDWR when read
 * (default true) and write or append, O_WRONLY when write or append only,
 * O_RDONLY otherwise. O_CREAT iff create, O_TRUNC iff truncate, O_APPEND iff
 * append. `create` without write or append, or `truncate` without write, is a
 * TypeError (Deno.open does the same). Exported so that PR 35's shim copies
 * one rule instead of keeping a second, weaker flag table.
 */
export function openFlagBits(options?: OpenOptions): number;
```

`writeTextFile(Sync)`/`writeFile(Sync)` open with `openFlagBits({ write: true, create: options.create ?? true, truncate: !options.append, append: options.append })`, which is how `Deno.writeFile` maps its options, and write through the descriptor; no `"w"`, `"a"` or `"r+"` string flag remains in `fs.ts`. So `{ create: false }` truncates an existing file and fails with `ENOENT` on a missing one, `{ append: true, create: false }` never creates, and shorter replacement content leaves no trailing bytes.

**One descriptor owner.** An `FsFile` owns its descriptor until it is closed. `readable` and `writable` are created once and cached. The Node streams behind them are given an `fs` option whose `close` is routed to the object's `close()`, so they never call `fs.close` on a number the object may already have released and the OS reused; reaching EOF, cancelling the readable, closing or aborting the writable therefore close the file exactly once (Deno semantics, triage A8). `close()` is idempotent and records the closed state; afterwards `read`, `write`, `writeSync` and the streams fail with an `EBADF` error instead of touching a recycled descriptor. Closing the file while its readable is mid-flight fails the next read with `EBADF`, as Deno's `BadResource` does. The writable differs in one timing: Node's `Writable.toWeb` resolves a `write()` as soon as the chunk is buffered, so one `write()` issued after `close()` still resolves; the underlying write then fails with `EBADF`, which errors the stream, and `closed`, `ready` and every later `write()` reject with it while the buffered bytes are never written (measured on Node 26.12.0 and 22.22). A caller that closes a file under its own writer learns of it from `closed` or the next `write()`, never through a write on a recycled descriptor.

### Files

- Modify: `src/deno_ral/errors.ts` (entire body)
- Modify: `src/deno_ral/fs.ts` (entire body)
- Modify: `src/deno_ral/temp.ts` (entire body)
- Modify: `tools/node-bundle/deno-shim.mjs` (delete the members `--check-shim` reports unused)
- Modify: `tools/node-bundle/known-failures.json` (remove entries for the files below that now pass on Node)
- Test: `tests/unit/ral/fs-walk-glob.test.ts` (new)
- Test: `tests/unit/ral/fs-node-semantics.test.ts` (new)
- Test: `tests/unit/ral/errors.test.ts` (PR 09; one case appended), `tests/unit/ral/fs.test.ts`, `tests/unit/ral/temp.test.ts` (PR 09; one case changed in `temp.test.ts`, see Task 3). Assumes PR 09 landed with these names under `tests/unit/ral/` (vocabulary rule: layer tests live there); if they differ, the contract is whatever `ls tests/unit/ral/` shows.

### Acceptance criteria

- `grep -n "Deno\." src/deno_ral/fs.ts src/deno_ral/temp.ts src/deno_ral/errors.ts` prints nothing except inside `errors.ts`'s guarded `globalThis.Deno` check; `test -e src/deno_ral/original-real-path.ts` fails (PR 25 deleted it; this PR does not recreate it); `grep -c "export function realPathSync" src/deno_ral/fs.ts` → `0`.
- `grep -n '"fs/' src/deno_ral/fs.ts` prints nothing (no `@std/fs` import).
- `grep -cE 'autoClose|"(w|a|r\+|w\+|a\+|wx)"' src/deno_ral/fs.ts` → `0` (open flags are numeric, `openFlagBits`; the streams never own the descriptor).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') $(find unit/project/ -name '*.test.ts') $(find unit/render/ -name '*.test.ts') unit/path.test.ts unit/file-permissions.test.ts $(find smoke/render/ -name '*.test.ts')` passes.
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` passes on Linux with no `fs`/`temp`/`errors`/`fs-walk-glob`/`fs-node-semantics` entry left in the list (the `node-unit` job checks the same on Windows).
- `quarto run --dev tools/check-runtime-boundary.ts` stays at zero.
- `node tools/node-bundle/build.mjs --check-shim` prints `0 missing` and no `unused` list, with fewer referenced members than on `main`.
- The PR 26 `node-render` job renders `simple.qmd`, the website and `jupyter.qmd` with an empty normalised diff.

## Plan

### Task 1: Confirm the error-class decision and rewrite `errors.ts`

**Files:**
- Modify: `src/deno_ral/errors.ts`
- Test: `tests/unit/ral/errors.test.ts` (PR 09)

- [ ] **Step 1: Verify no `instanceof Deno.errors` consumer remains**

Run: `grep -rn "instanceof Deno.errors" src/ package/src tests/ --include=*.ts | grep -v "src/deno_ral/" | wc -l`
Expected: `0`. If not 0, PR 25's ratchet was bypassed: convert each site to the matching predicate from `src/deno_ral/errors.ts` first (same mechanical change as PR 10–13) and commit that separately.

- [ ] **Step 2: Add a Node-code test case to the PR 09 contract test**

Append to `tests/unit/ral/errors.test.ts`:

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
  assert(isNotFound(new Error("spawn failed", { cause: Object.assign(new Error("x"), { code: "ENOENT" }) })), "code on cause");
  assert(!isNotFound(new Error("plain")));
  assert(!isNotFound("not an error"));
});
```

(Imports: `fail`, `assert` from `../../asserts.ts`; `makeTempDirSync` from `../../../src/deno_ral/temp.ts`; `removeSync` from `../../../src/deno_ral/fs.ts`; the five predicates from `../../../src/deno_ral/errors.ts`. Add whichever the file does not import yet.)

- [ ] **Step 3: Run it; the Deno-era predicates may already pass (Deno 2 sets `code`), either way continue**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/errors.test.ts`
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
 * same `code` on its own error classes. Predicates check the code (on the
 * error, then on its `cause`) and fall back to the Deno class only while a
 * Deno-native path still exists (Deno.Kv until PR 30, the bundle's
 * temporary shim until PR 33).
 */

function ownCode(e: unknown): string | undefined {
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

// `exec`/`spawn` errors for a missing executable carry code "ENOENT" on the
// error or, on Deno, on its `cause` (vocabulary, errors.ts).
function codeOf(e: unknown): string | undefined {
  return ownCode(e) ??
    (e && typeof e === "object" && "cause" in e ? ownCode((e as { cause?: unknown }).cause) : undefined);
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
  if (typeof cls !== "function") return false;
  const cause = e && typeof e === "object" && "cause" in e ? (e as { cause?: unknown }).cause : undefined;
  return e instanceof cls || cause instanceof cls;
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

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/errors.test.ts`
Expected: all green, including `errors - predicates recognise node:fs error codes`.

- [ ] **Step 6: Commit**

```bash
git add src/deno_ral/errors.ts tests/unit/ral/errors.test.ts
git commit -m "deno_ral/errors: code-first predicates for node: errors"
```

### Task 2: Node-semantics test for the plain fs calls

**Files:**
- Create: `tests/unit/ral/fs-node-semantics.test.ts`

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
  openSync,
  readDirSync,
  canonicalPathSync,
  readTextFileSync,
  realPath,
  removeSync,
  statSync,
  symlinkSync,
  writeTextFile,
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

unitTest("fs - writeTextFile(Sync): create, truncate and append are independent (R05)", async () => {
  const dir = scratch();
  const f = join(dir, "x.txt");
  writeTextFileSync(f, "123456");
  writeTextFileSync(f, "ab", { create: false });
  assertEquals(readTextFileSync(f), "ab", "create:false truncates: no trailing bytes of the longer content remain");
  writeTextFileSync(f, "Z", { append: true });
  assertEquals(readTextFileSync(f), "abZ");
  for (const options of [{ create: false }, { append: true, create: false }]) {
    try {
      writeTextFileSync(join(dir, "nope.txt"), "x", options);
      assert(false, `expected NotFound for ${JSON.stringify(options)}`);
    } catch (e) {
      assert(isNotFound(e), `expected NotFound for ${JSON.stringify(options)}, got ${e}`);
    }
  }
  assert(!existsSync(join(dir, "nope.txt")), "create:false never created the file");
  await writeTextFile(f, "123456");
  await writeTextFile(f, "ab", { create: false });
  assertEquals(readTextFileSync(f), "ab", "the async variant truncates too");
  await writeTextFile(f, "Z", { append: true });
  assertEquals(readTextFileSync(f), "abZ");
  removeSync(dir, { recursive: true });
});

unitTest("fs - openSync: create, truncate and append are independent (R05)", async () => {
  const dir = scratch();
  const f = join(dir, "x.txt");
  const enc = new TextEncoder();
  writeTextFileSync(f, "123456");
  openSync(f, { write: true, create: true }).close();
  assertEquals(readTextFileSync(f), "123456", "write+create does not truncate an existing file");
  openSync(f, { write: true, truncate: true }).close();
  assertEquals(readTextFileSync(f), "", "truncate truncates");
  for (const options of [{ write: true, truncate: true }, { append: true }, { write: true }]) {
    try {
      openSync(join(dir, "missing.txt"), options).close();
      assert(false, `expected NotFound for ${JSON.stringify(options)}`);
    } catch (e) {
      assert(isNotFound(e), `expected NotFound for ${JSON.stringify(options)}, got ${e}`);
    }
  }
  assert(!existsSync(join(dir, "missing.txt")), "no combination without create created the file");
  const a = openSync(f, { append: true });
  a.writeSync(enc.encode("A"));
  a.close();
  const b = openSync(f, { append: true, create: true });
  b.writeSync(enc.encode("B"));
  b.close();
  assertEquals(readTextFileSync(f), "AB", "append writes at the end and keeps the content");
  assertThrows(() => openSync(f, { create: true }), TypeError, "create", "create without write or append is a TypeError, as on Deno");
  assertThrows(() => openSync(f, { append: true, truncate: true }), TypeError, "truncate", "truncate requires write");
  removeSync(dir, { recursive: true });
});

unitTest("FsFile - one descriptor owner: EOF, cancel, writer close and close() coordinate (R06)", async () => {
  const dir = scratch();
  const f = join(dir, "f.txt");
  writeTextFileSync(f, "hello");
  const enc = new TextEncoder();
  // The Node stream destroys itself, and so closes the file, a tick after EOF or finish.
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const a = openSync(f);
  assert(a.readable === a.readable, "the readable stream is created once");
  assertEquals(await new Response(a.readable).text(), "hello");
  await tick();
  // EOF closed the descriptor; the next open may reuse its number. close()
  // on the closed file must be a no-op, never a close of the unrelated file.
  const other = openSync(f);
  a.close();
  a.close();
  assertEquals(await other.read(new Uint8Array(5)), 5, "close() on a closed FsFile never touches a recycled descriptor");
  other.close();
  try {
    await a.read(new Uint8Array(1));
    assert(false, "expected EBADF");
  } catch (e) {
    assertEquals((e as { code?: string }).code, "EBADF", "operations after close fail instead of using a recycled descriptor");
  }
  const b = openSync(f);
  await b.readable.cancel();
  await tick();
  const other2 = openSync(f);
  b.close(); // the cancel already closed it: no-op
  assertEquals(await other2.read(new Uint8Array(2)), 2);
  other2.close();
  const g = join(dir, "g.txt");
  const w = openSync(g, { write: true, create: true, truncate: true });
  assert(w.writable === w.writable, "the writable stream is created once");
  w.writeSync(enc.encode("0"));
  const writer = w.writable.getWriter();
  await writer.write(enc.encode("abc"));
  await writer.close();
  await tick();
  assertEquals(readTextFileSync(g), "0abc", "direct and stream writes share one descriptor and one position");
  w.close(); // the writer's close already closed the file: no-op
  const x = openSync(g, { write: true });
  await x.writable.getWriter().abort(new Error("stop"));
  await tick();
  const other3 = openSync(g);
  x.close(); // closed by the abort: no-op
  assertEquals(await other3.read(new Uint8Array(4)), 4);
  other3.close();
  const y = openSync(f);
  const stream = y.readable;
  y.close();
  try {
    await new Response(stream).text();
    assert(false, "expected EBADF");
  } catch (e) {
    assertEquals((e as { code?: string }).code, "EBADF", "a stream over an explicitly closed file fails instead of reading a recycled descriptor");
  }
  // A writer whose file is closed underneath it. Writable.toWeb resolves a
  // write() as soon as the chunk is buffered, so the first write() after
  // close() resolves; the underlying write then fails with EBADF, which errors
  // the stream: closed, ready and every later write() reject with it, and the
  // buffered chunk never reaches a recycled descriptor (Node 26.12.0 and 22.22).
  const z = openSync(g, { write: true });
  const zw = z.writable.getWriter();
  z.close();
  await zw.write(enc.encode("q")); // buffered: resolves
  let closedWith: unknown;
  await zw.closed.catch((e) => (closedWith = e));
  assertEquals((closedWith as { code?: string }).code, "EBADF", "the closed file reaches the writer as EBADF on closed");
  try {
    await zw.write(enc.encode("r"));
    assert(false, "expected EBADF");
  } catch (e) {
    assertEquals((e as { code?: string }).code, "EBADF", "and on every later write()");
  }
  assertEquals(readTextFileSync(g), "0abc", "the buffered chunk was not written");
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
  assertEquals(canonicalPathSync(link), canonicalPathSync(target));
  // Async and sync resolve through the same libuv call and agree.
  assertEquals(await realPath(link), canonicalPathSync(link));
  assert(statSync(target).mtime instanceof Date);
  assertEquals(typeof statSync(target).size, "number");
  removeSync(dir, { recursive: true });
});

unitTest("fs - canonicalPathSync throws NotFound for a missing path and has no Windows \\\\?\\ prefix", async () => {
  const dir = scratch();
  try {
    canonicalPathSync(join(dir, "missing"));
    assert(false, "expected NotFound");
  } catch (e) {
    assert(isNotFound(e), `expected NotFound, got ${e}`);
  }
  const resolved = canonicalPathSync(dir);
  assert(!resolved.startsWith("\\\\?\\"), `unexpected long-path prefix: ${resolved}`);
  if (isWindows) assert(/^[A-Za-z]:\\/.test(resolved), `expected a drive-letter path, got ${resolved}`);
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

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs-node-semantics.test.ts`
Expected: all cases may already pass on the PR 09 (Deno) body; the file is the contract for the Node body written in Task 3.

- [ ] **Step 3: Commit the test**

```bash
git add tests/unit/ral/fs-node-semantics.test.ts
git commit -m "tests: pin node-sensitive fs semantics for deno_ral/fs"
```

### Task 3: Rewrite the plain calls and `temp.ts`

**Files:**
- Modify: `src/deno_ral/fs.ts` (plain calls section; walk/glob come in Task 4)
- Modify: `src/deno_ral/temp.ts`
- Modify: `tests/unit/ral/temp.test.ts` (one case)

- [ ] **Step 1: Pin the retry rule in the PR 09 temp test**

The vocabulary retries 5 times on `isAlreadyExists(e)` only. If `tests/unit/ral/temp.test.ts` contains PR 09's case expecting a missing parent directory to be retried, replace it with:

```ts
unitTest("temp - a missing parent directory fails at once with NotFound (only EEXIST is retried)", async () => {
  const dir = makeTempDirSync({ prefix: "rt27-temp-" });
  const missing = join(dir, "does-not-exist");
  let caught: unknown;
  try {
    makeTempFileSync({ dir: missing });
  } catch (e) {
    caught = e;
  }
  assert(isNotFound(caught), `expected NotFound, got ${caught}`);
  removeSync(dir, { recursive: true });
});
```

(Imports, adding whichever the file lacks: `assert` from `../../asserts.ts`; `isNotFound` from `../../../src/deno_ral/errors.ts`; `join` from `../../../src/deno_ral/path.ts`; `removeSync` from `../../../src/deno_ral/fs.ts`.)

- [ ] **Step 2: Replace `temp.ts`**

```ts
/*
 * temp.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Temporary files and directories: <dir ?? os.tmpdir()>/<prefix><12 hex><suffix>.
 * Retries 5 times on EEXIST only (vocabulary; the retry loop from the former
 * core/deno/monkey-patch.ts). Any other error is thrown at once.
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

// 5 attempts on a name collision (EEXIST), each debug-logged; the last
// collision is rethrown. Any other error (ENOENT parent, EACCES) is thrown
// at once: retrying cannot fix it.
function withAttempts<T>(fn: () => T): T {
  let last: unknown;
  for (let i = 0; i < kMaxAttempts; i++) {
    try {
      return fn();
    } catch (e) {
      if (!isAlreadyExists(e)) throw e;
      last = e;
      debug(`Temp path collision, retrying: ${e instanceof Error ? e.message : e}`);
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
      if (!isAlreadyExists(e)) throw e;
      last = e;
      debug(`Temp path collision, retrying: ${e instanceof Error ? e.message : e}`);
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

// ---------------------------------------------------------------- read observers (PR 20b)
// core/performance/metrics.ts subscribes to count file reads under --profile.
// Notified by the same functions PR 20b instrumented (readTextFileSync and
// readTextFile); check with `grep -n "notifyRead" src/deno_ral/fs.ts` on main
// before rewriting and keep exactly that set.
const readListeners = new Set<(path: string) => void>();
export function onFileRead(listener: (path: string) => void): () => void {
  readListeners.add(listener);
  return () => readListeners.delete(listener);
}
function notifyRead(path: string): void {
  for (const l of readListeners) l(path);
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

// Deno.writeFile maps its options to open options exactly like this (create
// defaults to true; a non-append write truncates). openFlagBits() keeps
// create, truncate and append independent (review R05: "w" created when
// create was false, "a" created a missing file, "r+" kept the tail of longer
// content), and the data is written through the descriptor.
function writeOpenFlags(options?: WriteOptions): number {
  return openFlagBits({ write: true, create: options?.create ?? true, truncate: !options?.append, append: options?.append });
}

function writeSyncImpl(path: string | URL, data: string | Uint8Array, options?: WriteOptions): void {
  const fd = nodeFs.openSync(toPathString(path), writeOpenFlags(options), options?.mode);
  try {
    nodeFs.writeFileSync(fd, data); // given a descriptor: writes at its position (the end under O_APPEND)
  } finally {
    nodeFs.closeSync(fd);
  }
}

async function writeImpl(path: string | URL, data: string | Uint8Array, options?: WriteOptions): Promise<void> {
  const handle = await nodeFsp.open(toPathString(path), writeOpenFlags(options), options?.mode);
  try {
    await handle.writeFile(data);
  } finally {
    await handle.close();
  }
}

export function readTextFileSync(path: string | URL): string {
  notifyRead(toPathString(path));
  try {
    return nodeFs.readFileSync(toPathString(path), "utf8");
  } catch (e) {
    throw e instanceof Error ? errorWithPath(e, toPathString(path)) : e;
  }
}
export async function readTextFile(path: string | URL): Promise<string> {
  notifyRead(toPathString(path));
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
// fs.promises.realpath is libuv's uv_fs_realpath, the same call as
// fs.realpathSync.native, so realPath and canonicalPathSync agree.
export function realPath(path: string | URL): Promise<string> {
  return nodeFsp.realpath(toPathString(path));
}
// Symlinks resolved, Windows "\\?\" prefix removed by libuv, throws when the
// path does not exist (vocabulary; PR 09 introduced it on Deno.realPathSync).
export function canonicalPathSync(path: string | URL): string {
  return nodeFs.realpathSync.native(toPathString(path));
}
export function chmod(path: string | URL, mode: number): Promise<void> {
  return nodeFsp.chmod(toPathString(path), mode);
}

// ---------------------------------------------------------------- open / create (PR 09 additions)

// One descriptor owner (review R06, triage A8). The object owns #fd until it
// is closed, by close() or by one of its streams finishing: the Node streams
// are created with an `fs` option whose `close` is routed to close() below, so
// they never call fs.close on a number this object may already have released
// and the OS reused. autoClose (default true) then only means "destroy the
// stream at EOF/finish", and destroy reaches close() here. Reading to EOF,
// cancelling the readable, closing or aborting the writable close the file,
// as on Deno. After close(), every operation fails with EBADF.
class NodeFsFile implements FsFile {
  #fd: number | null;
  #path: string;
  #readable?: ReadableStream<Uint8Array>;
  #writable?: WritableStream<Uint8Array>;
  constructor(fd: number, path: string) {
    this.#fd = fd;
    this.#path = path;
  }
  #use(): number {
    if (this.#fd === null) throw codedError(`file is closed: ${this.#path}`, "EBADF");
    return this.#fd;
  }
  // The streams' view of node:fs: real open/read/write, close routed here.
  #streamFs() {
    return {
      open: nodeFs.open,
      read: nodeFs.read,
      write: nodeFs.write,
      writev: nodeFs.writev,
      close: (_fd: number, cb: (err: NodeJS.ErrnoException | null) => void) => {
        try {
          this.close();
          cb(null);
        } catch (e) {
          cb(e as NodeJS.ErrnoException);
        }
      },
    };
  }
  get readable(): ReadableStream<Uint8Array> {
    this.#readable ??= Readable.toWeb(
      nodeFs.createReadStream(this.#path, { fd: this.#use(), fs: this.#streamFs() }),
    ) as ReadableStream<Uint8Array>;
    return this.#readable;
  }
  get writable(): WritableStream<Uint8Array> {
    this.#writable ??= Writable.toWeb(
      nodeFs.createWriteStream(this.#path, { fd: this.#use(), fs: this.#streamFs() }),
    ) as WritableStream<Uint8Array>;
    return this.#writable;
  }
  read(p: Uint8Array): Promise<number | null> {
    return new Promise((resolve, reject) => {
      nodeFs.read(this.#use(), p, 0, p.length, null, (err, n) => (err ? reject(err) : resolve(n === 0 ? null : n)));
    });
  }
  write(p: Uint8Array): Promise<number> {
    return new Promise((resolve, reject) => {
      nodeFs.write(this.#use(), p, 0, p.length, null, (err, n) => (err ? reject(err) : resolve(n)));
    });
  }
  writeSync(p: Uint8Array): number {
    return nodeFs.writeSync(this.#use(), p);
  }
  close(): void {
    const fd = this.#fd;
    if (fd === null) return; // idempotent: never closeSync a number the OS may have given to another file
    this.#fd = null;
    nodeFs.closeSync(fd);
  }
}

// The open-flag rule (Interfaces, "Open flags"): nothing is implied between
// create, truncate and append. node:fs string flags bundle them ("w" is
// O_WRONLY | O_CREAT | O_TRUNC, "a" is O_WRONLY | O_CREAT | O_APPEND), which
// was review R05. PR 35's shim copies this function.
export function openFlagBits(options?: OpenOptions): number {
  const o = options ?? {};
  const read = o.read ?? true;
  const write = o.write === true || o.append === true;
  if (o.create && !write) throw new TypeError("'create' requires 'write' or 'append'");
  if (o.truncate && !o.write) throw new TypeError("'truncate' requires 'write'");
  const { O_RDONLY, O_WRONLY, O_RDWR, O_CREAT, O_TRUNC, O_APPEND } = nodeFs.constants;
  let bits = read && write ? O_RDWR : write ? O_WRONLY : O_RDONLY;
  if (o.create) bits |= O_CREAT;
  if (o.truncate) bits |= O_TRUNC;
  if (o.append) bits |= O_APPEND;
  return bits;
}

export function openSync(path: string | URL, options?: OpenOptions): FsFile {
  const p = toPathString(path);
  return new NodeFsFile(nodeFs.openSync(p, openFlagBits(options), options?.mode), p);
}
export async function open(path: string | URL, options?: OpenOptions): Promise<FsFile> {
  return openSync(path, options);
}
// Deno.create is open with { read, write, create, truncate }.
export async function create(path: string | URL): Promise<FsFile> {
  return openSync(path, { read: true, write: true, create: true, truncate: true });
}
export function readLinkSync(path: string | URL): string {
  return nodeFs.readlinkSync(toPathString(path));
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

```

Keep `fs/walk`, `fs/expand-glob`, `fs/copy`, `fs/move` re-exports for one more commit (Task 4 replaces them). The former `isSubdir`/`safe*` helpers follow unchanged.

- [ ] **Step 4: Run the contract tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') $(find unit/ral/ -name '*.test.ts')`
Expected: all green, including `fs-node-semantics.test.ts` and PR 09's `temp.test.ts` (`makeTempFileSync({ prefix: "a", suffix: ".txt" })` yields `<tmp>/a<hex>.txt`; a missing parent fails at once with NotFound).

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/fs.ts src/deno_ral/temp.ts tests/unit/ral/temp.test.ts
git commit -m "deno_ral: fs plain calls and temp files on node:fs"
```

### Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`

**Files:**
- Create: `tests/unit/ral/fs-walk-glob.test.ts`
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
  copy,
  copySync,
  ensureDirSync,
  existsSync,
  expandGlob,
  expandGlobSync,
  lstatSync,
  moveSync,
  readTextFileSync,
  removeSync,
  statSync,
  symlinkSync,
  walk,
  walkSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";
import { isAlreadyExists } from "../../../src/deno_ral/errors.ts";
import { symlinkSync as nodeSymlinkSync } from "node:fs"; // junction fixture only (R19)

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

unitTest("copy(Sync) - a directory symlink keeps its target's type, a dangling link stays dangling (R19)", async () => {
  const dir = makeTempDirSync({ prefix: "rt27-links-" });
  ensureDirSync(join(dir, "src", "target"));
  writeTextFileSync(join(dir, "src", "target", "t.txt"), "t");
  try {
    symlinkSync("target", join(dir, "src", "rel-dir"), { type: "dir" }); // relative: resolves at src/ and, once copied, at out/
    symlinkSync(join(dir, "src", "target"), join(dir, "src", "abs-dir"), { type: "dir" });
    symlinkSync(join(dir, "src", "gone"), join(dir, "src", "dangling"));
    // A junction, Windows only and through node:fs (the layer exposes no
    // junction type because Quarto creates none): lstat reports a symlink,
    // readlink gives its absolute target, stat a directory, so copy recreates
    // it as a "dir" symlink to that target (Context, the `copy` bullet).
    if (isWindows) nodeSymlinkSync(join(dir, "src", "target"), join(dir, "src", "junction"), "junction");
  } catch (e) {
    if (isWindows && (e as { code?: string }).code === "EPERM") {
      removeSync(dir, { recursive: true });
      return; // this runner has no symlink privilege; the node-unit job on Windows has
    }
    throw e;
  }
  copySync(join(dir, "src"), join(dir, "out-sync"));
  await copy(join(dir, "src"), join(dir, "out-async"));
  for (const out of ["out-sync", "out-async"]) {
    for (const name of isWindows ? ["rel-dir", "abs-dir", "junction"] : ["rel-dir", "abs-dir"]) {
      const copied = join(dir, out, name);
      assert(lstatSync(copied).isSymlink, `${out}/${name} is a symlink`);
      assert(statSync(copied).isDirectory, `${out}/${name} resolves to a directory (on Windows: a "dir" link, not a "file" link)`);
      assertEquals(readTextFileSync(join(copied, "t.txt")), "t");
    }
    assert(lstatSync(join(dir, out, "dangling")).isSymlink, `${out}/dangling is recreated as a link`);
    assert(!existsSync(join(dir, out, "dangling")), "and still dangles");
  }
  removeSync(dir, { recursive: true });
});

unitTest("copy (async) - same semantics as copySync, and other work runs while it copies", async () => {
  const dir = fixture();
  // A tree large enough that a synchronous copy would starve the timer below.
  for (let i = 0; i < 300; i++) writeTextFileSync(join(dir, "posts", `bulk-${i}.md`), "x".repeat(4096));
  const out = join(dir, "..", "async-copy");
  let ticks = 0;
  const timer = setInterval(() => ticks++, 1);
  await copy(join(dir, "posts"), out);
  clearInterval(timer);
  assertEquals(readTextFileSync(join(out, "a.qmd")), "a");
  assertEquals(readTextFileSync(join(out, "bulk-299.md")).length, 4096);
  assert(ticks > 0, "the event loop ran during copy()");
  let threw = false;
  try {
    await copy(join(dir, "posts"), out);
  } catch (e) {
    threw = isAlreadyExists(e);
  }
  assert(threw, "async copy onto existing dest without overwrite is AlreadyExists");
  writeTextFileSync(join(dir, "posts", "a.qmd"), "a3");
  await copy(join(dir, "posts"), out, { overwrite: true, preserveTimestamps: true });
  assertEquals(readTextFileSync(join(out, "a.qmd")), "a3");
  if (!isWindows) {
    await copy(join(dir, "renv"), join(dir, "..", "renv-async"));
    assert(lstatSync(join(dir, "..", "renv-async", "library", "loop")).isSymlink, "symlinks are copied as symlinks");
  }
  let into = false;
  try {
    await copy(join(dir, "posts"), join(dir, "posts", "nested"));
  } catch (e) {
    into = e instanceof Error && /subdirectory of itself/.test(e.message);
  }
  assert(into, "copy into its own subtree is refused");
  removeSync(join(dir, ".."), { recursive: true });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs-walk-glob.test.ts`
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
      // Same resolution as the async walk: libuv uv_fs_realpath.
      const resolved = canonicalPathSync(path);
      if (canonicalize) path = resolved;
      ({ isSymlink, isDirectory } = lstatSync(resolved));
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
      const resolved = await realPath(path);
      if (canonicalize) path = resolved;
      ({ isSymlink, isDirectory } = await lstat(resolved));
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

// Windows is the only platform where symlinkSync's type matters (R19). lstat
// describes the link, not its target: @std/fs 1.0.16 copy.ts reads it and so
// recreates every directory link as a file link, which this PR does not carry
// over. stat follows the link where it is, at `src`, so a relative target
// resolves there; Node's own autodetection (type omitted) resolves it against
// `dest`, whose sibling entries may not have been copied yet. A dangling link
// (ENOENT, ENOTDIR) or a loop (ELOOP) becomes a "file" link. A junction is a
// symlink to lstat and readlink gives its target: it is recreated as a
// directory symlink of that target; this PR creates no junctions.
const kNoTarget = new Set(["ENOENT", "ENOTDIR", "ELOOP"]);
function symlinkTypeSync(src: string): "dir" | "file" | undefined {
  if (!isWindows) return undefined;
  try {
    return nodeFs.statSync(src).isDirectory() ? "dir" : "file";
  } catch (e) {
    if (kNoTarget.has((e as NodeJS.ErrnoException).code ?? "")) return "file";
    throw e;
  }
}

function copySymlinkSync(src: string, dest: string, options: CopyOptions): void {
  const originSrcFilePath = nodeFs.readlinkSync(src);
  const type = symlinkTypeSync(src);
  if (ensureValidCopySync(src, dest, options)) nodeFs.unlinkSync(dest);
  nodeFs.symlinkSync(originSrcFilePath, dest, type);
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

// Async variant on node:fs/promises, same semantics as copySync. It must not
// block the event loop: src/publish/gh-pages/gh-pages.ts:243 copies a whole
// rendered site, and src/command/dev-call/show-ast-trace/cmd.ts:25 a tree.
async function ensureValidCopy(src: string, dest: string, options: CopyOptions & { isFolder?: boolean }): Promise<FileInfo | undefined> {
  let destStat: FileInfo;
  try {
    destStat = await lstat(dest);
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

async function copyFileEntry(src: string, dest: string, options: CopyOptions): Promise<void> {
  await ensureValidCopy(src, dest, options);
  await nodeFsp.copyFile(src, dest);
  if (options.preserveTimestamps) {
    const info = await nodeFsp.stat(src);
    await nodeFsp.utimes(dest, info.atime, info.mtime);
  }
}

async function symlinkType(src: string): Promise<"dir" | "file" | undefined> {
  if (!isWindows) return undefined;
  try {
    return (await nodeFsp.stat(src)).isDirectory() ? "dir" : "file";
  } catch (e) {
    if (kNoTarget.has((e as NodeJS.ErrnoException).code ?? "")) return "file";
    throw e;
  }
}

async function copySymlink(src: string, dest: string, options: CopyOptions): Promise<void> {
  const originSrcFilePath = await nodeFsp.readlink(src);
  const type = await symlinkType(src);
  if (await ensureValidCopy(src, dest, options)) await nodeFsp.unlink(dest);
  await nodeFsp.symlink(originSrcFilePath, dest, type);
  if (options.preserveTimestamps) {
    const info = await nodeFsp.lstat(src);
    await nodeFsp.lutimes(dest, info.atime, info.mtime);
  }
}

async function copyDir(src: string, dest: string, options: CopyOptions): Promise<void> {
  const destStat = await ensureValidCopy(src, dest, { ...options, isFolder: true });
  if (!destStat) await ensureDir(dest);
  if (options.preserveTimestamps) {
    const info = await nodeFsp.stat(src);
    await nodeFsp.utimes(dest, info.atime, info.mtime);
  }
  for await (const entry of readDir(src)) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, basename(srcPath));
    if (entry.isSymlink) await copySymlink(srcPath, destPath, options);
    else if (entry.isDirectory) await copyDir(srcPath, destPath, options);
    else if (entry.isFile) await copyFileEntry(srcPath, destPath, options);
  }
}

export async function copy(src: string | URL, dest: string | URL, options: CopyOptions = {}): Promise<void> {
  const s = resolve(toPathString(src));
  const d = resolve(toPathString(dest));
  if (s === d) throw new Error("Source and destination cannot be the same");
  const info = await lstat(s);
  if (info.isDirectory && isSubdir(s, d)) {
    throw new Error(`Cannot copy '${s}' to a subdirectory of itself: '${d}'`);
  }
  if (info.isSymlink) await copySymlink(s, d, options);
  else if (info.isDirectory) await copyDir(s, d, options);
  else if (info.isFile) await copyFileEntry(s, d, options);
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

`isSubdir` is the existing helper in the same file. `canonicalPathSync` and `realPath` are the functions Task 3 added. `process.cwd()` is used for the default glob root because `deno_ral/process.ts` imports `fs.ts` indirectly (log) and a cycle must be avoided; `process` is a global on Node and on Deno 2.

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') $(find unit/ral/ -name '*.test.ts')`
Expected: all green.

- [ ] **Step 5: Run the callers that depend on walk/glob**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/project/ -name '*.test.ts') unit/path.test.ts unit/filter-paths.test.ts $(find unit/extension/ -name '*.test.ts') $(find smoke/project/ -name '*.test.ts') $(find smoke/extensions/ -name '*.test.ts') $(find smoke/book/ -name '*.test.ts')`
Expected: all green (`tests/smoke/extensions/` and `tests/smoke/book/` exist on `main`; `smoke/extensions/install.test.ts` exercises `copy`, `smoke/book/render-book.test.ts` walk/glob over a book).

- [ ] **Step 6: Commit**

```bash
git add src/deno_ral/fs.ts tests/unit/ral/fs-walk-glob.test.ts
git commit -m "deno_ral/fs: walk, expandGlob, copy and move on node:fs (no @std/fs)"
```

### Task 5: Shrink the shim, shrink the known-failures list, render on Node

**Files:**
- Modify: `tools/node-bundle/deno-shim.mjs`
- Modify: `tools/node-bundle/known-failures.json`

- [ ] **Step 1: Build and delete the unused members**

Run: `npm ci && node tools/node-bundle/build.mjs --check-shim`
Expected: `0 missing` and an `unused` list (PR 26's `check-shim.mjs` prints it). The candidates after this PR are the plain file calls (`readTextFileSync` … `truncateSync`, `open`/`openSync`/`create`/`createSync`, `realPath`/`realPathSync`), `makeTemp*`, and `errors` if nothing else references it; members still referenced by a dependency or by `src/resources/**/*.js` (for example `julia-engine.js`) are not listed and stay. Delete exactly the listed `Deno.<name> = ...` lines (and helpers such as `FsFile`, `openFlags`, `tempPath`, `attempts` once nothing in the shim uses them), rebuild, confirm `0 missing` and no `unused` list.

- [ ] **Step 2: Remove the known failures this PR fixes**

Run: `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/`
Expected: lines `now passes on Node, remove it from known-failures.json: tests/unit/ral/<fs|temp|errors>.test.ts > …` (exit 1). Delete those entries from the `linux` section (and the `windows` section if the Windows `node-unit` run of this branch reports them), rerun, and expect `node unit tests: no change …` with exit 0. A new failure in `fs-walk-glob.test.ts` or `fs-node-semantics.test.ts` on Node is a bug in this PR: fix it, do not list it.

- [ ] **Step 3: Render on Node**

Run:
```bash
tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd
tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/website
```
Expected: `Output created: simple.html` and the website renders without `Deno is not defined` or shim errors.

- [ ] **Step 4: Commit**

```bash
git add tools/node-bundle/deno-shim.mjs tools/node-bundle/known-failures.json
git commit -m "node-bundle: drop shim members and known failures made obsolete by deno_ral/fs on node:fs"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` → green (contract tests from PR 09 plus the two new files).
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` → `no change`, exit 0, with no `fs`/`temp`/`errors` entry left for Linux.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') $(find smoke/render/ -name '*.test.ts') $(find smoke/project/ -name '*.test.ts')` → green.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/file-permissions.test.ts unit/render-shared-output-dir.test.ts unit/sass-cache.test.ts` → green (chmod, copy, temp dirs).
- `quarto run --dev tools/check-runtime-boundary.ts` → zero.
- `grep -c "Deno\." src/deno_ral/fs.ts src/deno_ral/temp.ts` → `0` for each; `grep -c '"fs/' src/deno_ral/fs.ts` → `0`; `ls src/deno_ral/original-real-path.ts` → no such file.
- `node tools/node-bundle/build.mjs --check-shim` → `0 missing`, no `unused` list; the two spike renders above succeed.
- Manual: `cp -r tests/docs/smoke-all/book/simple /tmp/rt27-book && package/dist/bin/quarto render /tmp/rt27-book` (a book: walk, glob, copy of resources into `_book`), then the same with `tools/node-bundle/quarto-node render /tmp/rt27-book` and a normalised diff of the two `_book` trees (PR 26's `normalize-html.mjs --root`, `diff -r -x .quarto`); and `package/dist/bin/quarto create project website /tmp/rt27-site --no-prompt` (ensureDir, copy, ensureUserWritable).
- Windows: run `cd tests; $env:QUARTO_TESTS_NO_CONFIG="true"; .\run-tests.ps1 --agent unit/ral/` on a Windows machine or let the CI matrix run; the PR 26 `node-unit` job runs the same files on Node on Windows (`canonicalPathSync` drive-letter and no-prefix case; the R19 case needs a runner with symlink privilege, which GitHub's `windows-latest` has, and checks that a copied directory link is a `"dir"` link; the fixture's junction, made with `node:fs` because Quarto creates none, must come out as a `"dir"` link to its absolute target, as the Context's `copy` bullet states).

## Review checklist

- [ ] No `Deno.` in `fs.ts`, `temp.ts`; `errors.ts` only reads `globalThis.Deno` behind a guard and checks `code` on the error and on its `cause`; `original-real-path.ts` is not recreated and no normalising `realPathSync` is exported.
- [ ] `canonicalPathSync` is `fs.realpathSync.native`; `realPath` is `fs.promises.realpath`; sync and async `walk` resolve symlinks through them; the agreement test passes.
- [ ] `copy` is asynchronous end to end (no `copySync` call inside it); `copySync` exists with the same semantics.
- [ ] PR 20b's `onFileRead` hook is kept and notified by the same read functions as before.
- [ ] No import from `fs/`, `@std/fs` or `jsr:@std/fs` anywhere in `src/deno_ral/`.
- [ ] `readDirSync`/`readDir` sort by name; `walk` therefore yields deterministically.
- [ ] `removeSync` without `recursive` refuses non-empty directories and unlinks symlinks instead of following them.
- [ ] `existsSync` returns `true` on `EACCES`/`EPERM` and `false` on a dangling symlink.
- [ ] `expandGlob*` yields absolute, de-duplicated, sorted paths; a missing fixed root yields nothing; other errors propagate.
- [ ] `walk` `skip`/`match` test the full path (not the name), `exts` get a leading dot, symlinks are yielded as symlinks when `followSymlinks: false`.
- [ ] `copySync` recreates symlinks, refuses copying into a subdirectory of the source, honours `overwrite` and `preserveTimestamps`; on Windows the link type comes from `statSync(src)` (`"dir"` for a directory target, `"file"` otherwise and for a dangling link), never from `lstat`.
- [ ] `openFlagBits` is the only flag translation in `fs.ts`: `O_CREAT` iff `create`, `O_TRUNC` iff `truncate`, `O_APPEND` iff `append`, `TypeError` for `create` without write/append and `truncate` without write; `writeTextFile(Sync)`/`writeFile(Sync)` go through it with `truncate: !append`; the R05 tests (existing and missing file × create/truncate/append, shorter replacement, sync and async) pass on both runtimes.
- [ ] `NodeFsFile`: one `#fd`, nulled by an idempotent `close()`; `readable`/`writable` cached; the Node streams get the `fs` option that routes `close` to the object; EOF, cancel, writer close and abort close the file (A8); `read`, `write`, `writeSync` and the readable fail with `EBADF` after close, and a writer's buffered `write()` surfaces it on `closed`, `ready` and the next `write()`; the R06 test's recycled-descriptor cases pass on both runtimes.
- [ ] `moveSync` throws `EEXIST` without `overwrite` and `ENOTSUP` for a move into its own subtree.
- [ ] `temp.ts` builds `<dir>/<prefix><hex><suffix>` and retries only on `EEXIST`.
- [ ] The shim lost members, none were added; `--check-shim` prints no `unused` list.
- [ ] `known-failures.json` lost the `fs`/`temp`/`errors` entries and gained none.

## Risks and rollback

- **Semantic drift in walk/glob** shows up as changed project input discovery (files missing from a website render, extension not found). The new tests encode `projectHiddenIgnoreGlob` and `resolvePathGlobs` usage; `smoke/project/` and `smoke/extensions/` cover the callers. Rollback: `git revert` the walk/glob commit; the `@std/fs` re-exports return and still run on Deno.
- **`canonicalPathSync` on Windows** (`fs.realpathSync.native`): libuv strips `\\?\` and rewrites `\\?\UNC\` to `\\`; a mapped network drive resolves to its UNC target (as Deno's `realPathSync` does, both use `GetFinalPathNameByHandleW`). If a regression appears in `safeRemoveDirSync` or the four other PR 25 callers, it shows as a path-comparison failure in `tests/unit/ral/safe-remove-dir.test.ts` on the Windows `node-unit` job; the fallback is `fs.realpathSync` (the JavaScript implementation, no drive-to-UNC resolution) in `canonicalPathSync` only.
- **Performance:** `copy()` is sequential per entry like `@std/fs` (no parallel copies, which would risk EMFILE on large sites). If `quarto publish gh-pages` of a large site regresses, measure with `QUARTO_PROFILE` before changing it.
- **`node:fs` compat on Deno for the R05/R06 mechanisms:** numeric open flags, `writeFileSync(fd, data)` and the streams' `fs` option were checked on Node 26.12.0 and 22.22 only; Deno 2.7.14's `node:fs` polyfill is a port of Node's `internal/fs/streams.js` and should honour them, and the Task 2 tests run on both runtimes to prove it. If one does not hold on Deno: for the flags, open with the access bits only and apply `O_CREAT`/`O_TRUNC` by hand (`existsSync` check, `ftruncateSync(fd, 0)`) behind the same `openFlagBits` contract; for the streams, keep `autoClose: false` and `once("end")`/`once("finish")`/`once("close")` listeners that call `close()`, and make `close()` tolerate the `EBADF` that Node's `destroy()` then causes by closing the descriptor itself, with a comment saying which runtime needs it. Either fallback keeps the tests of Task 2 as the contract.
- **Whole-PR rollback:** revert the five commits; no caller changed.

## Decisions needed

None. The no-error-classes decision is backed by the Task 1 grep; reopen it only if that grep is not zero.
