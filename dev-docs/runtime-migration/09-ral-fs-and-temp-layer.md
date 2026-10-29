# PR 09: `deno_ral/fs.ts` and `deno_ral/temp.ts` API, error predicates, unit tests, and the ts-morph codemod (no callers moved yet)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the filesystem, temp-file and error-predicate surface of the runtime layer (`src/deno_ral/fs.ts` extended and retyped, `src/deno_ral/temp.ts` and `src/deno_ral/errors.ts` new), each with a unit test that is the compatibility contract for PR 27, and ship the codemod `tools/codemod-deno-ral.ts` (forward and `--reverse`) that PRs 10–14 run to move callers and that the backport checklist uses to move fixes back to stable branches.
**Phase:** 1.
**Depends on:** PR 02 (ratchet; the codemod imports its `kSrcExclusions`).
**Unblocks:** PR 10, 11, 12, 13, 14, 14b, 17, 18, 19, 20b, 23, 24, 25.
Milestone J (Julia engine, README row J) needs nothing from this PR beyond the exported `fs.ts`/`temp.ts`/`errors.ts` interfaces; the hand-off to PumasAI is triage A9.
**Branch:** `rt/09-ral-fs-and-temp-layer`.
**Suggested executor:** Opus.
The layer code is mechanical, but the codemod's symbol-based collision handling, alias-preserving import merge and reverse mode need judgement, and the two monkey-patch behaviours (read-error path annotation, temp retry) must be carried over exactly.
**Size:** M.
3 layer modules (1 extended), 1 tool with its own test and 21 fixture files, 3 unit test files, 2 rules docs, the backport checklist, one changelog line; no application caller changes.
**Ships on:** Deno; the existing test suite must stay green.
The ratchet baseline does not change (no caller moves).

## Spec

### Context

Assessment section 11, module plan rows `fs.ts` ("extend: readTextFile[Sync], … own `FileInfo`, `DirEntry` types; error predicates.
The read-error path annotation moves here.
`readDirSync` callers that depend on order get an explicit sort") and `temp.ts` ("new: makeTempDir[Sync], makeTempFile[Sync], own `TempOptions`; carries the retry loop from `core/deno/monkey-patch.ts`"), design rule 4 ("error handling through predicates … replace `instanceof Deno.errors.X`") and order-of-work step 3 ("a `ts-morph` script run with `quarto run --dev` rewrites `Deno.<fsCall>(` to the layer function and adds the import; review by directory").
Review findings S10 and S11 (2026-10-15) set the codemod's requirements: retype the layer helpers that take Deno types, preserve aliases and `import type`, symbol-based idempotent collisions, a reverse mode for backports, and a skip list that mirrors the ratchet.

What exists today (verified 2026-10-15, `main` at `b86f98d`):

- `src/deno_ral/fs.ts` (206 lines; its header comment says `encoding.ts`, a copy-paste error) re-exports `@std/fs` helpers (`ensureDir`, `existsSync`, `walk`, `expandGlob`, `copy`, `moveSync`, `emptyDirSync`, `EOL`) and defines `safeMoveSync`, `safeRemoveSync`, `safeExistsFileSync`, `safeRemoveDirSync`, `safeModeFromFile`, `safeChmodSync`, `ensureUserWritable`, `isSubdir`, `toPathString`, `getFileInfoType`.
  Two of them take Deno types: `getFileInfoType(fileInfo: Deno.FileInfo)` (line 30) and `safeRemoveSync(file, options: Deno.RemoveOptions = {})` (line 116).
  `src/core/copy.ts:203` calls `getFileInfoType(Deno.lstatSync(src))`; once PR 10 rewrites that to the layer's `lstatSync`, which returns the 8-field `FileInfo`, `deno check` fails because `Deno.FileInfo` requires `dev`, `ino`, `nlink`, `ctime`, … This PR retypes both helpers to the layer's types, so PR 10 type-checks.
- `src/core/deno/monkey-patch.ts` (135 lines), imported first by `src/quarto.ts:9`: sets `Deno.realPathSync = normalizePath` (line 17; `normalizePath` in `src/core/path.ts:319-328` makes the path absolute against `Deno.cwd()`, normalises it, and upper-cases a Windows drive letter; it does not resolve symlinks and removes no prefix), wraps `Deno.makeTemp{File,Dir}{,Sync}` in a 5-attempt retry loop on any error (lines 35-99, Deno issue 17781), and wraps `Deno.readTextFile{,Sync}` to append `"\nPath: <path>"` to the error message (lines 101-135).
  It also installs `Deno.copy`/`Deno.writeAll` shims (lines 19-24; PR 25).
  `src/deno_ral/original-real-path.ts` saves the un-patched `Deno.realPathSync` for `safeRemoveDirSync`, `check.ts:194`, `tests/utils.ts:315` and two smoke tests.
- **No code calls `Deno.realPathSync` itself** (`rg 'Deno\.realPathSync\('` over `src`, `tests`, `package/src` finds only comments, the monkey-patch assignment and `originalRealPathSync`).
  The first draft of this plan added a `realPathSync` with `normalizePath` semantics next to a symlink-resolving `realPath`: a sync/async pair with opposite meanings (macOS `/var` vs `/private/var`) and no callers.
  It is dropped.
  The layer instead gets `canonicalPathSync(path)` (symlinks resolved, throws when missing), implemented on the runtime's own real-path call, and the codemod maps `Deno.realPathSync(` to it.
  The async `realPath` keeps `Deno.realPath` semantics (`src/tools/impl/tinytex.ts:662` relies on symlink resolution).
- `@std/fs@1.0.16` (the import map's `fs/` key): the only `Deno.realPathSync` call in the modules Quarto imports is in `walk`/`walkSync` (`walk.ts:922`), and it runs only with `followSymlinks: true`, which `expandGlob` forwards; `copy`/`expand_glob` never call it.
  Every Quarto call site passes `followSymlinks: false` explicitly (`src/core/copy.ts:80`, `src/project/project-context.ts:940,1085`, `src/extension/extension.ts:532`) or relies on the default `false`.
  So the monkey patch changes nothing for `@std/fs` today, and removing it (PR 25) is safe.
- `src/core/performance/metrics.ts:18-33` (`captureFileReads`) reassigns `Deno.readTextFileSync` at runtime to record file reads.
  Until PR 20b replaces that with the layer's `onFileRead(listener)` hook, the layer must look `Deno.readTextFileSync` up at call time (never cache the function).
  This PR does not add `onFileRead`; PR 20b owns it.
- Deno-specific types used in application signatures that this PR gives a home: `Deno.FileInfo` (`src/core/copy.ts:231,232`), `Deno.MakeTempOptions` (`src/core/temp.ts:58,71,76,79`, `src/core/temp-types.ts:11,13,14`, `monkey-patch.ts`), `Deno.ReadFileOptions` (`src/core/qualified-path.ts:69`), `Deno.FsFile` (none by name; 11 `Deno.open` sites use it structurally).
- `Deno.errors.*` sites: 18 in `src/` (17 `instanceof` checks and one type alias), 1 in `package/src`, 4 in `tests/`: `NotFound` (`src/project/project-index.ts:250`, `src/command/render/pandoc.ts:1648`, `src/core/copy.ts:236`, `src/core/cache/cache.ts:161`, `src/core/path.ts:189`, `src/core/http.ts:64,230`, `src/core/jupyter/jupyter-shared.ts:107`, `src/core/typst.ts:82`, `package/src/common/validate-bundle.ts:72`), `PermissionDenied` (`src/project/project-context.ts:652,967,1072`; 967 is the type alias `InputWalkError`, rewritten by PR 12), `AddrInUse` (`src/core/port.ts:131`), and the five connection errors in `src/core/http.ts:231-235`.
- `Deno.readDirSync`/`Deno.readDir` iteration: no caller uses `.next()`; `src/command/use/commands/brand.ts:706` spreads the result (works on an array); `src/tools/impl/chrome-headless-shell.ts:122` mutates the directory while iterating (safer with a snapshot array); emptiness checks (`src/core/path.ts:53`, `src/command/use/commands/template.ts:373`, `src/command/render/freeze.ts:250`) become a full read and sort, negligible for those directories.
  Order-dependent loops: `src/format/html/format-html-shared.ts:133` (bslib SCSS; PR 01 also sorts), `src/command/capabilities/capabilities.ts:75` (theme list), `src/command/call/build-ts-extension/cmd.ts:118` (entry list), `src/project/types/manuscript/manuscript-meca.ts:427` (MECA item order), `src/extension/extension.ts:296,477,683` (extension discovery order).
  The layer sorts by code unit (`a.name < b.name`), so uppercase names sort before lowercase ones.
  That differs from APFS and NTFS listing order as well as from ext4's hash order, so the discovery order changes on every OS; the result is deterministic everywhere, and the PR carries a changelog line.
- Dev scripts import npm packages directly: `tools/deno-esbuild-bundle.ts:1` uses `npm:esbuild@0.27.1`.
  `quarto run --dev <script>` (`src/core/run/deno.ts:37-74`) runs `deno run --import-map src/import_map.json --allow-all` and passes the script's arguments through untouched (`src/command/run/run.ts:14-44`), so `npm:ts-morph@28.0.0` (pure JS, latest) resolves from the Deno npm cache.
  With PR 00b's committed `deno.lock` and `--frozen`, the new npm package must be added to the lockfile (Task 5).

### Scope

In:
- `src/deno_ral/fs.ts`: every function and type from the shared vocabulary (`canonicalPathSync` included, the normalising `realPathSync` excluded), implemented on `Deno.*`; `getFileInfoType` and `safeRemoveSync` retyped to the layer's types; `safeRemoveDirSync` moved from `originalRealPathSync` to `canonicalPathSync`; the header comment fixed.
- `src/deno_ral/errors.ts`: the vocabulary predicates (also looking through `cause`), `isConnectionError` and `errorWithPath`.
- `src/deno_ral/temp.ts`: `TempOptions`, `makeTemp{Dir,File}{,Sync}`, retrying 5 times on `isAlreadyExists` only.
- `tools/codemod-deno-ral.ts` with rules `fs`, `temp`, `env`, `process`, `platform`; `--dry-run`, `--dir`, `--file`, `--ral-dir`, `--reverse`; symbol-based, idempotent collision detection; alias- and `isTypeOnly`-preserving import merge; skip list = PR 02's `kSrcExclusions` plus `src/core/lib` and `src/resources/tools/ast-diagram`.
- Tests: `tests/unit/ral/fs.test.ts`, `errors.test.ts`, `temp.test.ts`; the codemod test `tools/codemod/codemod-deno-ral.test.ts` with fixtures under `tools/codemod/fixtures/`, run by a dedicated CI step (not by `run-tests.sh`).
- `.claude/rules/typescript/deno-ral.md` rows for `fs.ts`, `temp.ts`, `errors.ts` and a "Moving code off `Deno.*`" subsection; `.claude/rules/typescript/deno-essentials.md` example block; `dev-docs/checklist-backport-a-pr.md` reverse-codemod step; `news/changelog-1.11.md` line for directory order; `deno.lock` entry for `ts-morph`.

Out:
- Moving any caller (PRs 10–14, 23, 24).
  Deleting or editing `src/core/deno/monkey-patch.ts` (PR 25).
  Reimplementing `walk`/`expandGlob`/`copy` (PR 27).
- The `onFileRead` read-observer hook and the `metrics.ts` rewrite (PR 20b).
- `src/deno_ral/env.ts` itself (PR 14 adds it; the codemod's `env` rule is written here and tested on fixtures only).
- The `process` rule's targets beyond `exit`, `cwd`, `chdir`, `args`, `execPath`, `pid` (PR 08 moves `Deno.Command` by hand).
- A reverse mapping for `errors.ts` predicates (not 1:1; the backport step lists them for hand edits).

### Interfaces

#### `src/deno_ral/fs.ts` (additions and retyped helpers; other existing exports unchanged)

```ts
export interface FileInfo {
  isFile: boolean; isDirectory: boolean; isSymlink: boolean;
  size: number; mtime: Date | null; atime: Date | null; birthtime: Date | null; mode: number | null;
}
export interface DirEntry { name: string; isFile: boolean; isDirectory: boolean; isSymlink: boolean; }
// the file-handle shape the 11 Deno.open sites use (streams, Reader/Writer, close)
export interface FsFile {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  read(p: Uint8Array): Promise<number | null>;
  write(p: Uint8Array): Promise<number>;
  writeSync(p: Uint8Array): number;
  close(): void;
}
export interface OpenOptions { read?: boolean; write?: boolean; append?: boolean; create?: boolean; truncate?: boolean; mode?: number; }
export interface WriteOptions { append?: boolean; create?: boolean; mode?: number; }

export function readTextFileSync(path: string | URL): string;            // error message gets "\nPath: <path>" (once)
export function readTextFile(path: string | URL): Promise<string>;       // same
export function readFileSync(path: string | URL): Uint8Array;            // same
export function readFile(path: string | URL): Promise<Uint8Array>;       // same
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
export function readDirSync(path: string | URL): DirEntry[];             // sorted by name, code-unit order (an array is an Iterable<DirEntry>)
export function readDir(path: string | URL): AsyncIterable<DirEntry>;    // sorted by name, code-unit order
export function symlinkSync(target: string | URL, path: string | URL, options?: { type?: "file" | "dir" }): void;
export function symlink(target: string | URL, path: string | URL, options?: { type?: "file" | "dir" }): Promise<void>;
export function readLinkSync(path: string | URL): string;
export function realPath(path: string | URL): Promise<string>;           // resolves symlinks (Deno.realPath), as tinytex.ts relies on today
/** Symlinks resolved; the runtime itself returns no Windows `\\?\` prefix; throws
 *  when `path` does not exist. Deno: the un-patched Deno.realPathSync (saved by
 *  original-real-path.ts until PR 25); PR 27: fs.realpathSync.native. */
export function canonicalPathSync(path: string | URL): string;
export function chmodSync(path: string | URL, mode: number): void;
export function chmod(path: string | URL, mode: number): Promise<void>;
export function utimeSync(path: string | URL, atime: number | Date, mtime: number | Date): void;
export function truncateSync(path: string | URL, len?: number): void;
export function open(path: string | URL, options?: OpenOptions): Promise<FsFile>;
export function openSync(path: string | URL, options?: OpenOptions): FsFile;
export function create(path: string | URL): Promise<FsFile>;

// retyped existing helpers
export function getFileInfoType(fileInfo: FileInfo): PathType | undefined;
export function safeRemoveSync(file: string, options?: { recursive?: boolean }): void;
```

`Deno.FileInfo` and `Deno.DirEntry` are structurally assignable to `FileInfo`/`DirEntry`, so callers that still pass Deno values keep compiling during PRs 10–13.

#### `src/deno_ral/errors.ts`

```ts
export function isNotFound(e: unknown): boolean;          // Deno.errors.NotFound | code ENOENT (also on e.cause)
export function isAlreadyExists(e: unknown): boolean;     // Deno.errors.AlreadyExists | EEXIST (also on e.cause)
export function isPermissionDenied(e: unknown): boolean;  // Deno.errors.PermissionDenied | EACCES | EPERM (also on e.cause)
export function isAddrInUse(e: unknown): boolean;         // Deno.errors.AddrInUse | EADDRINUSE (also on e.cause)
export function isConnectionRefused(e: unknown): boolean; // Deno.errors.ConnectionRefused | ECONNREFUSED (also on e.cause)
export function isConnectionError(e: unknown): boolean;   // BrokenPipe | NotConnected | ConnectionAborted | ConnectionReset | ConnectionRefused | EPIPE | ENOTCONN | ECONNABORTED | ECONNRESET | ECONNREFUSED
export function errorWithPath(e: Error, path: string): Error; // appends "\nPath: <path>" unless the message already ends with it; returns e
```

Looking through `cause` (one level) makes `isNotFound(e)` true for `exec`'s wrapped "missing executable" error (PR 08 sets `code` and `cause`).

#### `src/deno_ral/temp.ts`

```ts
export interface TempOptions { dir?: string; prefix?: string; suffix?: string; }
export function makeTempDirSync(options?: TempOptions): string;   // up to 5 attempts while isAlreadyExists(e); any other error is rethrown at once
export function makeTempDir(options?: TempOptions): Promise<string>;
export function makeTempFileSync(options?: TempOptions): string;
export function makeTempFile(options?: TempOptions): Promise<string>;
/** Exported for the unit test: call fn up to `attempts` times while it throws an AlreadyExists error. */
export function retryOnAlreadyExists<T>(fn: () => T, attempts?: number): T;
```

While `monkey-patch.ts` is alive (until PR 25), its own any-error loop runs inside this one; a NotFound then costs 5 inner attempts (not 25), an AlreadyExists at most 25.
Harmless and temporary.

#### `tools/codemod-deno-ral.ts`

CLI: `quarto run --dev tools/codemod-deno-ral.ts --rules <r1,r2> (--dir <d> | --file <f>)... [--dry-run] [--reverse] [--ral-dir <path>]`.

- `--rules`: comma-separated subset of `fs`, `temp`, `env`, `process`, `platform` (required).
- `--dir`: walk `*.ts` under it (repeatable), relative to the current directory, which must be the repository root.
  Skipped: the paths in `kCodemodExclusions` (PR 02's `kSrcExclusions`: `src/deno_ral`, `src/vendor`, `src/resources/extension-subtrees`, `src/resources/scripts`, `src/resources/create`, `src/webui/quarto-preview/build.ts`; plus `src/core/lib`, which is bundled for the browser and must not import `deno_ral` (`src/core/lib/errors.ts:27-29`), and `src/resources/tools/ast-diagram`, a standalone script run by `deno run` without the import map that PR 25 moves into the ratchet allow-list), any `node_modules/` segment, `*.d.ts`, `*.ejs.ts`.
- `--file`: one file (repeatable); not subject to the skip list (used by the backport step on worktree files).
- `--dry-run`: print every replacement as `<file>:<line>: Deno.x → x` and the import that would be added; write nothing.
- `--reverse`: map layer names imported from `deno_ral/<module>.ts` back to `Deno.*` and remove the specifiers (and the declaration when it becomes empty).
  Uses the same rule tables read right to left.
- `--ral-dir`: absolute path of the layer directory (default `<cwd>/src/deno_ral`); import specifiers are computed relative to each file from it.

Library API (used by the codemod test):

```ts
export type RuleName = "fs" | "temp" | "env" | "process" | "platform";
export const kCodemodExclusions: readonly string[];
export interface Replacement { line: number; from: string; to: string; }
export interface Collision { name: string; line: number; module: string; }
export interface CodemodResult {
  file: string;
  replacements: Replacement[];            // applied (or, in dry-run, would be applied)
  collisions: Collision[];                // forward: names left as Deno.* because another binding of that name exists
  importsAdded: Record<string, string[]>; // forward: module file name -> names added
  importsRemoved: Record<string, string[]>; // reverse: module file name -> names removed
  left: Collision[];                      // reverse: layer names with a use the rules cannot express (left as is)
  skipped?: string;                       // whole file left untouched, with the reason
}
export function codemodFile(
  file: string,
  rules: RuleName[],
  options: { ralDir: string; dryRun: boolean; reverse?: boolean },
): CodemodResult;
export function collectFiles(dir: string, root?: string): string[];  // the walk with the skip list applied, sorted; root defaults to cwd
```

Rule tables (exact):

| Rule | Module | `Deno.<name>` → export | Types `Deno.<T>` → export |
|---|---|---|---|
| `fs` | `fs.ts` | `readTextFileSync`, `readTextFile`, `readFileSync`, `readFile`, `writeTextFileSync`, `writeTextFile`, `writeFileSync`, `writeFile`, `statSync`, `stat`, `lstatSync`, `lstat`, `mkdirSync`, `mkdir`, `removeSync`, `remove`, `renameSync`, `rename`, `copyFileSync`, `copyFile`, `readDirSync`, `readDir`, `symlinkSync`, `symlink`, `readLinkSync`, `realPath`, `chmodSync`, `chmod`, `utimeSync`, `truncateSync`, `open`, `openSync`, `create` (each to the same name); `realPathSync` → `canonicalPathSync` | `FileInfo` → `FileInfo`, `DirEntry` → `DirEntry`, `FsFile` → `FsFile` |
| `temp` | `temp.ts` | `makeTempDirSync`, `makeTempDir`, `makeTempFileSync`, `makeTempFile` | `MakeTempOptions` → `TempOptions` |
| `env` | `env.ts` | `env` (the `Deno.env` expression itself; `Deno.env.get(...)` becomes `env.get(...)`) | — |
| `process` | `process.ts` | `exit`, `cwd`, `chdir`, `execPath` (calls); `args` → `args()`, `pid` → `pid()` (property reads become calls) | — |
| `platform` | `platform.ts` | `build.os` → `os`, `build.arch` → `arch` (two-level member access) | — |

Behaviour (forward):
1. A file that writes to `Deno.*`, or uses the global `Deno` other than as `Deno.x`, is skipped whole with a `skipped` reason; rewriting any of it could turn a captured original (`const original = Deno.readTextFileSync`) into a layer call that forwards to the patched method, so the patch calls itself.
   - `assigns to <target> at line N`: `Deno.x` or, for nested rules, `Deno.a.b` is the target of an assignment (`=`, compound, logical), `++`/`--`, `delete`, a `for…of`/`for…in` head, or a destructuring pattern; the target or the `Deno` receiver may be wrapped in parentheses, `as`, `<T>`, `!` or `satisfies` (`(Deno as any).x = …`), and `Deno["x"]` counts as `Deno.x`.
   - `assigns to Deno.a via <call> at line N`: for nested rules, `Deno.a` is the first argument of `Object.assign`/`defineProperty`/`defineProperties` or `Reflect.set`/`defineProperty`/`deleteProperty`.
   - `uses Deno other than as Deno.x at line N`: the global `Deno` is aliased (`const D = Deno`), passed as an argument (`Object.defineProperty(Deno, …)`), spread, or destructured; `typeof Deno`, type positions (`Deno.FileInfo`) and declaration names (`type Deno = …`) are not uses.
   - `reaches Deno through globalThis.Deno at line N`: `Deno` is reached through `globalThis`, `self` or `window`, with `.Deno` or `["Deno"]`.
   - `listed in kCodemodPatchFiles`: the backstop, checked after the four reasons, for files known to patch `Deno`.

   The check is per file: what happens to `Deno` once it is passed elsewhere, or a patch in one file meeting a capture in another, is left to the rule that no code outside `src/deno_ral/` reaches `Deno` indirectly (README "How to execute a plan", and the review checklist in `_TEMPLATE.md`).
   The guard keeps `src/core/deno/monkey-patch.ts` and (until PR 20b) `src/core/performance/metrics.ts` untouched automatically; `kCodemodPatchFiles` keeps both as a backstop.
   Decided 2026-10-29: the guard is best-effort and frozen. Confirmed gaps (each reproduced on Deno 2.7.14: the file is rewritten, `skipped` stays undefined): a write through `Reflect.get(globalThis, "Deno")`, a computed key `globalThis[k]`, a comma-wrapped nested receiver `Object.assign((0, Deno.build), …)`. A new bypass spelling is handled by listing the patching file in `kCodemodPatchFiles`, not by a guard change.
2. **Alias reuse.** If the file already imports the export from the same layer module (`import { stat as fsStat } from ".../deno_ral/fs.ts"`), the replacement text is that local name (`Deno.stat(` → `fsStat(`), and no import is added.
   This makes the PRs 10–14 hand fixes (alias imports for collisions) stable under re-runs.
3. **Symbol-based collisions.** The replacement text `x` collides when some identifier `x` in the file that is a binding or a reference (declaration name, parameter, import specifier, shorthand property value, plain reference; property names `a.x`, `{ x: 1 }`, interface members are not) resolves, through the type checker, to a symbol whose declarations are not all import specifiers of export `x` from the same layer module.
   Unresolvable identifiers count as collisions (conservative).
   A colliding name is left as `Deno.*` everywhere in the file and reported as a `Collision`; the rest of the file is still rewritten.
   Because an existing layer import of the same export never collides, a second run over a partly migrated file finishes the job (idempotent).
4. **Import merge.** New value names are merged into an existing non-type-only `import { … } from "<rel>/deno_ral/<module>.ts"`, keeping every existing specifier's text (`type X`, `x as y`) and sorting by exported name with `localeCompare`; new type names go into that same declaration as inline `type X`, or into an existing `import type { … }` from the module when only types are added.
   Without a suitable declaration, a new one is inserted after the last import, or before the first statement (after the header comment) when the file has no imports; a declaration with only type names is written `import type { … }`.
5. Edits are computed from AST positions and applied to the file text from the end backwards; the AST is never mutated.
   Files are written only when at least one replacement was applied and `--dry-run` is off.
   The tool lives in `tools/`, outside the ratchet scopes, and may use `Deno.*`.

Behaviour (reverse): for each import specifier from a layer module of the selected rules whose exported name appears in the rule tables, every reference to its local binding (resolved by symbol, so aliases and shadowing are handled) is replaced: values by `Deno.<name>` (`env` → `Deno.env`, `os`/`arch` → `Deno.build.os`/`Deno.build.arch`), a call `args()`/`pid()` by `Deno.args`/`Deno.pid`, a type reference by `Deno.<T>`.
`canonicalPathSync` is never reversed; it is reported in `left` with a hint to use `originalRealPathSync`, because stable branches patch `Deno.realPathSync` to `normalizePath`.
If every reference was rewritten the specifier is removed (the declaration too when nothing is left); otherwise the specifier stays and is reported in `left`.
Names outside the tables (`existsSync`, `safeRemoveSync`, `isNotFound`, …) are untouched: stable branches have `deno_ral/fs.ts` with the `safe*` helpers, but not `errors.ts`.

### Files

- Modify: `src/deno_ral/fs.ts` (header comment, `getFileInfoType`/`safeRemoveSync` types, `safeRemoveDirSync`, new section appended)
- Create: `src/deno_ral/errors.ts`, `src/deno_ral/temp.ts`, `tools/codemod-deno-ral.ts`
- Create: `tests/unit/ral/fs.test.ts`, `tests/unit/ral/errors.test.ts`, `tests/unit/ral/temp.test.ts`
- Create: `tools/codemod/codemod-deno-ral.test.ts`, `tools/codemod/fixtures/{fs-basic,fs-collision,existing-import,existing-alias,type-only-existing,already-migrated,realpath,no-imports,temp-basic,env-basic,env-collision,process-basic,platform-basic,assignment-skip,reverse-left}.input.ts` and the matching `.expected.ts` (none for `assignment-skip`; `reverse-left` uses `reverse-left.expected.ts`; `existing-alias` also has `reverse-alias.expected.ts`)
- Modify: `.github/workflows/runtime-boundary.yml` (PR 02's workflow: one step running the codemod test)
- Modify: `.claude/rules/typescript/deno-ral.md`, `.claude/rules/typescript/deno-essentials.md`, `dev-docs/checklist-backport-a-pr.md`, `news/changelog-1.11.md`, `deno.lock`

### Acceptance criteria

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` → `ok | 24 passed | 0 failed` (12 fs + 4 errors + 5 temp + the 3 existing cases in `$(find unit/ral/ -name '*.test.ts')`).
- `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` → `ok | 17 passed | 0 failed`; `run-tests.sh` does not discover it (it lives outside `tests/`).
- `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dry-run` runs to completion, reports `src/core/deno/monkey-patch.ts` and `src/core/performance/metrics.ts` as skipped (only the first if PR 20b has landed), reports the collisions in `src/core/copy.ts` (`copyFileSync`, local function first referenced at line 60) and `src/core/qualified-path.ts` (`readTextFile` line 69, `readTextFileSync` line 73), never lists a file under `src/core/lib/`, and leaves the tree unchanged (`git status --short src` is empty).
- `quarto run --dev tools/check-runtime-boundary.ts` passes at the unchanged baseline.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.

## Plan

Assumes PR 02 landed (`tools/check-runtime-boundary.ts` exporting `kSrcExclusions`, and `.github/workflows/runtime-boundary.yml`), `./configure.sh` has been run, and `package/dist/bin/tools/x86_64/deno` is the dev Deno (substitute the architecture directory present).
New unit tests use the layer (`deno_ral`) for their own file operations, never raw `Deno.*` (the ratchet has a `tests` scope); the error-predicate test reads `Deno.errors` directly behind a `typeof Deno` guard and counts in the `tests` baseline (reading it through `globalThis` would only hide it from the ratchet).

### Task 1: `src/deno_ral/errors.ts`

**Files:**
- Create: `src/deno_ral/errors.ts`
- Test: `tests/unit/ral/errors.test.ts`

- [x] **Step 1: Write the failing test**

```ts
/*
 * errors.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "../../asserts.ts";
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

// The runtime's own error classes, when the runtime has them (Deno). Looked up
// through globalThis so this file stays free of the Deno namespace.
// deno-lint-ignore no-explicit-any
const runtimeErrors = (globalThis as any)["Deno"]?.errors as
  | Record<string, new (msg: string) => Error>
  | undefined;

// deno-lint-ignore require-await
unitTest("errors - predicates recognise the runtime's error classes", async () => {
  if (!runtimeErrors) return; // Node: covered by the code-based case below
  const e = (name: string) => new runtimeErrors[name]("x");
  assert(isNotFound(e("NotFound")));
  assert(isAlreadyExists(e("AlreadyExists")));
  assert(isPermissionDenied(e("PermissionDenied")));
  assert(isAddrInUse(e("AddrInUse")));
  assert(isConnectionRefused(e("ConnectionRefused")));
  assert(isConnectionError(e("BrokenPipe")));
  assert(isConnectionError(e("ConnectionReset")));
  assert(isConnectionError(e("ConnectionRefused")));
  assert(!isNotFound(e("AlreadyExists")));
  assert(!isConnectionError(e("NotFound")));
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
  assert(!isNotFound(new Error("x")));
  assert(!isNotFound(undefined));
  assert(!isNotFound("ENOENT"));
});

// deno-lint-ignore require-await
unitTest("errors - predicates look through cause (wrapped exec errors)", async () => {
  const wrapped = new Error("Error executing 'x': not found", {
    cause: withCode("ENOENT"),
  });
  assert(isNotFound(wrapped));
  assert(!isAlreadyExists(wrapped));
  const plain = new Error("outer", { cause: new Error("inner") });
  assert(!isNotFound(plain));
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

- [x] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/errors.test.ts` Expected: fails with `Module not found "file:///.../src/deno_ral/errors.ts"`.

- [x] **Step 3: Implement**

```ts
/*
 * errors.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Runtime-neutral error predicates. Application code uses these instead of
 * `instanceof Deno.errors.X`. The Deno classes are matched when the Deno
 * global exists; Node-style `code` properties are matched everywhere. A
 * wrapper error (deno_ral/process.ts exec) is looked through via `cause`.
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

function matchesOne(e: unknown, names: DenoErrorName[], codes: string[]): boolean {
  const code = errorCode(e);
  if (code !== undefined && codes.includes(code)) {
    return true;
  }
  return names.some((name) => isDenoError(e, name));
}

function matches(e: unknown, names: DenoErrorName[], codes: string[]): boolean {
  if (matchesOne(e, names, codes)) {
    return true;
  }
  const cause = e instanceof Error ? e.cause : undefined;
  return cause !== undefined && matchesOne(cause, names, codes);
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

- [x] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/errors.test.ts` Expected: `ok | 4 passed | 0 failed`

- [x] **Step 5: Commit**

```bash
git add src/deno_ral/errors.ts tests/unit/ral/errors.test.ts
git commit -m "deno_ral/errors: runtime-neutral error predicates"
```

### Task 2: `src/deno_ral/temp.ts`

**Files:**
- Create: `src/deno_ral/temp.ts`
- Test: `tests/unit/ral/temp.test.ts`

- [x] **Step 1: Write the failing test**

The test uses only helpers that `deno_ral/fs.ts` already exports (`existsSync`, `safeRemoveSync`), so it does not depend on Task 3.

```ts
/*
 * temp.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects, assertThrows } from "../../asserts.ts";
import {
  makeTempDir,
  makeTempDirSync,
  makeTempFile,
  makeTempFileSync,
  retryOnAlreadyExists,
} from "../../../src/deno_ral/temp.ts";
import { isAlreadyExists, isNotFound } from "../../../src/deno_ral/errors.ts";
import { existsSync, safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { basename, dirname, join } from "../../../src/deno_ral/path.ts";

function codeError(code: string): Error {
  const e = new Error(code);
  (e as Error & { code: string }).code = code;
  return e;
}

// deno-lint-ignore require-await
unitTest("temp - makeTempDirSync honours dir, prefix and suffix", async () => {
  const root = makeTempDirSync({ prefix: "ral-temp-" });
  try {
    const dir = makeTempDirSync({ dir: root, prefix: "pre-", suffix: "-suf" });
    assertEquals(dirname(dir), root);
    assert(basename(dir).startsWith("pre-"));
    assert(basename(dir).endsWith("-suf"));
    assert(existsSync(dir));
  } finally {
    safeRemoveSync(root, { recursive: true });
  }
});

// deno-lint-ignore require-await
unitTest("temp - makeTempFileSync creates a file", async () => {
  const root = makeTempDirSync({ prefix: "ral-temp-" });
  try {
    const file = makeTempFileSync({ dir: root, suffix: ".json" });
    assertEquals(dirname(file), root);
    assert(file.endsWith(".json"));
    assert(existsSync(file));
  } finally {
    safeRemoveSync(root, { recursive: true });
  }
});

unitTest("temp - async variants", async () => {
  const root = await makeTempDir({ prefix: "ral-temp-" });
  try {
    const dir = await makeTempDir({ dir: root });
    const file = await makeTempFile({ dir: root, prefix: "f-" });
    assert(existsSync(dir));
    assert(existsSync(file));
    assert(basename(file).startsWith("f-"));
  } finally {
    safeRemoveSync(root, { recursive: true });
  }
});

unitTest("temp - a missing parent directory fails with NotFound", async () => {
  const root = makeTempDirSync({ prefix: "ral-temp-" });
  const missing = join(root, "nope", "deeper");
  try {
    const e = assertThrows(() => makeTempDirSync({ dir: missing }));
    assert(isNotFound(e), `expected NotFound, got ${e}`);
    const e2 = await assertRejects(() => makeTempFile({ dir: missing }));
    assert(isNotFound(e2), `expected NotFound, got ${e2}`);
  } finally {
    safeRemoveSync(root, { recursive: true });
  }
});

// deno-lint-ignore require-await
unitTest("temp - retries only AlreadyExists, at most 5 times", async () => {
  let calls = 0;
  const flaky = () => {
    calls++;
    if (calls < 3) throw codeError("EEXIST");
    return "ok";
  };
  assertEquals(retryOnAlreadyExists(flaky), "ok");
  assertEquals(calls, 3);

  calls = 0;
  const e = assertThrows(() =>
    retryOnAlreadyExists(() => {
      calls++;
      throw codeError("EEXIST");
    })
  );
  assert(isAlreadyExists(e));
  assertEquals(calls, 5);

  calls = 0;
  assertThrows(() =>
    retryOnAlreadyExists(() => {
      calls++;
      throw codeError("ENOENT");
    })
  );
  assertEquals(calls, 1, "other errors are not retried");
});
```

- [x] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/temp.test.ts` Expected: fails with `Module not found "file:///.../src/deno_ral/temp.ts"`.

- [x] **Step 3: Implement**

```ts
/*
 * temp.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Temporary files and directories. Carries the retry that
 * core/deno/monkey-patch.ts installs on Deno.makeTemp* (rare EEXIST races,
 * https://github.com/denoland/deno/issues/17781), narrowed to AlreadyExists:
 * any other error (a missing parent directory, a permission problem) is
 * reported at once. Until PR 25 removes the monkey patch, its own loop runs
 * inside this one; that is harmless.
 */

import { isAlreadyExists } from "./errors.ts";
import { debug } from "./log.ts";

export interface TempOptions {
  dir?: string;
  prefix?: string;
  suffix?: string;
}

const kMaxAttempts = 5;

/** Call fn up to `attempts` times while it throws an AlreadyExists error. */
export function retryOnAlreadyExists<T>(
  fn: () => T,
  attempts = kMaxAttempts,
): T {
  for (let i = 1; ; i++) {
    try {
      return fn();
    } catch (err) {
      if (!isAlreadyExists(err) || i >= attempts) {
        throw err;
      }
      debug(`Temp path already exists, retrying (${i} of ${attempts - 1})`);
    }
  }
}

async function retryOnAlreadyExistsAsync<T>(
  fn: () => Promise<T>,
  attempts = kMaxAttempts,
): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!isAlreadyExists(err) || i >= attempts) {
        throw err;
      }
      debug(`Temp path already exists, retrying (${i} of ${attempts - 1})`);
    }
  }
}

export function makeTempDirSync(options?: TempOptions): string {
  return retryOnAlreadyExists(() => Deno.makeTempDirSync(options));
}

export function makeTempDir(options?: TempOptions): Promise<string> {
  return retryOnAlreadyExistsAsync(() => Deno.makeTempDir(options));
}

export function makeTempFileSync(options?: TempOptions): string {
  return retryOnAlreadyExists(() => Deno.makeTempFileSync(options));
}

export function makeTempFile(options?: TempOptions): Promise<string> {
  return retryOnAlreadyExistsAsync(() => Deno.makeTempFile(options));
}
```

- [x] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/temp.test.ts` Expected: `ok | 5 passed | 0 failed`

- [x] **Step 5: Commit**

```bash
git add src/deno_ral/temp.ts tests/unit/ral/temp.test.ts
git commit -m "deno_ral/temp: makeTemp* retrying on AlreadyExists only"
```

### Task 3: `src/deno_ral/fs.ts` additions

**Files:**
- Modify: `src/deno_ral/fs.ts` (append after `ensureUserWritable`, line 206)
- Test: `tests/unit/ral/fs.test.ts`

- [x] **Step 1: Write the failing test**

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
  assertStringIncludes,
  assertThrows,
} from "../../asserts.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { isNotFound } from "../../../src/deno_ral/errors.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { join } from "../../../src/deno_ral/path.ts";
import {
  canonicalPathSync,
  chmodSync,
  copyFileSync,
  create,
  existsSync,
  getFileInfoType,
  lstatSync,
  mkdirSync,
  open,
  readDir,
  readDirSync,
  readFileSync,
  readLinkSync,
  readTextFile,
  readTextFileSync,
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
      removeSync(dir, { recursive: true });
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

unitTest("fs - canonicalPathSync resolves symlinks and throws when missing", withDir((dir) => {
  const real = join(dir, "real");
  mkdirSync(real);
  const canonicalReal = canonicalPathSync(real);
  assertEquals(canonicalPathSync(join(real, "..", "real")), canonicalReal);
  assert(!canonicalReal.startsWith("\\\\?\\"), "no Windows verbatim prefix");
  if (!isWindows) {
    const link = join(dir, "link");
    symlinkSync(real, link);
    assertEquals(canonicalPathSync(link), canonicalReal, "symlinks are resolved");
  }
  const e = assertThrows(() => canonicalPathSync(join(dir, "missing")));
  assert(isNotFound(e));
}));

unitTest("fs - getFileInfoType takes the layer's FileInfo", withDir((dir) => {
  const file = join(dir, "f.txt");
  writeTextFileSync(file, "x");
  assertEquals(getFileInfoType(lstatSync(file)), "file");
  assertEquals(getFileInfoType(lstatSync(dir)), "dir");
  if (!isWindows) {
    const link = join(dir, "f-link");
    symlinkSync(file, link);
    assertEquals(getFileInfoType(lstatSync(link)), "symlink");
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

- [x] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs.test.ts` Expected: fails at type-check with `Module '"../../../src/deno_ral/fs.ts"' has no exported member 'readTextFileSync'` (and others).

- [x] **Step 3: Implement (append to `src/deno_ral/fs.ts`)**

Add `import { errorWithPath } from "./errors.ts";` to the imports at the top (keep the existing `fromFileUrl`, `resolve`, `SEP` and `originalRealPathSync` imports), then append:

```ts
// ---------------------------------------------------------------------------
// Plain filesystem calls (PR 09). Deno's names are kept so that the codemod is
// `Deno.x(` → `x(` plus an import. Implemented on Deno here; PR 27 moves this
// section to node:fs behind the same signatures and the same unit test
// (tests/unit/ral/fs.test.ts).
//
// Deno.* is looked up at call time on purpose: core/performance/metrics.ts
// reassigns Deno.readTextFileSync to record file reads until PR 20b replaces
// that with the onFileRead hook in this module.
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

/** Resolves symlinks (the un-patched Deno.realPath behaviour). */
export function realPath(path: string | URL): Promise<string> {
  return Deno.realPath(path);
}

/**
 * The canonical absolute path: symlinks resolved, and no Windows `\\?\` prefix
 * (Deno strips it itself, so nothing is sliced here). Throws when the path
 * does not exist. Uses the runtime's own realPathSync: until PR 25 deletes
 * core/deno/monkey-patch.ts, Deno.realPathSync is patched to normalizePath,
 * so the saved original is called. PR 25 switches this to Deno.realPathSync;
 * PR 27 to fs.realpathSync.native.
 */
export function canonicalPathSync(path: string | URL): string {
  return originalRealPathSync(path);
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

Then make the edits to the existing part of the file:

- Header comment: `* encoding.ts` on line 2 is a copy-paste error; replace it with `* fs.ts`.
- Line 30, `getFileInfoType`: `export function getFileInfoType(fileInfo: FileInfo): PathType | undefined {` (the `FileInfo` interface is declared further down in the same module; TypeScript hoists interfaces).
- Lines 114-117, `safeRemoveSync`: `options: { recursive?: boolean } = {},` instead of `options: Deno.RemoveOptions = {},`.
- Lines 147-163, `safeRemoveDirSync`: replace the comment block and the two calls with

```ts
  // Resolve symlinks so both sides compare the same physical path. External
  // tools (knitr, for example) may resolve symlinks while project.dir
  // preserves them.
  let resolvedPath = path;
  let resolvedBoundary = boundary;
  try {
    resolvedPath = canonicalPathSync(path);
    resolvedBoundary = canonicalPathSync(boundary);
  } catch {
    // If resolution fails (e.g., path doesn't exist), use original paths
  }
```

The `originalRealPathSync` import (line 11) stays: `canonicalPathSync` uses it until PR 25.

- [x] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs.test.ts $(find unit/ral/ -name '*.test.ts')` Expected: `ok | 15 passed | 0 failed` (12 new + the 3 existing cases in `unit/ral/safe-*.test.ts`).

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` Expected: no errors.

- [x] **Step 5: Commit**

```bash
git add src/deno_ral/fs.ts tests/unit/ral/fs.test.ts
git commit -m "deno_ral/fs: plain filesystem calls, canonicalPathSync, layer-typed helpers"
```


### Task 4: the codemod and its fixtures

**Files:**
- Create: `tools/codemod-deno-ral.ts`
- Test: `tools/codemod/codemod-deno-ral.test.ts`, `tools/codemod/fixtures/*`

The codemod test lives under `tools/`, not `tests/unit/`: `run-tests.sh` only discovers `*.test.ts` under `tests/`, so the per-OS unit runs never download or type-check `npm:ts-morph` (review finding: it would add network and TypeScript compiler typings to every `tests/unit` run on three OSes).
It runs in one dedicated CI step (Task 5) and locally with plain `deno test`.
Being outside the ratchet scopes, it may use `Deno.*`.

- [x] **Step 1: Write the fixtures**

Each fixture is copied by the test to `<tmp>/src/core/<name>.ts`, next to a (non-existent) `<tmp>/src/deno_ral/`, so layer imports read `../deno_ral/<module>.ts`.
Fixture files are inputs to a tool, not modules of the build, and `deno check` never sees them (they are not imported).

`tools/codemod/fixtures/fs-basic.input.ts`:
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

`tools/codemod/fixtures/fs-basic.expected.ts`:
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

`tools/codemod/fixtures/fs-collision.input.ts`:
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

`tools/codemod/fixtures/fs-collision.expected.ts`:
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

`tools/codemod/fixtures/existing-import.input.ts`:
```ts
import { existsSync } from "../deno_ral/fs.ts";

export function sizeOf(path: string): number {
  if (!existsSync(path)) {
    return 0;
  }
  return Deno.statSync(path).size;
}
```

`tools/codemod/fixtures/existing-import.expected.ts`:
```ts
import { existsSync, statSync } from "../deno_ral/fs.ts";

export function sizeOf(path: string): number {
  if (!existsSync(path)) {
    return 0;
  }
  return statSync(path).size;
}
```

`tools/codemod/fixtures/existing-alias.input.ts`:
```ts
import { join } from "../deno_ral/path.ts";
import { os as platformOs } from "../deno_ral/platform.ts";

export function binDir(base: string): string {
  if (Deno.build.os === "linux") {
    return join(base, `bin/${Deno.build.arch}-linux`);
  }
  return platformOs;
}
```

`tools/codemod/fixtures/existing-alias.expected.ts`:
```ts
import { join } from "../deno_ral/path.ts";
import { arch, os as platformOs } from "../deno_ral/platform.ts";

export function binDir(base: string): string {
  if (platformOs === "linux") {
    return join(base, `bin/${arch}-linux`);
  }
  return platformOs;
}
```

`tools/codemod/fixtures/reverse-alias.expected.ts` (the reverse of `existing-alias.expected.ts`; the alias import goes too, which is correct for a stable branch):
```ts
import { join } from "../deno_ral/path.ts";

export function binDir(base: string): string {
  if (Deno.build.os === "linux") {
    return join(base, `bin/${Deno.build.arch}-linux`);
  }
  return Deno.build.os;
}
```

`tools/codemod/fixtures/type-only-existing.input.ts`:
```ts
import type { FileInfo } from "../deno_ral/fs.ts";

export function info(path: string): FileInfo {
  return Deno.statSync(path);
}
```

`tools/codemod/fixtures/type-only-existing.expected.ts`:
```ts
import type { FileInfo } from "../deno_ral/fs.ts";
import { statSync } from "../deno_ral/fs.ts";

export function info(path: string): FileInfo {
  return statSync(path);
}
```

`tools/codemod/fixtures/already-migrated.input.ts`:
```ts
import { stat as fsStat, statSync } from "../deno_ral/fs.ts";

export async function sizes(a: string, b: string): Promise<number> {
  const stat = await Deno.stat(a);
  return stat.size + statSync(a).size + Deno.statSync(b).size + (await fsStat(b)).size;
}
```

`tools/codemod/fixtures/already-migrated.expected.ts`:
```ts
import { stat as fsStat, statSync } from "../deno_ral/fs.ts";

export async function sizes(a: string, b: string): Promise<number> {
  const stat = await fsStat(a);
  return stat.size + statSync(a).size + statSync(b).size + (await fsStat(b)).size;
}
```

`tools/codemod/fixtures/realpath.input.ts`:
```ts
export const canonical = (p: string) => Deno.realPathSync(p);
```

`tools/codemod/fixtures/realpath.expected.ts`:
```ts
import { canonicalPathSync } from "../deno_ral/fs.ts";
export const canonical = (p: string) => canonicalPathSync(p);
```

`tools/codemod/fixtures/no-imports.input.ts`:
```ts
/*
 * no imports at all
 */

export const text = Deno.readTextFileSync("x.txt");
```

`tools/codemod/fixtures/no-imports.expected.ts`:
```ts
/*
 * no imports at all
 */

import { readTextFileSync } from "../deno_ral/fs.ts";
export const text = readTextFileSync("x.txt");
```

`tools/codemod/fixtures/temp-basic.input.ts`:
```ts
export function scratch(options?: Deno.MakeTempOptions): string {
  return Deno.makeTempDirSync({ prefix: "q-", ...options });
}
```

`tools/codemod/fixtures/temp-basic.expected.ts`:
```ts
import { makeTempDirSync, type TempOptions } from "../deno_ral/temp.ts";
export function scratch(options?: TempOptions): string {
  return makeTempDirSync({ prefix: "q-", ...options });
}
```

`tools/codemod/fixtures/env-basic.input.ts`:
```ts
export function home(): string {
  Deno.env.set("QUARTO_X", "1");
  const all = Deno.env.toObject();
  return Deno.env.get("HOME") ?? all["USERPROFILE"] ?? "";
}
```

`tools/codemod/fixtures/env-basic.expected.ts`:
```ts
import { env } from "../deno_ral/env.ts";
export function home(): string {
  env.set("QUARTO_X", "1");
  const all = env.toObject();
  return env.get("HOME") ?? all["USERPROFILE"] ?? "";
}
```

`tools/codemod/fixtures/env-collision.input.ts`:
```ts
export function mode(): string {
  const env = Deno.env.get("MODE");
  return env ?? "production";
}
```

`tools/codemod/fixtures/env-collision.expected.ts`: identical to the input (nothing rewritten, one collision reported).

`tools/codemod/fixtures/process-basic.input.ts`:
```ts
export function main() {
  if (Deno.args.length === 0) {
    console.log(Deno.cwd(), Deno.execPath(), Deno.pid);
    Deno.exit(1);
  }
}
```

`tools/codemod/fixtures/process-basic.expected.ts`:
```ts
import { args, cwd, execPath, exit, pid } from "../deno_ral/process.ts";
export function main() {
  if (args().length === 0) {
    console.log(cwd(), execPath(), pid());
    exit(1);
  }
}
```

`tools/codemod/fixtures/platform-basic.input.ts`:
```ts
export const sep = Deno.build.os === "windows" ? "\\" : "/";
export const bits = Deno.build.arch;
```

`tools/codemod/fixtures/platform-basic.expected.ts`:
```ts
import { arch, os } from "../deno_ral/platform.ts";
export const sep = os === "windows" ? "\\" : "/";
export const bits = arch;
```

`tools/codemod/fixtures/assignment-skip.input.ts`:
```ts
const original = Deno.readTextFileSync;
Deno.readTextFileSync = (path: string | URL) => original(path);
export const text = Deno.readTextFileSync("x.txt");
```

`tools/codemod/fixtures/reverse-left.input.ts`:
```ts
import { args, exit } from "../deno_ral/process.ts";

export const argv = args;
export function stop() {
  exit(1);
}
```

`tools/codemod/fixtures/reverse-left.expected.ts`:
```ts
import { args } from "../deno_ral/process.ts";

export const argv = args;
export function stop() {
  Deno.exit(1);
}
```

- [x] **Step 2: Write the failing test**

`tools/codemod/codemod-deno-ral.test.ts`:

```ts
/*
 * codemod-deno-ral.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Contract for tools/codemod-deno-ral.ts. Lives under tools/, not tests/, so
 * that run-tests.sh never loads npm:ts-morph; CI runs it in the
 * runtime-boundary workflow:
 *   package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/
 */

import { assert, assertEquals } from "testing/asserts";
import { dirname, fromFileUrl, join, relative } from "../../src/deno_ral/path.ts";
import {
  codemodFile,
  type CodemodResult,
  collectFiles,
  type RuleName,
} from "../codemod-deno-ral.ts";

const fixtures = join(dirname(fromFileUrl(import.meta.url)), "fixtures");
const read = (name: string) => Deno.readTextFileSync(join(fixtures, name));

// Copy a fixture to <tmp>/src/core/<name>.ts so that the import path to the
// (fake) <tmp>/src/deno_ral is "../deno_ral/<module>.ts", then run the codemod.
function run(
  name: string,
  rules: RuleName[],
  opts: { reverse?: boolean; input?: string } = {},
): { result: CodemodResult; output: string } {
  const tmp = Deno.makeTempDirSync({ prefix: "codemod-" });
  try {
    const target = join(tmp, "src", "core", `${name}.ts`);
    Deno.mkdirSync(dirname(target), { recursive: true });
    Deno.copyFileSync(join(fixtures, opts.input ?? `${name}.input.ts`), target);
    const result = codemodFile(target, rules, {
      ralDir: join(tmp, "src", "deno_ral"),
      dryRun: false,
      reverse: opts.reverse,
    });
    return { result, output: Deno.readTextFileSync(target) };
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
}

Deno.test("codemod - fs calls and types with a new import", () => {
  const { result, output } = run("fs-basic", ["fs"]);
  assertEquals(output, read("fs-basic.expected.ts"));
  assertEquals(result.replacements.length, 4);
  assertEquals(result.collisions, []);
  assertEquals(result.importsAdded, {
    "fs.ts": ["FileInfo", "lstatSync", "readTextFileSync", "statSync"],
  });
});

Deno.test("codemod - a local binding blocks only that name", () => {
  const { result, output } = run("fs-collision", ["fs"]);
  assertEquals(output, read("fs-collision.expected.ts"));
  assertEquals(result.collisions, [{ name: "remove", line: 3, module: "fs.ts" }]);
  assertEquals(result.replacements.length, 1);
});

Deno.test("codemod - merges into an existing deno_ral import", () => {
  const { result, output } = run("existing-import", ["fs"]);
  assertEquals(output, read("existing-import.expected.ts"));
  assertEquals(result.importsAdded, { "fs.ts": ["statSync"] });
});

Deno.test("codemod - keeps an existing alias and reuses it", () => {
  const { result, output } = run("existing-alias", ["platform"]);
  assertEquals(output, read("existing-alias.expected.ts"));
  assertEquals(result.replacements.length, 2);
  assertEquals(result.importsAdded, { "platform.ts": ["arch"] });
});

Deno.test("codemod - leaves an import type declaration type-only", () => {
  const { output } = run("type-only-existing", ["fs"]);
  assertEquals(output, read("type-only-existing.expected.ts"));
});

Deno.test("codemod - an existing layer import is not a collision (idempotent)", () => {
  const { result, output } = run("already-migrated", ["fs"]);
  assertEquals(output, read("already-migrated.expected.ts"));
  assertEquals(result.collisions, []);
  assertEquals(result.importsAdded, {});
  const again = run("already-migrated", ["fs"], { input: "already-migrated.expected.ts" });
  assertEquals(again.result.replacements, []);
  assertEquals(again.output, read("already-migrated.expected.ts"));
});

Deno.test("codemod - Deno.realPathSync becomes canonicalPathSync", () => {
  const { output } = run("realpath", ["fs"]);
  assertEquals(output, read("realpath.expected.ts"));
});

Deno.test("codemod - inserts after the header comment when there are no imports", () => {
  const { output } = run("no-imports", ["fs"]);
  assertEquals(output, read("no-imports.expected.ts"));
});

Deno.test("codemod - temp rule maps MakeTempOptions to TempOptions", () => {
  const { output } = run("temp-basic", ["temp"]);
  assertEquals(output, read("temp-basic.expected.ts"));
});

Deno.test("codemod - env rule rewrites the Deno.env expression", () => {
  const { result, output } = run("env-basic", ["env"]);
  assertEquals(output, read("env-basic.expected.ts"));
  assertEquals(result.replacements.length, 3);
});

Deno.test("codemod - env rule reports a local env binding", () => {
  const { result, output } = run("env-collision", ["env"]);
  assertEquals(output, read("env-collision.expected.ts"));
  assertEquals(result.collisions, [{ name: "env", line: 2, module: "env.ts" }]);
  assertEquals(result.replacements, []);
});

Deno.test("codemod - process rule turns args/pid into calls", () => {
  const { output } = run("process-basic", ["process"]);
  assertEquals(output, read("process-basic.expected.ts"));
});

Deno.test("codemod - platform rule rewrites Deno.build.os/arch", () => {
  const { output } = run("platform-basic", ["platform"]);
  assertEquals(output, read("platform-basic.expected.ts"));
});

Deno.test("codemod - a file assigning to Deno.* is skipped whole", () => {
  const { result, output } = run("assignment-skip", ["fs"]);
  assertEquals(result.skipped, "assigns to Deno.readTextFileSync at line 2");
  assertEquals(result.replacements, []);
  assertEquals(output, read("assignment-skip.input.ts"));
});

Deno.test("codemod --reverse - round-trips the basic fixtures", () => {
  const cases: [string, RuleName[]][] = [
    ["fs-basic", ["fs"]],
    ["no-imports", ["fs"]],
    ["realpath", ["fs"]],
    ["temp-basic", ["temp"]],
    ["env-basic", ["env"]],
    ["process-basic", ["process"]],
    ["platform-basic", ["platform"]],
  ];
  for (const [name, rules] of cases) {
    const { output } = run(name, rules, { reverse: true, input: `${name}.expected.ts` });
    assertEquals(output, read(`${name}.input.ts`), name);
  }
});

Deno.test("codemod --reverse - follows aliases and reports what it cannot express", () => {
  const alias = run("existing-alias", ["platform"], {
    reverse: true,
    input: "existing-alias.expected.ts",
  });
  assertEquals(alias.output, read("reverse-alias.expected.ts"));
  const left = run("reverse-left", ["process"], { reverse: true });
  assertEquals(left.output, read("reverse-left.expected.ts"));
  assertEquals(left.result.left, [{ name: "args", line: 3, module: "process.ts" }]);
  assertEquals(left.result.importsRemoved, { "process.ts": ["exit"] });
});

Deno.test("codemod - collectFiles applies the skip list", () => {
  const tmp = Deno.makeTempDirSync({ prefix: "codemod-walk-" });
  try {
    for (
      const rel of [
        "src/core/a.ts",
        "src/core/b.d.ts",
        "src/core/t.ejs.ts",
        "src/core/node_modules/x/index.ts",
        "src/core/lib/l.ts",
        "src/deno_ral/fs.ts",
        "src/vendor/v.ts",
        "src/resources/extension-subtrees/julia-engine/src/j.ts",
        "src/resources/scripts/s.ts",
        "src/resources/create/c.ts",
        "src/resources/tools/ast-diagram/main.ts",
        "src/webui/quarto-preview/build.ts",
        "src/webui/quarto-preview/src/x.ts",
        "src/command/c.ts",
      ]
    ) {
      const p = join(tmp, ...rel.split("/"));
      Deno.mkdirSync(dirname(p), { recursive: true });
      Deno.writeTextFileSync(p, "");
    }
    const files = collectFiles(join(tmp, "src"), tmp)
      .map((f) => relative(tmp, f).replaceAll("\\", "/"));
    assertEquals(files, [
      "src/command/c.ts",
      "src/core/a.ts",
      "src/webui/quarto-preview/src/x.ts",
    ]);
    assert(!files.some((f) => f.startsWith("src/core/lib/")));
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});
```

- [x] **Step 3: Run it and see it fail**

Run: `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` Expected: fails with `Module not found "file:///.../tools/codemod-deno-ral.ts"`.

- [x] **Step 4: Implement `tools/codemod-deno-ral.ts`**

```ts
/*
 * codemod-deno-ral.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Rewrites `Deno.<api>` uses to the equivalent export of src/deno_ral/<module>.ts
 * and adds or merges the import; with --reverse, rewrites layer names back to
 * `Deno.*` (used by dev-docs/checklist-backport-a-pr.md). Dev tooling: run with
 *
 *   quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core [--dry-run]
 *
 * See dev-docs/runtime-migration/09-ral-fs-and-temp-layer.md for the rules.
 * This script lives outside the runtime boundary and may use Deno.* itself.
 */

import {
  type Identifier,
  type ImportDeclaration,
  type ImportSpecifier,
  Node,
  Project,
  type SourceFile,
  SyntaxKind,
  ts,
} from "npm:ts-morph@28.0.0";
import { dirname, join, relative, resolve } from "../src/deno_ral/path.ts";
import { walkSync } from "../src/deno_ral/fs.ts";
import { kSrcExclusions } from "./check-runtime-boundary.ts";

export type RuleName = "fs" | "temp" | "env" | "process" | "platform";

interface Member {
  to: string;
  callAfter?: boolean; // Deno.args -> args()
}

interface Rule {
  module: string;
  members: Record<string, Member>; // Deno.<name> -> export
  types: Record<string, string>; // Deno.<T> (type position) -> export
  nested: Record<string, string>; // Deno.<a>.<b> -> export
}

const kFsNames = [
  "readTextFileSync", "readTextFile", "readFileSync", "readFile",
  "writeTextFileSync", "writeTextFile", "writeFileSync", "writeFile",
  "statSync", "stat", "lstatSync", "lstat", "mkdirSync", "mkdir",
  "removeSync", "remove", "renameSync", "rename", "copyFileSync", "copyFile",
  "readDirSync", "readDir", "symlinkSync", "symlink", "readLinkSync",
  "realPath", "chmodSync", "chmod", "utimeSync", "truncateSync",
  "open", "openSync", "create",
];

const same = (names: string[]): Record<string, Member> =>
  Object.fromEntries(names.map((n) => [n, { to: n }]));

export const RULES: Record<RuleName, Rule> = {
  fs: {
    module: "fs.ts",
    members: { ...same(kFsNames), realPathSync: { to: "canonicalPathSync" } },
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

/** Paths (relative to the repository root) the codemod never walks into. */
export const kCodemodExclusions: readonly string[] = [
  ...kSrcExclusions,
  // bundled for the browser; must not import deno_ral (src/core/lib/errors.ts:27-29)
  "src/core/lib",
  // run by `deno run` from share/tools without the import map; PR 25 allow-lists it
  "src/resources/tools/ast-diagram",
];

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
  importsRemoved: Record<string, string[]>;
  left: Collision[];
  skipped?: string;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

export function collectFiles(dir: string, root = Deno.cwd()): string[] {
  const files: string[] = [];
  for (const entry of walkSync(dir, { includeDirs: false, exts: [".ts"], skip: [/node_modules/] })) {
    const rel = relative(root, resolve(entry.path)).replaceAll("\\", "/");
    if (kCodemodExclusions.some((e) => rel === e || rel.startsWith(e + "/"))) continue;
    if (rel.split("/").includes("node_modules")) continue;
    if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".ejs.ts")) continue;
    files.push(entry.path);
  }
  return files.sort();
}

function isDenoIdentifier(node: Node | undefined): boolean {
  return node !== undefined && Node.isIdentifier(node) && node.getText() === "Deno";
}

// A binding or a reference in scope, as opposed to a property name.
function isBindingOrReference(id: Node): boolean {
  const parent = id.getParent();
  if (!parent) return true;
  if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) return false;
  if (Node.isPropertyAssignment(parent) && parent.getNameNode() === id) return false;
  if (Node.isPropertySignature(parent) || Node.isMethodSignature(parent)) return false;
  if (Node.isPropertyDeclaration(parent) || Node.isMethodDeclaration(parent)) {
    return parent.getNameNode() !== id;
  }
  if (Node.isQualifiedName(parent) && parent.getRight() === id) return false;
  if (Node.isEnumMember(parent)) return false;
  // `a` in `import { a as b }` names the other module's export, not a binding here
  if (Node.isImportSpecifier(parent) && parent.getAliasNode() !== undefined &&
    parent.getNameNode() === id) return false;
  return true;
}

function resolvesToModule(
  sourceFile: SourceFile,
  specifier: string,
  ralDir: string,
  module: string,
): boolean {
  if (!specifier.startsWith(".")) return false;
  const target = resolve(join(resolve(ralDir), module)).replaceAll("\\", "/");
  const actual = resolve(join(dirname(sourceFile.getFilePath()), specifier))
    .replaceAll("\\", "/");
  return target === actual;
}

function importSpecifierFor(file: string, ralDir: string, module: string): string {
  let rel = relative(dirname(resolve(file)), join(resolve(ralDir), module));
  rel = rel.replaceAll("\\", "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function byName(a: string, b: string): number {
  return a.localeCompare(b, "en");
}

// The symbol an identifier refers to (the value symbol for `{ x }` shorthand).
function referencedDeclarations(id: Identifier, checker: ts.TypeChecker): ts.Declaration[] {
  const parent = id.getParent();
  const symbol = parent && Node.isShorthandPropertyAssignment(parent)
    ? checker.getShorthandAssignmentValueSymbol(parent.compilerNode)
    : checker.getSymbolAtLocation(id.compilerNode);
  return symbol?.declarations ?? [];
}

function specifierExport(spec: ts.ImportSpecifier): string {
  return (spec.propertyName ?? spec.name).text;
}

function newProject(): Project {
  return new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    // noLib: no lib.d.ts per file (speed); identifiers that resolve only to a
    // global then count as collisions, which is the conservative answer.
    compilerOptions: { allowImportingTsExtensions: true, noEmit: true, noLib: true },
  });
}

function emptyResult(file: string): CodemodResult {
  return { file, replacements: [], collisions: [], importsAdded: {}, importsRemoved: {}, left: [] };
}

function applyEdits(text: string, edits: Edit[]): string {
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = text;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

function renderImport(decl: ImportDeclaration, specifiers: string[], typeOnly: boolean): string {
  const def = decl.getDefaultImport()?.getText();
  const head = typeOnly ? "import type " : "import ";
  const named = specifiers.length > 0 ? `{ ${specifiers.join(", ")} }` : "";
  const clause = [def, named].filter((x) => x).join(", ");
  return `${head}${clause} from "${decl.getModuleSpecifierValue()}";`;
}

export function codemodFile(
  file: string,
  rules: RuleName[],
  options: { ralDir: string; dryRun: boolean; reverse?: boolean },
): CodemodResult {
  // Fast path: most files have nothing to rewrite; skip the type checker.
  const raw = Deno.readTextFileSync(file);
  if (!raw.includes(options.reverse ? "deno_ral/" : "Deno.")) {
    return emptyResult(file);
  }
  const project = newProject();
  const sourceFile = project.addSourceFileAtPath(file);
  const checker = project.getTypeChecker().compilerObject;
  const result = options.reverse
    ? reverseFile(sourceFile, rules, options.ralDir, checker)
    : forwardFile(sourceFile, rules, options.ralDir, checker);
  if (result.edits.length > 0 && !options.dryRun) {
    Deno.writeTextFileSync(file, applyEdits(sourceFile.getFullText(), result.edits));
  }
  return result.result;
}

function forwardFile(
  sourceFile: SourceFile,
  rules: RuleName[],
  ralDir: string,
  checker: ts.TypeChecker,
): { result: CodemodResult; edits: Edit[] } {
  const file = sourceFile.getFilePath();
  const result = emptyResult(file);
  const edits: Edit[] = [];
  const text = sourceFile.getFullText();

  // 1. Files that assign to Deno.* (monkey patches, instrumentation) are left alone.
  for (const pae of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (!isDenoIdentifier(pae.getExpression())) continue;
    const parent = pae.getParent();
    if (
      Node.isBinaryExpression(parent) && parent.getLeft() === pae &&
      parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken
    ) {
      result.skipped = `assigns to ${pae.getText()} at line ${pae.getStartLineNumber()}`;
      return { result, edits: [] };
    }
  }

  const importDecls = sourceFile.getImportDeclarations();
  const declsFor = (module: string) =>
    importDecls.filter((d) =>
      resolvesToModule(sourceFile, d.getModuleSpecifierValue(), ralDir, module)
    );

  // 2. Existing local name for an export of a layer module (alias reuse).
  const existingLocal = (module: string, exportName: string, forType: boolean) => {
    for (const d of declsFor(module)) {
      for (const s of d.getNamedImports()) {
        if (s.getName() !== exportName) continue;
        if (!forType && (d.isTypeOnly() || s.isTypeOnly())) continue;
        return s.getAliasNode()?.getText() ?? exportName;
      }
    }
    return undefined;
  };

  // 3. Symbol-based collisions: does `local` refer to anything other than
  //    the layer export it would name?
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
  const isLayerBinding = (decl: ts.Declaration, module: string, exportName: string) => {
    if (!ts.isImportSpecifier(decl) || specifierExport(decl) !== exportName) return false;
    const importDecl = decl.parent.parent.parent;
    return ts.isStringLiteral(importDecl.moduleSpecifier) &&
      resolvesToModule(sourceFile, importDecl.moduleSpecifier.text, ralDir, module);
  };
  const collisionCache = new Map<string, boolean>();
  const blocked = (local: string, module: string, exportName: string): boolean => {
    const key = `${module}:${exportName}:${local}`;
    const cached = collisionCache.get(key);
    if (cached !== undefined) return cached;
    let collision: Collision | undefined;
    for (const id of identifiers) {
      if (id.getText() !== local || !isBindingOrReference(id)) continue;
      const decls = referencedDeclarations(id, checker);
      const ok = decls.length > 0 && decls.every((d) => isLayerBinding(d, module, exportName));
      if (!ok) {
        collision = { name: local, line: id.getStartLineNumber(), module };
        break;
      }
    }
    if (collision) result.collisions.push(collision);
    collisionCache.set(key, collision !== undefined);
    return collision !== undefined;
  };

  const wanted = new Map<string, { values: Set<string>; types: Set<string> }>();
  const want = (module: string, name: string, isType: boolean) => {
    const w = wanted.get(module) ?? { values: new Set(), types: new Set() };
    (isType ? w.types : w.values).add(name);
    wanted.set(module, w);
  };
  const replace = (node: Node, exportName: string, module: string, isType: boolean, suffix = "") => {
    const existing = existingLocal(module, exportName, isType);
    const local = existing ?? exportName;
    if (blocked(local, module, exportName)) return false;
    const to = local + suffix;
    edits.push({ start: node.getStart(), end: node.getEnd(), text: to });
    result.replacements.push({ line: node.getStartLineNumber(), from: node.getText(), to });
    if (!existing) want(module, exportName, isType);
    return true;
  };

  // 4. Value positions: Deno.<name> and Deno.<a>.<b>.
  for (const pae of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (!isDenoIdentifier(pae.getExpression())) continue;
    const name = pae.getName();
    const parent = pae.getParent();
    for (const ruleName of rules) {
      const rule = RULES[ruleName];
      if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === pae) {
        const to = rule.nested[`${name}.${parent.getName()}`];
        if (to) {
          replace(parent, to, rule.module, false);
          break;
        }
      }
      const member = rule.members[name];
      if (member) {
        replace(pae, member.to, rule.module, false, member.callAfter ? "()" : "");
        break;
      }
    }
  }

  // 5. Type positions: Deno.<T>.
  for (const ref of sourceFile.getDescendantsOfKind(SyntaxKind.TypeReference)) {
    const typeName = ref.getTypeName();
    if (!Node.isQualifiedName(typeName) || !isDenoIdentifier(typeName.getLeft())) continue;
    const name = typeName.getRight().getText();
    for (const ruleName of rules) {
      const rule = RULES[ruleName];
      const to = rule.types[name];
      if (!to) continue;
      replace(typeName, to, rule.module, true);
      break;
    }
  }

  if (edits.length === 0) {
    return { result, edits };
  }

  // 6. Imports: merge into an existing declaration or insert a new one.
  const newDecls: string[] = [];
  for (const [module, names] of wanted) {
    const decls = declsFor(module);
    const valueDecl = decls.find((d) => !d.isTypeOnly() && d.getNamespaceImport() === undefined);
    const typeDecl = decls.find((d) => d.isTypeOnly());
    const values = [...names.values].sort(byName);
    const types = [...names.types].sort(byName);
    result.importsAdded[module] = [...values, ...types].sort(byName);
    const render = (existing: string[], add: string[]) =>
      [...existing, ...add].sort((a, b) =>
        byName(a.replace(/^type /, "").split(" as ")[0], b.replace(/^type /, "").split(" as ")[0])
      );
    if (values.length > 0 || (types.length > 0 && valueDecl && !typeDecl)) {
      const add = [...values, ...types.map((t) => `type ${t}`)];
      if (valueDecl) {
        const existing = valueDecl.getNamedImports().map((s) => s.getText());
        edits.push({
          start: valueDecl.getStart(),
          end: valueDecl.getEnd(),
          text: renderImport(valueDecl, render(existing, add), false),
        });
      } else {
        const spec = importSpecifierFor(sourceFile.getFilePath(), ralDir, module);
        newDecls.push(`import { ${render([], add).join(", ")} } from "${spec}";`);
      }
    } else if (types.length > 0) {
      if (typeDecl) {
        const existing = typeDecl.getNamedImports().map((s) => s.getText());
        edits.push({
          start: typeDecl.getStart(),
          end: typeDecl.getEnd(),
          text: renderImport(typeDecl, render(existing, types), true),
        });
      } else {
        const spec = importSpecifierFor(sourceFile.getFilePath(), ralDir, module);
        newDecls.push(`import type { ${types.join(", ")} } from "${spec}";`);
      }
    }
  }
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
  return { result, edits };
}

interface ReverseTarget {
  value?: string; // replacement for a value reference
  call?: string; // replacement for `name()` (callAfter members)
  type?: string; // replacement for a type reference
}

function reverseTable(rule: Rule): Record<string, ReverseTarget> {
  const table: Record<string, ReverseTarget> = {};
  for (const [deno, m] of Object.entries(rule.members)) {
    table[m.to] = m.callAfter ? { call: `Deno.${deno}` } : { value: `Deno.${deno}` };
  }
  for (const [deno, to] of Object.entries(rule.types)) {
    table[to] = { ...table[to], type: `Deno.${deno}` };
  }
  for (const [deno, to] of Object.entries(rule.nested)) {
    table[to] = { value: `Deno.${deno}` };
  }
  return table;
}

function reverseFile(
  sourceFile: SourceFile,
  rules: RuleName[],
  ralDir: string,
  checker: ts.TypeChecker,
): { result: CodemodResult; edits: Edit[] } {
  const result = emptyResult(sourceFile.getFilePath());
  const edits: Edit[] = [];
  const text = sourceFile.getFullText();
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);

  for (const decl of sourceFile.getImportDeclarations()) {
    const ruleName = rules.find((r) =>
      resolvesToModule(sourceFile, decl.getModuleSpecifierValue(), ralDir, RULES[r].module)
    );
    if (!ruleName) continue;
    const rule = RULES[ruleName];
    const table = reverseTable(rule);
    const removed: ImportSpecifier[] = [];
    for (const spec of decl.getNamedImports()) {
      const target = table[spec.getName()];
      if (!target) continue;
      const local = spec.getAliasNode()?.getText() ?? spec.getName();
      const refs = identifiers.filter((id) =>
        id.getText() === local && isBindingOrReference(id) &&
        id !== spec.getNameNode() && id !== spec.getAliasNode() &&
        referencedDeclarations(id, checker).includes(spec.compilerNode)
      );
      const specEdits: Edit[] = [];
      const specReplacements: Replacement[] = [];
      let complete = true;
      for (const id of refs) {
        const parent = id.getParent()!;
        let node: Node = id;
        let to: string | undefined;
        if (Node.isTypeReference(parent) && parent.getTypeName() === id) {
          to = target.type;
        } else if (target.call) {
          if (Node.isCallExpression(parent) && parent.getExpression() === id &&
            parent.getArguments().length === 0) {
            node = parent;
            to = target.call;
          }
        } else {
          to = target.value;
        }
        if (to === undefined) {
          complete = false;
          result.left.push({ name: local, line: id.getStartLineNumber(), module: rule.module });
          break;
        }
        specEdits.push({ start: node.getStart(), end: node.getEnd(), text: to });
        specReplacements.push({ line: node.getStartLineNumber(), from: node.getText(), to });
      }
      if (complete) {
        edits.push(...specEdits);
        result.replacements.push(...specReplacements);
        removed.push(spec);
      }
    }
    if (removed.length === 0) continue;
    result.importsRemoved[rule.module] = removed.map((s) => s.getName()).sort(byName);
    const keep = decl.getNamedImports().filter((s) => !removed.includes(s));
    if (keep.length === 0 && !decl.getDefaultImport() && !decl.getNamespaceImport()) {
      let end = decl.getEnd();
      if (text.startsWith("\r\n", end)) end += 2;
      else if (text.startsWith("\n", end)) end += 1;
      edits.push({ start: decl.getStart(), end, text: "" });
    } else {
      edits.push({
        start: decl.getStart(),
        end: decl.getEnd(),
        text: renderImport(decl, keep.map((s) => s.getText()), decl.isTypeOnly()),
      });
    }
  }
  return { result, edits };
}

function parseArgs(argv: string[]) {
  const opts = {
    rules: [] as RuleName[],
    dirs: [] as string[],
    files: [] as string[],
    dryRun: false,
    reverse: false,
    ralDir: join(Deno.cwd(), "src", "deno_ral"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--reverse") opts.reverse = true;
    else if (a === "--rules") opts.rules = argv[++i].split(",") as RuleName[];
    else if (a === "--dir") opts.dirs.push(argv[++i]);
    else if (a === "--file") opts.files.push(argv[++i]);
    else if (a === "--ral-dir") opts.ralDir = resolve(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  if (opts.rules.length === 0) throw new Error("--rules is required");
  for (const r of opts.rules) {
    if (!(r in RULES)) {
      throw new Error(`unknown rule: ${r} (expected ${Object.keys(RULES).join(", ")})`);
    }
  }
  if (opts.dirs.length + opts.files.length === 0) {
    throw new Error("--dir or --file is required");
  }
  return opts;
}

if (import.meta.main) {
  const opts = parseArgs(Deno.args);
  const files = [...opts.files, ...opts.dirs.flatMap((d) => collectFiles(d))];
  let rewritten = 0, replacements = 0, withCollisions = 0, skipped = 0, left = 0;
  for (const file of files) {
    const r = codemodFile(file, opts.rules, {
      ralDir: opts.ralDir,
      dryRun: opts.dryRun,
      reverse: opts.reverse,
    });
    const rel = relative(Deno.cwd(), file).replaceAll("\\", "/");
    if (r.skipped) {
      skipped++;
      console.log(`${rel}: skipped: ${r.skipped}`);
      continue;
    }
    for (const c of r.collisions) {
      console.log(
        `${rel}:${c.line}: collision: local binding '${c.name}' conflicts with deno_ral/${c.module}; left as Deno.*`,
      );
    }
    for (const c of r.left) {
      console.log(
        `${rel}:${c.line}: left: '${c.name}' (deno_ral/${c.module}) has a use --reverse cannot express; edit by hand`,
      );
    }
    if (r.collisions.length > 0) withCollisions++;
    left += r.left.length;
    if (r.replacements.length > 0) {
      rewritten++;
      replacements += r.replacements.length;
      const changes = Object.entries(opts.reverse ? r.importsRemoved : r.importsAdded)
        .map(([m, n]) => `${m}: ${n.join(", ")}`).join("; ");
      const verb = opts.reverse ? "import removed" : "import";
      console.log(`${rel}: ${r.replacements.length} replacement(s)${changes ? `, ${verb} ${changes}` : ""}`);
      if (opts.dryRun) {
        for (const rep of r.replacements) console.log(`  ${rel}:${rep.line}: ${rep.from} → ${rep.to}`);
      }
    }
  }
  console.log(
    `Summary: ${files.length} files scanned, ${rewritten} ${opts.dryRun ? "would be " : ""}rewritten, ${replacements} replacements, ${withCollisions} with collisions, ${skipped} skipped${opts.reverse ? `, ${left} left` : ""}`,
  );
}
```

- [x] **Step 5: Run the test**

Run: `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` Expected: `ok | 17 passed | 0 failed`.
The first run downloads `ts-morph@28.0.0` into the Deno npm cache (network needed once).
The fixtures and the logic were validated before this plan was written by running a Node port of exactly this file (only the `Deno.*`/`deno_ral` imports swapped for `node:` ones) over the same fixtures with `ts-morph@28.0.0`; all 17 cases passed.

If a fixture comparison fails on whitespace only, fix the *expected* file to match the tool's deterministic output and say so in the commit message; the contract is "deterministic", not "pretty" (PRs 10–14 run `deno fmt` after the codemod).

- [x] **Step 6: Dry-run against the real tree**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dir src/quarto-core --dir src/config --dry-run | grep -E 'skipped|collision|Summary'` Expected (measured with the Node port on `b86f98d`; about one second per rewritten file, because each file gets its own type checker):
```
src/core/copy.ts:60: collision: local binding 'copyFileSync' conflicts with deno_ral/fs.ts; left as Deno.*
src/core/deno/monkey-patch.ts: skipped: assigns to Deno.realPathSync at line 17
src/core/performance/metrics.ts: skipped: assigns to Deno.readTextFileSync at line 23
src/core/qualified-path.ts:69: collision: local binding 'readTextFile' conflicts with deno_ral/fs.ts; left as Deno.*
src/core/qualified-path.ts:73: collision: local binding 'readTextFileSync' conflicts with deno_ral/fs.ts; left as Deno.*
Summary: 205 files scanned, 56 would be rewritten, 153 replacements, 2 with collisions, 2 skipped
```
(205, not 264: `src/core/lib` is skipped.)
`git status --short src` shows no modified files.

- [x] **Step 7: Commit**

```bash
git add tools/codemod-deno-ral.ts tools/codemod
git commit -m "tools: ts-morph codemod for Deno.* <-> deno_ral rewrites, with fixtures"
```

### Task 5: lockfile, CI step, backport checklist, docs, changelog

**Files:**
- Modify: `deno.lock`, `.github/workflows/runtime-boundary.yml`, `dev-docs/checklist-backport-a-pr.md`, `.claude/rules/typescript/deno-ral.md`, `.claude/rules/typescript/deno-essentials.md`, `news/changelog-1.11.md`

- [ ] **Step 1: Lockfile**

PR 00b commits `deno.lock` and runs Deno with `--frozen`, so a new `npm:` specifier must be recorded.
Run:

```bash
package/dist/bin/tools/x86_64/deno cache --lock=deno.lock --frozen=false --import-map=src/import_map.json tools/codemod-deno-ral.ts tools/codemod/codemod-deno-ral.test.ts
git diff --stat deno.lock
```
Expected: `deno.lock` gains `npm:ts-morph@28.0.0` and its dependencies (`@ts-morph/common`, `code-block-writer`, `typescript`, …); nothing else changes.
(If PR 00b has not landed yet, `deno.lock` does not exist in the tree: skip this step; PR 00b's lockfile then picks the specifier up when it is generated.)

- [ ] **Step 2: CI step**

In `.github/workflows/runtime-boundary.yml` (PR 02's job, Linux, after its `configure.sh` step and before the ratchet step), add:

```yaml
      - name: Codemod contract test (tools/codemod)
        run: package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/
```

This is the only place CI runs the codemod tests; `tests/run-tests.sh` never sees them.
If PR 02b landed first, the step already exists (it runs `tools/codemod/` for 02b's own test); leave it as it is.

- [ ] **Step 3: Backport checklist**

In `dev-docs/checklist-backport-a-pr.md`, after the bullet "Cherry-pick the commits from the development branch" (and its two sub-bullets), add:

````markdown
- If the stable branch predates the runtime-layer codemods (v1.10 and earlier: `src/deno_ral/fs.ts` there has no `readTextFileSync`) and a commit touches TypeScript, cherry-picking conflicts wherever its context lines were codemodded. Build the patch in the stable branch's `Deno.*` form instead, from the `main` checkout:

  ```bash
  c=<commit>
  w=$(mktemp -d)/bp
  git worktree add --detach "$w" "$c^"
  rev() {
    for f in $(git diff --name-only --diff-filter=AM "$c^" "$c" -- '*.ts'); do
      quarto run --dev tools/codemod-deno-ral.ts --reverse --rules fs,temp,env,process,platform \
        --ral-dir "$w/src/deno_ral" --file "$w/$f"
    done
  }
  rev && git -C "$w" commit -qam "reversed base" --allow-empty
  git -C "$w" checkout "$c" -- $(git diff --name-only --diff-filter=AM "$c^" "$c")
  for f in $(git diff --name-only --diff-filter=D "$c^" "$c"); do git -C "$w" rm -q "$f"; done
  rev
  git -C "$w" add -A && git -C "$w" diff --cached HEAD > "$w.patch"
  git worktree remove --force "$w"
  ```

  Then, on the stable branch: `git apply -3 "$w.patch" && git commit -C "$c"`. The tool prints `left:` for any layer name it cannot express (for example `args` used without a call) and never rewrites `deno_ral/errors.ts` predicates: grep the patch for `deno_ral/errors.ts` and `isNotFound(` and turn them into `instanceof Deno.errors.X` by hand. The tool reports `canonicalPathSync` as `left` (stable branches patch `Deno.realPathSync`): import `originalRealPathSync` from `deno_ral/original-real-path.ts` there.
````

Check the procedure on a real commit before committing the doc: pick the PR 10 commit "core: codemod Deno fs/temp calls to deno_ral (mechanical)" once it exists, or this PR's own `src/deno_ral/fs.ts` change otherwise, and confirm `git apply --check` succeeds on `v1.10`.

- [ ] **Step 4: Rules docs**

In `.claude/rules/typescript/deno-ral.md`, replace the `fs.ts` row and add rows for `temp.ts` and `errors.ts`:

```
| `fs.ts` | File system | `readTextFileSync`, `writeTextFileSync`, `statSync`, `readDirSync` (sorted), `removeSync`, `mkdirSync`, `copyFileSync`, `open`, `canonicalPathSync` (resolves symlinks), `existsSync`, `ensureDirSync`, `copySync`, `safeMoveSync`, `safeRemoveSync`; types `FileInfo`, `DirEntry`, `FsFile` |
| `temp.ts` | Temp files/dirs (retry on AlreadyExists) | `makeTempDirSync`, `makeTempDir`, `makeTempFileSync`, `makeTempFile`; type `TempOptions` |
| `errors.ts` | Runtime-neutral error predicates | `isNotFound`, `isAlreadyExists`, `isPermissionDenied`, `isAddrInUse`, `isConnectionRefused`, `isConnectionError`, `errorWithPath` |
```

Add a subsection:

```
## Moving code off `Deno.*`

Never add new `Deno.*` calls; import the equivalent from `deno_ral/`. To migrate existing files mechanically:

    quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/<dir> --dry-run
    quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/<dir>

The tool reports local-name collisions (left as `Deno.*`; fix with an alias import such as `import { stat as fsStat } ...`, which later runs reuse) and skips files that assign to `Deno.*`, `src/core/lib` and the standalone scripts. Replace `instanceof Deno.errors.X` with the predicates in `deno_ral/errors.ts`. After a rebase conflict in a codemodded file, reset the file to `main` and re-run the codemod; never resolve by hand. `--reverse` produces the `Deno.*` form for backports (`dev-docs/checklist-backport-a-pr.md`).
```

Replace the `## Deno APIs vs Node.js` example block in `.claude/rules/typescript/deno-essentials.md` (it still tells readers to call `Deno.readTextFileSync` and `Deno.env.get`) with:

```typescript
// Correct - runtime layer
import { readTextFileSync, writeTextFileSync } from "../deno_ral/fs.ts";
import { makeTempDirSync } from "../deno_ral/temp.ts";
import { cwd } from "../deno_ral/process.ts";

// Wrong - direct runtime calls (the CI ratchet counts these)
Deno.readTextFileSync(path);
Deno.cwd();
```

- [ ] **Step 5: Changelog**

Open the PR as a draft to get its number `N`, then add under `## Other fixes and improvements` in `news/changelog-1.11.md`:

```markdown
- ([#N](https://github.com/quarto-dev/quarto-cli/pull/N)): Directories are now read in a fixed order (sorted by name, uppercase before lowercase) on every platform.
  Extension discovery, the theme list of `quarto capabilities`, and the items of a MECA bundle no longer depend on the file system's listing order; when two extensions share an id, which one wins can differ from earlier versions.
```

(The behaviour reaches users when PRs 11–13 move the callers; they land before the `v1.11` cut, decision 2.)

- [ ] **Step 6: Run the Verification list, then commit**

```bash
git add deno.lock .github/workflows/runtime-boundary.yml dev-docs/checklist-backport-a-pr.md .claude/rules/typescript/deno-ral.md .claude/rules/typescript/deno-essentials.md news/changelog-1.11.md
git commit -m "codemod CI step, backport step, rules docs and changelog for deno_ral fs/temp/errors"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` → `ok | 24 passed | 0 failed`.
- `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` → `ok | 17 passed | 0 failed`.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes; `git diff --stat tools/runtime-boundary-baseline.json` is empty (no callers moved; the new tests use the layer, so the `tests` count does not rise).
- The Task 4 step 6 dry run → the lines shown there; `git status --short src` clean.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts unit/ral/safe-remove-dir.test.ts smoke/check/check-info-project.test.ts` → pass (`safeRemoveDirSync` now resolves through `canonicalPathSync`).

## Review checklist

- [ ] `readTextFileSync`/`readTextFile`/`readFileSync`/`readFile` call `Deno.*` at call time (no cached reference), so `captureFileReads` keeps working until PR 20b.
- [ ] `errorWithPath` is idempotent and uses the same `"\nPath: "` text as `monkey-patch.ts:116,131`; predicates look through one level of `cause`.
- [ ] There is no `realPathSync` export; `canonicalPathSync` calls the saved original (`originalRealPathSync`) and slices nothing; `realPath` (async) resolves symlinks.
- [ ] `getFileInfoType` takes `FileInfo`, `safeRemoveSync` takes `{ recursive?: boolean }`, `safeRemoveDirSync` uses `canonicalPathSync`.
- [ ] `readDirSync` returns an array sorted with the code-unit comparator; `readDir` sorts before yielding.
- [ ] `temp.ts` retries only on `isAlreadyExists`, at most 5 attempts.
- [ ] The codemod never mutates the AST; edits are applied from the end; a file is written only when something changed and `--dry-run` is off.
- [ ] Collisions are symbol-based: an existing import of the same export from the same layer module never collides; an existing alias is reused; `import type` declarations stay type-only; aliases survive a merge.
- [ ] `kCodemodExclusions` is `kSrcExclusions` plus `src/core/lib` and `src/resources/tools/ast-diagram`; the codemod test never runs under `run-tests.sh`.
- [ ] `--reverse` round-trips the basic fixtures and reports, rather than guesses, uses it cannot express; `canonicalPathSync` is always reported, never reversed.
- [ ] No file outside `src/deno_ral/`, `tools/`, `tests/unit/ral/`, the two rules docs, the backport checklist, the workflow, the changelog and `deno.lock` changed; the ratchet baseline is unchanged.

## Risks and rollback

- `npm:ts-morph@28.0.0` under Deno: ts-morph is pure JS and runs through Deno's `npm:` support; if `Project` fails to load, pin `npm:ts-morph@26.0.0` and, as a last resort, rewrite the finder on `npm:typescript`'s compiler API with the same text-edit strategy (the fixtures are the contract either way).
- The codemod test needs network on first run to fetch ts-morph; the CI step runs after `configure.sh` with network.
  With `--frozen` (PR 00b), forgetting Task 5 step 1 makes the step fail with a lockfile error, not silently.
- Speed: about one second per file that has a `Deno.` occurrence (a type checker per file, without `lib.d.ts`).
  The largest run, `--rules env --dir src` in PR 14, takes about a minute.
  Acceptable for a one-off tool.
- `noLib`: an identifier that resolves only to a global (DOM `open`, for example) counts as a collision.
  Conservative by design; it shows up as an extra collision line in a dry run.
- `readDirSync` returning an array instead of a lazy iterator changes nothing for `for…of` callers; the one caller that spreads it (`src/command/use/commands/brand.ts:706`) still works.
  The order change is user-visible (changelog line).
- Double "Path:" annotation while `monkey-patch.ts` is alive is prevented by idempotence.
- Rollback: revert the PR; nothing outside the layer, `tools/`, tests and docs changes.

## Decisions needed

None.
Review items closed here: `FileInfo` type break (retyped helpers), alias/`import type` merge, non-idempotent collisions (symbol-based, alias reuse), `realPathSync` footgun (dropped; `canonicalPathSync` here, not in PR 25), skip list vs `kSrcExclusions` (imported, plus `src/core/lib` and `ast-diagram`), `npm:ts-morph` in every unit run (moved to `tools/codemod/` with one CI step), `@std/fs` facts (corrected in Context), temp retry scope (AlreadyExists only), `readDirSync` order (documented, changelog), `instanceof` count (18 in `src/`, 1 in `package/src`, 4 in `tests/`).
The `onFileRead` hook for `metrics.ts` is PR 20b's, not this PR's.

## Execution log

Executed 2026-10-28 on branch `rt/09-ral-fs-and-temp-layer` (Windows 11, pwsh + `tests/run-tests.ps1 --agent`; the Windows equivalent of the plan's `./run-tests.sh` commands).

### Step 0: plan refresh against this worktree

- Branch tip `364ee3bae` (fetched upstream/main); dev build present (`package/dist/bin/quarto.cmd`, `package/dist/bin/tools/x86_64/deno.exe`); `deno.lock` committed.
- PR 02 present: `tools/check-runtime-boundary.ts` exports `kSrcExclusions` at line 158; `.github/workflows/runtime-boundary.yml`, `tests/asserts.ts` exist.
- Every `path:line` the plan cites was re-grepped. Two Context citations drifted (content identical, line moved): `src/core/cache/cache.ts:161` is now line 186; `src/core/path.ts:189` is now line 197. `src/deno_ral/fs.ts` is 215 lines (the plan says 206): the Task 3 append point "after `ensureUserWritable`, line 206" is the end of the file, line 214, and the `safeRemoveDirSync` block of lines 147-163 sits at lines 143-169. The `@std/fs` `walk.ts:922` citation cannot be re-grepped (`fs/` maps to the remote `jsr:/@std/fs@1.0.16/`); the `Deno.realPathSync(` grep over `src/` confirms no application caller.
- README "Open decisions with an owner": no row names PR 09; the plan's "Decisions needed" is none.
- Beads: `quarto-cli-81ld.13` open with both `blocks` dependencies closed (PR 02 #15135, PR 02c #15153). `quarto-cli-81ld.50` (plan defect: contract tests imported `testing/asserts`) is closed: the plan's `tests/unit/ral` tests import `../../asserts.ts`; only the `tools/codemod` test keeps `testing/asserts` (outside the ratchet `tests` scope, by design).

### Task 1: `src/deno_ral/errors.ts`

- Step 2 (RED): `$env:QUARTO_TESTS_NO_CONFIG="true"; pwsh -File run-tests.ps1 --agent unit/ral/errors.test.ts` →

  ```
  TS2307 [ERROR]: Cannot find module 'file:///C:/Users/chris/Documents/DEV_R/quarto-cli.worktrees/rt-09-ral-fs-and-temp-layer/src/deno_ral/errors.ts'.
  error: Type checking failed.
  ```
- Step 4 (GREEN): same command →

  ```
  ok | 4 passed | 0 failed (88ms)
  ```
- Step 5: commit `c40c547ff` "deno_ral/errors: runtime-neutral error predicates" (2 files, 184 insertions).

### Task 2: `src/deno_ral/temp.ts`

- Step 2 (RED): `$env:QUARTO_TESTS_NO_CONFIG="true"; pwsh -File run-tests.ps1 --agent unit/ral/temp.test.ts` →

  ```
  TS2307 [ERROR]: Cannot find module 'file:///C:/Users/chris/Documents/DEV_R/quarto-cli.worktrees/rt-09-ral-fs-and-temp-layer/src/deno_ral/temp.ts'.
  error: Type checking failed.
  ```
- Step 4 (GREEN): same command →

  ```
  ok | 5 passed | 0 failed (78ms)
  ```
- Step 5: commit `e43dc49d1` "deno_ral/temp: makeTemp* retrying on AlreadyExists only" (2 files, 180 insertions).

### Task 3: `src/deno_ral/fs.ts` additions

- Step 2 (RED): `$env:QUARTO_TESTS_NO_CONFIG="true"; pwsh -File run-tests.ps1 --agent unit/ral/fs.test.ts` → 23 type errors, `TS2305: Module '"../../../src/deno_ral/fs.ts"' has no exported member 'readTextFileSync'` (and the other new names), as expected.
- Step 3: the plan's verbatim block needed two adaptations against this worktree's vendored Deno 2.7.14 types (a defect in the plan's Step 3 code): `Deno.SymlinkOptions.type` is required, so `symlink[Sync]` forwards an options object only when a `type` is given (a bare `symlinkSync(a, b)` stays options-free, matching existing callers); `Deno.truncateSync` takes `string` only, so a URL goes through `toPathString`. Both recorded in README "Open decisions with an owner" for PR 27.
- Step 4 (GREEN): `$env:QUARTO_TESTS_NO_CONFIG="true"; pwsh -File run-tests.ps1 --agent unit/ral/*.test.ts` (pwsh passes the glob through; Deno expands it) →

  ```
  ok | 23 passed | 0 failed | 1 ignored (6s)
  ```

  The plan expected `15 passed` (12 new + 3 `safe-*`); the ral suite now also holds errors (4) and temp (5) from Tasks 1–2, so 12 + 3 + 4 + 5 = 24 = 23 passed + 1 ignored.
- Step 4, `deno check`: the plan's command fails on Deno 2.7 with `error: Requires import access to "cdn.skypack.dev:443", run again with the --allow-import flag` (a remote import in `src/core/yaml.ts:31`). With `--allow-import` added → `Check quarto.ts`, no errors. Recorded in README for every plan whose verification runs this command.
- Step 5: commit `9d3b1ca00` "deno_ral/fs: plain filesystem calls, canonicalPathSync, layer-typed helpers" (2 files, 516 insertions, 15 deletions).

### Review of Tasks 1–3

- `tests/unit/ral/fs.test.ts` reuses `withTempDir` from `tests/utils.ts` instead of its own `withDir`; the duplicated `codeError`/`withCode` helpers of `temp.test.ts` and `errors.test.ts` became `errorWithCode` in `tests/unit/ral/utils.ts`.
- `errors.test.ts` reads `Deno.errors` directly behind a `typeof Deno` guard instead of through `globalThis` (which only hid the access from the ratchet); `tools/runtime-boundary-baseline.json` `tests` 874 → 875 with `--accept-increase`. The PR description lists that occurrence.
- Plan and PR numbers removed from the comments in `src/deno_ral/{fs,errors,temp}.ts` and the `fs.test.ts` header; README "Decisions and conventions" records both rules.
- `$env:QUARTO_TESTS_NO_CONFIG="true"; pwsh -File run-tests.ps1 --agent unit/ral/*.test.ts` → `ok | 23 passed | 0 failed | 1 ignored`.
- Post-commit review found `annotate` in `src/deno_ral/fs.ts` defeated `errorWithPath`'s idempotence for file URLs: it passed `toPathString(path)` (filesystem path) while the still-active read-annotation wrapper appends `"Path: " + path` (the URL href), so a second `Path:` line was added. Commit `4bdd5f4ca` switches to `String(path)` and adds missing-file URL cases to `fs.test.ts` (the new assertion fails on the old code: two `Path:` lines).
- The `errorWithPath` docstring and the `annotate` comment no longer name the read-annotation wrapper's file: the wording holds while the wrapper is active and after its removal, so the removal-time comment sweep has two fewer hits (the remaining ones, in `temp.ts` and `fs.test.ts`, are tracked in beads). `String(path)` is unchanged, so idempotence with the active wrapper is unaffected.

### Task 4: the codemod and its fixtures

- Steps 1–3 (fixtures, failing test, RED) were ticked with files on disk at resume; verified the RED via the module-not-found state and the ticked checkboxes.
- Step 4: `tools/codemod-deno-ral.ts` transcribed verbatim from the plan (607 lines). The prior session's write had been interrupted; rewrote the whole file from the plan block rather than splice mid-function.
- Step 5 (GREEN): `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` initially failed 9/17 with CRLF mismatches — the extracted fixtures and test file had been written CRLF, while the tool emits LF. Normalized all `tools/codemod/**` files and `tools/codemod-deno-ral.ts` to LF (repo standard for `tools/`; `tests/unit/ral/fs.test.ts` is `i/lf w/lf`). Re-run: `ok | 17 passed | 0 failed`, matching the plan exactly.
- Step 6 (dry-run): `package/dist/bin/quarto.cmd run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dir src/quarto-core --dir src/config --dry-run`. All 5 collision/skipped lines, 205 files, 153 replacements, 2 collisions, 2 skipped match the plan. One delta: `57 would be rewritten` vs the plan's `56` — the plan's figure was measured on `b86f98d`; upstream `d0bc2d947` (#15128, on this branch's base) added `Deno.readTextFileSync` to `src/core/bibliography.ts`, which at `b86f98d` used only `Deno.cwd()` (one extra file), not an error. Tasks 1–3 touch only `src/deno_ral` and `tests/unit/ral`. `git status --short src` empty (dry-run wrote nothing).
- Step 7: commit `c5af406bc` "tools: ts-morph codemod for Deno.* <-> deno_ral rewrites, with fixtures" (32 files, 1000 insertions).

### Review of Task 4: the write guard

Seven review rounds on the forward guard that skips files patching `Deno.*` (forward behaviour item 1). Each finding was reproduced before the fix, and each new fixture is rewritten by the previous guard and skipped unchanged by the new one.

- `61947b5f9`: the guard matched only a plain `=` on `Deno.x`. Compound and logical assignments, `++`/`--`, `delete`, and writes to the nested `Deno.build.os` node the platform rule replaces now skip the file. The same commit fixes reverse mode: `export { os }` keeps its import and is reported in `left`.
- `0b4a15b83`: destructuring targets (`({ readTextFileSync: Deno.readTextFileSync } = o)`, `[Deno.build.os] = …`) and `for…of`/`for…in` heads. `literal-not-write` pins that a literal that is not a pattern is still rewritten.
- `81d6aed64`: writes through `as`, `<T>`, `!` or `satisfies` on the target or the `Deno` receiver, and `Deno["x"]`. The receiver case shows why the guard exists: with `(Deno as any).readTextFileSync = …`, an earlier `const original = Deno.readTextFileSync` became the layer wrapper, which forwards to the patched method, so the patch called itself.
- `94753630a`: `Object.defineProperty(Deno, …)` hid the same recursion, and so did an alias or `globalThis.Deno`. Rather than list every mutating call, the guard now skips a file where the global `Deno` is used other than as `Deno.x` (alias, argument, spread, destructuring source) or reached through `globalThis`/`self`/`window`, which is the rule README "How to execute a plan" already applies to `src/`. `typeof Deno`, type positions and declaration names are exempt; the first draft flagged `type Deno = …` in `shadowed-deno`. The `Object`/`Reflect` mutator list remains only for nested `Deno.a` targets (`Object.assign(Deno.build, …)`).
- `842260c91`: forward behaviour item 1 now lists the four `skipped` reasons and the per-file limit. The Step 4 code block still shows the guard as first transcribed.
- `bf7d2da18` (fifth round): a shorthand `{ Deno }` was exempt as a declaration name, so `const holder = { Deno }` followed by a patch through `holder.Deno` was rewritten; it is now a use (`write-shorthand`). `(Object.assign)(Deno.build, …)` escaped the mutator list, whose callee and owner are now unwrapped (`write-object-assign-paren`). `kMutators` became a `Map`: an owner named `constructor` found `Object` through the prototype and the codemod threw (`mutator-inherited-key`). `write-define-property-paren` pins that `(Object.defineProperty)(Deno, …)` was already skipped as an argument use.
- `9472526fd`: `Object["assign"](Deno.build, …)` also escaped the mutator list, which matched only a dotted callee (`write-object-assign-element`). The callee may now be an element access with a string literal key, read by the `memberOf` helper that `globalObjectDeno` now shares.
- `3c973e12b` (sixth round): `` globalThis[`Deno`] `` and `` Object[`assign`] `` escaped both guards, because `memberOf` accepted only string-literal keys. A template literal without substitutions now counts as a static key, like a string literal (`write-global-this-template`, `write-object-assign-template`).
- `428714395` (seventh round): a parenthesized key (`globalThis[("Deno")]`, `Object[("assign")]`) escaped them the same way. `memberOf` now unwraps the key through the transparent wrappers already stripped from the receiver and the callee (`write-global-this-paren-key`, `write-object-assign-paren-key`).
- After each round, `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` passed (27 tests after the last round), and the forward dry run over `src/` with all rules (`--rules fs,temp,env,process,platform --dir src --dry-run`) was unchanged: 624 files scanned, 224 would be rewritten, 816 replacements, 18 with collisions, 2 skipped (`src/core/deno/monkey-patch.ts`, `src/core/performance/metrics.ts`).

### Branch review (2026-10-29)

- Commit "tools: codemod-deno-ral --reverse reports canonicalPathSync instead of mapping it to Deno.realPathSync": `--reverse` no longer maps `canonicalPathSync` to `Deno.realPathSync` (the monkey-patched `normalizePath` on stable branches); it reports the binding in `left` with a hint naming `originalRealPathSync`, before the re-export check so a re-exported name keeps the hint. Pinned by the `reverse-realpath` and `reverse-realpath-reexport` fixtures. TDD: the new test failed first with a type error (`kCanonicalReverseHint` not exported). Suite after: `ok | 28 passed | 0 failed`. CLI dry-run on the fixture printed `:2: left: 'canonicalPathSync' (deno_ral/fs.ts) is not Deno.realPathSync on branches that load core/deno/monkey-patch.ts; use originalRealPathSync from deno_ral/original-real-path.ts; edit by hand` and `Summary: 1 files scanned, 1 would be rewritten, 1 replacements, 0 with collisions, 0 skipped, 1 left`. Plan text updated at Behaviour (reverse), the Task 5 backport text and the review checklist.
- Commit "tools: codemod-deno-ral freezes the write guard and skips the known patch files by path": the write guard is documented as best-effort and frozen, and `kCodemodPatchFiles` (`src/core/deno/monkey-patch.ts`, `src/core/performance/metrics.ts`) is a backstop checked after the guard, so a caught file keeps the guard's reason. Pinned by `patch-file-backstop.input.ts` (a `Reflect.get` write the guard misses) run under both listed paths. TDD: the test failed first with `result.skipped` `undefined` (the file was rewritten). Probe before documenting the gaps (Deno 2.7.14, `codemodFile` dry run): all three reproduced — `Reflect.get(globalThis, "Deno")` → skipped undefined, 1 replacement; computed key `globalThis[k]` → skipped undefined, 1 replacement; comma-wrapped `Object.assign((0, Deno.build), …)` → skipped undefined, 1 replacement. Suite after: `ok | 29 passed | 0 failed`. Full dry run (`--rules fs,temp,env,process,platform --dir src --dry-run`) unchanged: `src/core/deno/monkey-patch.ts: skipped: assigns to Deno.realPathSync at line 17`, `src/core/performance/metrics.ts: skipped: assigns to Deno.readTextFileSync at line 23`, `Summary: 624 files scanned, 224 would be rewritten, 816 replacements, 18 with collisions, 2 skipped`; `git status --short src` empty. README "Open decisions with an owner" gained the PR 20b and PR 25 rows that remove the two entries later.
