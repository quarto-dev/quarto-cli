# PR 09: `deno_ral/fs.ts` and `deno_ral/temp.ts` API, error predicates, unit tests, and the ts-morph codemod (no callers moved yet)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the filesystem, temp-file and error-predicate surface of the runtime layer (`src/deno_ral/fs.ts` extended, `src/deno_ral/temp.ts` and `src/deno_ral/errors.ts` new), each with a unit test that is the compatibility contract for PR 27, and ship the codemod `tools/codemod-deno-ral.ts` that PRs 10–14 run to move callers.
**Phase:** 1. **Depends on:** PR 02 (ratchet; the codemod's skip list mirrors its exemptions). **Unblocks:** PR 10, 11, 12, 13, 14, 17, 18, 23, 24.
**Branch:** `rt/09-ral-fs-and-temp-layer`.
**Suggested executor:** Opus. The layer code is mechanical, but the codemod's collision handling and import merging need judgement, and the two monkey-patch behaviours (UNC path normalisation, temp retry) must be carried over exactly.
**Size:** M. 3 layer modules, 1 tool, 4 unit tests, 11 fixture files, 1 rules doc; no application caller changes.
**Ships on:** Deno; the existing test suite must stay green. The ratchet baseline does not change (no caller moves).

## Spec

### Context

Assessment section 11, module plan rows `fs.ts` ("extend: readTextFile[Sync], … own `FileInfo`, `DirEntry` types; error predicates. The `realPathSync` Windows monkey patch and the read-error path annotation move here. `readDirSync` callers that depend on order get an explicit sort") and `temp.ts` ("new: makeTempDir[Sync], makeTempFile[Sync], own `TempOptions`; carries the retry loop from `core/deno/monkey-patch.ts`"), design rule 4 ("error handling through predicates … replace `instanceof Deno.errors.X` (33 sites)") and order-of-work step 3 ("a `ts-morph` script run with `quarto run --dev` rewrites `Deno.<fsCall>(` to the layer function and adds the import; review by directory").

What exists today (verified 2026-10-14, `main` at a4d0979):

- `src/deno_ral/fs.ts` (206 lines) re-exports `@std/fs` helpers (`ensureDir`, `existsSync`, `walk`, `expandGlob`, `copy`, `moveSync`, `emptyDirSync`, `EOL`) and defines `safeMoveSync`, `safeRemoveSync`, `safeExistsFileSync`, `safeRemoveDirSync`, `safeModeFromFile`, `safeChmodSync`, `ensureUserWritable`, `isSubdir`, `toPathString`, `getFileInfoType`. It calls `Deno.renameSync`, `Deno.removeSync`, `Deno.statSync`, `Deno.chmodSync`, `Deno.build.os` directly (allowed inside the layer).
- `src/core/deno/monkey-patch.ts` (135 lines), imported first by `src/quarto.ts:9`: sets `Deno.realPathSync = normalizePath` (line 17; `normalizePath` in `src/core/path.ts:319-328` makes the path absolute against `Deno.cwd()`, normalises it, and upper-cases a Windows drive letter; it does not resolve symlinks), wraps `Deno.makeTemp{File,Dir}{,Sync}` in a 5-attempt retry loop (lines 35-99, Deno issue 17781), and wraps `Deno.readTextFile{,Sync}` to append `"\nPath: <path>"` to the error message (lines 101-135). It also installs `Deno.copy`/`Deno.writeAll` shims for old dependencies (lines 19-24; PR 25 decides their fate). `src/deno_ral/original-real-path.ts` saves the un-patched `Deno.realPathSync` for `safeRemoveDirSync`, which needs symlink resolution.
- No file under `src/` calls `Deno.realPathSync` itself (grep: only comments and the monkey-patch assignment); the patch exists for `@std/fs` internals (`walk`, `expandGlob`, `copy`) that call it. `Deno.realPath` (async) is called once, `src/tools/impl/tinytex.ts:662`, and is not patched, so it resolves symlinks.
- `src/core/performance/metrics.ts:18-33` (`captureFileReads`) reassigns `Deno.readTextFileSync` at runtime to record file reads. The layer must therefore look `Deno.readTextFileSync` up at call time (never cache the function) until PR 25 moves that hook into the layer.
- Deno-specific types used in application signatures that this PR gives a home: `Deno.FileInfo` (`src/core/copy.ts:231,232`), `Deno.MakeTempOptions` (`src/core/temp.ts:58,71,76,79`, `src/core/temp-types.ts:11,13,14`, `monkey-patch.ts`), `Deno.ReadFileOptions` (`src/core/qualified-path.ts:69`), `Deno.FsFile` (none by name; 11 `Deno.open` sites use it structurally).
- `Deno.errors.*` sites in `src/` (18) and `package/src` (1): `NotFound` (11: `src/project/project-index.ts:250`, `src/command/render/pandoc.ts:1648`, `src/core/copy.ts:236`, `src/core/cache/cache.ts:161`, `src/core/path.ts:189`, `src/core/http.ts:64,230`, `src/core/jupyter/jupyter-shared.ts:107`, `src/core/typst.ts:82`, `package/src/common/validate-bundle.ts:72`), `PermissionDenied` (3: `src/project/project-context.ts:652,967,1072`), `AddrInUse` (`src/core/port.ts:131`), and the five connection errors in `src/core/http.ts:231-235` (`BrokenPipe`, `NotConnected`, `ConnectionAborted`, `ConnectionReset`, `ConnectionRefused`). Note `project-context.ts:967` uses `Deno.errors.PermissionDenied` as a *type* (`type InputWalkError = Deno.errors.PermissionDenied & {...}`); PR 12 rewrites it to `Error & {...}`.
- Order-dependent `Deno.readDirSync` iteration: `src/format/html/format-html-shared.ts:133` (bslib SCSS concatenation; PR 01 adds a sort there too), `src/command/capabilities/capabilities.ts:75` (theme list in `quarto capabilities` JSON), `src/command/call/build-ts-extension/cmd.ts:118` (entry list), `src/project/types/manuscript/manuscript-meca.ts:427` (MECA item order), `src/extension/extension.ts:296,477,683` (extension discovery order). Sorting inside the layer makes all of them deterministic across filesystems and runtimes.
- Dev scripts import npm packages directly: `tools/deno-esbuild-bundle.ts:1` uses `npm:esbuild@0.27.1`; `package/src/common/import-report/report-bundle-async-cycles.ts:13-15` uses `npm:acorn@8.14.0` etc. `quarto run --dev <script>` (`src/core/run/deno.ts:37-74`) runs `deno run --import-map src/import_map.json --allow-all` and passes the script's arguments through untouched (`src/command/run/run.ts:14-44`), so `npm:ts-morph@28.0.0` (latest on npm at the time of writing) resolves from the Deno npm cache and `--dry-run`/`--dir` reach the script.

### Scope

In:
- `src/deno_ral/fs.ts`: every function and type from the shared vocabulary, plus the additions listed under Interfaces (`open`, `openSync`, `create`, `FsFile`, `OpenOptions`, `realPath`, `symlink`, `chmod`), implemented on `Deno.*`.
- `src/deno_ral/errors.ts`: the vocabulary predicates plus `isConnectionError` (addition) and `errorWithPath`.
- `src/deno_ral/temp.ts`: `TempOptions`, `makeTemp{Dir,File}{,Sync}` with the retry loop.
- `tools/codemod-deno-ral.ts` with rules `fs`, `temp`, `env`, `process`, `platform`; `--dry-run`, `--dir`, `--file`, `--ral-dir`; collision detection and reporting; import add/merge.
- Tests: `tests/unit/deno-ral/fs.test.ts`, `errors.test.ts`, `temp.test.ts`, `tests/unit/codemod/codemod-deno-ral.test.ts` with fixtures under `tests/unit/codemod/fixtures/`.
- `.claude/rules/typescript/deno-ral.md` rows for `fs.ts`, `temp.ts`, `errors.ts` and a "Codemod" subsection.

Out:
- Moving any caller (PRs 10–14, 23, 24). Deleting or editing `src/core/deno/monkey-patch.ts` (PR 25). Reimplementing `walk`/`expandGlob`/`copy` (PR 27).
- `src/deno_ral/env.ts` itself (PR 14 adds it; the codemod's `env` rule is written here and tested on fixtures only).
- The `process` rule's targets beyond `exit`, `cwd`, `chdir`, `args`, `execPath`, `pid` (PR 08 moves `Deno.Command` by hand).

### Interfaces

#### `src/deno_ral/fs.ts` (additions; existing exports unchanged)

```ts
export interface FileInfo {
  isFile: boolean; isDirectory: boolean; isSymlink: boolean;
  size: number; mtime: Date | null; atime: Date | null; birthtime: Date | null; mode: number | null;
}
export interface DirEntry { name: string; isFile: boolean; isDirectory: boolean; isSymlink: boolean; }
// addition: the file-handle shape the 11 Deno.open sites use (streams, Reader/Writer, close)
export interface FsFile {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  read(p: Uint8Array): Promise<number | null>;
  write(p: Uint8Array): Promise<number>;
  writeSync(p: Uint8Array): number;
  close(): void;
}
// addition
export interface OpenOptions { read?: boolean; write?: boolean; append?: boolean; create?: boolean; truncate?: boolean; mode?: number; }
export interface WriteOptions { append?: boolean; create?: boolean; mode?: number; }

export function readTextFileSync(path: string | URL): string;            // error message gets "\nPath: <path>" (once)
export function readTextFile(path: string | URL): Promise<string>;       // same
export function readFileSync(path: string | URL): Uint8Array;
export function readFile(path: string | URL): Promise<Uint8Array>;
export function writeTextFileSync(path: string | URL, data: string, options?: WriteOptions): void;
export function writeTextFile(path: string | URL, data: string, options?: WriteOptions): Promise<void>;
export function writeFileSync(path: string | URL, data: Uint8Array, options?: WriteOptions): void;
export function writeFile(path: string | URL, data: Uint8Array, options?: WriteOptions): Promise<void>;
export function statSync(path: string | URL): FileInfo;
export function stat(path: string | URL): Promise<FileInfo>;
export function lstatSync(path: string | URL): FileInfo;
export function lstat(path: string | URL): Promise<FileInfo>;
export function mkdirSync(path: string | URL, options?: { recursive?: boolean; mode?: number }): void;
export function mkdir(path: string | URL, options?: { recursive?: boolean; mode?: number }): Promise<void>;
export function removeSync(path: string | URL, options?: { recursive?: boolean }): void;
export function remove(path: string | URL, options?: { recursive?: boolean }): Promise<void>;
export function renameSync(oldPath: string | URL, newPath: string | URL): void;
export function rename(oldPath: string | URL, newPath: string | URL): Promise<void>;
export function copyFileSync(from: string | URL, to: string | URL): void;
export function copyFile(from: string | URL, to: string | URL): Promise<void>;
export function readDirSync(path: string | URL): DirEntry[];             // sorted by name (an array is an Iterable<DirEntry>)
export function readDir(path: string | URL): AsyncIterable<DirEntry>;    // sorted by name
export function symlinkSync(target: string | URL, path: string | URL, options?: { type?: "file" | "dir" }): void;
export function symlink(target: string | URL, path: string | URL, options?: { type?: "file" | "dir" }): Promise<void>; // addition
export function readLinkSync(path: string | URL): string;
export function realPathSync(path: string | URL): string;   // normalizePath semantics (absolute, normalised, upper-cased drive letter); does NOT resolve symlinks
export function realPath(path: string | URL): Promise<string>; // addition; resolves symlinks (Deno.realPath), as tinytex.ts relies on today
export function chmodSync(path: string | URL, mode: number): void;
export function chmod(path: string | URL, mode: number): Promise<void>;  // addition
export function utimeSync(path: string | URL, atime: number | Date, mtime: number | Date): void;
export function truncateSync(path: string | URL, len?: number): void;
export function open(path: string | URL, options?: OpenOptions): Promise<FsFile>;   // addition
export function openSync(path: string | URL, options?: OpenOptions): FsFile;        // addition
export function create(path: string | URL): Promise<FsFile>;                        // addition
```

The sort order of `readDirSync`/`readDir` is `a.name < b.name ? -1 : a.name > b.name ? 1 : 0` (code-unit order, locale-independent, identical on every runtime).

#### `src/deno_ral/errors.ts`

```ts
export function isNotFound(e: unknown): boolean;          // Deno.errors.NotFound | code ENOENT
export function isAlreadyExists(e: unknown): boolean;     // Deno.errors.AlreadyExists | EEXIST
export function isPermissionDenied(e: unknown): boolean;  // Deno.errors.PermissionDenied | EACCES | EPERM
export function isAddrInUse(e: unknown): boolean;         // Deno.errors.AddrInUse | EADDRINUSE
export function isConnectionRefused(e: unknown): boolean; // Deno.errors.ConnectionRefused | ECONNREFUSED
// addition: the five socket-teardown errors src/core/http.ts:230-235 ignores
export function isConnectionError(e: unknown): boolean;   // BrokenPipe | NotConnected | ConnectionAborted | ConnectionReset | ConnectionRefused | EPIPE | ENOTCONN | ECONNABORTED | ECONNRESET | ECONNREFUSED
export function errorWithPath(e: Error, path: string): Error; // appends "\nPath: <path>" unless the message already ends with it; returns e
```

#### `src/deno_ral/temp.ts`

```ts
export interface TempOptions { dir?: string; prefix?: string; suffix?: string; }
export function makeTempDirSync(options?: TempOptions): string;   // 5 attempts, debug-logged, rethrows the last error
export function makeTempDir(options?: TempOptions): Promise<string>;
export function makeTempFileSync(options?: TempOptions): string;
export function makeTempFile(options?: TempOptions): Promise<string>;
```

#### `tools/codemod-deno-ral.ts`

CLI: `quarto run --dev tools/codemod-deno-ral.ts --rules <r1,r2> (--dir <d> | --file <f>)... [--dry-run] [--ral-dir <path>]`.

- `--rules`: comma-separated subset of `fs`, `temp`, `env`, `process`, `platform` (required).
- `--dir`: walk `*.ts` under it (repeatable). Skipped: `src/deno_ral/`, `src/vendor/`, `src/resources/extension-subtrees/`, any `node_modules/` segment, `*.d.ts`, `*.ejs.ts`.
- `--file`: one file (repeatable); not subject to the skip list.
- `--dry-run`: print every replacement as `<file>:<line>: Deno.x → x` and the import that would be added; write nothing.
- `--ral-dir`: absolute path of the layer directory (default `<cwd>/src/deno_ral`); import specifiers are computed relative to each file from it.

Library API (used by the unit test):

```ts
export type RuleName = "fs" | "temp" | "env" | "process" | "platform";
export interface Replacement { line: number; from: string; to: string; }
export interface Collision { name: string; line: number; module: string; }
export interface CodemodResult {
  file: string;
  replacements: Replacement[];       // applied (or, in dry-run, would be applied)
  collisions: Collision[];           // names left as Deno.* because a local binding of that name exists
  importsAdded: Record<string, string[]>; // module file name -> names added (e.g. { "fs.ts": ["readTextFileSync"] })
  skipped?: string;                  // whole file left untouched, with the reason
}
export function codemodFile(file: string, rules: RuleName[], options: { ralDir: string; dryRun: boolean }): CodemodResult;
export function collectFiles(dir: string): string[];  // the walk with the skip list applied, sorted
```

Rule tables (exact):

| Rule | Module | `Deno.<name>` → export | Types `Deno.<T>` → export |
|---|---|---|---|
| `fs` | `fs.ts` | `readTextFileSync`, `readTextFile`, `readFileSync`, `readFile`, `writeTextFileSync`, `writeTextFile`, `writeFileSync`, `writeFile`, `statSync`, `stat`, `lstatSync`, `lstat`, `mkdirSync`, `mkdir`, `removeSync`, `remove`, `renameSync`, `rename`, `copyFileSync`, `copyFile`, `readDirSync`, `readDir`, `symlinkSync`, `symlink`, `readLinkSync`, `realPathSync`, `realPath`, `chmodSync`, `chmod`, `utimeSync`, `truncateSync`, `open`, `openSync`, `create` (each to the same name) | `FileInfo` → `FileInfo`, `DirEntry` → `DirEntry`, `FsFile` → `FsFile` |
| `temp` | `temp.ts` | `makeTempDirSync`, `makeTempDir`, `makeTempFileSync`, `makeTempFile` | `MakeTempOptions` → `TempOptions` |
| `env` | `env.ts` | `env` (the `Deno.env` expression itself; `Deno.env.get(...)` becomes `env.get(...)`) | — |
| `process` | `process.ts` | `exit`, `cwd`, `chdir`, `execPath` (calls); `args` → `args()`, `pid` → `pid()` (property reads become calls) | — |
| `platform` | `platform.ts` | `build.os` → `os`, `build.arch` → `arch` (two-level member access) | — |

Behaviour:
1. A file that *assigns* to any `Deno.<x>` (e.g. `Deno.realPathSync = …`, `Deno.readTextFileSync = …`) is skipped whole with `skipped: "assigns to Deno.<x> at line N"`. This keeps `src/core/deno/monkey-patch.ts` and `src/core/performance/metrics.ts` untouched automatically.
2. For every name the rules would import, the file is scanned for an identifier with that text that is a binding or a reference (declaration name, parameter, import specifier from another module, shorthand property, plain reference). Property names (`foo.remove`, `{ remove: 1 }`, interface members) do not count. If one exists, every `Deno.<x>` that maps to that name is left alone and reported as a `Collision`; the rest of the file is still rewritten.
3. The import is merged into an existing `import { … } from "<rel>/deno_ral/<module>.ts"` when present (names deduplicated, sorted with `localeCompare`, types as inline `type X` specifiers); otherwise a new declaration is inserted after the last import, or before the first statement when the file has no imports (after the copyright comment).
4. Edits are computed from AST positions and applied to the file text from the end backwards; the AST is never mutated. Files are written with `Deno.writeTextFileSync` only when at least one replacement was applied and `--dry-run` is off. The tool itself lives in `tools/`, outside the ratchet scope, and may use `Deno.*`.

### Files

- Modify: `src/deno_ral/fs.ts` (append the new section; keep existing exports)
- Create: `src/deno_ral/errors.ts`, `src/deno_ral/temp.ts`, `tools/codemod-deno-ral.ts`
- Create: `tests/unit/deno-ral/fs.test.ts`, `tests/unit/deno-ral/errors.test.ts`, `tests/unit/deno-ral/temp.test.ts`, `tests/unit/codemod/codemod-deno-ral.test.ts`, `tests/unit/codemod/fixtures/{fs-basic,fs-collision,existing-import,no-imports,temp-basic,env-basic,env-collision,process-basic,platform-basic,assignment-skip}.input.ts` and the matching `.expected.ts` (no expected file for `assignment-skip`)
- Modify: `.claude/rules/typescript/deno-ral.md`

### Acceptance criteria

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/fs.test.ts unit/deno-ral/errors.test.ts unit/deno-ral/temp.test.ts unit/codemod/codemod-deno-ral.test.ts` → `ok | 29 passed | 0 failed` (11 + 3 + 4 + 11).
- `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dry-run` runs to completion, reports `src/core/deno/monkey-patch.ts` and `src/core/performance/metrics.ts` as skipped, reports the collisions in `src/core/copy.ts` (`copyFileSync`, first referenced at line 60, declared at line 138) and `src/core/qualified-path.ts` (`readTextFile`, `readTextFileSync`), and leaves the tree unchanged (`git status --short` shows only the files this PR adds).
- `quarto run --dev tools/check-runtime-boundary.ts` passes at the unchanged baseline.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.

## Plan

Assumes PR 02 landed (`tools/check-runtime-boundary.ts`), `./configure.sh` has been run, and `package/dist/bin/tools/x86_64/deno` is the dev Deno (substitute the architecture directory present).

### Task 1: `src/deno_ral/errors.ts`

**Files:**
- Create: `src/deno_ral/errors.ts`
- Test: `tests/unit/deno-ral/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * errors.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";
import {
  errorWithPath,
  isAddrInUse,
  isAlreadyExists,
  isConnectionError,
  isConnectionRefused,
  isNotFound,
  isPermissionDenied,
} from "../../../src/deno_ral/errors.ts";

function withCode(code: string): Error {
  const e = new Error(code);
  (e as Error & { code: string }).code = code;
  return e;
}

// deno-lint-ignore require-await
unitTest("errors - predicates recognise Deno error classes", async () => {
  assert(isNotFound(new Deno.errors.NotFound("x")));
  assert(isAlreadyExists(new Deno.errors.AlreadyExists("x")));
  assert(isPermissionDenied(new Deno.errors.PermissionDenied("x")));
  assert(isAddrInUse(new Deno.errors.AddrInUse("x")));
  assert(isConnectionRefused(new Deno.errors.ConnectionRefused("x")));
  assert(isConnectionError(new Deno.errors.BrokenPipe("x")));
  assert(isConnectionError(new Deno.errors.ConnectionReset("x")));
  assert(isConnectionError(new Deno.errors.ConnectionRefused("x")));
  assert(!isNotFound(new Deno.errors.AlreadyExists("x")));
  assert(!isNotFound(new Error("x")));
  assert(!isNotFound(undefined));
  assert(!isConnectionError(new Deno.errors.NotFound("x")));
});

// deno-lint-ignore require-await
unitTest("errors - predicates recognise Node-style error codes", async () => {
  assert(isNotFound(withCode("ENOENT")));
  assert(isAlreadyExists(withCode("EEXIST")));
  assert(isPermissionDenied(withCode("EACCES")));
  assert(isPermissionDenied(withCode("EPERM")));
  assert(isAddrInUse(withCode("EADDRINUSE")));
  assert(isConnectionRefused(withCode("ECONNREFUSED")));
  assert(isConnectionError(withCode("EPIPE")));
  assert(isConnectionError(withCode("ECONNRESET")));
  assert(!isNotFound(withCode("EEXIST")));
});

// deno-lint-ignore require-await
unitTest("errors - errorWithPath appends the path exactly once", async () => {
  const e = new Error("boom");
  errorWithPath(e, "/tmp/a.txt");
  errorWithPath(e, "/tmp/a.txt");
  assertEquals(e.message, "boom\nPath: /tmp/a.txt");
  const empty = new Error("");
  errorWithPath(empty, "/tmp/b.txt");
  assertEquals(empty.message, "");
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `mkdir -p tests/unit/deno-ral && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/errors.test.ts`
Expected: fails with `Module not found "file:///.../src/deno_ral/errors.ts"`.

- [ ] **Step 3: Implement**

```ts
/*
 * errors.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Runtime-neutral error predicates. Application code uses these instead of
 * `instanceof Deno.errors.X`. The Deno classes are matched when the Deno
 * global exists; Node-style `code` properties are matched everywhere.
 */

function errorCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

type DenoErrorName =
  | "NotFound"
  | "AlreadyExists"
  | "PermissionDenied"
  | "AddrInUse"
  | "ConnectionRefused"
  | "BrokenPipe"
  | "NotConnected"
  | "ConnectionAborted"
  | "ConnectionReset";

function isDenoError(e: unknown, name: DenoErrorName): boolean {
  // deno-lint-ignore no-explicit-any
  const errors = (globalThis as any).Deno?.errors;
  const cls = errors?.[name];
  return typeof cls === "function" && e instanceof cls;
}

function matches(e: unknown, names: DenoErrorName[], codes: string[]): boolean {
  const code = errorCode(e);
  if (code !== undefined && codes.includes(code)) {
    return true;
  }
  return names.some((name) => isDenoError(e, name));
}

export function isNotFound(e: unknown): boolean {
  return matches(e, ["NotFound"], ["ENOENT"]);
}

export function isAlreadyExists(e: unknown): boolean {
  return matches(e, ["AlreadyExists"], ["EEXIST"]);
}

export function isPermissionDenied(e: unknown): boolean {
  return matches(e, ["PermissionDenied"], ["EACCES", "EPERM"]);
}

export function isAddrInUse(e: unknown): boolean {
  return matches(e, ["AddrInUse"], ["EADDRINUSE"]);
}

export function isConnectionRefused(e: unknown): boolean {
  return matches(e, ["ConnectionRefused"], ["ECONNREFUSED"]);
}

/** Errors a server sees when a client goes away mid-response. */
export function isConnectionError(e: unknown): boolean {
  return matches(
    e,
    [
      "BrokenPipe",
      "NotConnected",
      "ConnectionAborted",
      "ConnectionReset",
      "ConnectionRefused",
    ],
    ["EPIPE", "ENOTCONN", "ECONNABORTED", "ECONNRESET", "ECONNREFUSED"],
  );
}

/**
 * Append the offending path to an error message (idempotent). Until PR 25,
 * core/deno/monkey-patch.ts annotates Deno.readTextFile* errors the same way;
 * the idempotence keeps the path from being appended twice.
 */
export function errorWithPath(e: Error, path: string): Error {
  const suffix = "\nPath: " + path;
  if (e.message && !e.message.endsWith(suffix)) {
    e.message = e.message + suffix;
  }
  return e;
}
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/errors.test.ts`
Expected: `ok | 3 passed | 0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/errors.ts tests/unit/deno-ral/errors.test.ts
git commit -m "deno_ral/errors: runtime-neutral error predicates"
```

### Task 2: `src/deno_ral/temp.ts`

**Files:**
- Create: `src/deno_ral/temp.ts`
- Test: `tests/unit/deno-ral/temp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * temp.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects, assertThrows } from "testing/asserts";
import {
  makeTempDir,
  makeTempDirSync,
  makeTempFile,
  makeTempFileSync,
} from "../../../src/deno_ral/temp.ts";
import { isNotFound } from "../../../src/deno_ral/errors.ts";
import { basename, dirname, join } from "../../../src/deno_ral/path.ts";

// deno-lint-ignore require-await
unitTest("temp - makeTempDirSync honours dir, prefix and suffix", async () => {
  const root = makeTempDirSync({ prefix: "ral-temp-" });
  try {
    const dir = makeTempDirSync({ dir: root, prefix: "pre-", suffix: "-suf" });
    assertEquals(dirname(dir), root);
    assert(basename(dir).startsWith("pre-"));
    assert(basename(dir).endsWith("-suf"));
    assert(Deno.statSync(dir).isDirectory);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

// deno-lint-ignore require-await
unitTest("temp - makeTempFileSync creates an empty file", async () => {
  const root = makeTempDirSync({ prefix: "ral-temp-" });
  try {
    const file = makeTempFileSync({ dir: root, suffix: ".json" });
    assertEquals(dirname(file), root);
    assert(file.endsWith(".json"));
    assertEquals(Deno.statSync(file).size, 0);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

unitTest("temp - async variants", async () => {
  const root = await makeTempDir({ prefix: "ral-temp-" });
  try {
    const dir = await makeTempDir({ dir: root });
    const file = await makeTempFile({ dir: root, prefix: "f-" });
    assert(Deno.statSync(dir).isDirectory);
    assert(Deno.statSync(file).isFile);
    assert(basename(file).startsWith("f-"));
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

unitTest("temp - a missing parent directory fails after the retries", async () => {
  const missing = join(makeTempDirSync({ prefix: "ral-temp-" }), "nope", "deeper");
  const e = assertThrows(() => makeTempDirSync({ dir: missing }));
  assert(isNotFound(e), `expected NotFound, got ${e}`);
  const e2 = await assertRejects(() => makeTempFile({ dir: missing }));
  assert(isNotFound(e2), `expected NotFound, got ${e2}`);
  Deno.removeSync(dirname(dirname(missing)), { recursive: true });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/temp.test.ts`
Expected: fails with `Module not found "file:///.../src/deno_ral/temp.ts"`.

- [ ] **Step 3: Implement**

```ts
/*
 * temp.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Temporary files and directories. Carries the retry loop that
 * core/deno/monkey-patch.ts installs on Deno.makeTemp* (rare EEXIST races,
 * https://github.com/denoland/deno/issues/17781). Until PR 25 removes the
 * monkey patch the two loops nest; that is harmless.
 */

import { debug } from "./log.ts";

export interface TempOptions {
  dir?: string;
  prefix?: string;
  suffix?: string;
}

const maxAttempts = 5;

function withAttempts<T>(callable: () => T): T {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return callable();
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      if (err.message) {
        debug("Error attempting to create temp file: " + err.message);
      }
      if (i === maxAttempts - 1) {
        throw err;
      }
      debug(`Retrying... ${i + 1} of ${maxAttempts - 1}`);
    }
  }
  throw new Error("Shouldn't get here");
}

function withAttemptsAsync<T>(callable: () => Promise<T>): Promise<T> {
  const inner = (attempt: number): Promise<T> => {
    return callable().catch((err) => {
      if (!(err instanceof Error)) {
        throw err;
      }
      if (err.message) {
        debug("Error attempting to create temp file: " + err.message);
      }
      if (attempt === maxAttempts - 1) {
        throw err;
      }
      debug(`Retrying... ${attempt + 1} of ${maxAttempts - 1}`);
      return inner(attempt + 1);
    });
  };
  return inner(0);
}

export function makeTempDirSync(options?: TempOptions): string {
  return withAttempts(() => Deno.makeTempDirSync(options));
}

export function makeTempDir(options?: TempOptions): Promise<string> {
  return withAttemptsAsync(() => Deno.makeTempDir(options));
}

export function makeTempFileSync(options?: TempOptions): string {
  return withAttempts(() => Deno.makeTempFileSync(options));
}

export function makeTempFile(options?: TempOptions): Promise<string> {
  return withAttemptsAsync(() => Deno.makeTempFile(options));
}
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/temp.test.ts`
Expected: `ok | 4 passed | 0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/temp.ts tests/unit/deno-ral/temp.test.ts
git commit -m "deno_ral/temp: makeTemp* with the retry loop from monkey-patch"
```

### Task 3: `src/deno_ral/fs.ts` additions

**Files:**
- Modify: `src/deno_ral/fs.ts` (append after `ensureUserWritable`, line 206)
- Test: `tests/unit/deno-ral/fs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * fs.test.ts
 *
 * Compatibility contract for the plain filesystem calls in
 * src/deno_ral/fs.ts. PR 27 must keep this file green on node:fs.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
  assertThrows,
} from "testing/asserts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { isNotFound } from "../../../src/deno_ral/errors.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { join, normalize, resolve } from "../../../src/deno_ral/path.ts";
import {
  chmodSync,
  copyFileSync,
  create,
  existsSync,
  lstatSync,
  mkdirSync,
  open,
  readDir,
  readDirSync,
  readFileSync,
  readLinkSync,
  readTextFile,
  readTextFileSync,
  realPathSync,
  removeSync,
  renameSync,
  statSync,
  symlinkSync,
  truncateSync,
  utimeSync,
  writeFileSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";

function withDir(fn: (dir: string) => void | Promise<void>) {
  return async () => {
    const dir = makeTempDirSync({ prefix: "ral-fs-" });
    try {
      await fn(dir);
    } finally {
      Deno.removeSync(dir, { recursive: true });
    }
  };
}

unitTest("fs - text round trip and append", withDir((dir) => {
  const file = join(dir, "a.txt");
  writeTextFileSync(file, "hello");
  writeTextFileSync(file, " world", { append: true });
  assertEquals(readTextFileSync(file), "hello world");
}));

unitTest("fs - read errors carry the path once and satisfy isNotFound", withDir(async (dir) => {
  const missing = join(dir, "missing.txt");
  const e = assertThrows(() => readTextFileSync(missing));
  assert(isNotFound(e));
  assertStringIncludes((e as Error).message, "Path: " + missing);
  assertEquals((e as Error).message.split("Path: ").length, 2, "path appended once");
  let asyncErr: unknown;
  try {
    await readTextFile(missing);
  } catch (err) {
    asyncErr = err;
  }
  assert(isNotFound(asyncErr));
  assertStringIncludes((asyncErr as Error).message, "Path: " + missing);
}));

unitTest("fs - bytes round trip", withDir((dir) => {
  const file = join(dir, "b.bin");
  writeFileSync(file, new Uint8Array([1, 2, 3]));
  assertEquals([...readFileSync(file)], [1, 2, 3]);
}));

unitTest("fs - statSync and lstatSync", withDir((dir) => {
  const file = join(dir, "s.txt");
  writeTextFileSync(file, "12345");
  const info = statSync(file);
  assertEquals(info.isFile, true);
  assertEquals(info.isDirectory, false);
  assertEquals(info.size, 5);
  assert(info.mtime instanceof Date);
  assertEquals(statSync(dir).isDirectory, true);
  if (!isWindows) {
    const link = join(dir, "s-link");
    symlinkSync(file, link);
    assertEquals(lstatSync(link).isSymlink, true);
    assertEquals(statSync(link).isSymlink, false);
    assertEquals(readLinkSync(link), file);
  }
}));

unitTest("fs - mkdirSync recursive and removeSync recursive", withDir((dir) => {
  const nested = join(dir, "x", "y", "z");
  mkdirSync(nested, { recursive: true });
  assert(existsSync(nested));
  removeSync(join(dir, "x"), { recursive: true });
  assert(!existsSync(join(dir, "x")));
}));

unitTest("fs - renameSync and copyFileSync", withDir((dir) => {
  const a = join(dir, "a.txt");
  const b = join(dir, "b.txt");
  const c = join(dir, "c.txt");
  writeTextFileSync(a, "A");
  renameSync(a, b);
  assert(!existsSync(a));
  copyFileSync(b, c);
  assertEquals(readTextFileSync(c), "A");
  assertEquals(readTextFileSync(b), "A");
}));

unitTest("fs - readDirSync and readDir are sorted by name", withDir(async (dir) => {
  for (const name of ["c.txt", "a.txt", "b.txt"]) {
    writeTextFileSync(join(dir, name), name);
  }
  mkdirSync(join(dir, "B-dir"));
  const sync = readDirSync(dir).map((e) => e.name);
  assertEquals(sync, ["B-dir", "a.txt", "b.txt", "c.txt"]);
  const entry = readDirSync(dir).find((e) => e.name === "B-dir")!;
  assertEquals(entry.isDirectory, true);
  assertEquals(entry.isFile, false);
  const async: string[] = [];
  for await (const e of readDir(dir)) {
    async.push(e.name);
  }
  assertEquals(async, sync);
}));

unitTest("fs - realPathSync normalises without resolving symlinks", withDir((dir) => {
  const rel = realPathSync(".");
  assertEquals(rel, normalize(resolve(Deno.cwd())));
  assertEquals(realPathSync(join(dir, "sub", "..")), normalize(dir));
  if (isWindows) {
    assertMatch(realPathSync("."), /^[A-Z]:\\/);
  } else {
    const target = join(dir, "t.txt");
    const link = join(dir, "l.txt");
    writeTextFileSync(target, "x");
    symlinkSync(target, link);
    assertEquals(realPathSync(link), link, "symlinks are not resolved");
  }
}));

unitTest("fs - utimeSync and truncateSync", withDir((dir) => {
  const file = join(dir, "u.txt");
  writeTextFileSync(file, "0123456789");
  const when = new Date("2020-01-02T03:04:05Z");
  utimeSync(file, when, when);
  assertEquals(statSync(file).mtime?.getTime(), when.getTime());
  truncateSync(file, 4);
  assertEquals(readTextFileSync(file), "0123");
  truncateSync(file);
  assertEquals(readTextFileSync(file), "");
}));

unitTest("fs - chmodSync (POSIX)", withDir((dir) => {
  if (isWindows) return;
  const file = join(dir, "m.txt");
  writeTextFileSync(file, "x");
  chmodSync(file, 0o600);
  assertEquals((statSync(file).mode ?? 0) & 0o777, 0o600);
}));

unitTest("fs - open/create expose streams and close", withDir(async (dir) => {
  const file = join(dir, "o.txt");
  const out = await create(file);
  const writer = out.writable.getWriter();
  await writer.write(new TextEncoder().encode("line1\nline2\n"));
  await writer.close();
  const inp = await open(file, { read: true });
  const text = await new Response(inp.readable).text();
  assertEquals(text, "line1\nline2\n");
  const appender = await open(file, { append: true });
  appender.writeSync(new TextEncoder().encode("line3\n"));
  appender.close();
  assertEquals(readTextFileSync(file), "line1\nline2\nline3\n");
}));
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/fs.test.ts`
Expected: fails at type-check with `Module '"../../../src/deno_ral/fs.ts"' has no exported member 'readTextFileSync'` (and others).

- [ ] **Step 3: Implement (append to `src/deno_ral/fs.ts`)**

Add `import { errorWithPath } from "./errors.ts";` and `import { isAbsolute, join, normalize } from "./path.ts";` to the imports at the top (keep the existing `fromFileUrl`, `resolve`, `SEP` imports), then append:

```ts
// ---------------------------------------------------------------------------
// Plain filesystem calls (PR 09). Deno's names are kept so that the codemod is
// `Deno.x(` → `x(` plus an import. Implemented on Deno here; PR 27 moves this
// section to node:fs behind the same signatures and the same unit test
// (tests/unit/deno-ral/fs.test.ts).
//
// Deno.* is looked up at call time on purpose: core/performance/metrics.ts
// reassigns Deno.readTextFileSync to record file reads (until PR 25).
// ---------------------------------------------------------------------------

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

export interface FsFile {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  read(p: Uint8Array): Promise<number | null>;
  write(p: Uint8Array): Promise<number>;
  writeSync(p: Uint8Array): number;
  close(): void;
}

export interface OpenOptions {
  read?: boolean;
  write?: boolean;
  append?: boolean;
  create?: boolean;
  truncate?: boolean;
  mode?: number;
}

export interface WriteOptions {
  append?: boolean;
  create?: boolean;
  mode?: number;
}

function toFileInfo(info: Deno.FileInfo): FileInfo {
  return {
    isFile: info.isFile,
    isDirectory: info.isDirectory,
    isSymlink: info.isSymlink,
    size: info.size,
    mtime: info.mtime,
    atime: info.atime,
    birthtime: info.birthtime,
    mode: info.mode,
  };
}

function toDirEntry(entry: Deno.DirEntry): DirEntry {
  return {
    name: entry.name,
    isFile: entry.isFile,
    isDirectory: entry.isDirectory,
    isSymlink: entry.isSymlink,
  };
}

function byName(a: DirEntry, b: DirEntry): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function annotate(e: unknown, path: string | URL): unknown {
  return e instanceof Error ? errorWithPath(e, toPathString(path)) : e;
}

export function readTextFileSync(path: string | URL): string {
  try {
    return Deno.readTextFileSync(path);
  } catch (e) {
    throw annotate(e, path);
  }
}

export async function readTextFile(path: string | URL): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch (e) {
    throw annotate(e, path);
  }
}

export function readFileSync(path: string | URL): Uint8Array {
  try {
    return Deno.readFileSync(path);
  } catch (e) {
    throw annotate(e, path);
  }
}

export async function readFile(path: string | URL): Promise<Uint8Array> {
  try {
    return await Deno.readFile(path);
  } catch (e) {
    throw annotate(e, path);
  }
}

export function writeTextFileSync(
  path: string | URL,
  data: string,
  options?: WriteOptions,
): void {
  Deno.writeTextFileSync(path, data, options);
}

export function writeTextFile(
  path: string | URL,
  data: string,
  options?: WriteOptions,
): Promise<void> {
  return Deno.writeTextFile(path, data, options);
}

export function writeFileSync(
  path: string | URL,
  data: Uint8Array,
  options?: WriteOptions,
): void {
  Deno.writeFileSync(path, data, options);
}

export function writeFile(
  path: string | URL,
  data: Uint8Array,
  options?: WriteOptions,
): Promise<void> {
  return Deno.writeFile(path, data, options);
}

export function statSync(path: string | URL): FileInfo {
  return toFileInfo(Deno.statSync(path));
}

export async function stat(path: string | URL): Promise<FileInfo> {
  return toFileInfo(await Deno.stat(path));
}

export function lstatSync(path: string | URL): FileInfo {
  return toFileInfo(Deno.lstatSync(path));
}

export async function lstat(path: string | URL): Promise<FileInfo> {
  return toFileInfo(await Deno.lstat(path));
}

export function mkdirSync(
  path: string | URL,
  options?: { recursive?: boolean; mode?: number },
): void {
  Deno.mkdirSync(path, options);
}

export function mkdir(
  path: string | URL,
  options?: { recursive?: boolean; mode?: number },
): Promise<void> {
  return Deno.mkdir(path, options);
}

export function removeSync(
  path: string | URL,
  options?: { recursive?: boolean },
): void {
  Deno.removeSync(path, options);
}

export function remove(
  path: string | URL,
  options?: { recursive?: boolean },
): Promise<void> {
  return Deno.remove(path, options);
}

export function renameSync(oldPath: string | URL, newPath: string | URL): void {
  Deno.renameSync(oldPath, newPath);
}

export function rename(
  oldPath: string | URL,
  newPath: string | URL,
): Promise<void> {
  return Deno.rename(oldPath, newPath);
}

export function copyFileSync(from: string | URL, to: string | URL): void {
  Deno.copyFileSync(from, to);
}

export function copyFile(from: string | URL, to: string | URL): Promise<void> {
  return Deno.copyFile(from, to);
}

/** Directory entries sorted by name (code-unit order). */
export function readDirSync(path: string | URL): DirEntry[] {
  return Array.from(Deno.readDirSync(path), toDirEntry).sort(byName);
}

/** Directory entries sorted by name (code-unit order). */
export async function* readDir(path: string | URL): AsyncIterable<DirEntry> {
  const entries: DirEntry[] = [];
  for await (const entry of Deno.readDir(path)) {
    entries.push(toDirEntry(entry));
  }
  entries.sort(byName);
  yield* entries;
}

export function symlinkSync(
  target: string | URL,
  path: string | URL,
  options?: { type?: "file" | "dir" },
): void {
  Deno.symlinkSync(target, path, options);
}

export function symlink(
  target: string | URL,
  path: string | URL,
  options?: { type?: "file" | "dir" },
): Promise<void> {
  return Deno.symlink(target, path, options);
}

export function readLinkSync(path: string | URL): string {
  return Deno.readLinkSync(path);
}

/**
 * Absolute, normalised form of `path` with an upper-cased Windows drive
 * letter. This is the behaviour core/deno/monkey-patch.ts gives
 * Deno.realPathSync (Windows UNC paths were mishandled by the real one, see
 * quarto-dev/quarto-vscode#67); symlinks are NOT resolved. Use
 * originalRealPathSync (original-real-path.ts) when they must be.
 */
export function realPathSync(path: string | URL): string {
  let file = toPathString(path);
  if (!isAbsolute(file)) {
    file = join(Deno.cwd(), file);
  }
  file = normalize(file);
  return file.replace(/^\w:\\/, (m: string) => m[0].toUpperCase() + ":\\");
}

/** Resolves symlinks (the un-patched Deno.realPath behaviour). */
export function realPath(path: string | URL): Promise<string> {
  return Deno.realPath(path);
}

export function chmodSync(path: string | URL, mode: number): void {
  Deno.chmodSync(path, mode);
}

export function chmod(path: string | URL, mode: number): Promise<void> {
  return Deno.chmod(path, mode);
}

export function utimeSync(
  path: string | URL,
  atime: number | Date,
  mtime: number | Date,
): void {
  Deno.utimeSync(path, atime, mtime);
}

export function truncateSync(path: string | URL, len?: number): void {
  Deno.truncateSync(path, len);
}

export function open(path: string | URL, options?: OpenOptions): Promise<FsFile> {
  return Deno.open(path, options);
}

export function openSync(path: string | URL, options?: OpenOptions): FsFile {
  return Deno.openSync(path, options);
}

export function create(path: string | URL): Promise<FsFile> {
  return Deno.create(path);
}
```

Also replace the file's header comment (`* encoding.ts` on line 2 is a copy-paste error) with `* fs.ts`.

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/fs.test.ts unit/ral/`
Expected: `ok | 14 passed | 0 failed` (11 new + 3 existing in `unit/ral/`).

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/fs.ts tests/unit/deno-ral/fs.test.ts
git commit -m "deno_ral/fs: plain filesystem calls with sorted readDir and path-annotated read errors"
```

### Task 4: the codemod and its fixtures

**Files:**
- Create: `tools/codemod-deno-ral.ts`
- Test: `tests/unit/codemod/codemod-deno-ral.test.ts`, `tests/unit/codemod/fixtures/*`

- [ ] **Step 1: Write the fixtures**

`tests/unit/codemod/fixtures/fs-basic.input.ts`:
```ts
/*
 * fixture
 */
import { join } from "../deno_ral/path.ts";

export function readIt(dir: string): string {
  const info = Deno.statSync(dir);
  if (!info.isDirectory) {
    throw new Error("not a dir");
  }
  return Deno.readTextFileSync(join(dir, "a.txt"));
}

export function infoOf(path: string): Deno.FileInfo {
  return Deno.lstatSync(path);
}
```

`tests/unit/codemod/fixtures/fs-basic.expected.ts`:
```ts
/*
 * fixture
 */
import { join } from "../deno_ral/path.ts";
import { type FileInfo, lstatSync, readTextFileSync, statSync } from "../deno_ral/fs.ts";

export function readIt(dir: string): string {
  const info = statSync(dir);
  if (!info.isDirectory) {
    throw new Error("not a dir");
  }
  return readTextFileSync(join(dir, "a.txt"));
}

export function infoOf(path: string): FileInfo {
  return lstatSync(path);
}
```

`tests/unit/codemod/fixtures/fs-collision.input.ts`:
```ts
import { join } from "../deno_ral/path.ts";

function remove(path: string) {
  return Deno.remove(path);
}

export function readIt(dir: string): string {
  remove(dir);
  return Deno.readTextFileSync(join(dir, "a.txt"));
}
```

`tests/unit/codemod/fixtures/fs-collision.expected.ts`:
```ts
import { join } from "../deno_ral/path.ts";
import { readTextFileSync } from "../deno_ral/fs.ts";

function remove(path: string) {
  return Deno.remove(path);
}

export function readIt(dir: string): string {
  remove(dir);
  return readTextFileSync(join(dir, "a.txt"));
}
```

`tests/unit/codemod/fixtures/existing-import.input.ts`:
```ts
import { existsSync } from "../deno_ral/fs.ts";

export function sizeOf(path: string): number {
  if (!existsSync(path)) {
    return 0;
  }
  return Deno.statSync(path).size;
}
```

`tests/unit/codemod/fixtures/existing-import.expected.ts`:
```ts
import { existsSync, statSync } from "../deno_ral/fs.ts";

export function sizeOf(path: string): number {
  if (!existsSync(path)) {
    return 0;
  }
  return statSync(path).size;
}
```

`tests/unit/codemod/fixtures/no-imports.input.ts`:
```ts
/*
 * no imports at all
 */

export const text = Deno.readTextFileSync("x.txt");
```

`tests/unit/codemod/fixtures/no-imports.expected.ts`:
```ts
/*
 * no imports at all
 */

import { readTextFileSync } from "../deno_ral/fs.ts";
export const text = readTextFileSync("x.txt");
```

`tests/unit/codemod/fixtures/temp-basic.input.ts`:
```ts
export function scratch(options?: Deno.MakeTempOptions): string {
  return Deno.makeTempDirSync({ prefix: "q-", ...options });
}
```

`tests/unit/codemod/fixtures/temp-basic.expected.ts`:
```ts
import { makeTempDirSync, type TempOptions } from "../deno_ral/temp.ts";
export function scratch(options?: TempOptions): string {
  return makeTempDirSync({ prefix: "q-", ...options });
}
```

`tests/unit/codemod/fixtures/env-basic.input.ts`:
```ts
export function home(): string {
  Deno.env.set("QUARTO_X", "1");
  const all = Deno.env.toObject();
  return Deno.env.get("HOME") ?? all["USERPROFILE"] ?? "";
}
```

`tests/unit/codemod/fixtures/env-basic.expected.ts`:
```ts
import { env } from "../deno_ral/env.ts";
export function home(): string {
  env.set("QUARTO_X", "1");
  const all = env.toObject();
  return env.get("HOME") ?? all["USERPROFILE"] ?? "";
}
```

`tests/unit/codemod/fixtures/env-collision.input.ts`:
```ts
export function mode(): string {
  const env = Deno.env.get("MODE");
  return env ?? "production";
}
```

`tests/unit/codemod/fixtures/env-collision.expected.ts`: identical to the input (nothing rewritten, one collision reported).

`tests/unit/codemod/fixtures/process-basic.input.ts`:
```ts
export function main() {
  if (Deno.args.length === 0) {
    console.log(Deno.cwd(), Deno.execPath(), Deno.pid);
    Deno.exit(1);
  }
}
```

`tests/unit/codemod/fixtures/process-basic.expected.ts`:
```ts
import { args, cwd, execPath, exit, pid } from "../deno_ral/process.ts";
export function main() {
  if (args().length === 0) {
    console.log(cwd(), execPath(), pid());
    exit(1);
  }
}
```

`tests/unit/codemod/fixtures/platform-basic.input.ts`:
```ts
export const sep = Deno.build.os === "windows" ? "\\" : "/";
export const bits = Deno.build.arch;
```

`tests/unit/codemod/fixtures/platform-basic.expected.ts`:
```ts
import { arch, os } from "../deno_ral/platform.ts";
export const sep = os === "windows" ? "\\" : "/";
export const bits = arch;
```

`tests/unit/codemod/fixtures/assignment-skip.input.ts`:
```ts
const original = Deno.readTextFileSync;
Deno.readTextFileSync = (path: string | URL) => original(path);
export const text = Deno.readTextFileSync("x.txt");
```

- [ ] **Step 2: Write the failing test**

```ts
/*
 * codemod-deno-ral.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { dirname, fromFileUrl, join } from "../../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import {
  codemodFile,
  type CodemodResult,
  collectFiles,
  type RuleName,
} from "../../../tools/codemod-deno-ral.ts";

const fixtures = join(dirname(fromFileUrl(import.meta.url)), "fixtures");

// Copy a fixture to <tmp>/src/core/<name>.ts so that the import path to the
// (fake) <tmp>/src/deno_ral is "../deno_ral/<module>.ts", then run the codemod.
function run(
  name: string,
  rules: RuleName[],
): { result: CodemodResult; output: string; expected: string | undefined } {
  const tmp = makeTempDirSync({ prefix: "codemod-" });
  const target = join(tmp, "src", "core", `${name}.ts`);
  Deno.mkdirSync(dirname(target), { recursive: true });
  Deno.copyFileSync(join(fixtures, `${name}.input.ts`), target);
  const result = codemodFile(target, rules, {
    ralDir: join(tmp, "src", "deno_ral"),
    dryRun: false,
  });
  const output = Deno.readTextFileSync(target);
  const expectedPath = join(fixtures, `${name}.expected.ts`);
  let expected: string | undefined;
  try {
    expected = Deno.readTextFileSync(expectedPath);
  } catch {
    expected = undefined;
  }
  Deno.removeSync(tmp, { recursive: true });
  return { result, output, expected };
}

// deno-lint-ignore require-await
unitTest("codemod - fs calls and types with a new import", async () => {
  const { result, output, expected } = run("fs-basic", ["fs"]);
  assertEquals(output, expected);
  assertEquals(result.replacements.length, 4);
  assertEquals(result.collisions, []);
  assertEquals(result.importsAdded, {
    "fs.ts": ["FileInfo", "lstatSync", "readTextFileSync", "statSync"],
  });
});

// deno-lint-ignore require-await
unitTest("codemod - a local binding blocks only that name", async () => {
  const { result, output, expected } = run("fs-collision", ["fs"]);
  assertEquals(output, expected);
  assertEquals(result.collisions, [{ name: "remove", line: 3, module: "fs.ts" }]);
  assertEquals(result.replacements.length, 1);
});

// deno-lint-ignore require-await
unitTest("codemod - merges into an existing deno_ral import", async () => {
  const { result, output, expected } = run("existing-import", ["fs"]);
  assertEquals(output, expected);
  assertEquals(result.importsAdded, { "fs.ts": ["statSync"] });
});

// deno-lint-ignore require-await
unitTest("codemod - inserts after the header comment when there are no imports", async () => {
  const { output, expected } = run("no-imports", ["fs"]);
  assertEquals(output, expected);
});

// deno-lint-ignore require-await
unitTest("codemod - temp rule maps MakeTempOptions to TempOptions", async () => {
  const { output, expected } = run("temp-basic", ["temp"]);
  assertEquals(output, expected);
});

// deno-lint-ignore require-await
unitTest("codemod - env rule rewrites the Deno.env expression", async () => {
  const { result, output, expected } = run("env-basic", ["env"]);
  assertEquals(output, expected);
  assertEquals(result.replacements.length, 3);
});

// deno-lint-ignore require-await
unitTest("codemod - env rule reports a local env binding", async () => {
  const { result, output, expected } = run("env-collision", ["env"]);
  assertEquals(output, expected);
  assertEquals(result.collisions, [{ name: "env", line: 2, module: "env.ts" }]);
  assertEquals(result.replacements, []);
});

// deno-lint-ignore require-await
unitTest("codemod - process rule turns args/pid into calls", async () => {
  const { output, expected } = run("process-basic", ["process"]);
  assertEquals(output, expected);
});

// deno-lint-ignore require-await
unitTest("codemod - platform rule rewrites Deno.build.os/arch", async () => {
  const { output, expected } = run("platform-basic", ["platform"]);
  assertEquals(output, expected);
});

// deno-lint-ignore require-await
unitTest("codemod - a file assigning to Deno.* is skipped whole", async () => {
  const { result, output } = run("assignment-skip", ["fs"]);
  assertEquals(result.skipped, "assigns to Deno.readTextFileSync at line 2");
  assertEquals(result.replacements, []);
  assertEquals(output, Deno.readTextFileSync(join(fixtures, "assignment-skip.input.ts")));
});

// deno-lint-ignore require-await
unitTest("codemod - collectFiles applies the skip list", async () => {
  const tmp = makeTempDirSync({ prefix: "codemod-walk-" });
  const mk = (rel: string) => {
    const p = join(tmp, ...rel.split("/"));
    Deno.mkdirSync(dirname(p), { recursive: true });
    Deno.writeTextFileSync(p, "");
  };
  mk("src/core/a.ts");
  mk("src/core/b.d.ts");
  mk("src/core/t.ejs.ts");
  mk("src/core/node_modules/x/index.ts");
  mk("src/deno_ral/fs.ts");
  mk("src/vendor/v.ts");
  mk("src/resources/extension-subtrees/julia-engine/src/j.ts");
  mk("src/command/c.ts");
  const files = collectFiles(join(tmp, "src")).map((f) => f.slice(tmp.length + 1).replaceAll("\\", "/"));
  assertEquals(files, ["src/command/c.ts", "src/core/a.ts"]);
  Deno.removeSync(tmp, { recursive: true });
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `mkdir -p tests/unit/codemod/fixtures && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/codemod/codemod-deno-ral.test.ts`
Expected: fails with `Module not found "file:///.../tools/codemod-deno-ral.ts"`.

- [ ] **Step 4: Implement `tools/codemod-deno-ral.ts`**

```ts
/*
 * codemod-deno-ral.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Rewrites `Deno.<api>` uses to the equivalent export of src/deno_ral/<module>.ts
 * and adds or merges the import. Dev tooling: run with
 *
 *   quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core [--dry-run]
 *
 * See dev-docs/runtime-migration/09-ral-fs-and-temp-layer.md for the rules.
 * This script lives outside the runtime boundary and may use Deno.* itself.
 */

import { Node, Project, SyntaxKind, type SourceFile } from "npm:ts-morph@28.0.0";
import { dirname, join, relative, resolve } from "../src/deno_ral/path.ts";
import { walkSync } from "../src/deno_ral/fs.ts";

export type RuleName = "fs" | "temp" | "env" | "process" | "platform";

interface Rule {
  module: string;
  // Deno.<name> -> replacement identifier; callAfter adds "()" (property reads)
  members: Record<string, { to: string; callAfter?: boolean }>;
  // Deno.<T> in a type position -> replacement type name
  types: Record<string, string>;
  // Deno.<a>.<b> -> replacement identifier
  nested: Record<string, string>;
}

const kFsNames = [
  "readTextFileSync", "readTextFile", "readFileSync", "readFile",
  "writeTextFileSync", "writeTextFile", "writeFileSync", "writeFile",
  "statSync", "stat", "lstatSync", "lstat", "mkdirSync", "mkdir",
  "removeSync", "remove", "renameSync", "rename", "copyFileSync", "copyFile",
  "readDirSync", "readDir", "symlinkSync", "symlink", "readLinkSync",
  "realPathSync", "realPath", "chmodSync", "chmod", "utimeSync",
  "truncateSync", "open", "openSync", "create",
];

const same = (names: string[]) =>
  Object.fromEntries(names.map((n) => [n, { to: n }]));

export const RULES: Record<RuleName, Rule> = {
  fs: {
    module: "fs.ts",
    members: same(kFsNames),
    types: { FileInfo: "FileInfo", DirEntry: "DirEntry", FsFile: "FsFile" },
    nested: {},
  },
  temp: {
    module: "temp.ts",
    members: same(["makeTempDirSync", "makeTempDir", "makeTempFileSync", "makeTempFile"]),
    types: { MakeTempOptions: "TempOptions" },
    nested: {},
  },
  env: {
    module: "env.ts",
    members: { env: { to: "env" } },
    types: {},
    nested: {},
  },
  process: {
    module: "process.ts",
    members: {
      ...same(["exit", "cwd", "chdir", "execPath"]),
      args: { to: "args", callAfter: true },
      pid: { to: "pid", callAfter: true },
    },
    types: {},
    nested: {},
  },
  platform: {
    module: "platform.ts",
    members: {},
    types: {},
    nested: { "build.os": "os", "build.arch": "arch" },
  },
};

export interface Replacement {
  line: number;
  from: string;
  to: string;
}
export interface Collision {
  name: string;
  line: number;
  module: string;
}
export interface CodemodResult {
  file: string;
  replacements: Replacement[];
  collisions: Collision[];
  importsAdded: Record<string, string[]>;
  skipped?: string;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

const kSkipSegments = ["node_modules", "deno_ral", "vendor", "extension-subtrees"];

export function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of walkSync(dir, { includeDirs: false, exts: [".ts"] })) {
    const segments = entry.path.split(/[\\/]/);
    if (segments.some((s) => kSkipSegments.includes(s))) continue;
    if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".ejs.ts")) continue;
    files.push(entry.path);
  }
  return files.sort();
}

function isDenoIdentifier(node: Node | undefined): boolean {
  return node !== undefined && Node.isIdentifier(node) && node.getText() === "Deno";
}

// Is this identifier a binding or a reference in scope (as opposed to a
// property name), so that importing a function of the same name would clash?
function isBindingOrReference(id: Node): boolean {
  const parent = id.getParent();
  if (!parent) return true;
  if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) return false;
  if (Node.isPropertyAssignment(parent) && parent.getNameNode() === id) return false;
  if (Node.isPropertySignature(parent) || Node.isMethodSignature(parent)) return false;
  if (Node.isPropertyDeclaration(parent) || Node.isMethodDeclaration(parent)) {
    return parent.getNameNode() !== id;
  }
  if (Node.isQualifiedName(parent)) return false;
  if (Node.isEnumMember(parent)) return false;
  return true;
}

function importSpecifierFor(file: string, ralDir: string, module: string): string {
  let rel = relative(dirname(resolve(file)), join(resolve(ralDir), module));
  rel = rel.replaceAll("\\", "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function resolvesToModule(sourceFile: SourceFile, specifier: string, ralDir: string, module: string): boolean {
  if (!specifier.startsWith(".")) return false;
  const target = resolve(join(resolve(ralDir), module)).replaceAll("\\", "/");
  const actual = resolve(join(dirname(sourceFile.getFilePath()), specifier)).replaceAll("\\", "/");
  return target === actual;
}

function sortNames(names: Iterable<string>): string[] {
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "en"));
}

export function codemodFile(
  file: string,
  rules: RuleName[],
  options: { ralDir: string; dryRun: boolean },
): CodemodResult {
  const result: CodemodResult = { file, replacements: [], collisions: [], importsAdded: {} };
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(file);
  const text = sourceFile.getFullText();

  // 1. Files that assign to Deno.* (monkey patches, instrumentation) are left alone.
  for (const pae of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (!isDenoIdentifier(pae.getExpression())) continue;
    const parent = pae.getParent();
    if (Node.isBinaryExpression(parent) && parent.getLeft() === pae &&
      parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
      result.skipped = `assigns to ${pae.getText()} at line ${pae.getStartLineNumber()}`;
      return result;
    }
  }

  const edits: Edit[] = [];
  const wanted = new Map<string, { values: Set<string>; types: Set<string> }>(); // module -> names
  const want = (module: string, name: string, isType: boolean) => {
    const w = wanted.get(module) ?? { values: new Set(), types: new Set() };
    (isType ? w.types : w.values).add(name);
    wanted.set(module, w);
  };

  // 2. Collision detection: identifiers equal to a name we would import.
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
  const collides = (name: string, module: string): Collision | undefined => {
    for (const id of identifiers) {
      if (id.getText() !== name) continue;
      // an existing import of the same name from the same layer module is fine
      const spec = id.getFirstAncestorByKind(SyntaxKind.ImportSpecifier);
      if (spec) {
        const decl = spec.getFirstAncestorByKindOrThrow(SyntaxKind.ImportDeclaration);
        if (resolvesToModule(sourceFile, decl.getModuleSpecifierValue(), options.ralDir, module)) continue;
        return { name, line: id.getStartLineNumber(), module };
      }
      if (isBindingOrReference(id)) {
        return { name, line: id.getStartLineNumber(), module };
      }
    }
    return undefined;
  };
  const collisionCache = new Map<string, Collision | undefined>();
  const blocked = (name: string, module: string): boolean => {
    const key = module + ":" + name;
    if (!collisionCache.has(key)) {
      const c = collides(name, module);
      collisionCache.set(key, c);
      if (c) result.collisions.push(c);
    }
    return collisionCache.get(key) !== undefined;
  };

  // 3. Value positions: Deno.<name> and Deno.<a>.<b>.
  for (const pae of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (!isDenoIdentifier(pae.getExpression())) continue;
    const name = pae.getName();
    for (const ruleName of rules) {
      const rule = RULES[ruleName];
      const parent = pae.getParent();
      if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === pae) {
        const nestedKey = `${name}.${parent.getName()}`;
        const to = rule.nested[nestedKey];
        if (to) {
          if (blocked(to, rule.module)) break;
          edits.push({ start: parent.getStart(), end: parent.getEnd(), text: to });
          result.replacements.push({ line: parent.getStartLineNumber(), from: parent.getText(), to });
          want(rule.module, to, false);
          break;
        }
      }
      const member = rule.members[name];
      if (member) {
        if (blocked(member.to, rule.module)) break;
        const to = member.callAfter ? `${member.to}()` : member.to;
        edits.push({ start: pae.getStart(), end: pae.getEnd(), text: to });
        result.replacements.push({ line: pae.getStartLineNumber(), from: pae.getText(), to });
        want(rule.module, member.to, false);
        break;
      }
    }
  }

  // 4. Type positions: Deno.<T>.
  for (const ref of sourceFile.getDescendantsOfKind(SyntaxKind.TypeReference)) {
    const typeName = ref.getTypeName();
    if (!Node.isQualifiedName(typeName)) continue;
    if (!isDenoIdentifier(typeName.getLeft())) continue;
    const name = typeName.getRight().getText();
    for (const ruleName of rules) {
      const rule = RULES[ruleName];
      const to = rule.types[name];
      if (!to) continue;
      if (blocked(to, rule.module)) break;
      edits.push({ start: typeName.getStart(), end: typeName.getEnd(), text: to });
      result.replacements.push({ line: typeName.getStartLineNumber(), from: typeName.getText(), to });
      want(rule.module, to, true);
      break;
    }
  }

  if (edits.length === 0) {
    return result;
  }

  // 5. Imports: merge into an existing declaration or insert a new one.
  const importDecls = sourceFile.getImportDeclarations();
  const newDecls: string[] = [];
  for (const [module, names] of wanted) {
    const existing = importDecls.find((d) =>
      resolvesToModule(sourceFile, d.getModuleSpecifierValue(), options.ralDir, module)
    );
    const already = new Set<string>();
    const alreadyTypes = new Set<string>();
    if (existing) {
      for (const s of existing.getNamedImports()) {
        (s.isTypeOnly() ? alreadyTypes : already).add(s.getName());
      }
    }
    const addValues = sortNames([...names.values].filter((n) => !already.has(n)));
    const addTypes = sortNames([...names.types].filter((n) => !alreadyTypes.has(n) && !already.has(n)));
    if (addValues.length + addTypes.length === 0) continue;
    result.importsAdded[module] = sortNames([...addValues, ...addTypes]);
    const allValues = sortNames([...already, ...addValues]);
    const allTypes = sortNames([...alreadyTypes, ...addTypes]);
    const specifiers = sortNames([...allValues, ...allTypes]).map((n) =>
      allTypes.includes(n) && !allValues.includes(n) ? `type ${n}` : n
    );
    const specifier = existing
      ? existing.getModuleSpecifierValue()
      : importSpecifierFor(file, options.ralDir, module);
    const declText = `import { ${specifiers.join(", ")} } from "${specifier}";`;
    if (existing) {
      edits.push({ start: existing.getStart(), end: existing.getEnd(), text: declText });
    } else {
      newDecls.push(declText);
    }
  }
  // New declarations go in one edit so that their order is the rule order.
  if (newDecls.length > 0) {
    if (importDecls.length > 0) {
      const last = importDecls[importDecls.length - 1];
      edits.push({ start: last.getEnd(), end: last.getEnd(), text: "\n" + newDecls.join("\n") });
    } else {
      const first = sourceFile.getStatements()[0];
      const pos = first ? first.getStart() : text.length;
      edits.push({ start: pos, end: pos, text: newDecls.join("\n") + "\n" });
    }
  }

  // 6. Apply from the end so earlier offsets stay valid.
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = text;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  if (!options.dryRun) {
    Deno.writeTextFileSync(file, out);
  }
  return result;
}

function parseArgs(argv: string[]) {
  const opts = { rules: [] as RuleName[], dirs: [] as string[], files: [] as string[], dryRun: false, ralDir: join(Deno.cwd(), "src", "deno_ral") };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--rules") opts.rules = argv[++i].split(",") as RuleName[];
    else if (a === "--dir") opts.dirs.push(argv[++i]);
    else if (a === "--file") opts.files.push(argv[++i]);
    else if (a === "--ral-dir") opts.ralDir = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  if (opts.rules.length === 0) throw new Error("--rules is required");
  for (const r of opts.rules) {
    if (!(r in RULES)) throw new Error(`unknown rule: ${r} (expected ${Object.keys(RULES).join(", ")})`);
  }
  if (opts.dirs.length + opts.files.length === 0) throw new Error("--dir or --file is required");
  return opts;
}

if (import.meta.main) {
  const opts = parseArgs(Deno.args);
  const files = [...opts.files, ...opts.dirs.flatMap(collectFiles)];
  let rewritten = 0, replacements = 0, withCollisions = 0, skipped = 0;
  for (const file of files) {
    const r = codemodFile(file, opts.rules, { ralDir: opts.ralDir, dryRun: opts.dryRun });
    const rel = relative(Deno.cwd(), file).replaceAll("\\", "/");
    if (r.skipped) {
      skipped++;
      console.log(`${rel}: skipped: ${r.skipped}`);
      continue;
    }
    for (const c of r.collisions) {
      console.log(`${rel}:${c.line}: collision: local binding '${c.name}' conflicts with deno_ral/${c.module}; left as Deno.*`);
    }
    if (r.collisions.length > 0) withCollisions++;
    if (r.replacements.length > 0) {
      rewritten++;
      replacements += r.replacements.length;
      const imports = Object.entries(r.importsAdded).map(([m, n]) => `${m}: ${n.join(", ")}`).join("; ");
      console.log(`${rel}: ${r.replacements.length} replacement(s)${imports ? `, import ${imports}` : ""}`);
      if (opts.dryRun) {
        for (const rep of r.replacements) console.log(`  ${rel}:${rep.line}: ${rep.from} → ${rep.to}`);
      }
    }
  }
  console.log(`Summary: ${files.length} files scanned, ${rewritten} ${opts.dryRun ? "would be " : ""}rewritten, ${replacements} replacements, ${withCollisions} with collisions, ${skipped} skipped`);
}
```

- [ ] **Step 5: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/codemod/codemod-deno-ral.test.ts`
Expected: `ok | 11 passed | 0 failed`. The first run downloads `ts-morph@28.0.0` into the Deno npm cache (network needed once).

If a fixture comparison fails on whitespace only, fix the *expected* file to match the tool's deterministic output and say so in the commit message; the contract is "deterministic", not "pretty" (PRs 10–14 run `deno fmt` after the codemod).

- [ ] **Step 6: Dry-run against the real tree**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dry-run | tail -8`
Expected output includes lines of the form:
```
src/core/deno/monkey-patch.ts: skipped: assigns to Deno.realPathSync at line 17
src/core/performance/metrics.ts: skipped: assigns to Deno.readTextFileSync at line 23
src/core/copy.ts:60: collision: local binding 'copyFileSync' conflicts with deno_ral/fs.ts; left as Deno.*
src/core/qualified-path.ts:69: collision: local binding 'readTextFile' conflicts with deno_ral/fs.ts; left as Deno.*
src/core/qualified-path.ts:73: collision: local binding 'readTextFileSync' conflicts with deno_ral/fs.ts; left as Deno.*
Summary: N files scanned, M would be rewritten, R replacements, 2 with collisions, 2 skipped
```
and `git status --short src` shows no modified files.

- [ ] **Step 7: Commit**

```bash
git add tools/codemod-deno-ral.ts tests/unit/codemod
git commit -m "tools: ts-morph codemod for Deno.* to deno_ral rewrites, with fixtures"
```

### Task 5: docs and final verification

**Files:**
- Modify: `.claude/rules/typescript/deno-ral.md`

- [ ] **Step 1: Update the module table**

Replace the `fs.ts` row and add rows for `temp.ts` and `errors.ts`:

```
| `fs.ts` | File system | `readTextFileSync`, `writeTextFileSync`, `statSync`, `readDirSync` (sorted), `removeSync`, `mkdirSync`, `copyFileSync`, `open`, `existsSync`, `ensureDirSync`, `copySync`, `safeMoveSync`, `safeRemoveSync`; types `FileInfo`, `DirEntry`, `FsFile` |
| `temp.ts` | Temp files/dirs with retry | `makeTempDirSync`, `makeTempDir`, `makeTempFileSync`, `makeTempFile`; type `TempOptions` |
| `errors.ts` | Runtime-neutral error predicates | `isNotFound`, `isAlreadyExists`, `isPermissionDenied`, `isAddrInUse`, `isConnectionRefused`, `isConnectionError`, `errorWithPath` |
```

Add a subsection:

```
## Moving code off `Deno.*`

Never add new `Deno.*` calls; import the equivalent from `deno_ral/`. To migrate existing files mechanically:

    quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/<dir> --dry-run
    quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/<dir>

The tool reports local-name collisions (left as `Deno.*`, fix by hand with an alias import) and skips files that assign to `Deno.*`. Replace `instanceof Deno.errors.X` with the predicates in `deno_ral/errors.ts`.
```

Also replace the `## Deno APIs vs Node.js` example block in `.claude/rules/typescript/deno-essentials.md` (it still tells readers to call `Deno.readTextFileSync` and `Deno.env.get`) with:

```typescript
// Correct - runtime layer
import { readTextFileSync, writeTextFileSync } from "../deno_ral/fs.ts";
import { makeTempDirSync } from "../deno_ral/temp.ts";
import { cwd } from "../deno_ral/process.ts";

// Wrong - direct runtime calls (the CI ratchet counts these)
Deno.readTextFileSync(path);
Deno.cwd();
```

- [ ] **Step 2: Run the Verification list, then commit**

```bash
git add .claude/rules/typescript/deno-ral.md .claude/rules/typescript/deno-essentials.md
git commit -m "rules: document deno_ral fs/temp/errors and the codemod"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/fs.test.ts unit/deno-ral/errors.test.ts unit/deno-ral/temp.test.ts unit/codemod/codemod-deno-ral.test.ts unit/ral/` → `ok | 32 passed | 0 failed`.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes; `git diff --stat tools/runtime-boundary-baseline.json` is empty (no callers moved).
- `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dry-run` → the skip/collision lines in Task 4 step 6; `git status --short src` clean.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts` → pass (nothing in the render path changed; this is the smoke sanity check).

## Review checklist

- [ ] `readTextFileSync`/`readTextFile`/`readFileSync`/`readFile` call `Deno.*` at call time (no cached reference), so `captureFileReads` keeps working.
- [ ] `errorWithPath` is idempotent and uses the same `"\nPath: "` text as `monkey-patch.ts:116,131`.
- [ ] `realPathSync` reproduces `normalizePath` (`src/core/path.ts:319-328`) exactly and documents that symlinks are not resolved; `realPath` (async) resolves them.
- [ ] `readDirSync` returns an array sorted with the code-unit comparator; `readDir` sorts before yielding.
- [ ] `temp.ts` retries 5 times with the same debug messages as the monkey patch and rethrows non-`Error` values immediately.
- [ ] The codemod never mutates the AST; edits are applied from the end; a file is written only when something changed and `--dry-run` is off.
- [ ] Collision detection treats shorthand properties (`{ cwd }`) and parameters as collisions and property names (`a.remove`, `{ remove: 1 }`) as non-collisions.
- [ ] `collectFiles` skips `node_modules`, `deno_ral`, `vendor`, `extension-subtrees`, `*.d.ts`, `*.ejs.ts`.
- [ ] No file outside `src/deno_ral/`, `tools/`, `tests/unit/` and the two rules docs changed; the ratchet baseline is unchanged.

## Risks and rollback

- `npm:ts-morph@28.0.0` under Deno 2.7: ts-morph runs on Deno through the `node:` compatibility layer and is widely used that way; if `Project` fails to load, pin `npm:ts-morph@26.0.0` (previous major) and, as a last resort, rewrite the finder on `npm:typescript@5.9.3`'s compiler API with the same text-edit strategy (the test fixtures are the contract either way).
- The codemod test needs network on first run to fetch ts-morph; CI runners have it. `QUARTO_RUN_NO_NETWORK=true` (`--cached-only`) will fail until the package is cached.
- `readDirSync` returning an array instead of a lazy iterator changes nothing for `for…of` callers; the one caller that spreads it (`src/command/use/commands/brand.ts:706`) still works.
- Double "Path:" annotation while `monkey-patch.ts` is alive is prevented by idempotence; if a message ever shows the path twice, the paths differ in form (URL vs string) and `annotate` should normalise with `toPathString` on both sides (it already does on ours).
- Rollback: revert the PR; nothing outside the layer, `tools/` and tests changes.

## Decisions needed

1. **Additions to the shared vocabulary** in `fs.ts` (`open`, `openSync`, `create`, `FsFile`, `OpenOptions`, `WriteOptions`, `realPath`, `symlink`, `chmod`) and `errors.ts` (`isConnectionError`): the 11 `Deno.open` sites and the three async calls have no home in the template, and `src/core/http.ts:230-235` needs a predicate for the five socket errors. Options: (a) accept and fold into `_TEMPLATE.md`; (b) leave those 15 sites as `Deno.*` in the baseline until PR 27 designs a stream API. Recommendation: (a); the shapes are structural copies of what the callers already use, and PR 27 implements `FsFile` on `node:fs` file handles.
2. **Where the import is placed in files without imports**: before the first statement (after the header comment), as implemented. Alternative: at byte 0. Recommendation: keep; it preserves the copyright header position.
