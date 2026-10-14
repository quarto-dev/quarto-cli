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
- New files carry `Copyright (C) 2026 Posit Software, PBC`.
- Unit tests live in `tests/unit/`, use `unitTest` from `tests/test.ts` and
  assertions from `testing/asserts` (until PR 22 adds `tests/asserts.ts`), and
  run with `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/<file>.test.ts`.
- Dev build: `./configure.sh`, then `package/dist/bin/quarto ...`. Dev scripts
  run with `quarto run --dev <script.ts>` (uses `src/import_map.json`).
- Changelog entries go in `news/changelog-1.11.md` only for user-visible changes.

## Shared vocabulary (normative)

Module paths are under `src/deno_ral/`. Existing modules: `fs.ts`, `path.ts`,
`log.ts`, `io.ts`, `encoding.ts`, `platform.ts`, `process.ts`, `tar.ts`.

### Tooling introduced by plans

| Tool | Path | Invocation |
|---|---|---|
| Boundary ratchet (PR 02) | `tools/check-runtime-boundary.ts`, baseline `tools/runtime-boundary-baseline.json` | `quarto run --dev tools/check-runtime-boundary.ts` (fails if any count exceeds the baseline); `--update-baseline` rewrites the baseline with lower counts only |
| Codemod (PR 09) | `tools/codemod-deno-ral.ts` (ts-morph via `npm:ts-morph`) | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core` (`--rules` from `fs`, `temp`, `env`, `process`, `platform`; `--dry-run` prints the diff) |
| Node bundle (PR 26) | `tools/node-bundle/build.mjs`, `tools/node-bundle/deno-shim.js`, `tools/node-bundle/quarto-node`, root `package.json` | `node tools/node-bundle/build.mjs && tools/node-bundle/quarto-node render <doc>` |
| Node CI job (PR 26) | `.github/workflows/test-node-bundle.yml` | runs the bundle against `dev-docs/runtime-migration/spike/tests/` and selected smoke tests |

### `errors.ts` (new in PR 09)

```ts
export function isNotFound(e: unknown): boolean;        // Deno.errors.NotFound | ENOENT
export function isAlreadyExists(e: unknown): boolean;   // Deno.errors.AlreadyExists | EEXIST
export function isPermissionDenied(e: unknown): boolean; // Deno.errors.PermissionDenied | EACCES/EPERM
export function isAddrInUse(e: unknown): boolean;       // Deno.errors.AddrInUse | EADDRINUSE
export function isConnectionRefused(e: unknown): boolean;
export function errorWithPath(e: Error, path: string): Error; // appends "Path: ..." (from monkey-patch.ts)
```

### `fs.ts` (extended in PR 09)

Keeps Deno's names for the plain calls so the codemod is `Deno.x(` → `x(` plus an import:

```ts
export interface FileInfo { isFile: boolean; isDirectory: boolean; isSymlink: boolean; size: number; mtime: Date | null; atime: Date | null; birthtime: Date | null; mode: number | null; }
export interface DirEntry { name: string; isFile: boolean; isDirectory: boolean; isSymlink: boolean; }
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
export function readDirSync(path: string | URL): Iterable<DirEntry>;   // sorted by name
export function readDir(path: string | URL): AsyncIterable<DirEntry>;  // sorted by name
export function symlinkSync(target: string | URL, path: string | URL, options?: { type?: "file" | "dir" }): void;
export function readLinkSync(path: string | URL): string;
export function realPathSync(path: string | URL): string;   // carries the Windows UNC normalisation from monkey-patch.ts
export function chmodSync(path: string | URL, mode: number): void;
export function utimeSync(path: string | URL, atime: number | Date, mtime: number | Date): void;
export function truncateSync(path: string | URL, len?: number): void;
// walk, walkSync, expandGlob, expandGlobSync, ensureDir(Sync), existsSync, copy(Sync), moveSync, emptyDirSync, EOL: unchanged re-exports until PR 27
```

### `temp.ts` (new in PR 09)

```ts
export interface TempOptions { dir?: string; prefix?: string; suffix?: string; }
export function makeTempDirSync(options?: TempOptions): string;   // retries 5x on EEXIST (from monkey-patch.ts)
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
export interface SpawnOptions { args?: string[]; cwd?: string; env?: Record<string, string>; clearEnv?: boolean; stdin?: StdioOption; stdout?: StdioOption; stderr?: StdioOption; signal?: AbortSignal; }
export interface ExitStatus { success: boolean; code: number; signal: string | null; }
export interface ExecOutput extends ExitStatus { stdout: Uint8Array; stderr: Uint8Array; }
export interface ChildProcess {
  readonly pid: number;
  readonly stdin: WritableStream<Uint8Array> | null;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly status: Promise<ExitStatus>;
  kill(signal?: "SIGTERM" | "SIGKILL" | "SIGINT"): void;
}
export function spawn(cmd: string, options?: SpawnOptions): ChildProcess;          // defaults: stdin inherit, stdout/stderr inherit
export function exec(cmd: string, options?: SpawnOptions): Promise<ExecOutput>;    // defaults: stdin null, stdout/stderr piped
export function execSync(cmd: string, options?: SpawnOptions): ExecOutput;
export function exit(code?: number): never;
export function cwd(): string;
export function chdir(dir: string): void;
export function args(): string[];
export function execPath(): string;
export function pid(): number;
export function onSignal(signal: "SIGINT" | "SIGTERM", handler: () => void): void;
export function writeStdoutSync(data: Uint8Array): number;
export function writeStderrSync(data: Uint8Array): number;
export function isTerminal(stream: "stdin" | "stdout" | "stderr"): boolean;
// existing `call(path, opts)` becomes a thin alias of exec and is removed in PR 25
```
`src/core/process.ts` (`execProcess`, `ProcessResult` in `core/process-types.ts`) stays the application-level API; it is reimplemented on `spawn`.

### `net.ts` (new in PR 15)

```ts
export interface TcpConnection { read(buf: Uint8Array): Promise<number | null>; write(data: Uint8Array): Promise<number>; close(): void; }
export function connectTcp(options: { hostname: string; port: number }): Promise<TcpConnection>;
export function isPortAvailable(port: number, hostname?: string): Promise<boolean>;
export function findOpenPort(options?: { port?: number; hostname?: string; attempts?: number }): Promise<number>;
```

### `http.ts` (new in PR 16)

```ts
export interface ServeOptions { port: number; hostname?: string; handler: (req: Request, info: { remoteAddr: { hostname: string; port: number } }) => Response | Promise<Response>; signal?: AbortSignal; onListen?: (addr: { hostname: string; port: number }) => void; }
export interface HttpServer { readonly finished: Promise<void>; readonly addr: { hostname: string; port: number }; shutdown(): Promise<void>; }
export function serveHttp(options: ServeOptions): HttpServer;
export interface WebSocketLike { readonly readyState: number; readonly CLOSED: number; readonly CLOSING: number; send(data: string | Uint8Array): void; close(): void; onmessage: ((ev: { data: string | Uint8Array }) => void) | null; onclose: ((ev: unknown) => void) | null; onerror: ((ev: unknown) => void) | null; }
export function upgradeWebSocket(req: Request): { socket: WebSocketLike; response: Response };
```

### `watch.ts` (new in PR 17)

```ts
export interface FsEvent { kind: "create" | "modify" | "remove" | "rename" | "other"; paths: string[]; }
export interface FsWatcher extends AsyncIterable<FsEvent> { close(): void; }
export function watchFs(paths: string[], options?: { recursive?: boolean }): FsWatcher;
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
export function openKeyValueStore(path: string): Promise<KeyValueStore>;
```

### `platform.ts` (extended in PR 19)

```ts
export const isWindows: boolean; export const isMac: boolean; export const isLinux: boolean; export const os: string; export const arch: string; // existing
export function runtime(): { name: "deno" | "node" | "bun"; version: string };
export function consoleColumns(): number | undefined;
export function inspect(value: unknown, options?: { depth?: number; colors?: boolean }): string;
export function isRootUser(): boolean;
export function noColor(): boolean;
```

### `main.ts` (new in PR 19)

```ts
export function isMainModule(meta: ImportMeta): boolean;
```

### Test harness (PR 23, PR 31)

`tests/harness.ts` exports `registerTest(def: { name: string; fn: () => Promise<void> | void; ignore?: boolean; sanitize?: boolean })` and `tests/asserts.ts` (PR 22) re-exports `assert`, `assertEquals`, `assertStringIncludes`, `assertThrows`, `assertRejects`, `assertMatch`, `assertObjectMatch`, `fail`, `AssertionError`.
