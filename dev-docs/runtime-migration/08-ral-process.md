# PR 08: `deno_ral/process.ts`: spawn/exec interface, `execProcess` on it, direct `Deno.Command` sites, exit/cwd/args/execPath/signals/stdio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Quarto its own process interface in `src/deno_ral/process.ts` (`spawn`, `exec`, `execSync`, `exit`, `cwd`, `chdir`, `args`, `execPath`, `pid`, `onSignal`, `killProcess`, `writeStdoutSync`, `writeStderrSync`, `isTerminal`, `readStdin`, `readStdinLines`), reimplement `src/core/process.ts` `execProcess` on `spawn`, and move every direct `Deno.Command`, `Deno.run`, `Deno.exit`, `Deno.cwd`, `Deno.args`, `Deno.execPath`, `Deno.pid`, `Deno.kill`, `Deno.addSignalListener`, `Deno.stdin`/`Deno.stdout`/`Deno.stderr` use in `src/` and the build tooling's process spawning in `package/src` onto it.
**Phase:** 1. **Depends on:** PR 02 (ratchet). **Unblocks:** PR 14b (its `tests/unit/process-group.test.ts` needs `SpawnOptions.detached` and `killProcess`), PR 15, PR 19, PR 20b, PR 28.
**Branch:** `rt/08-ral-process`.
**Suggested executor:** Opus. The `execProcess` rewrite must keep stdin chunking, stream merging and timeout semantics intact for its 55 importers; three spawn sites (Chrome launch, external preview server, Jupyter log tail) have lifecycle subtleties, and the process-group, exit-flush and stdin-release contracts need judgement; the rest is mechanical.
**Size:** L. 1 rewritten module, 1 new unit test file (17 cases), 132 code sites in 58 files under `src/`, 32 sites in 10 files under `package/src`, plus the ratchet baseline, `.claude/rules/typescript/deno-ral.md` and one changelog line.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 11, module plan row `process.ts`: absorb `Deno.Command`, `Deno.run` (build tooling), `execPath`, `pid`, `args`, `exit`, `cwd`, `chdir`, `addSignalListener`, `kill`, raw stdio access and `isatty`, with Quarto's own `SpawnOptions`/`ChildProcess`. "Port `execProcess` first; then route the direct `Deno.Command` sites through `execProcess` or the new `spawn`." Section 11 names this the highest-leverage module: every external tool call goes through it and it is where Node differs most (PR 28 reimplements it on `node:child_process` behind the same interface and the same unit test).

Today `src/deno_ral/process.ts` is 10 lines: `call(path, opts: Deno.CommandOptions)` wrapping `new Deno.Command(path, opts).output()`, imported by `src/command/render/pandoc.ts:227` and `src/command/create/editor.ts:25`. `src/core/process.ts` (265 lines) builds a `Deno.Command` at line 77, spawns it, writes stdin in 4 KB chunks (lines 92-101, "deno observed to overflow at > 64k"), multiplexes stdout/stderr with `MuxAsyncIterator` and writes inherited output with `Deno.stdout.writeSync`/`Deno.stderr.writeSync` (lines 254-256). Its `ExecProcessOptions` is `Deno.CommandOptions & { cmd: string }` (line 48). `execProcess` is imported by 55 files under `src/` besides `src/core/process.ts`, 4 under `package/src` and 17 under `tests/` (`rg -l '\bexecProcess\b'`). `ExecProcessOptions` is re-exported to engine extensions through `src/core/api/types.ts:21,166` (the `quarto.system.execProcess` API); `packages/quarto-types/src/system.ts:18-26` declares its own structural copy with `cmd`, `args`, `cwd`, `env`, `stdout`, `stderr`, `stdin`, which the new type keeps satisfying. The new type drops the other `Deno.CommandOptions` fields (`uid`, `gid`, `windowsRawArguments`, `ref`, numeric stdio): no caller in the tree passes them (verified by the reviewer, 2026-10-15), but a third-party engine extension could, so the PR carries a changelog line.

Verified inventory (2026-10-15, `main` at `b86f98d`). `rg -o 'new Deno\.Command' src package/src -g '*.ts' | wc -l` gives 38 occurrences: 23 in the julia-engine subtree, 15 in 14 files elsewhere, of which `src/core/process.ts` (Task 2) and `src/deno_ral/process.ts` (Task 1) are the layer and its first client:

| # | File:line | What it does today | Plan |
|---|---|---|---|
| 1 | `src/deno_ral/process.ts:8` | `call()` helper | rewritten by this PR; `call` becomes an alias of `exec` (removed in PR 25) |
| 2 | `src/core/devconfig.ts:142` | runs `./configure.sh` / `configure.cmd`, output discarded | `exec` |
| 3 | `src/core/schema/types-from-schema.ts:30` | `deno fmt <file>` via `Deno.execPath()` | `exec(execPath(), …)` |
| 4 | `src/core/cri/launch.ts:285` | spawns Chrome, drains stderr, kills on close | `spawn` |
| 5 | `src/core/typst.ts:309` | inside a `/* … */` block (dead `typstWatch`, lines 295-341) | delete the dead block |
| 6 | `src/preview/preview-server.ts:38` | external preview server (Shiny for Python via `execute/jupyter/jupyter.ts:705`, project `serve:` commands via `project/serve/serve.ts:451`), merged stdio, `Deno.kill(-pid)` | `spawn` with `detached: true` on POSIX + `killProcess(-pid)`; Windows tree kill with `taskkill /T` |
| 7 | `src/execute/ojs/extract-resources.ts:338` | `deno check` via `Deno.execPath()` | `exec(execPath(), …)` |
| 8 | `src/execute/jupyter/jupyter-kernel.ts:66` | `tail -F` of the kernel log in debug mode, killed with SIGKILL | `spawn` |
| 9 | `src/command/dev-call/typst-gather/cmd.ts:62` | runs typst-gather with inherited stdio | `exec` |
| 10 | `src/webui/quarto-preview/build.ts:23,38` | that package's own build script, run with `deno run --no-config -A build.ts` (`package/src/common/previewjs.ts:14`) | **excluded**: already outside the ratchet's `src` scope (PR 02 `kSrcExclusions`); it keeps `Deno.*` until PR 33 ports the build tooling (PR 25 records it in the allow-list) |
| 11 | `src/resources/tools/ast-diagram/main.ts:27` | resource script shipped in `share/tools/`, run by `deno run` without the import map (`src/command/dev-call/make-ast-diagram/cmd.ts:23-29`) | **excluded**: cannot import `src/deno_ral`; PR 25 moves it to the ratchet allow-list; PR 35 ports it with the `quarto run` work |
| 12 | `src/resources/extension-subtrees/julia-engine/src/julia-engine.ts:362,395,427,467` | git subtree of `PumasAI/quarto-julia-engine` | **excluded**: no in-tree edit (decision 7); outside the ratchet's `src` scope; fixed upstream once this PR and PR 09 publish the runtime-neutral engine API |
| 13 | `src/resources/extension-subtrees/julia-engine/tests/smoke/julia-engine/julia.test.ts` (18 sites) | same subtree | excluded, same reason |
| 14 | `src/resources/extension-subtrees/julia-engine/tests/smoke/julia-engine/render.test.ts:19` | same subtree | excluded, same reason |
| 15 | `package/src/util/cmd.ts:26` | `runCmd` helper for the build tooling | `exec`; `CmdResult.status` becomes `ExitStatus` |
| 16 | `package/src/common/previewjs.ts:18` | `deno run build.ts` with `outputSync()` | `execSync(execPath(), …)` |

`src/command/render/latexmk/quarto-latexmk.ts` (`Deno.args` at line 130, plus `import.meta.main`) is **also excluded**: it is the standalone `tinitex` entry compiled by `deno compile`, and decision 9 deletes it in PR 39 (`tinitex` is being rewritten in Rust). Converting it here would be throw-away work, and its `args` parameters (lines 32, 46, 61) would need an alias import for nothing. The latexmk modules that `render --to pdf` uses (`pdf.ts`, `latex.ts`, `texlive.ts`, …) are not excluded.

`Deno.run` (soft-removed in Deno 2, still works) is used in `package/src/util/tar.ts:96,120`, `package/src/util/git.ts:49,67,113`, `package/src/common/configure.ts:171` (not awaited), `package/src/common/import-report/deno-info.ts:67`, `explain-all-cycles.ts:144`, `explain-import-chain.ts:140`, `report-bundle-async-cycles.ts:32`, `report-risky-files.ts:64`, and in a comment in `src/core/deno/monkey-patch.ts:27`. All code sites move to `exec`/`execSync`.

Process-family code sites in scope, counted on the AST (comments excluded) over `src/` minus `src/deno_ral/`, `src/resources/`, `src/webui/quarto-preview/build.ts` and `quarto-latexmk.ts`: 132 sites in 58 files: `cwd` 49, `exit` 41, `Command` 8, `stdout` 7, `stderr` 5, `stdin` 3, `execPath` 3, `CommandStatus` 3 (type), `ChildProcess` 3 (type), `CommandOptions` 2 (type), `args` 2, `addSignalListener` 2, `pid` 2, `kill` 2. Per file:

- `Deno.exit` (41 code sites): `src/command/call/build-ts-extension/cmd.ts` 13, `src/quarto.ts` 6, `src/command/call/typst-gather/cmd.ts` 6, `src/tools/tools.ts` 3, `src/command/dev-call/typst-gather/cmd.ts` 3, `src/command/dev-call/pull-git-subtree/cmd.ts` 3, `src/command/dev-call/validate-yaml/cmd.ts` 2, `src/command/call/engine-cmd.ts` 2, `src/core/cleanup.ts` 1, `src/command/dev-call/cmd.ts` 1, `src/command/call/cmd.ts` 1. Three comment lines also mention it (`src/tools/tools-console.ts:165`, `src/command/call/axe/cmd.ts:417`, `src/quarto.ts:187`); comments are left to PR 25's comment cleanup (one owner for all comment lines).
- `Deno.cwd` (49): `src/command/call/typst-gather/cmd.ts` 6, `src/core/jupyter/jupyter-shared.ts` 3, `src/command/preview/cmd.ts` 3, `src/command/call/build-ts-extension/cmd.ts` 3, `src/extension/extension.ts` 2, `src/execute/rmd.ts` 2, `src/execute/ojs/extract-resources.ts` 2, `src/command/render/cmd.ts` 2, and 1 each in `src/project/serve/serve.ts`, `src/inspect/inspect.ts`, `src/format/reveal/format-reveal-theme.ts`, `src/format/html/format-html-notebook.ts`, `src/format/dashboard/format-dashboard-shared.ts`, `src/extension/install.ts`, `src/core/schema/validated-yaml.ts`, `src/core/path.ts`, `src/core/mapped-text.ts`, `src/core/jupyter/jupyter-embed.ts`, `src/core/jupyter/filtered-notebook-cache.ts`, `src/core/bibliography.ts`, `src/command/use/commands/template.ts`, `src/command/use/commands/brand.ts`, `src/command/use/commands/binder/binder.ts`, `src/command/render/template.ts`, `src/command/render/project.ts`, `src/command/remove/cmd.ts`, `src/command/publish/cmd.ts`, `src/command/preview/preview-shiny.ts`, `src/command/list/cmd.ts`, `src/command/inspect/cmd.ts`, `src/command/create/cmd.ts`, `src/command/create-project/cmd.ts`, `src/command/command-utils.ts`, `src/command/call/axe/cmd.ts`. The 7 in `package/src` (`common/cyclic-dependencies.ts` 3, `common/config.ts` 2, `macos/installer.ts` 1, `common/create-deno-config.ts` 1) are left for PR 24.
- `Deno.args`: `src/quarto.ts:223`, `src/core/main.ts:26`; `package/src`: 16 sites in 9 files, of which the 4 import-report files touched here are converted and the rest (`create-schema-types.ts` 4, `find-bad-types-constants.ts`, `find-bad-imports.ts`, `bld.ts`) wait for PR 24.
- `Deno.execPath`: `src/execute/ojs/extract-resources.ts:337`, `src/core/schema/types-from-schema.ts:30`, `src/command/dev-call/make-ast-diagram/cmd.ts:23`, `package/src/common/previewjs.ts:18`.
- `Deno.pid`: `src/project/serve/serve.ts:918`, `src/execute/jupyter/jupyter.ts:487`. `Deno.kill`: `src/project/serve/serve.ts:907`, `src/preview/preview-server.ts:75` (process group, negative pid). `Deno.addSignalListener`: `src/core/main.ts:34,36`. `Deno.chdir`: none in `src/`; 3 in `package/src` (PR 24).
- `Deno.stdout.writeSync`: `src/core/process.ts:254`, `src/tools/tools.ts:95`, `src/command/inspect/cmd.ts:61`, `src/command/editor-support/crossref.ts:149`, `src/command/create/cmd.ts:296`; `Deno.stdout` handed to `writeAllSync`: `src/core/console.ts:176`, `src/command/capabilities/cmd.ts:20`. `Deno.stderr.writeSync`: `src/preview/preview-server.ts:63,69`, `src/core/process.ts:256`, `src/core/log.ts:185`. `Deno.stderr.isTerminal()`: `src/core/platform.ts:98`. `Deno.stdin`: `src/command/create/cmd.ts:259-260` (`readLines(Deno.stdin).next()` then `close()`), `src/command/editor-support/crossref.ts:82` (`readAll(Deno.stdin)`). PR 20b's inventory also lists the `create/cmd.ts` `readLines(Deno.stdin)` site; this PR converts it first (landing order 08 → 22 → 10–13 → 14 → 14b, 20b), and PR 20b skips it when it finds `readStdinLines()` there.
- Deno process types in signatures: `Deno.ChildProcess` (`src/core/process.ts:12,16`, `src/execute/jupyter/jupyter-kernel.ts:63`), `Deno.CommandOptions` (`src/core/process.ts:48`, `src/command/render/pandoc.ts:262`), `Deno.CommandStatus` (`src/core/cri/launch.ts:134,139,146`).

Process-level behaviours this PR pins in the contract test because Node differs (review S6 and the PR 08 findings, 2026-10-15):

- **Process groups.** `preview-server.ts:75` kills `-pid`, but nothing makes the child a group leader today, so on POSIX the call addresses the caller's own group only by accident of how the shell started Quarto, and `kill(-pid)` fails with ESRCH when the child is not a leader. `SpawnOptions.detached` (Deno: `Deno.CommandOptions.detached`, which starts the child in a new process group; PR 28: `child_process.spawn({ detached: true })`, which calls `setsid()`) makes the child a group leader so that `killProcess(-pid)` also ends the grandchildren (uvicorn workers, a Shiny app's R/Python processes). On Windows there are no process groups to signal; `preview-server.ts` ends the tree with `taskkill /PID <pid> /T /F`.
- **Exit after large piped output.** `quarto inspect | jq`, `render -o -`: on Node, pipes are asynchronous on POSIX and `process.exit()` truncates. The layer's `exit()` is documented to flush stdout and stderr first; on Deno the writes are synchronous so `Deno.exit` already satisfies it, and the contract test proves it with 1 MiB through a pipe read to the end (the `| wc -c` case) and through a pipe whose reader goes away after the first chunk (the `| head -c 1` case). PR 14b's `tests/smoke/inspect/inspect-pipe.test.ts` covers the same at the CLI level.
- **Writes to a closed or stalled stream.** `core/log.ts:177-195` breaks out of its loop on a 0-byte write; the first draft of `writeStdoutSync` threw "short write" instead, which would turn a logger hiccup into a crash. `writeStdoutSync`/`writeStderrSync` never throw on a 0-byte write and treat a broken pipe (reader gone) as "stop writing", returning the bytes written.
- **Missing executable.** `exec` wraps the runtime error for a readable message; the wrapper keeps `code: "ENOENT"` and `cause`, so `isNotFound(e)` (PR 09 `errors.ts`, which also looks through `cause`) is true.
- **Environment merge.** `Deno.Command` merges `env` over the inherited environment; Node's `spawn` replaces it. The contract pins merge (`PATH` survives when `env` is passed) unless `clearEnv: true`.
- **Early stop reading stdin.** `create/cmd.ts:259-260` reads one line and then calls `Deno.stdin.close()`; on Node a flowing stdin keeps the process alive. `readStdinLines()` releases stdin when the consumer stops early (`break`), and the contract test proves the process then exits with input still pending.

Not in this PR: `Deno.env` (PR 14), `Deno.consoleSize`/`Deno.noColor`/`Deno.build`/`Deno.version`/`Deno.uid`/`Deno.permissions` (PR 19), `Deno.Conn`/`Deno.connect`/`Deno.listen` (PR 15), the `package/src` sites not listed above (PR 24), `tests/` (PR 23), `tools/*.ts`, comment lines that mention `Deno.*` (PR 25).

### Scope

In:
- `src/deno_ral/process.ts`: the full interface from the shared vocabulary (`SpawnOptions.detached`, `killProcess`, `readStdin`, `readStdinLines` included), implemented on `Deno.Command`, `Deno.exit`, `Deno.cwd`, `Deno.chdir`, `Deno.args`, `Deno.execPath`, `Deno.pid`, `Deno.kill`, `Deno.addSignalListener`, `Deno.stdin`/`stdout`/`stderr`.
- `src/core/process.ts`: `execProcess` on `spawn`; `ExecProcessOptions = SpawnOptions & { cmd: string }`; `registerForExitCleanup(process: ChildProcess)`.
- The 12 movable direct `Deno.Command` files (rows 1-9, 15, 16 and `src/core/process.ts`), the 10 `Deno.run` code sites, and every `Deno.exit`/`cwd`/`args`/`execPath`/`pid`/`kill`/`addSignalListener`/stdio code site in `src/` outside the excluded paths, grouped by directory into separate commits.
- In the `package/src` files this PR already edits (`util/cmd.ts`, `util/tar.ts`, `util/git.ts`, `common/previewjs.ts`, `common/configure.ts`, the five `common/import-report/*.ts`): also their `Deno.exit`/`Deno.args` sites. Nothing else in `package/src`.
- `tests/unit/ral/process.test.ts` (the contract; PR 28 keeps it green on Node); `tests/unit/exec-process-stdin.test.ts` stays as the regression test for the stdin path.
- `news/changelog-1.11.md` line for the `quarto.system.execProcess` options narrowing.
- `.claude/rules/typescript/deno-ral.md` row for `process.ts`; ratchet baseline update.

Out:
- Dropping the 4 KB stdin chunking (kept with its comment; removed in PR 28 when the Node implementation lands).
- Any `Deno.env`, filesystem or temp call in the touched files (PRs 09–14).
- `src/webui/quarto-preview/build.ts` (PR 33), `src/resources/` (PR 25 allow-list, PR 35), the julia-engine subtree (upstream), `src/command/render/latexmk/quarto-latexmk.ts` (deleted by PR 39), `tests/`, `tools/*.ts`, the remaining `package/src` files.
- Comment lines that mention `Deno.*` (PR 25).
- Changing `ProcessResult` (`src/core/process-types.ts`) or the `quarto.system` API shape beyond the options type.

### Interfaces

`src/deno_ral/process.ts` (complete signatures; the vocabulary in `_TEMPLATE.md` is normative and matches this):

```ts
export type StdioOption = "piped" | "inherit" | "null";
export type Signal = "SIGTERM" | "SIGKILL" | "SIGINT";

export interface SpawnOptions {
  args?: string[];
  cwd?: string;
  /** Merged over the inherited environment, unless clearEnv is true. */
  env?: Record<string, string>;
  /** Start from an empty environment (only `env` is passed). */
  clearEnv?: boolean;
  stdin?: StdioOption;
  stdout?: StdioOption;
  stderr?: StdioOption;
  signal?: AbortSignal;
  /** POSIX: the child leads a new process group (setsid/setpgid), so killProcess(-pid)
   *  reaches its descendants. Windows: the runtime's detached semantics
   *  (Node: DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP); Quarto passes it on
   *  POSIX only. */
  detached?: boolean;
}

export interface ExitStatus {
  success: boolean;
  code: number;
  signal: string | null;
}

export interface ExecOutput extends ExitStatus {
  stdout: Uint8Array; // empty when stdout was not "piped"
  stderr: Uint8Array; // empty when stderr was not "piped"
}

export interface ChildProcess {
  readonly pid: number;
  readonly stdin: WritableStream<Uint8Array> | null;   // null unless stdin: "piped"
  readonly stdout: ReadableStream<Uint8Array> | null;  // null unless stdout: "piped"
  readonly stderr: ReadableStream<Uint8Array> | null;  // null unless stderr: "piped"
  readonly status: Promise<ExitStatus>;
  kill(signal?: Signal): void;                         // default "SIGTERM"
}

/** Start a child process. Defaults: stdin/stdout/stderr "inherit".
 *  A missing executable throws synchronously on Deno (PR 28: may instead reject `status`);
 *  callers that care use `exec`, which always rejects. */
export function spawn(cmd: string, options?: SpawnOptions): ChildProcess;
/** Run to completion and collect output. Defaults: stdin "null", stdout/stderr "piped".
 *  Rejects with an Error whose message contains `cmd` when the executable cannot be
 *  started; the error carries `cause` (the runtime error) and, for a missing
 *  executable, `code: "ENOENT"`. Throws TypeError if options.stdin is "piped" (use spawn). */
export function exec(cmd: string, options?: SpawnOptions): Promise<ExecOutput>;
/** Synchronous `exec` (same defaults and errors). */
export function execSync(cmd: string, options?: SpawnOptions): ExecOutput;
/** Exit with `code` after stdout and stderr are flushed. Deno: writes are
 *  synchronous, so this is Deno.exit. Node (PR 28): set process.exitCode and
 *  end once both streams have drained. */
export function exit(code?: number): never;
export function cwd(): string;
export function chdir(dir: string): void;
/** A fresh copy of the command-line arguments (mutating it has no effect). */
export function args(): string[];
export function execPath(): string;
export function pid(): number;
/** Install a handler. "SIGTERM" is a no-op on Windows (Deno rejects it there);
 *  "SIGINT" works on every platform. Handlers are additive. */
export function onSignal(signal: "SIGINT" | "SIGTERM", handler: () => void): void;
/** Write the buffer, looping over partial writes. Never throws on a 0-byte
 *  write (stops and returns what was written) and treats a broken pipe (the
 *  reader went away) as "stop writing". Returns the number of bytes written. */
export function writeStdoutSync(data: Uint8Array): number;
export function writeStderrSync(data: Uint8Array): number;
export function isTerminal(stream: "stdin" | "stdout" | "stderr"): boolean;
/** Send a signal to a process; a negative pid addresses the process group whose
 *  leader is -pid (POSIX; the leader must have been spawned with detached: true). */
export function killProcess(pid: number, signal?: Signal): void;
/** Read stdin to EOF (replaces readAll(Deno.stdin)). */
export function readStdin(): Promise<Uint8Array>;
/** Stdin as lines without the trailing "\n" / "\r\n" (replaces readLines(Deno.stdin)).
 *  Stopping early (break/return) releases stdin so the process can exit with
 *  input still pending. */
export function readStdinLines(): AsyncIterable<string>;

/** Deprecated alias of exec; removed in PR 25. */
export const call: (cmd: string, options?: SpawnOptions) => Promise<ExecOutput>;
```

Behavioural notes that the unit test pins down:
- `exec` stdin defaults to `"null"`; `Deno.Command.output()` defaulted to `"inherit"`. The two `call` users (`ttx` in `pandoc.ts`, editor launchers in `editor.ts`) and `devconfig.ts`/`types-from-schema.ts`/`extract-resources.ts` do not read stdin, so nothing changes for them.
- `ExecOutput.stdout`/`stderr` are empty `Uint8Array`s (never a throwing getter, unlike `Deno.CommandOutput`) when the stream was not piped.
- `ExitStatus.signal` is `"SIGTERM"` etc. on POSIX when the child was killed, `null` otherwise.
- `env` is merged; `clearEnv` empties first.
- A detached child's whole group dies on `killProcess(-pid)`, grandchildren included (POSIX).
- 1 MiB written with `writeStdoutSync` before `exit(3)` reaches a pipe in full; when the reader goes away early, the writer still exits with code 3 and prints no broken-pipe error.
- `readStdinLines()` with an early `break` lets the process exit while the parent keeps stdin open.

`src/core/process.ts`:

```ts
export type ExecProcessOptions = SpawnOptions & { cmd: string };
export function registerForExitCleanup(process: ChildProcess): number;
export function unregisterForExitCleanup(processId: number): void;
export async function execProcess(
  options: ExecProcessOptions,
  stdin?: string,
  mergeOutput?: "stderr>stdout" | "stdout>stderr",
  stderrFilter?: (output: string) => string,
  respectStreams?: boolean,
  timeout?: number,
): Promise<ProcessResult>;   // unchanged signature; ProcessResult unchanged
export function processSuccessResult(): ProcessResult;
```

`package/src/util/cmd.ts`: `export interface CmdResult { status: ExitStatus; stdout: string; stderr: string }` (callers only read `status.success`: `package/src/common/update-html-dependencies.ts:1052,1066`, `package/src/macos/installer.ts:324,358`).

Import alias convention for files where a local binding has the same name as the layer function (found with the collision emulation over `src/`, 2026-10-15): `src/command/call/build-ts-extension/cmd.ts:41` and `src/command/call/typst-gather/cmd.ts:42` (`cwd`), `src/execute/rmd.ts:447` (`cwd`), `src/core/main.ts:22` and `src/quarto.ts:86` (`args`), `src/project/serve/serve.ts:900` (`pid`). Import with an alias, `cwd as currentDir`, `args as processArgs`, `pid as processPid`. Never rename the local binding.

### Files

- Modify: `src/deno_ral/process.ts` (rewrite, 10 → ~230 lines)
- Modify: `src/core/process.ts:7-50,77-114,138-139,168-200,243-265` (spawn-based `execProcess`, types, stdio writes)
- Modify: `src/core/devconfig.ts:142-147`, `src/core/schema/types-from-schema.ts:29-33`, `src/core/cri/launch.ts:134-146,285-325`, `src/core/typst.ts:295-341` (delete), `src/core/cleanup.ts:25`, `src/core/main.ts:19,26,29-37`, `src/core/platform.ts:98`, `src/core/log.ts:177-195`, `src/core/console.ts:8-9,173-178`, `src/core/path.ts`, `src/core/mapped-text.ts`, `src/core/bibliography.ts`, `src/core/jupyter/jupyter-shared.ts`, `src/core/jupyter/jupyter-embed.ts`, `src/core/jupyter/filtered-notebook-cache.ts`, `src/core/schema/validated-yaml.ts` (one `Deno.cwd()` each, except `jupyter-shared.ts` with 3)
- Modify: `src/preview/preview-server.ts:7-82`
- Modify: `src/execute/ojs/extract-resources.ts:245,337-349,777`, `src/execute/jupyter/jupyter-kernel.ts:63-69`, `src/execute/jupyter/jupyter.ts:487`, `src/execute/rmd.ts:447`
- Modify: the `src/command` files listed in Task 5, `src/command/render/pandoc.ts:227,262`, `src/command/dev-call/make-ast-diagram/cmd.ts:23`
- Modify: `src/project/serve/serve.ts:145,907,918`, `src/inspect/inspect.ts`, `src/format/reveal/format-reveal-theme.ts`, `src/format/html/format-html-notebook.ts`, `src/format/dashboard/format-dashboard-shared.ts`, `src/extension/extension.ts`, `src/extension/install.ts`, `src/tools/tools.ts:95-97,151,166,338`
- Modify: `src/quarto.ts` (6 `Deno.exit`, `Deno.args` at 223)
- Modify: `package/src/util/cmd.ts`, `package/src/util/tar.ts:95-106,119-124`, `package/src/util/git.ts:49-57,67-78,113-120`, `package/src/common/previewjs.ts:18-25`, `package/src/common/configure.ts:169-175`, `package/src/common/import-report/{deno-info,explain-all-cycles,explain-import-chain,report-bundle-async-cycles,report-risky-files}.ts`
- Modify: `news/changelog-1.11.md`, `.claude/rules/typescript/deno-ral.md` (module table row), `tools/runtime-boundary-baseline.json` (via `--update-baseline`)
- Test: `tests/unit/ral/process.test.ts` (new); `tests/unit/exec-process-stdin.test.ts` (existing, unchanged)

### Acceptance criteria

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts` prints `ok | 17 passed | 0 failed` (on Windows the POSIX-only cases return early and count as passed).
- No code site is left in scope (comment lines excluded; they belong to PR 25):

  ```bash
  rg -n '\bDeno\.(Command|run|exit|cwd|args|execPath|pid|kill|addSignalListener|stdin|stdout|stderr|ChildProcess|CommandOptions|CommandStatus|CommandOutput)\b' src -g '*.ts' \
    -g '!src/deno_ral/**' -g '!src/resources/**' -g '!src/webui/quarto-preview/build.ts' -g '!src/command/render/latexmk/quarto-latexmk.ts' \
    | rg -v '^[^:]+:[0-9]+:\s*(//|/\*|\*)'
  ```
  prints nothing.
- `rg -n 'Deno\.run\(|new Deno\.Command' package/src -g '*.ts'` prints nothing.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.
- `quarto run --dev tools/check-runtime-boundary.ts` passes at a baseline lowered by this PR: the `src` scope by 133 (132 code sites plus the `new Deno.Command` inside the deleted `typst.ts` comment block), the `package/src` scope by 32; the tool's before/after numbers go in the PR description.
- PR 14b's `tests/unit/process-group.test.ts`, when it lands, passes without changes to this PR's code (it relies on `detached` and `killProcess`).
- The existing tests named in Verification stay green; `package/dist/bin/quarto render` of an HTML, a Typst and a Jupyter document behaves as before; `quarto preview` Ctrl-C still cleans up (signal handler path).

## Plan

Assumes PR 02 landed with `tools/check-runtime-boundary.ts` and `tools/runtime-boundary-baseline.json`, and that `./configure.sh` has been run (dev build at `package/dist/bin/quarto`, Deno at `package/dist/bin/tools/x86_64/deno`; substitute the architecture directory present under `package/dist/bin/tools/`). Line numbers are from `main` at `b86f98d`; re-check each with `rg -n` before editing.

Helper used by several tasks to insert an import before the first `import` statement of a file (GNU sed; on macOS use `gsed`):

```bash
# usage: add_import FILE 'import { exit } from "../deno_ral/process.ts";'
add_import() { sed -i "0,/^import /{s|^import |$2\nimport |}" "$1"; }
```

When a file already imports from `deno_ral/process.ts` (only `src/command/render/pandoc.ts` and `src/command/create/editor.ts` do, importing `call`), add the new names to that import instead.

### Task 0: confirm `Deno.CommandOptions.detached`

- [ ] **Step 1: Check the bundled Deno's type declarations**

Run: `package/dist/bin/tools/x86_64/deno types | grep -n -A3 'detached?: boolean'`
Expected: one hit inside `interface CommandOptions` (doc: "Whether to detach the spawned process from the current process"). If it is absent (Deno older than the PR 00a bump), stop and land PR 00a first: the process-group contract depends on it, and a hand-rolled `setsid` wrapper is not portable to macOS.

### Task 1: `src/deno_ral/process.ts` with its unit test

**Files:**
- Modify: `src/deno_ral/process.ts`
- Test: `tests/unit/ral/process.test.ts`

- [ ] **Step 1: Write the failing test**

The test must not use raw `Deno.*` (the ratchet has a `tests` scope). Child scripts that exercise `exit`, `writeStdoutSync` and `readStdinLines` are written to a temp file and run with the current runtime: `execPath() run --no-config --allow-all <script>` on Deno, `execPath() <script>` on Node (PR 28; Node strips the types). The script imports the layer by absolute file URL, so it needs no import map.

```ts
/*
 * process.test.ts
 *
 * Compatibility contract for src/deno_ral/process.ts. PR 28 must keep this
 * file green on the node:child_process implementation.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "testing/asserts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import {
  args,
  cwd,
  exec,
  execPath,
  execSync,
  isTerminal,
  killProcess,
  pid,
  spawn,
  writeStdoutSync,
} from "../../../src/deno_ral/process.ts";
import { basename, isAbsolute } from "../../../src/deno_ral/path.ts";
import { createTempContext } from "../../../src/core/temp.ts";

const kProcessModule =
  new URL("../../../src/deno_ral/process.ts", import.meta.url).href;

// A shell one-liner as [program, args] for the current platform.
function shell(script: string): [string, string[]] {
  return isWindows ? ["cmd", ["/c", script]] : ["sh", ["-c", script]];
}
const decode = (b: Uint8Array) => new TextDecoder().decode(b).trim();

// Write a child script that imports the layer, and the command line that runs
// it with the current runtime.
function childScript(body: string): { cmd: string; args: string[]; cleanup: () => void } {
  const temp = createTempContext();
  const file = temp.createFileFromString(
    `import * as p from ${JSON.stringify(kProcessModule)};\n${body}\n`,
    { suffix: ".ts" },
  );
  const runtimeArgs = "Deno" in globalThis
    ? ["run", "--no-config", "--allow-all", file]
    : [file];
  return { cmd: execPath(), args: runtimeArgs, cleanup: () => temp.cleanup() };
}

const kMiB = 1024 * 1024;
const kWriteMiBThenExit3 = `
const chunk = new Uint8Array(65536).fill(120);
for (let i = 0; i < 16; i++) p.writeStdoutSync(chunk);
p.exit(3);
`;

unitTest("process.exec - captures stdout and stderr, code 0", async () => {
  const [prog, a] = shell(isWindows ? "echo out & echo err 1>&2" : "echo out; echo err 1>&2");
  const r = await exec(prog, { args: a });
  assertEquals(r.success, true);
  assertEquals(r.code, 0);
  assertEquals(r.signal, null);
  assertEquals(decode(r.stdout), "out");
  assertEquals(decode(r.stderr), "err");
});

unitTest("process.exec - non-zero exit code", async () => {
  const [prog, a] = shell("exit 3");
  const r = await exec(prog, { args: a });
  assertEquals(r.success, false);
  assertEquals(r.code, 3);
});

unitTest("process.exec - missing executable rejects with cmd, ENOENT code and cause", async () => {
  const err = await assertRejects(
    () => exec("quarto-no-such-binary-7f3a", { args: ["--version"] }),
    Error,
  );
  assertStringIncludes(err.message, "quarto-no-such-binary-7f3a");
  assertEquals((err as Error & { code?: string }).code, "ENOENT");
  assert(err.cause !== undefined, "the runtime error is kept as cause");
});

unitTest("process.exec - inherit gives empty buffers, not errors", async () => {
  const [prog, a] = shell("exit 0");
  const r = await exec(prog, { args: a, stdout: "inherit", stderr: "null" });
  assertEquals(r.stdout.length, 0);
  assertEquals(r.stderr.length, 0);
});

unitTest("process.execSync - mirrors exec", async () => {
  const [prog, a] = shell("echo sync");
  const r = execSync(prog, { args: a });
  assertEquals(r.code, 0);
  assertEquals(decode(r.stdout), "sync");
});

unitTest("process.exec - env is visible to the child", async () => {
  const [prog, a] = shell(isWindows ? "echo %QUARTO_RAL_TEST%" : "echo $QUARTO_RAL_TEST");
  const r = await exec(prog, { args: a, env: { QUARTO_RAL_TEST: "hello-ral" } });
  assertEquals(decode(r.stdout), "hello-ral");
});

unitTest("process.exec - env is merged over the inherited environment", async () => {
  const [prog, a] = shell(isWindows ? "echo %PATH%" : 'echo "$PATH"');
  const without = decode((await exec(prog, { args: a })).stdout);
  const withEnv = decode((await exec(prog, { args: a, env: { QUARTO_RAL_TEST: "x" } })).stdout);
  assert(without.length > 0, "PATH is set in the test environment");
  assertEquals(withEnv, without, "passing env keeps PATH");
});

unitTest("process.exec - clearEnv removes inherited variables", async () => {
  if (isWindows) return; // cmd.exe needs SystemRoot; the semantics are tested on POSIX only
  const r = await exec("/bin/sh", { args: ["-c", 'echo "${HOME:-unset}"'], clearEnv: true });
  assertEquals(decode(r.stdout), "unset");
});

unitTest("process.exec - cwd option", async () => {
  const temp = createTempContext();
  const dir = temp.createDir({ prefix: "ral-cwd-" });
  const [prog, a] = shell(isWindows ? "cd" : "pwd");
  const r = await exec(prog, { args: a, cwd: dir });
  assertEquals(basename(decode(r.stdout)), basename(dir));
  temp.cleanup();
});

unitTest("process.spawn - piped stdin is echoed to piped stdout", async () => {
  const [prog, a] = isWindows ? ["cmd", ["/c", "more"]] : ["cat", []];
  const child = spawn(prog, { args: a, stdin: "piped", stdout: "piped", stderr: "null" });
  assert(child.pid > 0);
  assert(child.stdin !== null && child.stdout !== null && child.stderr === null);
  const writer = child.stdin!.getWriter();
  await writer.write(new TextEncoder().encode("ping\n"));
  await writer.close();
  const out = decode(await new Response(child.stdout!).bytes());
  const status = await child.status;
  assertEquals(out, "ping");
  assertEquals(status.success, true);
});

unitTest("process.spawn - kill ends the child with a failed status", async () => {
  const [prog, a] = isWindows
    ? ["cmd", ["/c", "ping -n 30 127.0.0.1 > NUL"]]
    : ["sleep", ["30"]];
  const child = spawn(prog, { args: a, stdout: "null", stderr: "null" });
  child.kill("SIGTERM");
  const status = await child.status;
  assertEquals(status.success, false);
  if (!isWindows) assertEquals(status.signal, "SIGTERM");
});

unitTest("process.spawn - detached child leads a group; killProcess(-pid) ends the grandchild", async () => {
  if (isWindows) return; // process groups are POSIX; preview-server.ts uses taskkill /T on Windows
  const child = spawn("sh", {
    args: ["-c", "sleep 30 & echo $!; wait"],
    stdout: "piped",
    stderr: "null",
    detached: true,
  });
  const reader = child.stdout!.pipeThrough(new TextDecoderStream()).getReader();
  let text = "";
  while (!text.includes("\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    text += value;
  }
  const grandchild = Number(text.trim());
  assert(grandchild > 0, `grandchild pid: ${text}`);
  killProcess(-child.pid, "SIGTERM");
  await child.status;
  await reader.cancel();
  // Gone means: no such process, or a zombie waiting to be reaped.
  let alive = true;
  for (let i = 0; i < 50 && alive; i++) {
    const ps = await exec("ps", { args: ["-o", "stat=", "-p", String(grandchild)] });
    const state = decode(ps.stdout);
    alive = ps.success && state.length > 0 && !state.startsWith("Z");
    if (alive) await new Promise((r) => setTimeout(r, 100));
  }
  assertEquals(alive, false, `grandchild ${grandchild} survived the group kill`);
});

unitTest("process - cwd, pid, args, execPath", async () => {
  assert(isAbsolute(cwd()));
  assert(pid() > 0);
  assert(execPath().length > 0);
  const a = args();
  a.push("mutated");
  assertEquals(args().includes("mutated"), false, "args() returns a copy");
});

unitTest("process - writeStdoutSync of 0 bytes returns 0, isTerminal is boolean", async () => {
  assertEquals(writeStdoutSync(new Uint8Array()), 0);
  assertEquals(typeof isTerminal("stdout"), "boolean");
  assertEquals(typeof isTerminal("stdin"), "boolean");
});

unitTest("process.exit - flushes 1 MiB written to a pipe before exiting (| wc -c)", async () => {
  const s = childScript(kWriteMiBThenExit3);
  try {
    const r = await exec(s.cmd, { args: s.args });
    assertEquals(r.code, 3);
    assertEquals(r.stdout.length, kMiB);
  } finally {
    s.cleanup();
  }
});

unitTest("process.exit - reader going away early is not a crash (| head -c 1)", async () => {
  const s = childScript(kWriteMiBThenExit3);
  try {
    const child = spawn(s.cmd, {
      args: s.args,
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
      signal: AbortSignal.timeout(30_000),
    });
    const stderr = new Response(child.stderr!).text();
    const reader = child.stdout!.getReader();
    const first = await reader.read();
    assert(!first.done && first.value.length > 0);
    await reader.cancel(); // close our end of the pipe, like `head -c 1`
    const status = await child.status;
    assertEquals(status.code, 3, "the code passed to exit() survives a broken pipe");
    const err = await stderr;
    assert(!/BrokenPipe|EPIPE/.test(err), `unexpected stderr: ${err}`);
  } finally {
    s.cleanup();
  }
});

unitTest("process.readStdinLines - an early break releases stdin", async () => {
  const s = childScript(`
for await (const line of p.readStdinLines()) {
  p.writeStdoutSync(new TextEncoder().encode("got:" + line + "\\n"));
  break;
}
p.writeStdoutSync(new TextEncoder().encode("done\\n"));
`);
  try {
    const child = spawn(s.cmd, {
      args: s.args,
      stdin: "piped",
      stdout: "piped",
      stderr: "null",
      signal: AbortSignal.timeout(30_000),
    });
    const writer = child.stdin!.getWriter();
    // Send two lines and keep stdin open: the child must exit anyway.
    await writer.write(new TextEncoder().encode("first\nsecond\n"));
    const out = await new Response(child.stdout!).text();
    const status = await child.status;
    await writer.close().catch(() => {});
    assertEquals(status.success, true, "child exited on its own (no timeout kill)");
    assertEquals(out.replaceAll("\r\n", "\n"), "got:first\ndone\n");
  } finally {
    s.cleanup();
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts`
Expected: the run fails at type-check time with `Module '"../../../src/deno_ral/process.ts"' has no exported member 'exec'` (and the other names).

- [ ] **Step 3: Implement `src/deno_ral/process.ts`**

Replace the whole file with:

```ts
/*
 * process.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Process-shaped runtime APIs. Implemented on Deno here; PR 28 reimplements
 * this module on node:child_process behind the same interface and the same
 * unit test (tests/unit/ral/process.test.ts).
 */

import { isWindows } from "./platform.ts";

export type StdioOption = "piped" | "inherit" | "null";
export type Signal = "SIGTERM" | "SIGKILL" | "SIGINT";

export interface SpawnOptions {
  args?: string[];
  cwd?: string;
  /** Merged over the inherited environment, unless clearEnv is true. */
  env?: Record<string, string>;
  /** Start from an empty environment (only `env` is passed). */
  clearEnv?: boolean;
  stdin?: StdioOption;
  stdout?: StdioOption;
  stderr?: StdioOption;
  signal?: AbortSignal;
  /** POSIX: the child leads a new process group (setsid/setpgid), so killProcess(-pid)
   *  reaches its descendants. Windows: the runtime's detached semantics
   *  (Node: DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP); Quarto passes it on
   *  POSIX only. */
  detached?: boolean;
}

export interface ExitStatus {
  success: boolean;
  code: number;
  signal: string | null;
}

export interface ExecOutput extends ExitStatus {
  stdout: Uint8Array;
  stderr: Uint8Array;
}

export interface ChildProcess {
  readonly pid: number;
  readonly stdin: WritableStream<Uint8Array> | null;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly status: Promise<ExitStatus>;
  kill(signal?: Signal): void;
}

function toStatus(s: Deno.CommandStatus): ExitStatus {
  return { success: s.success, code: s.code, signal: s.signal ?? null };
}

function commandOptions(
  options: SpawnOptions,
  defaults: { stdin: StdioOption; stdout: StdioOption; stderr: StdioOption },
): Deno.CommandOptions {
  // Deno.Command merges `env` over the inherited environment unless clearEnv.
  return {
    args: options.args,
    cwd: options.cwd,
    env: options.env,
    clearEnv: options.clearEnv,
    signal: options.signal,
    detached: options.detached,
    stdin: options.stdin ?? defaults.stdin,
    stdout: options.stdout ?? defaults.stdout,
    stderr: options.stderr ?? defaults.stderr,
  };
}

const kSpawnDefaults = {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
} as const;
const kExecDefaults = {
  stdin: "null",
  stdout: "piped",
  stderr: "piped",
} as const;

/**
 * Start a child process. stdin/stdout/stderr default to "inherit". A missing
 * executable throws synchronously on Deno.
 */
export function spawn(cmd: string, options: SpawnOptions = {}): ChildProcess {
  const opts = commandOptions(options, kSpawnDefaults);
  const child = new Deno.Command(cmd, opts).spawn();
  return {
    pid: child.pid,
    stdin: opts.stdin === "piped" ? child.stdin : null,
    stdout: opts.stdout === "piped" ? child.stdout : null,
    stderr: opts.stderr === "piped" ? child.stderr : null,
    status: child.status.then(toStatus),
    kill(signal: Signal = "SIGTERM") {
      child.kill(signal);
    },
  };
}

function toExecOutput(
  output: Deno.CommandOutput,
  opts: Deno.CommandOptions,
): ExecOutput {
  return {
    ...toStatus(output),
    stdout: opts.stdout === "piped" ? output.stdout : new Uint8Array(),
    stderr: opts.stderr === "piped" ? output.stderr : new Uint8Array(),
  };
}

// The wrapper keeps the runtime error as `cause` and a Node-style `code`, so
// that deno_ral/errors.ts predicates (isNotFound) recognise it.
function execError(cmd: string, e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  const err = new Error(`Error executing '${cmd}': ${msg}`, { cause: e });
  const code = e instanceof Deno.errors.NotFound
    ? "ENOENT"
    : (typeof e === "object" && e !== null && "code" in e &&
        typeof (e as { code: unknown }).code === "string")
    ? (e as { code: string }).code
    : undefined;
  if (code !== undefined) {
    (err as Error & { code?: string }).code = code;
  }
  return err;
}

/**
 * Run a command to completion. stdin defaults to "null", stdout and stderr to
 * "piped". Rejects when the executable cannot be started.
 */
export async function exec(
  cmd: string,
  options: SpawnOptions = {},
): Promise<ExecOutput> {
  if (options.stdin === "piped") {
    throw new TypeError("exec() cannot pipe stdin; use spawn()");
  }
  const opts = commandOptions(options, kExecDefaults);
  try {
    const output = await new Deno.Command(cmd, opts).output();
    return toExecOutput(output, opts);
  } catch (e) {
    throw execError(cmd, e);
  }
}

/** Synchronous exec with the same defaults and errors. */
export function execSync(cmd: string, options: SpawnOptions = {}): ExecOutput {
  if (options.stdin === "piped") {
    throw new TypeError("execSync() cannot pipe stdin; use spawn()");
  }
  const opts = commandOptions(options, kExecDefaults);
  try {
    const output = new Deno.Command(cmd, opts).outputSync();
    return toExecOutput(output, opts);
  } catch (e) {
    throw execError(cmd, e);
  }
}

/**
 * Exit after stdout and stderr are flushed. Deno's standard-stream writes are
 * synchronous, so nothing is pending here; PR 28 sets process.exitCode and
 * ends once both streams have drained.
 */
export function exit(code?: number): never {
  return Deno.exit(code);
}

export function cwd(): string {
  return Deno.cwd();
}

export function chdir(dir: string): void {
  Deno.chdir(dir);
}

export function args(): string[] {
  return [...Deno.args];
}

export function execPath(): string {
  return Deno.execPath();
}

export function pid(): number {
  return Deno.pid;
}

/**
 * Install a signal handler. SIGTERM is a no-op on Windows, where Deno rejects
 * it; SIGINT works everywhere (Deno maps console interruption to it).
 */
export function onSignal(
  signal: "SIGINT" | "SIGTERM",
  handler: () => void,
): void {
  if (signal === "SIGTERM" && isWindows) {
    return;
  }
  Deno.addSignalListener(signal, handler);
}

/**
 * Send a signal to a process. A negative pid addresses the process group led
 * by -pid (POSIX); spawn the leader with `detached: true`.
 */
export function killProcess(pid: number, signal: Signal = "SIGTERM"): void {
  Deno.kill(pid, signal);
}

// Loop over partial writes. A 0-byte write stops the loop (never spin, never
// throw: core/log.ts relied on that), and a broken pipe means the reader went
// away (`quarto inspect | head -c 1`), so the rest is dropped.
function writeAllSync(
  stream: { writeSync(p: Uint8Array): number },
  data: Uint8Array,
): number {
  let written = 0;
  while (written < data.length) {
    let n: number;
    try {
      n = stream.writeSync(data.subarray(written));
    } catch (e) {
      if (e instanceof Deno.errors.BrokenPipe) {
        return written;
      }
      throw e;
    }
    if (n === 0) {
      break;
    }
    written += n;
  }
  return written;
}

export function writeStdoutSync(data: Uint8Array): number {
  return writeAllSync(Deno.stdout, data);
}

export function writeStderrSync(data: Uint8Array): number {
  return writeAllSync(Deno.stderr, data);
}

export function isTerminal(stream: "stdin" | "stdout" | "stderr"): boolean {
  return Deno[stream].isTerminal();
}

/** Read standard input until EOF. */
export async function readStdin(): Promise<Uint8Array> {
  return await new Response(Deno.stdin.readable).bytes();
}

/**
 * Standard input as lines (without the line terminator). Stopping early
 * (break/return in for-await) closes stdin: Deno's stdin stream does not
 * close its resource on cancel, and a pending read would keep the process
 * alive (create --json used to call Deno.stdin.close() for this reason).
 */
export async function* readStdinLines(): AsyncIterable<string> {
  const decoder = new TextDecoder();
  let pending = "";
  let reachedEof = false;
  try {
    for await (const chunk of Deno.stdin.readable) {
      pending += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = pending.indexOf("\n")) >= 0) {
        yield pending.slice(0, nl).replace(/\r$/, "");
        pending = pending.slice(nl + 1);
      }
    }
    reachedEof = true;
    pending += decoder.decode();
    if (pending.length > 0) {
      yield pending.replace(/\r$/, "");
    }
  } finally {
    if (!reachedEof) {
      try {
        Deno.stdin.close();
      } catch {
        // already closed
      }
    }
  }
}

/** Deprecated alias of exec; removed in PR 25. */
export const call = (cmd: string, options: SpawnOptions = {}) =>
  exec(cmd, options);
```

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts`
Expected: `ok | 17 passed | 0 failed`

If the "reader going away early" case fails with a non-3 code, read the child's stderr in the assertion message: a `BrokenPipe` from a write path other than `writeAllSync` (for example a `console.log`) means the script is wrong, not the layer. If the "early break" case hits the 30 s timeout, `Deno.stdin.close()` did not release the pending read on this Deno version; report it on the PR (the case documents a contract PR 28 must meet on Node) rather than weakening the test.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/process.ts tests/unit/ral/process.test.ts
git commit -m "deno_ral/process: spawn/exec interface with contract test"
```

### Task 2: `execProcess` on `spawn`

**Files:**
- Modify: `src/core/process.ts`
- Test: `tests/unit/exec-process-stdin.test.ts` (existing), `tests/unit/ral/process.test.ts`

- [ ] **Step 1: Run the existing regression test to record the baseline**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/exec-process-stdin.test.ts`
Expected: `ok | 4 passed | 0 failed` (3 on Windows, where the tests return early).

- [ ] **Step 2: Rewrite `src/core/process.ts`**

Replace lines 7-50 (imports through `ExecProcessOptions`) with:

```ts
import { MuxAsyncIterator, pooledMap } from "async";
import { debug, info } from "../deno_ral/log.ts";
import {
  type ChildProcess,
  spawn,
  type SpawnOptions,
  type StdioOption,
  writeStderrSync,
  writeStdoutSync,
} from "../deno_ral/process.ts";
import { onCleanup } from "./cleanup.ts";
import { ProcessResult } from "./process-types.ts";

const processList = new Map<number, ChildProcess>();
let processCount = 0;
let cleanupRegistered = false;

export function registerForExitCleanup(process: ChildProcess) {
  // The registry is only killed by a handler that execProcess used to be the
  // sole installer of, so registering a process was not on its own enough to
  // have it cleaned up. Install it here too: a command that spawns a browser
  // and never shells out (`quarto call axe`) must still not orphan it on
  // Ctrl-C.
  ensureCleanup();
  const thisProcessId = ++processCount; // don't risk repeated PIDs
  processList.set(thisProcessId, process);
  return thisProcessId;
}

export function unregisterForExitCleanup(processId: number) {
  processList.delete(processId);
}

function ensureCleanup() {
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    onCleanup(() => {
      for (const process of processList.values()) {
        try {
          process.kill();
        } catch (error) {
          info("Error occurred during cleanup: " + error);
        }
      }
    });
  }
}

export type ExecProcessOptions = SpawnOptions & {
  cmd: string;
};
```

Replace lines 71-114 (the comment `// define process` through the end of the stdin block) with:

```ts
  // define process
  try {
    debug(`[execProcess] ${[options.cmd, ...(options.args || [])].join(" ")}`);
    // stdout/stderr are always piped here; "inherit" is implemented below by
    // processOutput so that output can be captured and echoed at once.
    const process = spawn(options.cmd, {
      args: options.args,
      cwd: options.cwd,
      env: options.env,
      clearEnv: options.clearEnv,
      detached: options.detached,
      signal: options.signal,
      stdin: stdin !== undefined ? "piped" : (options.stdin ?? "inherit"),
      stdout: "piped",
      stderr: "piped",
    });
    const thisProcessId = registerForExitCleanup(process);

    if (stdin !== undefined) {
      if (!process.stdin) {
        unregisterForExitCleanup(thisProcessId);
        throw new Error("Process stdin not available");
      }
      const stdinWriter = process.stdin.getWriter();
      // write in 4k chunks (deno observed to overflow at > 64k)
      // TODO(PR 28): drop the chunking once the Node implementation lands.
      const kWindowSize = 4096;
      const buffer = new TextEncoder().encode(stdin);
      let offset = 0;
      while (offset < buffer.length) {
        const end = Math.min(offset + kWindowSize, buffer.length);
        const window = buffer.subarray(offset, end);
        await stdinWriter.write(window);
        offset += window.byteLength;
      }
      stdinWriter.releaseLock();
      try {
        await process.stdin.close();
      } catch (e) {
        // The child may have closed its read end of the pipe before our
        // close() completed (e.g. exited fast, failed to spawn). The
        // resulting "Writable stream is closed or errored." is not a
        // failure of execProcess — the child's exit status reflects any
        // real problem. Swallow it so it doesn't escape as an unhandled
        // rejection that aborts the process. See #14445.
        debug(`[execProcess] stdin.close() rejected: ${e}`);
      }
    }
```

In the merge branch (old lines 138-139) replace `process.stdout.values()` / `process.stderr.values()` with `process.stdout!.values()` / `process.stderr!.values()`. In the independent-streams branch (old lines 168-195) keep the `!== null` guards; they now compile against `ReadableStream | null`. Replace old line 200 `const status = await withTimeout(process.output());` with:

```ts
    const status = await withTimeout(process.status);
```

Replace `processOutput`'s signature and the two raw writes (old lines 244-258) with:

```ts
async function processOutput(
  iterator: AsyncIterable<Uint8Array>,
  output?: StdioOption,
  which?: "stdout" | "stderr",
): Promise<string> {
  const decoder = new TextDecoder();
  let outputText = "";
  for await (const chunk of iterator) {
    if (output === "inherit" || output === undefined) {
      if (which === "stdout") {
        writeStdoutSync(chunk);
      } else if (which === "stderr") {
        writeStderrSync(chunk);
      } else {
        info(decoder.decode(chunk), { newline: false });
      }
    }
```

Delete the `// FIXME: In Deno 2 we get ReadableStreams...` comment block and the `// process.close();` comments; nothing else changes.

- [ ] **Step 3: Type-check and run the regression tests**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: errors only in `src/core/cri/launch.ts` (`registerForExitCleanup` now takes `ChildProcess`; `Deno.ChildProcess` is structurally compatible, so this may already pass) and nowhere else. If `launch.ts` errors, Task 3 fixes it; continue.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/exec-process-stdin.test.ts unit/ral/process.test.ts`
Expected: `ok | 21 passed | 0 failed`

- [ ] **Step 4: Commit**

```bash
git add src/core/process.ts
git commit -m "core/process: implement execProcess on deno_ral spawn"
```

### Task 3: the direct `Deno.Command` sites in `src/`

**Files:**
- Modify: `src/core/devconfig.ts`, `src/core/schema/types-from-schema.ts`, `src/core/cri/launch.ts`, `src/core/typst.ts`, `src/preview/preview-server.ts`, `src/execute/ojs/extract-resources.ts`, `src/execute/jupyter/jupyter-kernel.ts`, `src/command/dev-call/typst-gather/cmd.ts`

- [ ] **Step 1: `src/core/devconfig.ts`**

Add `import { exec } from "../deno_ral/process.ts";` next to the other `deno_ral` imports. Replace lines 142-147:

```ts
  await exec(configureScript[0], {
    args: configureScript.slice(1),
    cwd: quartoDir,
  });
```

(Output stays collected and discarded, as `Deno.Command(...).output()` did.)

- [ ] **Step 2: `src/core/schema/types-from-schema.ts`**

Add `import { exec, execPath } from "../../deno_ral/process.ts";`. Replace lines 29-33:

```ts
export function fmtSource(source: string) {
  return exec(execPath(), { args: ["fmt", source] });
}
```

- [ ] **Step 3: `src/core/cri/launch.ts`**

Add `type ExitStatus, spawn` to the existing import from `../../deno_ral/process.ts` (create it if the file has none: `import { type ExitStatus, spawn } from "../../deno_ral/process.ts";`). Replace `Deno.CommandStatus` with `ExitStatus` at lines 134, 139, 146. Replace lines 285-290:

```ts
  const process = spawn(app, {
    args,
    // stdout is never read; piping it only risks blocking Chrome on a full pipe
    stdout: "null",
    stderr: "piped",
  });
```

Line 299: `const stream = process.stderr!.pipeThrough(new TextDecoderStream());`. Lines 315 (`process.kill()`) and 325 (`await process.status`) are unchanged.

- [ ] **Step 4: `src/core/typst.ts`**

Delete lines 295-341 (the `/* export async function typstWatch ... */` block). It is dead code and the only `Deno.Command` mention in the file.

- [ ] **Step 5: `src/preview/preview-server.ts`**

Replace the import of `isWindows` (line 8) with:

```ts
import { isWindows } from "../deno_ral/platform.ts";
import {
  execSync,
  killProcess,
  spawn,
  writeStderrSync,
} from "../deno_ral/process.ts";
```

and lines 36-81 with:

```ts
  const { cmd } = options;
  // start the process; on POSIX it leads its own process group so that stop()
  // also ends what it spawned (uvicorn workers, a Shiny app's R/Python children)
  const process = spawn(cmd[0], {
    args: cmd.slice(1),
    env: options.env,
    cwd: options.cwd,
    stdout: "piped",
    stderr: "piped",
    detached: !isWindows,
  });

  // merge and stream stdout and stderr
  const multiplexIterator = new MuxAsyncIterator<
    Uint8Array
  >();
  multiplexIterator.add(process.stdout!);
  multiplexIterator.add(process.stderr!);

  // wait for ready and then return from 'start'
  const decoder = new TextDecoder();
  return {
    start: async () => {
      for await (const chunk of multiplexIterator) {
        const text = decoder.decode(chunk);
        if (options.readyPattern.test(text)) {
          break;
        }
        writeStderrSync(chunk);
      }
      return "";
    },
    serve: async () => {
      for await (const chunk of multiplexIterator) {
        writeStderrSync(chunk);
      }
      await process.status;
    },
    stop: () => {
      if (!isWindows) {
        killProcess(-process.pid, "SIGTERM");
      } else {
        // No process groups to signal on Windows: end the whole tree.
        try {
          execSync("taskkill", {
            args: ["/PID", String(process.pid), "/T", "/F"],
            stdout: "null",
            stderr: "null",
          });
        } catch {
          process.kill();
        }
      }
      return Promise.resolve();
    },
  };
```

The detached child no longer receives the terminal's Ctrl-C directly; both callers stop it from Quarto's cleanup (`execute/jupyter/jupyter.ts:713-715` registers `server.stop()` with `onCleanup`; `project/serve/serve.ts:465-467` calls it from the `stop()` it hands to the preview cleanup), which `core/main.ts`'s SIGINT handler runs. PR 14b's `tests/unit/process-group.test.ts` exercises this path end to end.

- [ ] **Step 6: `src/execute/ojs/extract-resources.ts`**

Add `import { cwd, exec, execPath } from "../../deno_ral/process.ts";`. Replace lines 337-349:

```ts
  const output = await exec(execPath(), {
    args: [
      "check",
      file,
      "-c",
      resourcePath("conf/deno-ts-compile.jsonc"),
      `--importmap=${resourcePath("conf/jsx-import-map.json")}`,
    ],
    stderr: "piped",
  });
  const stderr = output.stderr;
```

Lines 245 and 777: `Deno.cwd()` → `cwd()`.

- [ ] **Step 7: `src/execute/jupyter/jupyter-kernel.ts`**

Add `import { type ChildProcess, spawn } from "../../deno_ral/process.ts";`. Line 63: `let serverLogProcess: ChildProcess | undefined;`. Lines 66-68:

```ts
      serverLogProcess = spawn("tail", {
        args: ["-F", "-n", "0", kernelLogFile()],
      });
```

Line 147 (`serverLogProcess?.kill("SIGKILL")`) is unchanged.

- [ ] **Step 8: `src/command/dev-call/typst-gather/cmd.ts`**

Add `import { exec, exit } from "../../../deno_ral/process.ts";`. Replace lines 62-74:

```ts
    const result = await exec(typstGatherBinary, {
      args: ["gather", tomlPath],
      cwd: quartoRoot,
      stdout: "inherit",
      stderr: "inherit",
    });

    if (!result.success) {
      error(`typst-gather failed with exit code ${result.code}`);
      exit(result.code);
    }
```

Line 54: `Deno.exit(1)` → `exit(1)`.

- [ ] **Step 9: Type-check and test**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts smoke/typst-gather/typst-gather.test.ts smoke/ojs/dependency-traversal.test.ts smoke/jupyter/issue-10097.test.ts`
Expected: all pass (tally `0 failed`).

- [ ] **Step 10: Commit**

```bash
git add src/core/devconfig.ts src/core/schema/types-from-schema.ts src/core/cri/launch.ts src/core/typst.ts src/preview/preview-server.ts src/execute/ojs/extract-resources.ts src/execute/jupyter/jupyter-kernel.ts src/command/dev-call/typst-gather/cmd.ts
git commit -m "Route direct Deno.Command sites through deno_ral/process"
```

### Task 4: `src/core`: exit, cwd, args, signals, stdio

**Files:**
- Modify: `src/core/cleanup.ts`, `src/core/main.ts`, `src/core/platform.ts`, `src/core/log.ts`, `src/core/console.ts`, `src/core/path.ts`, `src/core/mapped-text.ts`, `src/core/bibliography.ts`, `src/core/jupyter/jupyter-shared.ts`, `src/core/jupyter/jupyter-embed.ts`, `src/core/jupyter/filtered-notebook-cache.ts`, `src/core/schema/validated-yaml.ts`

- [ ] **Step 1: `cwd` sites (one-liners)**

```bash
for f in src/core/path.ts src/core/mapped-text.ts src/core/bibliography.ts; do
  add_import "$f" 'import { cwd } from "../deno_ral/process.ts";'
  sed -i 's/Deno\.cwd()/cwd()/g' "$f"
done
for f in src/core/jupyter/jupyter-shared.ts src/core/jupyter/jupyter-embed.ts src/core/jupyter/filtered-notebook-cache.ts src/core/schema/validated-yaml.ts; do
  add_import "$f" 'import { cwd } from "../../deno_ral/process.ts";'
  sed -i 's/Deno\.cwd()/cwd()/g' "$f"
done
```

- [ ] **Step 2: `src/core/cleanup.ts`**

Add `import { exit } from "../deno_ral/process.ts";`; line 25: `exit(code);`.

- [ ] **Step 3: `src/core/main.ts`**

Replace the `isWindows` import (line 19) with `import { args as processArgs, onSignal } from "../deno_ral/process.ts";` (`isWindows` has no other use in the file). Line 26: `const args = parse(processArgs());`. Replace lines 29-37 with:

```ts
    // install termination signal handlers (SIGTERM is a no-op on Windows,
    // where Deno maps console interruption to SIGINT)
    onSignal("SIGINT", abend);
    onSignal("SIGTERM", abend);
```

- [ ] **Step 4: `src/core/platform.ts`**

Add `import { isTerminal } from "../deno_ral/process.ts";`; line 98: `return isTerminal("stderr");`.

- [ ] **Step 5: `src/core/log.ts`**

Add `import { writeStderrSync } from "../deno_ral/process.ts";`. Replace lines 177-195 (`override log(msg: string): void { ... }`) with:

```ts
  override log(msg: string): void {
    writeStderrSync(new TextEncoder().encode(msg));
  }
```

- [ ] **Step 6: `src/core/console.ts`**

Replace lines 8-9 (`io/write-all`, `io/read-all` imports; verify with `grep -n 'readAllSync\|writeAllSync' src/core/console.ts` that lines 175-176 are their only uses) with `import { writeStdoutSync } from "../deno_ral/process.ts";`. Replace lines 173-178:

```ts
export function writeFileToStdout(file: string) {
  writeStdoutSync(Deno.readFileSync(file));
}
```

(`Deno.readFileSync` is rewritten by the PR 10 codemod. If PR 09 has already landed, `src/deno_ral/fs.ts` exports `readFileSync`; import it from there instead of writing a new `Deno.readFileSync` call. The same applies to `crossref.ts:149` in Task 5.)

- [ ] **Step 7: Verify and commit**

Run: `rg -n '\bDeno\.(exit|cwd|args|addSignalListener|stdin|stdout|stderr)\b' src/core -g '*.ts' | rg -v '^[^:]+:[0-9]+:\s*(//|/\*|\*)'`
Expected: empty.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts unit/environment.test.ts unit/core/append-log-options.test.ts $(find smoke/logging/ -name '*.test.ts')`
Expected: `0 failed`.

```bash
git add src/core
git commit -m "core: exit/cwd/args/signals/stdio through deno_ral/process"
```

### Task 5: `src/command`: exit, cwd, args, execPath, stdio, stdin

**Files:** the files below.

- [ ] **Step 1: `Deno.exit` files**

| File | Import to add |
|---|---|
| `src/command/call/cmd.ts`, `src/command/dev-call/cmd.ts`, `src/command/call/engine-cmd.ts` | `import { exit } from "../../deno_ral/process.ts";` |
| `src/command/dev-call/validate-yaml/cmd.ts`, `src/command/dev-call/pull-git-subtree/cmd.ts` | `import { exit } from "../../../deno_ral/process.ts";` |
| `src/command/call/build-ts-extension/cmd.ts` (13 exits + 3 cwd, local `const cwd` at line 41) | `import { cwd as currentDir, exit } from "../../../deno_ral/process.ts";` |
| `src/command/call/typst-gather/cmd.ts` (6 exits + 6 cwd, local `const cwd` at lines 42, 112) | `import { cwd as currentDir, exit } from "../../../deno_ral/process.ts";` |

```bash
for f in src/command/call/cmd.ts src/command/dev-call/cmd.ts src/command/call/engine-cmd.ts src/command/dev-call/validate-yaml/cmd.ts src/command/dev-call/pull-git-subtree/cmd.ts src/command/call/build-ts-extension/cmd.ts src/command/call/typst-gather/cmd.ts; do
  sed -i 's/Deno\.exit(/exit(/g' "$f"
done
sed -i 's/Deno\.cwd()/currentDir()/g' src/command/call/build-ts-extension/cmd.ts src/command/call/typst-gather/cmd.ts
```

Then add the imports from the table (by hand; `add_import` works for all of them). Comment lines that mention `Deno.exit` (`src/command/call/axe/cmd.ts:417`) are left for PR 25's comment cleanup.

- [ ] **Step 2: `Deno.cwd` files (no local `cwd` binding; plain `cwd` import)**

| Import path | Files |
|---|---|
| `../deno_ral/process.ts` | `src/command/command-utils.ts` |
| `../../deno_ral/process.ts` | `src/command/preview/cmd.ts`, `src/command/render/cmd.ts`, `src/command/render/template.ts`, `src/command/render/project.ts`, `src/command/remove/cmd.ts`, `src/command/publish/cmd.ts`, `src/command/preview/preview-shiny.ts`, `src/command/list/cmd.ts`, `src/command/inspect/cmd.ts`, `src/command/create/cmd.ts`, `src/command/create-project/cmd.ts` |
| `../../../deno_ral/process.ts` | `src/command/use/commands/template.ts`, `src/command/use/commands/brand.ts`, `src/command/call/axe/cmd.ts` |
| `../../../../deno_ral/process.ts` | `src/command/use/commands/binder/binder.ts` |

For each: `sed -i 's/Deno\.cwd()/cwd()/g' FILE` and add `import { cwd } from "<path>";` (`src/command/call/axe/cmd.ts` has only its one `Deno.cwd()` code site). `src/command/inspect/cmd.ts` and `src/command/create/cmd.ts` also need `writeStdoutSync` (Step 4), so import `{ cwd, writeStdoutSync }` there.

- [ ] **Step 3: `args` and `execPath`**

`src/command/render/latexmk/quarto-latexmk.ts:130` (`Deno.args`) is not touched: decision 9 deletes this standalone entry in PR 39.
`src/command/dev-call/make-ast-diagram/cmd.ts:23`: `cmd: Deno.execPath(),` → `cmd: execPath(),` with `import { execPath } from "../../../deno_ral/process.ts";`.
`src/command/render/pandoc.ts:262`: `args: Deno.CommandOptions,` → `args: SpawnOptions,` and extend line 227 to `import { call, type SpawnOptions } from "../../deno_ral/process.ts";`.

- [ ] **Step 4: stdout / stdin**

`src/command/inspect/cmd.ts:61-63`:
```ts
        writeStdoutSync(new TextEncoder().encode(outputJson + "\n"));
```
`src/command/create/cmd.ts:259-260` (import `readStdinLines` and `writeStdoutSync` with `cwd`; drop the `readLines` import from `../../deno_ral/io.ts` at line 20 if it has no other use):
```ts
  // Read the first line of stdin (the JSON request)
  let input = "";
  for await (const line of readStdinLines()) {
    input = line;
    break;
  }
```
and line 296: `writeStdoutSync(new TextEncoder().encode(resultJSON));`.
`src/command/editor-support/crossref.ts` (`import { readStdin, writeStdoutSync } from "../../deno_ral/process.ts";`; drop the `readAll` import at line 8): line 82 `const stdinContent = await readStdin();`; line 149 `writeStdoutSync(Deno.readFileSync(indexFile));`.
`src/command/capabilities/cmd.ts` (replace the `io/write-all` import at line 7 with `import { writeStdoutSync } from "../../deno_ral/process.ts";`), lines 19-22:
```ts
    writeStdoutSync(new TextEncoder().encode(capsJSON));
```

- [ ] **Step 5: Verify and commit**

Run: `rg -n '\bDeno\.(exit|cwd|args|execPath|stdin|stdout|stderr|CommandOptions)\b' src/command -g '*.ts' -g '!src/command/render/latexmk/quarto-latexmk.ts' | rg -v '^[^:]+:[0-9]+:\s*(//|/\*|\*)'`
Expected: empty.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/create/create.test.ts smoke/inspect/inspect-project.test.ts smoke/check/check.test.ts $(find smoke/build-ts-extension/ -name '*.test.ts') smoke/use/template.test.ts smoke/render/render-html.test.ts $(find unit/render/ -name '*.test.ts')`
Expected: `0 failed`.

Manual: `echo '{"type":"project","directive":{"type":"default"},"directory":"'$(mktemp -d)'/p"}' | package/dist/bin/quarto create --json` prints a JSON result (exercises `readStdinLines` and `writeStdoutSync`), and `package/dist/bin/quarto capabilities | head -3` prints JSON.

```bash
git add src/command
git commit -m "command: exit/cwd/args/execPath/stdio through deno_ral/process"
```

### Task 6: `src/project`, `src/format`, `src/execute`, `src/extension`, `src/inspect`, `src/tools`

**Files:** below.

- [ ] **Step 1: `cwd` sites**

| File | Import | Edit |
|---|---|---|
| `src/project/serve/serve.ts` | `import { cwd, killProcess, pid as processPid } from "../../deno_ral/process.ts";` | line 145 `target = cwd();`, line 907 `killProcess(pid, "SIGTERM");`, line 918 `String(processPid())` |
| `src/inspect/inspect.ts` | `import { cwd } from "../deno_ral/process.ts";` | `Deno.cwd()` → `cwd()` |
| `src/format/reveal/format-reveal-theme.ts`, `src/format/html/format-html-notebook.ts`, `src/format/dashboard/format-dashboard-shared.ts` | `import { cwd } from "../../deno_ral/process.ts";` | `Deno.cwd()` → `cwd()` |
| `src/extension/extension.ts`, `src/extension/install.ts` | `import { cwd } from "../deno_ral/process.ts";` | `Deno.cwd()` → `cwd()` |
| `src/execute/rmd.ts` (local `const cwd` at line 447) | `import { cwd as currentDir } from "../deno_ral/process.ts";` | line 447 `const cwd = withinActiveRenv() ? currentDir() : projectDir ?? currentDir();` |
| `src/execute/jupyter/jupyter.ts` | `import { pid } from "../../deno_ral/process.ts";` | line 487 `supervisor_pid: options.previewServer ? pid() : undefined,` |
| `src/tools/tools.ts` | `import { exit, writeStdoutSync } from "../deno_ral/process.ts";` | lines 151, 166, 338 `exit(1)`; lines 95-97 `writeStdoutSync(new TextEncoder().encode(JSON.stringify(response, null, 2) + "\n"));` |

- [ ] **Step 2: Verify and commit**

Run: `rg -n '\bDeno\.(exit|cwd|pid|kill|stdin|stdout|stderr)\b' src/project src/format src/execute src/extension src/inspect src/tools src/preview -g '*.ts' | rg -v '^[^:]+:[0-9]+:\s*(//|/\*|\*)'`
Expected: empty.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/project/ -name '*.test.ts') $(find unit/extension/ -name '*.test.ts') $(find unit/tools/ -name '*.test.ts') smoke/project/project-simple.test.ts smoke/site/render-site.test.ts smoke/extensions/install.test.ts smoke/render/render-jupyter.test.ts`
Expected: `0 failed`. (`smoke/render/render-jupyter.test.ts` needs the Python test environment; if it is skipped for prerequisites, run `smoke/jupyter/issue-10097.test.ts` instead.)

```bash
git add src/project src/format src/execute src/extension src/inspect src/tools
git commit -m "project/format/execute/extension/tools: process calls through deno_ral/process"
```

### Task 7: `src/quarto.ts`

**Files:**
- Modify: `src/quarto.ts`

`src/webui/quarto-preview/build.ts` is not touched: it runs with `deno run --no-config` (no import map), it is outside the ratchet's `src` scope (PR 02 `kSrcExclusions`), and PR 25 records it in the ratchet allow-list until PR 33 ports the build tooling.

- [ ] **Step 1: `src/quarto.ts`**

Add `import { args as processArgs, exit } from "./deno_ral/process.ts";` after the `import { mainRunner } from "./core/main.ts";` line. `sed -i 's/Deno\.exit(/exit(/g' src/quarto.ts` (6 code sites; the sed also rewrites the comment at line 187, "The calls to Deno.exit() above", to "exit()", which is correct prose). Line 223: `let quartoArgs = [...processArgs()];`. Line 7's comment keeps `Deno.realPathSync` (it describes the monkey patch; PR 25 deletes it).

- [ ] **Step 2: Verify**

Run: `package/dist/bin/quarto --version && package/dist/bin/quarto pandoc --version | head -1 && package/dist/bin/quarto typst --version`
Expected: a version, `pandoc 3.x`, `typst 0.x` (the three `exit(result.code)` passthrough paths).

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/run/command-passthrough.test.ts smoke/run/run-script.test.ts`
Expected: `0 failed`.

- [ ] **Step 3: Commit**

```bash
git add src/quarto.ts
git commit -m "quarto.ts: exit/args through deno_ral/process"
```

### Task 8: `package/src`: `Deno.run` and the two `Deno.Command` helpers

PR 24 (`package/src` codemod) lists the same `Deno.run` sites and says to skip any that PR 08 already converted (its table notes "PR 08 already retyped `CmdResult.status`"). Whichever PR lands second checks `grep -rn 'Deno\.run(\|new Deno\.Command' package/src --include=*.ts` and skips the converted files. PR 24 may later replace the `execSync("ln", …)` in `configure.ts` with `symlinkSync` from `deno_ral/fs.ts` (PR 09); PR 08 depends only on PR 02, so it keeps the process call.

**Files:**
- Modify: `package/src/util/cmd.ts`, `package/src/common/previewjs.ts`, `package/src/util/tar.ts`, `package/src/util/git.ts`, `package/src/common/configure.ts`, `package/src/common/import-report/deno-info.ts`, `explain-all-cycles.ts`, `explain-import-chain.ts`, `report-bundle-async-cycles.ts`, `report-risky-files.ts`

- [ ] **Step 1: `package/src/util/cmd.ts`**

```ts
import { debug, error, info } from "../../../src/deno_ral/log.ts";
import { exec, type ExitStatus } from "../../../src/deno_ral/process.ts";

export interface CmdResult {
  status: ExitStatus;
  stdout: string;
  stderr: string;
}

export async function runCmd(
  runCmd: string,
  args: string[],
): Promise<CmdResult> {
  info([runCmd, ...args]);
  info(`Starting ${runCmd}`);
  const output = await exec(runCmd, { args });
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);
  info(`Finished ${runCmd}`);
  debug(stdout);

  const code = output.code;
  info(`Status ${code}`);
  if (code !== 0) {
    // Some tools (e.g. xcrun stapler) write their actual failure reason to
    // stdout rather than stderr; without this, that reason is only visible
    // at debug level and failures show an empty error message.
    error(stdout);
    error(stderr);
    throw Error(
      `Command ${[runCmd, ...args]} failed.\n${stdout}\n${stderr}`,
    );
  }

  return {
    status: { success: output.success, code: output.code, signal: output.signal },
    stdout,
    stderr,
  };
}
```

- [ ] **Step 2: `package/src/common/previewjs.ts`**

```ts
import { join } from "../../../src/deno_ral/path.ts";
import { execPath, execSync } from "../../../src/deno_ral/process.ts";

export function buildQuartoPreviewJs(
  srcDir: string,
  denoDir?: string,
  force?: boolean,
) {
  const args = ["run", "--no-config", "-A", "build.ts"];
  if (force) {
    args.push("--force");
  }
  return execSync(execPath(), {
    args,
    cwd: quartoPreviewJsDir(srcDir),
    env: denoDir ? { DENO_DIR: denoDir } : undefined,
    stderr: "inherit",
    stdout: "inherit",
  });
}
```

(Callers at `package/src/common/configure.ts:47` and `prepare-dist.ts:105` read `result.success`/`result.code`, which `ExecOutput` has.)

- [ ] **Step 3: `package/src/util/tar.ts`**

Add `import { exec } from "../../../src/deno_ral/process.ts";`. Lines 95-99:

```ts
  const status = await exec(tarCmd[0], {
    args: tarCmd.slice(1),
    stdout: "inherit",
    stderr: "inherit",
  });
```

Lines 119-124:

```ts
  const status = await exec(tarCmd[0], {
    args: tarCmd.slice(1),
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
```

Both replaced ranges start at the `// @ts-expect-error` comment line above each `Deno.run` (lines 95 and 119): it must go with the call, or the type check fails on an unused directive. The `if (status.code !== 0)` blocks that follow are unchanged.

- [ ] **Step 4: `package/src/util/git.ts`**

Add `import { exec } from "../../../src/deno_ral/process.ts";`. Lines 49-57 (checkout):

```ts
  const status = await exec(gitCmd[0], {
    args: gitCmd.slice(1),
    cwd: dir,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (status.code !== 0) {
    throw Error("Failed to checkout");
  }
```

Lines 67-82 (clone; stderr is parsed for the directory name):

```ts
  const output = await exec(gitCmd[0], {
    args: gitCmd.slice(1),
    cwd: workingDir,
    stdout: "inherit",
    stderr: "piped",
  });
  if (output.code !== 0) {
    throw Error("Failed to clone repo");
  }

  const outputTxt = new TextDecoder().decode(output.stderr);
  if (outputTxt) {
    // Forward the output
    info(outputTxt);
```

(keep the following `match`/`return` lines, re-indented into the `if (outputTxt)` block). Lines 113-120 (apply):

```ts
    const status = await exec(gitCmd[0], {
      args: gitCmd.slice(1),
      stdout: "inherit",
      stderr: "piped",
    });
    if (status.code !== 0) {
      throw Error(`Failed to apply patch: '${patch}'`);
    }
```

- [ ] **Step 5: `package/src/common/configure.ts`**

Add `import { execSync } from "../../../src/deno_ral/process.ts";`. Lines 171-174 (previously an un-awaited `Deno.run`):

```ts
    execSync("ln", {
      args: ["-s", linkTarget, "pandoc"],
      cwd: targetDir,
      stdout: "inherit",
      stderr: "inherit",
    });
```

- [ ] **Step 6: the five import-report scripts** (import path `../../../../src/deno_ral/process.ts`)

`deno-info.ts:67-73`:
```ts
  const output = await exec(denoBinary, {
    args: ["info", args()[0], "--json"],
    stderr: "inherit",
  });
  const json = JSON.parse(new TextDecoder().decode(output.stdout)) as DenoInfoJSON;
  return json;
```
with `import { args, exec } from "../../../../src/deno_ral/process.ts";`.

`explain-all-cycles.ts:144-147` and `explain-import-chain.ts:140-143` (`stdin: "inherit"` because `quarto preview` is interactive and `Deno.run` inherited stdin; this matches PR 24's choice):
```ts
  await exec("quarto", {
    args: ["preview", filename],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
```
plus `Deno.exit(` → `exit(` and `Deno.args` → `args()` in both (`import { args, exec, exit } ...`).

`report-bundle-async-cycles.ts:32-61`:
```ts
  const result = await exec(denoBinary, {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-net",
      "--allow-run",
      "--allow-import",
      "--import-map",
      importMapPath,
      scriptPath,
      entryPoint,
      "--simplify",
      "--toon",
      cyclesFile,
    ],
  });

  if (!result.success) {
    const error = new TextDecoder().decode(result.stderr);
    throw new Error(`Failed to generate cycles: ${error}`);
  }
```
(delete the `process.close();` line) plus `exit`/`args()` for its `Deno.exit`/`Deno.args`.

`report-risky-files.ts:63-78`:
```ts
  const output = await exec("rg", { args: ["-l", "export const"] });
  if (!output.success) {
    exit(output.code);
  }
  ...
  const exportFiles = new Set(
    new TextDecoder().decode(output.stdout).trim().split("\n"),
  );
```
plus `exit`/`args()` for its other sites.

- [ ] **Step 7: Verify and commit**

Run: `grep -rn 'Deno\.run(\|new Deno\.Command\|Deno\.CommandStatus' package/src --include=*.ts`
Expected: empty.

Run: `package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=src/import_map.json package/src/bld.ts package/src/common/import-report/report-risky-files.ts package/src/common/import-report/report-bundle-async-cycles.ts package/src/common/import-report/explain-all-cycles.ts package/src/common/import-report/explain-import-chain.ts`
Expected: no errors.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tar-command.test.ts unit/macos-notarize-status.test.ts`
Expected: `0 failed`.

Run: `package/src/quarto-bld prepare-dist --help` (exercises that `bld.ts` still loads)
Expected: help text.

```bash
git add package/src
git commit -m "package/src: Deno.run and Deno.Command through deno_ral/process"
```

### Task 9: changelog, ratchet, docs, final verification

**Files:**
- Modify: `news/changelog-1.11.md`, `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`

- [ ] **Step 1: Changelog**

Open the PR as a draft to get its number `N`, then add under `## Extensions` in `news/changelog-1.11.md` (create the heading in the position `.claude/rules/changelog.md` prescribes if it is absent):

```markdown
- ([#N](https://github.com/quarto-dev/quarto-cli/pull/N)): `quarto.system.execProcess` (the engine-extension API) now accepts exactly the options declared in `@quarto/types` plus `clearEnv`, `signal` and `detached`. Other Deno-specific options (`uid`, `gid`, `windowsRawArguments`, numeric stdio) were never part of the declared API and are now ignored.
```

- [ ] **Step 2: Lower the baseline**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts`
Expected: the second command passes; `git diff tools/runtime-boundary-baseline.json` shows only decreases: `src` lower by 133, `package/src` lower by 32 (re-measure if an earlier PR changed the touched files; the counts must only go down).

- [ ] **Step 3: Update the rules doc**

In `.claude/rules/typescript/deno-ral.md`, replace the `process.ts` row of the module table with:

```
| `process.ts` | Process execution and process-level runtime | `spawn`, `exec`, `execSync`, `exit`, `cwd`, `chdir`, `args`, `execPath`, `pid`, `onSignal`, `killProcess`, `writeStdoutSync`, `writeStderrSync`, `isTerminal`, `readStdin`, `readStdinLines` |
```

and add under "Process execution" in the Common Utilities section: "Never call `Deno.Command`, `Deno.exit`, `Deno.cwd` or `Deno.args` directly; import the equivalent from `deno_ral/process.ts`. `execProcess` (`src/core/process.ts`) remains the API for running external tools with captured output. Spawn with `detached: true` (POSIX) when the child must be stopped together with its own children through `killProcess(-pid)`."

- [ ] **Step 4: Run the Verification list below, then commit**

```bash
git add news/changelog-1.11.md tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "Changelog, rules doc and lower runtime boundary baseline after process layer"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts` → `ok | 17 passed | 0 failed`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/exec-process-stdin.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/path.test.ts unit/environment.test.ts $(find unit/project/ -name '*.test.ts') $(find unit/render/ -name '*.test.ts') $(find unit/tools/ -name '*.test.ts') unit/tar-command.test.ts $(find unit/ral/ -name '*.test.ts')` → `0 failed`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-typst-package-staging.test.ts smoke/jupyter/issue-10097.test.ts smoke/create/create.test.ts $(find smoke/inspect/ -name '*.test.ts') smoke/check/check.test.ts $(find smoke/typst-gather/ -name '*.test.ts') $(find smoke/run/ -name '*.test.ts') smoke/project/project-simple.test.ts smoke/site/render-site.test.ts smoke/ojs/dependency-traversal.test.ts $(find smoke/build-ts-extension/ -name '*.test.ts')` → `0 failed`.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- The acceptance `rg` → empty.
- Manual: `package/dist/bin/quarto preview tests/docs/test.qmd` then Ctrl-C → exits promptly, no orphan `pandoc`/`deno` processes in `ps`.
- Manual (POSIX, needs Python with `shiny`): render-preview a Shiny-for-Python document with `package/dist/bin/quarto preview <doc>.qmd`, then Ctrl-C; `ps -ef | grep -c '[u]vicorn'` → `0` (the detached group was killed). On Windows the same check with `tasklist | findstr python` after Ctrl-C prints nothing.
- Manual: `package/dist/bin/quarto inspect tests/docs/test.qmd | head -c 1; echo " exit=$?"` prints one character and `exit=0` with no `BrokenPipe` message (the CLI-level form of the contract; PR 14b automates it).
- Manual (needs Chrome): `package/dist/bin/quarto render` of a document with a `{mermaid}` cell to `pdf` or `docx` → renders; `quarto check` shows Chrome detected.

## Review checklist

- [ ] `spawn` returns `null` streams for non-piped stdio (never a throwing getter); `exec`/`execSync` return empty buffers for non-piped stdio.
- [ ] `exec`/`execSync` errors keep `cause` and set `code: "ENOENT"` for a missing executable.
- [ ] `env` is passed through untouched (merge is the runtime's default); `clearEnv` is honoured; the merge case is in the test.
- [ ] `detached` reaches `Deno.Command`; `preview-server.ts` passes `detached: !isWindows` and stops with `killProcess(-pid)` on POSIX, `taskkill /T` on Windows.
- [ ] `writeAllSync` never throws on 0 bytes or a broken pipe and returns the bytes written; `core/log.ts` uses `writeStderrSync`.
- [ ] `readStdinLines` closes stdin only when the consumer stopped before EOF.
- [ ] `execProcess` still: writes stdin in 4 KB chunks with the `#14445` close handling; merges streams with `MuxAsyncIterator` when `mergeOutput` is set; applies `timeout` to both the stream drain and the status; registers and unregisters the child for exit cleanup.
- [ ] `ExecProcessOptions` is still a superset of `packages/quarto-types/src/system.ts` `ExecProcessOptions` (cmd, args, cwd, env, stdin, stdout, stderr); the changelog line is present.
- [ ] `cri/launch.ts`: stderr is still drained; `close()` still awaits `status` then `draining` before removing the user-data dir.
- [ ] `create --json` reads the first stdin line; `editor-support crossref` reads all of stdin.
- [ ] Every file with a local `cwd`/`args`/`pid` binding uses the alias import (`currentDir`, `processArgs`, `processPid`), and no local binding was renamed.
- [ ] The excluded files (`src/webui/quarto-preview/build.ts`, `src/resources/tools/ast-diagram/main.ts`, the julia-engine subtree, `src/command/render/latexmk/quarto-latexmk.ts`) are untouched and the PR description says why.
- [ ] No comment line was edited except by the `quarto.ts` sed (comments belong to PR 25).
- [ ] The baseline only went down; `.claude/rules/typescript/deno-ral.md` lists the new exports.

## Risks and rollback

- `exec` defaults stdin to `"null"` where `Deno.Command.output()` inherited it. A tool that reads stdin interactively would now get EOF. None of the migrated `output()` sites read stdin (configure script, `deno fmt`, `deno check`, `ttx`, editor launchers, `npm`, `git`, `tar`, `rg`); if one shows up, pass `stdin: "inherit"` at that site.
- The external preview server now runs in its own process group on POSIX, so the terminal's Ctrl-C no longer reaches it directly. Both callers stop it from Quarto's cleanup; if Quarto itself is killed with SIGKILL the server survives (it did before too whenever the shell put Quarto in a different group). Visible as an orphaned `uvicorn`/`R` process after a crash.
- `writeStdoutSync` swallowing a broken pipe means Quarto keeps computing after `| head` closed the pipe, then exits with its normal code; before, the first write threw `BrokenPipe` and the process crashed with a stack trace. This is the intended behaviour (pinned by the contract test and by PR 14b's `inspect-pipe.test.ts`).
- `readStdinLines` closes stdin after an early stop; a caller that reads stdin again afterwards gets EOF. The only caller (`create --json`) reads one line.
- `spawn` on Deno throws synchronously for a missing executable; the Node implementation (PR 28) may reject `status` instead. Callers in this PR that spawn (`cri/launch.ts`, `preview-server.ts`, `jupyter-kernel.ts`, `execProcess`) are all inside `try`/`await` paths that handle both.
- Rollback: revert the PR; every change is additive at the layer and mechanical at the call sites, no data format changed.

## Decisions needed

None. Resolved since the first draft:
- The three additions (`killProcess`, `readStdin`, `readStdinLines`) and `SpawnOptions.detached` are in the shared vocabulary.
- `src/webui/quarto-preview/build.ts` is not migrated here (it was in the first draft): it stays on `Deno.*` in the ratchet allow-list until PR 33; `process.ts` therefore no longer has to stay free of import-map imports.
- `src/command/render/latexmk/quarto-latexmk.ts` is not migrated (decision 9: PR 39 deletes it).
- Windows tree kill: only the external preview server needs it (`taskkill /T`); Chrome's helper processes exit with the browser process. Not changed for `cri/launch.ts` because no orphan has been observed there.
