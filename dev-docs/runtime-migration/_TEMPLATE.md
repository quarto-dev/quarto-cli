# Plan template and shared vocabulary

Every `NN-*.md` plan in this directory follows this structure. The shared
vocabulary at the end is normative: plans that define or use a `deno_ral`
module use exactly these names and signatures so that the plans compose.

## Structure of a plan

```markdown
# PR NN: <title>

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** one sentence.
**Phase:** 0 | 1 | 2 | 3. **Depends on:** PR xx, yy. **Unblocks:** PR zz.
**Branch:** `rt/NN-<slug>`.
**Suggested executor:** Opus | Sonnet, with one line of reasoning (judgement needed vs mechanical).
**Size:** S (< 10 files) | M (10–40 files) | L (> 40 files); the number of call sites or files touched.
**Ships on:** Deno; the existing test suite must stay green. (Phase 2+ plans also name the Node job.)

## Spec

### Context
Why this PR exists and what it changes for callers. Point to the assessment section.

### Scope
In: ... Out: ... (explicit, so reviewers can reject scope creep).

### Interfaces
Complete TypeScript for every type and function this PR adds or changes
(signatures, doc comments, error behaviour). Use the shared vocabulary below.

### Files
- Create: `exact/path.ts` (responsibility)
- Modify: `exact/path.ts:line-range` (what changes)
- Test: `tests/unit/.../x.test.ts`

### Acceptance criteria
Checkable statements (counts, commands that must pass, behaviours).

## Plan

### Task 1: <component>
**Files:** ...
- [ ] **Step 1: Write the failing test** (full test code)
- [ ] **Step 2: Run it and see it fail** (`exact command`, expected output)
- [ ] **Step 3: Implement** (full code)
- [ ] **Step 4: Run the tests** (`exact command`, expected output)
- [ ] **Step 5: Commit** (`git add ...; git commit -m "..."`)
(repeat per task; 2–5 minute steps)

## Verification
Commands to run before opening the PR, with expected results:
- unit tests added by this plan
- the existing tests that cover the touched code
- the ratchet: `quarto run --dev tools/check-runtime-boundary.ts` (after PR 02)
- a manual render where relevant: `package/dist/bin/quarto render <doc>`

## Review checklist
What the reviewer verifies, as a checklist.

## Risks and rollback
What can break, how it shows up, how to revert.

## Decisions needed
Only if a choice cannot be made in the plan: options, trade-offs, recommendation.
```

Rules (from the writing-plans skill): no placeholders ("TBD", "handle edge
cases", "similar to task N"); exact paths; code blocks for every code step;
exact commands with expected output; DRY, YAGNI, TDD, frequent commits. Where
a detail depends on an earlier PR's outcome, state the assumption explicitly
("assumes PR 09 landed with `readTextFileSync` exported from
`src/deno_ral/fs.ts`").

Repository conventions that plans must respect (`.claude/CLAUDE.md` and
`.claude/rules/`):

- Imports use import-map names and `.ts` extensions; application code imports
  `src/deno_ral/`, never `jsr:`/`npm:` URLs and never `Deno.*` (after Phase 1).
  Direct std imports are allowed only for the import-map seams the std boundary
  rule allow-lists (PR 02 `kStdAllowListed`; the module inventory is PR 22's
  table): `async`, `crypto`, `datetime`, `streams`, `io/*`, `log` other than
  `log/file-handler`, `fmt/printf`, `dotenv/stringify`.
- New files carry `Copyright (C) 2026 Posit Software, PBC`.
- Unit tests live in `tests/unit/` (runtime-layer tests under the existing
  `tests/unit/ral/`), use `unitTest` from `tests/test.ts` and assertions from
  `tests/asserts.ts` (added by PR 02), and run with
  `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/<file>.test.ts`.
  The ratchet (PR 02) has a `tests` scope: tests written by PRs 09 and later use
  `deno_ral` `fs`/`temp`/`process`, never raw `Deno.*`.
- Landing order inside Phase 1: 08 → 22 → 10–13 → 14. A conflict in a codemod PR
  is resolved by resetting the file to `main` and re-running the codemod, never
  by hand (the codemod is idempotent, PR 09).
- Pins: Deno `v2.9.x` (PR 00a; newest 2.9 at execution), Node `v26.12.0` or
  newer 26.x, `@cliffy/*` 1.3.1, `@b-fuze/deno-dom` 0.1.56, `ws` 8.22.
- Dev build: `./configure.sh`, then `package/dist/bin/quarto ...`. Dev scripts
  run with `quarto run --dev <script.ts>` (uses `src/import_map.json`).
- Changelog entries go in `news/changelog-1.11.md` only for user-visible changes.

## Shared vocabulary (normative)

Module paths are under `src/deno_ral/`. Existing modules: `fs.ts`, `path.ts`,
`log.ts`, `io.ts`, `encoding.ts`, `platform.ts`, `process.ts`, `tar.ts`.

### Tooling introduced by plans

| Tool | Path | Invocation |
|---|---|---|
| Boundary ratchet (PR 02) | `tools/check-runtime-boundary.ts`, baseline `tools/runtime-boundary-baseline.json` | `quarto run --dev tools/check-runtime-boundary.ts` (fails if any count exceeds the baseline); `--update-baseline` rewrites the baseline with lower counts only. Scopes: `src` (`.ts` outside `kSrcExclusions`), `src-js` (`.js` under `src/` outside `src/vendor` and `src/resources/extension-subtrees`), `resources` (runtime-loaded `src/resources/**/*.{js,ts}`), `package/src`, `tests` (the `--accept-tests-increase` flag lets a PR that adds tests raise the `tests` count on purpose). `src-js` excludes all of `src/resources`, so it does not overlap `resources`. The std-import rule matches `jsr:@std`, `https://deno.land/std`, single and double quotes and every import-map std key (`http/` included); `deno.land/x` packages are not std; a file whose only std imports are the allow-listed seams (`kStdAllowListed`, the std boundary rule of PR 02) is not counted |
| Codemod (PR 09) | `tools/codemod-deno-ral.ts` (ts-morph via `npm:ts-morph`) | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core` (`--rules` from `fs`, `temp`, `env`, `process`, `platform`; `--dry-run` prints the diff; `--reverse` maps layer calls back to `Deno.*` for backport patches). Idempotent: collision detection is symbol-based (an identifier already imported from `deno_ral/*` is not a collision); import merging preserves aliases and `isTypeOnly`; the skip list mirrors `kSrcExclusions` plus the browser-shared `src/core/lib` |
| TS syntax check (PR 02b) | `tools/check-ts-syntax.mjs` | `node tools/check-ts-syntax.mjs [dir...]` runs `module.stripTypeScriptTypes` over every `.ts` under `src/` and `tests/`; exit 1 on `enum`, parameter property, runtime `namespace`, `<T>` assertion or any other syntax Node's type stripping rejects. `verbatimModuleSyntax` is on in `deno.jsonc` from PR 02b: type-only imports use `import type` |
| Node bundle (PR 26) | `tools/node-bundle/build.mjs` (writes `tools/node-bundle/dist/quarto.mjs`, `dist/meta.json`, `dist/resolved.json`), `tools/node-bundle/import-map.mjs` (shared import-map resolver: `applyImportMap`, `resolveBare`, `jsrToNpm`, `npmSpec`, `packageOf`, `dependenciesFromImportMap`, `loadImportMap`), `tools/node-bundle/deno-shim.mjs`, `tools/node-bundle/quarto-node`, `tools/node-bundle/check-deps.mjs`, `tools/node-bundle/check-shim.mjs` (scans the bundle and `src/resources/**/*.js`, including `Deno?.x` and nested members), `tools/node-bundle/build-test.mjs` (bundles one test file for `node:test`), `tools/node-bundle/known-failures.json` (Node-only failures; may only shrink), `tools/node-bundle/normalize-html.mjs`, root `package.json` (no `"type": "module"`; all Node tooling is `.mjs`) | `node tools/node-bundle/build.mjs [--entry src/quarto.ts] [--out tools/node-bundle/dist/quarto.mjs] [--check-shim] && tools/node-bundle/quarto-node render <doc>`; `node tools/node-bundle/check-deps.mjs [--write]` (package.json `dependencies` must mirror `src/import_map.json`); `node tools/node-bundle/normalize-html.mjs <dir>` (hashes, cell ids, timestamps → placeholders before diffing renders) |
| Node CI job (PR 26) | `.github/workflows/test-node-bundle.yml` | runs the bundle against `dev-docs/runtime-migration/spike/tests/` and selected smoke tests |
| Node test loader (PR 31; runner decided by Spike V in `SPIKES.md`) | `tools/node-bundle/import-map-hook.mjs`, `tools/node-bundle/register-import-map.mjs`, `tests/run-tests-node.sh` | `node --import tools/node-bundle/register-import-map.mjs --test --test-force-exit <files>` (node:test variant) or `vitest run` (Vitest variant) |
| Bundle freshness (PR 33) | `tools/node-bundle/ensure.mjs` | `node tools/node-bundle/ensure.mjs --entry <file.ts> --outfile <file.js> [--watch-dir <dir>]...` rebuilds through `build.mjs`'s exported `bundle()` when any `*.ts`/`*.js`/`*.json` under the watch dirs (default: the entry's tree, `src/import_map.json`, `package-lock.json`) is newer than `outfile` or `outfile` is missing; prints `bundle up to date` otherwise |

### `errors.ts` (new in PR 09)

```ts
export function isNotFound(e: unknown): boolean;        // Deno.errors.NotFound | ENOENT
export function isAlreadyExists(e: unknown): boolean;   // Deno.errors.AlreadyExists | EEXIST
export function isPermissionDenied(e: unknown): boolean; // Deno.errors.PermissionDenied | EACCES/EPERM
export function isAddrInUse(e: unknown): boolean;       // Deno.errors.AddrInUse | EADDRINUSE
export function isConnectionRefused(e: unknown): boolean;
export function isConnectionError(e: unknown): boolean;   // BrokenPipe | NotConnected | ConnectionAborted | ConnectionReset | ConnectionRefused | EPIPE | ENOTCONN | ECONNABORTED | ECONNRESET | ECONNREFUSED (PR 09 addition; PR 27 keeps it here)
export function errorWithPath(e: Error, path: string): Error; // appends "\nPath: <path>" unless the message already ends with it; returns e (from monkey-patch.ts)
```
The predicates also inspect `e.cause`, so an `exec`/`spawn` failure for a missing
executable (which carries `code: "ENOENT"`, PR 08) satisfies `isNotFound`.

### `fs.ts` (extended in PR 09)

Keeps Deno's names for the plain calls so the codemod is `Deno.x(` → `x(` plus an import:

```ts
export interface FileInfo { isFile: boolean; isDirectory: boolean; isSymlink: boolean; size: number; mtime: Date | null; atime: Date | null; birthtime: Date | null; mode: number | null; }
export interface DirEntry { name: string; isFile: boolean; isDirectory: boolean; isSymlink: boolean; }
// PR 09 additions: the file-handle shape the 11 Deno.open sites use (streams, Reader/Writer, close)
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
export function readTextFileSync(path: string | URL): string;
export function readTextFile(path: string | URL): Promise<string>;
export function readFileSync(path: string | URL): Uint8Array;
export function readFile(path: string | URL): Promise<Uint8Array>;
export function writeTextFileSync(path: string | URL, data: string, options?: { append?: boolean; create?: boolean; mode?: number }): void;
export function writeTextFile(path: string | URL, data: string, options?: { append?: boolean; create?: boolean; mode?: number }): Promise<void>;
export function writeFileSync(path: string | URL, data: Uint8Array, options?: { append?: boolean; create?: boolean; mode?: number }): void;
export function writeFile(path: string | URL, data: Uint8Array, options?: { append?: boolean; create?: boolean; mode?: number }): Promise<void>;
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
export function readDirSync(path: string | URL): DirEntry[];           // sorted by name (an array is an Iterable<DirEntry>)
export function readDir(path: string | URL): AsyncIterable<DirEntry>;  // sorted by name
export function symlinkSync(target: string | URL, path: string | URL, options?: { type?: "file" | "dir" }): void;
export function symlink(target: string | URL, path: string | URL, options?: { type?: "file" | "dir" }): Promise<void>; // PR 09 addition
export function readLinkSync(path: string | URL): string;
export function realPath(path: string | URL): Promise<string>; // resolves symlinks (Deno.realPath), as tinytex.ts relies on today
export function canonicalPathSync(path: string | URL): string; // PR 09: symlinks resolved; throws when `path` does not exist (Deno.realPathSync, which already strips the Windows `\\?\` prefix; PR 27: fs.realpathSync.native). The codemod maps `Deno.realPathSync(` here. There is NO normalising `realPathSync` in the layer: `normalizePath` in `core/path.ts` keeps that role
export function onFileRead(listener: (path: string) => void): () => void; // PR 20b: read-observer hook called by readTextFile[Sync]/readFile[Sync]; returns an unsubscribe function (replaces the metrics.ts monkey patch)
export function chmodSync(path: string | URL, mode: number): void;
export function chmod(path: string | URL, mode: number): Promise<void>;  // PR 09 addition
export function utimeSync(path: string | URL, atime: number | Date, mtime: number | Date): void;
export function truncateSync(path: string | URL, len?: number): void;
export function open(path: string | URL, options?: OpenOptions): Promise<FsFile>;   // PR 09 addition
export function openSync(path: string | URL, options?: OpenOptions): FsFile;        // PR 09 addition
export function create(path: string | URL): Promise<FsFile>;                        // PR 09 addition
// walk, walkSync, expandGlob, expandGlobSync, ensureDir(Sync), existsSync, copy(Sync), moveSync, emptyDirSync, EOL: unchanged re-exports until PR 27 (which keeps both `copy` and `copySync`)
```
PR 09 also retypes the existing `getFileInfoType(fileInfo: FileInfo)` and
`safeRemoveSync` to the layer's `FileInfo`.

### `temp.ts` (new in PR 09)

```ts
export interface TempOptions { dir?: string; prefix?: string; suffix?: string; }
export function makeTempDirSync(options?: TempOptions): string;   // retries 5x on isAlreadyExists(e) only (from monkey-patch.ts)
export function makeTempDir(options?: TempOptions): Promise<string>;
export function makeTempFileSync(options?: TempOptions): string;
export function makeTempFile(options?: TempOptions): Promise<string>;
```

### `env.ts` (new in PR 14)

```ts
export const env: {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  delete(name: string): void;
  toObject(): Record<string, string>;
};
```
Codemod: `Deno.env.get(` → `env.get(` with `import { env } from "<rel>/deno_ral/env.ts"`.

### `process.ts` (extended in PR 08)

```ts
export type StdioOption = "piped" | "inherit" | "null";
export type Signal = "SIGTERM" | "SIGKILL" | "SIGINT"; // PR 08 addition
export interface SpawnOptions { args?: string[]; cwd?: string; env?: Record<string, string>; clearEnv?: boolean; stdin?: StdioOption; stdout?: StdioOption; stderr?: StdioOption; signal?: AbortSignal; detached?: boolean; }
// `env` is merged over the inherited environment unless `clearEnv` is true (contract test pins it).
// `detached: true` makes the child a process-group leader (POSIX: `setsid`/`detached`; Windows: CREATE_NEW_PROCESS_GROUP) so `killProcess(-pid)` reaches its children.
export interface ExitStatus { success: boolean; code: number; signal: string | null; }
export interface ExecOutput extends ExitStatus { stdout: Uint8Array; stderr: Uint8Array; }
export interface ChildProcess {
  readonly pid: number;
  readonly stdin: WritableStream<Uint8Array> | null;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly status: Promise<ExitStatus>;
  kill(signal?: Signal): void; // default "SIGTERM"
}
export function spawn(cmd: string, options?: SpawnOptions): ChildProcess;          // defaults: stdin inherit, stdout/stderr inherit
export function exec(cmd: string, options?: SpawnOptions): Promise<ExecOutput>;    // defaults: stdin null, stdout/stderr piped
export function execSync(cmd: string, options?: SpawnOptions): ExecOutput;
export function exit(code?: number): never; // flushes stdout and stderr before exiting (Node: process.exitCode + drain both streams; contract test pipes ≥ 1 MB through `head -c 1` and `wc -c`)
export function cwd(): string;
export function chdir(dir: string): void;
export function args(): string[];
export function execPath(): string;
export function pid(): number;
export function onSignal(signal: "SIGINT" | "SIGTERM", handler: () => void): void;
export function writeStdoutSync(data: Uint8Array): number; // writes all of `data`; a 0-byte write is not an error
export function writeStderrSync(data: Uint8Array): number;
export function isTerminal(stream: "stdin" | "stdout" | "stderr"): boolean;
// PR 08 additions (PR 28 reimplements them on node:child_process / process.stdin with the same signatures):
export function killProcess(pid: number, signal?: Signal): void; // Deno.kill(pid, signal); default "SIGTERM"; a negative pid addresses a process group on POSIX (Windows: taskkill /T from PR 28)
export function readStdin(): Promise<Uint8Array>;               // read stdin to EOF (replaces readAll(Deno.stdin))
export function readStdinLines(): AsyncIterable<string>;        // stdin as lines without the trailing "\n" / "\r\n" (replaces readLines(Deno.stdin)); breaking out of the loop releases stdin so the process can exit
// existing `call(path, opts)` becomes a thin alias of exec and is removed in PR 25
```
`src/core/process.ts` (`execProcess`, `ProcessResult` in `core/process-types.ts`) stays the application-level API; it is reimplemented on `spawn`.

### `net.ts` (new in PR 15)

```ts
export interface TcpConnection { read(buf: Uint8Array): Promise<number | null>; write(data: Uint8Array): Promise<number>; close(): void; }
export function connectTcp(options: { hostname: string; port: number }): Promise<TcpConnection>;
export function isPortAvailable(port: number, hostname?: string): Promise<boolean>;
export function findOpenPort(options?: { port?: number; hostname?: string; attempts?: number }): Promise<number>; // attempts defaults to 100
```

### `http.ts` (new in PR 16)

```ts
export interface ServeOptions { port: number; hostname?: string; handler: (req: Request, info: { remoteAddr: { hostname: string; port: number } }) => Response | Promise<Response>; signal?: AbortSignal; onListen?: (addr: { hostname: string; port: number }) => void; }
export interface HttpServer { readonly listening: Promise<void>; readonly finished: Promise<void>; readonly addr: { hostname: string; port: number }; shutdown(): Promise<void>; }
// `listening` rejects on bind failure (isAddrInUse etc.); callers that do not await `finished` await `listening`.
export function serveHttp(options: ServeOptions): HttpServer; // default onListen prints `Listening on http://<hostname>:<port>/` to stderr, as Deno.serve does
export interface WebSocketLike { readonly readyState: number; readonly CLOSED: number; readonly CLOSING: number; send(data: string | Uint8Array): void; close(): void; onmessage: ((ev: { data: string | Uint8Array }) => void) | null; onclose: ((ev: unknown) => void) | null; onerror: ((ev: unknown) => void) | null; }
export function upgradeWebSocket(req: Request): { socket: WebSocketLike; response: Response };
```

### `watch.ts` (new in PR 17)

```ts
export interface FsEvent { kind: "create" | "modify" | "remove" | "rename" | "other"; paths: string[]; }
export interface FsWatcher extends AsyncIterable<FsEvent> { close(): void; }
export function watchFs(paths: string[], options?: { recursive?: boolean; poll?: boolean }): FsWatcher; // `poll` (PR 29): polling fallback; `QUARTO_WATCH_POLLING=1` forces it
```

### `kv.ts` (new in PR 18)

```ts
export type KvKey = (string | number)[];
export interface KvEntry<T> { key: KvKey; value: T; }
export interface KeyValueStore {
  get<T>(key: KvKey): Promise<T | null>;
  set<T>(key: KvKey, value: T): Promise<void>;
  delete(key: KvKey): Promise<void>;
  list<T>(prefix: KvKey): AsyncIterable<KvEntry<T>>;
  close(): void;
}
export function openKeyValueStore(dir: string, name: string): Promise<KeyValueStore>; // the backend chooses the file: `<dir>/<name>.kv` (Deno.openKv) or `<dir>/<name>.json` (Node, PR 30), so Quarto versions on different runtimes never share a file
// Contract (PR 18 tests): a second handle on the same store sees a committed `set`; two processes writing different keys both persist (Node: lock + read-modify-rename).
```

### `platform.ts` (extended in PR 19)

```ts
export const isWindows: boolean; export const isMac: boolean; export const isLinux: boolean; export const os: string; export const arch: string; // existing
export function runtime(): { name: "deno" | "node" | "bun"; version: string }; // real detection from PR 19: Deno when `typeof Deno !== "undefined" && "version" in Deno`, Bun when `process.versions.bun`, else Node
export function consoleColumns(): number | undefined;
export function inspect(value: unknown, options?: { depth?: number; colors?: boolean }): string;
export function isRootUser(): boolean;
export function noColor(): boolean;
```

### `main.ts` (new in PR 19)

```ts
/** Runtime-neutral in PR 19 (no later PR touches it): returns `meta.main` when defined (Deno, Node 24.2+);
 * otherwise compares `fileURLToPath(meta.url)` with `process.argv[1]`, both through `realpath`.
 * Used by `src/quarto.ts` only. Caveat: in a single-file esbuild bundle every inlined module sees the
 * bundle's `import.meta`, so this guard is meaningless anywhere but the bundle entry. */
export function isMainModule(meta: ImportMeta): boolean;
```

### `log.ts` (extended in PR 20b)

```ts
/** Replaces @std/log's FileHandler (which calls Deno.openSync). Same options core/log.ts:221 passes today. */
export class FileHandler extends BaseHandler { constructor(level: LevelName, options: { filename: string; mode?: "a" | "w"; formatter?: FormatterFunction }); flush(): void; }
```

### `env.ts` key validation (PR 14 contract)

`env.get` returns `undefined` for a key that is empty or contains `=` or NUL (Node `process.env` semantics; Deno throws, so the Deno implementation guards).

### Test harness (PR 23, PR 31)

`tests/harness.ts` (PR 23; PR 31 adds the `node:test` branch behind the same types):

```ts
export interface TestRunContext {
  /** file:// URL of the module that registered the test. Node: pathToFileURL(t.filePath).href. */
  origin: string;
  /** Runs a named sub-test; resolves true when it passed, false when ignored or failed. Node: t.test. */
  step(name: string, fn: (ctx: TestRunContext) => Promise<void> | void, options?: { ignore?: boolean }): Promise<boolean>;
}
export interface SanitizeOptions { resources?: boolean; ops?: boolean; exit?: boolean; }
export interface TestDefinition {
  name: string;
  fn: (ctx: TestRunContext) => Promise<void> | void;   // a `() => void` is assignable
  ignore?: boolean;                                    // statically skip (not run, not counted)
  sanitize?: boolean | SanitizeOptions;                // Deno only; ignored on Node
}
export function registerTest(def: TestDefinition): void;
export { runHarness } from "./utils.ts";              // re-export for PR 31
```

`tests/utils.ts` (PR 23; PR 31 adds the Node branch behind the same options):

```ts
/** Runs one test file through the harness in a child process. Deno:
 * `<runtime> test <harness flags> --importmap=… [flags] [--junit-path=<junitPath>] <file> [-- args]`.
 * Node (PR 31; the runner is decided by Spike V in `SPIKES.md`): `node --import tools/node-bundle/register-import-map.mjs [flags] --test
 * --test-concurrency=1 [--test-reporter=junit --test-reporter-destination=<junitPath>] <file>`, `--no-check`/`--check`
 * dropped from `flags`, `args` passed through QUARTO_TEST_ARGS (newline-separated). `cwd` must be the tests/ directory. */
export function runHarness(options: {
  file: string;                   // test file, relative to cwd or absolute
  cwd: string;
  flags?: string[];               // runtime flags placed before the file, e.g. ["--no-check"]
  args?: string[];                // test arguments placed after "--"
  env?: Record<string, string>;   // merged over the inherited environment
  junitPath?: string;
}): Promise<{ stdout: string; stderr: string; code: number }>;
/** Command line that runs `scriptPath` with the current JavaScript runtime (Deno: `run --allow-net --allow-read
 * --allow-env [--allow-write=<path>]`; Node (PR 31): `<node> <script>`). */
export function runtimeScriptCommand(scriptPath: string, options?: { allowWritePath?: string }): { cmd: string; args: string[] };
```

`tests/asserts.ts` (PR 02) re-exports `assert`, `assertEquals`, `assertStringIncludes`, `assertThrows`, `assertRejects`, `assertMatch`, `assertObjectMatch`, `fail`, `AssertionError`; PR 23 adds `assertFalse`, `assertInstanceOf`, `assertNotEquals`, `assertStrictEquals`.

`tests/harness.ts` also exports `testArgs(): string[]` (the test's own arguments: `Deno.args` after `--` on Deno, `QUARTO_TEST_ARGS` under the Node runner; PR 23/31) and `onProcessExit(fn: () => void): void` (PR 31). Shared helpers for process-level tests live in `tests/process-helpers.ts` (PR 14b: `waitFor`, `collectText`, `processGroupOf`, `isProcessGone`).

`tests/run-tests.sh` accepts files only, never directories: write `$(find unit/ral -name '*.test.ts')`, not `unit/ral/`.
