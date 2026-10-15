# PR 28: `process.ts` on `node:child_process`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement `src/deno_ral/process.ts` on `node:child_process`, `node:process`, `node:fs` and `node:tty`, make `execProcess` read a child's output while it writes stdin (so large inputs cannot deadlock), and delete the 4 KB stdin chunking.
**Phase:** 2. **Depends on:** PR 25 (every spawn goes through `src/deno_ral/process.ts` or `src/core/process.ts`). **Unblocks:** PR 32.
**Branch:** `rt/28-ral-process-on-node-apis`.
**Suggested executor:** Opus. Spawn-failure semantics, Windows `.cmd` handling and the stdin/stdout concurrency need judgement.
**Size:** M (2 source files rewritten, 2 test files, 1 tooling edit).
**Ships on:** Deno; the whole existing suite must stay green. The PR 26 Node job must still render the spike documents.

## Spec

### Context

Assessment section 11, module plan row `process.ts`: "Own `SpawnOptions`, `ChildProcess` (stdin writer, stdout/stderr as streams, `status` promise, `kill`) … Drop the 4 KB stdin chunking once off Deno." Section 10, spike finding: `Deno.Command` was shimmed on `child_process.spawn` with `Readable.toWeb`/`Writable.toWeb` and rendering (Pandoc with piped stdin, Dart Sass, Typst, Jupyter) worked.

After PR 08 and PR 25, `src/deno_ral/process.ts` exposes the shared-vocabulary interface (`spawn`, `exec`, `execSync`, `exit`, `cwd`, `chdir`, `args`, `execPath`, `pid`, `onSignal`, `writeStdoutSync`, `writeStderrSync`, `isTerminal`) implemented on `Deno.Command` and friends, and `src/core/process.ts` `execProcess` is built on `spawn`. This PR replaces the bodies with `node:` implementations that run on Node 22 and on Deno 2.

Facts verified in this sandbox (Node 22.22 and Deno 2.7.14, `node:child_process` compat):

- `spawn("cat")` with `Writable.toWeb(child.stdin)` / `Readable.toWeb(child.stdout)` moves 1 MiB through the child on both runtimes **only when stdout is read concurrently with the stdin write**. Writing all of stdin before reading stdout deadlocks on Node (the 64 KiB pipe fills) and happens to pass on Deno. The current `execProcess` writes stdin first and reads output afterwards; Task 3 reorders it.
- A missing executable: `spawn()` returns a `ChildProcess` with `pid === undefined` and emits `error` (`code: "ENOENT"`) asynchronously, then `close`. `spawnSync()` returns `{ error: { code: "ENOENT" }, status: null }`. Deno's `Deno.Command.spawn()` throws synchronously; the interface keeps `spawn()` non-throwing and makes `status` reject.
- `spawnSync` honours `maxBuffer`; the shim used 1 GiB and Pandoc's largest outputs fit.
- `fs.writeSync(1, data)` and `isatty(1)` work on both runtimes.
- Node refuses to spawn `.cmd`/`.bat` files without a shell (`EINVAL`, CVE-2024-27980). Quarto spawns `quarto.cmd`, `npm.cmd`, `Rscript` wrappers and `tlmgr.bat` (via `safeWindowsExec`, which already goes through `cmd /c`). The Node implementation routes `.cmd`/`.bat` through `%ComSpec% /d /s /c "<quoted command line>"` with `windowsVerbatimArguments: true` (`.claude/rules/typescript/windows-safe-exec.md` describes the quoting that `safeWindowsExec` applies; this is the same rule applied once, inside the layer).

### Scope

In:
- Rewrite `src/deno_ral/process.ts` on `node:` APIs; no `Deno.*` remains in it.
- `src/core/process.ts`: start stdout/stderr readers before writing stdin; write stdin in one `write()`; keep the stdin `close()` rejection swallow (#14445); keep `registerForExitCleanup`, merge/filter behaviour, timeout.
- Unit tests: 1 MiB stdin through `execProcess` and through `spawn`; ENOENT semantics; `execSync`; `.cmd` on Windows.
- Shrink `tools/node-bundle/deno-shim.js` by the members made unused (`Command`, `exit`, `execPath`, `pid`, `args`, `cwd`, `chdir`, `addSignalListener`, `stdout`/`stderr`/`stdin` writers, `isatty`: whatever `--check-shim` reports).

Out:
- Callers of `execProcess` (signature unchanged).
- `src/core/windows.ts` `safeWindowsExec`/`requireQuoting` (still correct; they produce a `.bat` that the layer runs through `cmd /c`).
- `net.ts`, `http.ts`, `watch.ts` (PR 29).

### Interfaces

Unchanged from the shared vocabulary (`_TEMPLATE.md`, "`process.ts`") plus PR 08's additions (its Interfaces section): `type Signal = "SIGTERM" | "SIGKILL" | "SIGINT"`, `killProcess(pid, signal?)` (a negative pid addresses a process group on POSIX), `readStdin(): Promise<Uint8Array>`, `readStdinLines(): AsyncIterable<string>`. Behaviour made precise by this PR:

- `spawn(cmd, options)`: never throws for a missing executable (PR 08 documented that Deno throws synchronously and that PR 28 "may instead reject `status`"; every caller is inside a `try`/`await` path per PR 08's risk note); `status` rejects with the spawn error (`code: "ENOENT"`, message `spawn <cmd> ENOENT`); `pid` is `-1` until Node assigns one (`child.pid` is `undefined` on failure). `stdin`/`stdout`/`stderr` are `null` unless the corresponding option is `"piped"`. When `options.signal` aborts, the child is killed with SIGTERM and `status` resolves (not rejects) with `signal: "SIGTERM"`.
- `exec(cmd, options)`: defaults `stdin: "null"`, `stdout: "piped"`, `stderr: "piped"`; resolves with collected buffers; rejects with the spawn error for a missing executable.
- `execSync(cmd, options)`: `spawnSync` with `maxBuffer: 1 GiB`; throws the spawn error for a missing executable; otherwise returns `ExecOutput` even for a non-zero exit.
- `ExitStatus.code` for a signal-terminated child is `128 + signal number` (Linux convention; `os.constants.signals`), `signal` is the name.
- `kill(signal)`: `child.kill(signal)`; a no-op when the child already exited.
- `writeStdoutSync`/`writeStderrSync`: loop until every byte is written; on `EAGAIN` (non-blocking pipe) wait 1 ms with `Atomics.wait` and retry.
- `onSignal(signal, handler)`: `process.on(signal, handler)`. On Windows `SIGTERM` listeners never fire (Node limitation; Deno had the same restriction), `SIGINT` fires on Ctrl-C.
- `isTerminal(stream)`: `isatty(0|1|2)`.
- `exit(code)`: `process.exit(code ?? 0)`.

### Files

- Modify: `src/deno_ral/process.ts` (entire body)
- Modify: `src/core/process.ts:` `execProcess` (stdin write and output readers reordered; chunk loop removed)
- Test: `tests/unit/deno-ral/process-stdin.test.ts` (new)
- Test: `tests/unit/deno-ral/process-node-semantics.test.ts` (new)
- Test: `tests/unit/deno-ral/process.test.ts` (PR 08 contract; unchanged, must pass), `tests/unit/exec-process-stdin.test.ts` (existing #14445 regression; must pass)
- Modify: `tools/node-bundle/deno-shim.js` (delete members reported unused)

### Acceptance criteria

- `grep -c "Deno\." src/deno_ral/process.ts src/core/process.ts` → `0` for both.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/ unit/exec-process-stdin.test.ts unit/windows-exec.test.ts` passes.
- `execProcess({ cmd: <echo program> }, oneMiB)` returns `stdout.length === oneMiB.length` on Deno (this PR) and on Node (PR 31's harness; until then, the test is also run by hand through the bundle in Task 4).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/ smoke/jupyter/` passes (Pandoc, Dart Sass, Jupyter spawns).
- `quarto run --dev tools/check-runtime-boundary.ts` stays at zero; `node tools/node-bundle/build.mjs --check-shim` lists fewer members.

## Plan

### Task 1: Semantics tests for the layer

**Files:**
- Create: `tests/unit/deno-ral/process-node-semantics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * process-node-semantics.test.ts
 *
 * Spawn-failure, exit-status and stdio semantics of src/deno_ral/process.ts
 * that differ between Deno.Command and node:child_process.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects, assertThrows } from "../../asserts.ts";
import { isWindows, runtime } from "../../../src/deno_ral/platform.ts";
import { isNotFound } from "../../../src/deno_ral/errors.ts";
import {
  exec,
  execPath,
  execSync,
  isTerminal,
  spawn,
} from "../../../src/deno_ral/process.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { removeSync, writeTextFileSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";

// A JavaScript one-liner that runs under `deno eval` and `node -e` alike
// (process is a global on both runtimes).
function evalArgs(code: string): string[] {
  return runtime().name === "deno" ? ["eval", code] : ["-e", code];
}

unitTest("process - spawn of a missing executable rejects status, does not throw", async () => {
  const child = spawn("quarto-rt28-definitely-missing", { stdout: "piped", stderr: "piped" });
  await assertRejects(() => child.status);
  try {
    await child.status;
  } catch (e) {
    assert(isNotFound(e), `expected ENOENT, got ${e}`);
  }
  assert(child.pid === -1 || typeof child.pid === "number");
});

unitTest("process - exec of a missing executable rejects; execSync throws", async () => {
  await assertRejects(() => exec("quarto-rt28-definitely-missing"));
  assertThrows(() => execSync("quarto-rt28-definitely-missing"));
});

unitTest("process - exec returns code, success, stdout and stderr", async () => {
  const out = await exec(execPath(), {
    args: evalArgs('process.stdout.write("out"); process.stderr.write("err"); process.exit(3)'),
  });
  assertEquals(out.code, 3);
  assertEquals(out.success, false);
  assertEquals(out.signal, null);
  assertEquals(new TextDecoder().decode(out.stdout), "out");
  assertEquals(new TextDecoder().decode(out.stderr), "err");
});

unitTest("process - execSync returns the same shape without throwing on exit code", async () => {
  const out = execSync(execPath(), { args: evalArgs('process.stdout.write("sync"); process.exit(2)') });
  assertEquals(out.code, 2);
  assertEquals(new TextDecoder().decode(out.stdout), "sync");
});

unitTest("process - env, clearEnv and cwd are applied", async () => {
  const dir = makeTempDirSync({ prefix: "rt28-cwd-" });
  const out = await exec(execPath(), {
    args: evalArgs('process.stdout.write(process.cwd() + "|" + (process.env.RT28 ?? "") + "|" + (process.env.PATH === undefined))'),
    cwd: dir,
    env: { RT28: "yes", PATH: process.env.PATH ?? "" },
    clearEnv: true,
  });
  const [cwd, rt28, pathMissing] = new TextDecoder().decode(out.stdout).split("|");
  assert(cwd.replaceAll("\\", "/").endsWith(dir.replaceAll("\\", "/").split("/").pop()!));
  assertEquals(rt28, "yes");
  assertEquals(pathMissing, "false");
  removeSync(dir, { recursive: true });
});

unitTest("process - kill resolves status with the signal", async () => {
  if (isWindows) return; // Windows reports TerminateProcess as exit code 1, no signal name
  const child = spawn(execPath(), { args: evalArgs("setTimeout(() => {}, 60000)"), stdout: "null", stderr: "null" });
  setTimeout(() => child.kill("SIGTERM"), 300);
  const status = await child.status;
  assertEquals(status.success, false);
  assertEquals(status.signal, "SIGTERM");
  assertEquals(status.code, 143);
});

unitTest("process - abort signal kills the child and status resolves", async () => {
  if (isWindows) return;
  const ac = new AbortController();
  const child = spawn(execPath(), { args: evalArgs("setTimeout(() => {}, 60000)"), stdout: "null", stderr: "null", signal: ac.signal });
  setTimeout(() => ac.abort(), 300);
  const status = await child.status;
  assertEquals(status.signal, "SIGTERM");
});

unitTest("process - isTerminal is a boolean for every stream", async () => {
  for (const s of ["stdin", "stdout", "stderr"] as const) assertEquals(typeof isTerminal(s), "boolean");
});

unitTest("process - .cmd files run through cmd.exe on Windows", async () => {
  if (!isWindows) return;
  const dir = makeTempDirSync({ prefix: "rt28 cmd " }); // a space in the path, on purpose
  const cmd = join(dir, "hello.cmd");
  writeTextFileSync(cmd, "@echo off\r\necho hello %1\r\n");
  const out = await exec(cmd, { args: ["world wide"] });
  assertEquals(out.code, 0);
  assertEquals(new TextDecoder().decode(out.stdout).trim(), 'hello "world wide"');
  removeSync(dir, { recursive: true });
});
```

(`runtime()` is in `src/deno_ral/platform.ts` since PR 19. `process` is a global on Deno 2 and Node; referencing it in a test is not a `Deno.*` use.)

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/process-node-semantics.test.ts`
Expected: `spawn of a missing executable rejects status, does not throw` fails on the PR 08 body (Deno's `Command.spawn()` throws synchronously); the signal/code case may fail (`code` differs). Everything else may already pass.

- [ ] **Step 3: Commit the test**

```bash
git add tests/unit/deno-ral/process-node-semantics.test.ts
git commit -m "tests: pin node:child_process semantics for deno_ral/process"
```

### Task 2: Rewrite `src/deno_ral/process.ts`

**Files:**
- Modify: `src/deno_ral/process.ts`

- [ ] **Step 1: Implement**

```ts
/*
 * process.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Process layer on node:child_process. Runs on Node and on Deno 2 (node
 * compat). See dev-docs/runtime-migration/_TEMPLATE.md for the interface.
 */

import {
  type ChildProcess as NodeChildProcess,
  spawn as nodeSpawn,
  spawnSync as nodeSpawnSync,
  type SpawnOptions as NodeSpawnOptions,
} from "node:child_process";
import { Readable, Writable } from "node:stream";
import { writeSync } from "node:fs";
import { isatty } from "node:tty";
import { constants as osConstants } from "node:os";
import nodeProcess from "node:process";

export type StdioOption = "piped" | "inherit" | "null";

export interface SpawnOptions {
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  clearEnv?: boolean;
  stdin?: StdioOption;
  stdout?: StdioOption;
  stderr?: StdioOption;
  signal?: AbortSignal;
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

export type Signal = "SIGTERM" | "SIGKILL" | "SIGINT";

export interface ChildProcess {
  readonly pid: number;
  readonly stdin: WritableStream<Uint8Array> | null;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly status: Promise<ExitStatus>;
  kill(signal?: Signal): void;
}

const kMaxBuffer = 1024 * 1024 * 1024;

function stdio(value: StdioOption | undefined, def: "pipe" | "inherit" | "ignore"): "pipe" | "inherit" | "ignore" {
  if (value === undefined) return def;
  return value === "piped" ? "pipe" : value === "null" ? "ignore" : "inherit";
}

function nodeOptions(options: SpawnOptions, mode: "spawn" | "exec"): NodeSpawnOptions {
  const env = options.clearEnv
    ? { ...(options.env ?? {}) }
    : { ...nodeProcess.env, ...(options.env ?? {}) };
  const defIn = mode === "spawn" ? "inherit" : "ignore";
  const defOut = mode === "spawn" ? "inherit" : "pipe";
  return {
    cwd: options.cwd,
    env,
    stdio: [stdio(options.stdin, defIn), stdio(options.stdout, defOut), stdio(options.stderr, defOut)],
    windowsHide: true,
    signal: options.signal,
  };
}

// Node refuses .cmd/.bat without a shell (CVE-2024-27980). Run them through
// cmd.exe with one quoted command line, the rule safeWindowsExec applies to
// its generated batch file (.claude/rules/typescript/windows-safe-exec.md).
function command(cmd: string, args: string[]): [string, string[], NodeSpawnOptions] {
  if (nodeProcess.platform !== "win32" || !/\.(cmd|bat)$/i.test(cmd)) {
    return [cmd, args, {}];
  }
  const quote = (s: string) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  const line = [cmd, ...args].map(quote).join(" ");
  return [
    nodeProcess.env.ComSpec ?? "cmd.exe",
    ["/d", "/s", "/c", `"${line}"`],
    { windowsVerbatimArguments: true },
  ];
}

function exitStatus(code: number | null, signal: NodeJS.Signals | null): ExitStatus {
  if (signal) {
    const num = (osConstants.signals as Record<string, number>)[signal] ?? 0;
    return { success: false, code: 128 + num, signal };
  }
  return { success: code === 0, code: code ?? 1, signal: null };
}

class NodeChild implements ChildProcess {
  readonly stdin: WritableStream<Uint8Array> | null;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly status: Promise<ExitStatus>;
  #child: NodeChildProcess;

  constructor(child: NodeChildProcess) {
    this.#child = child;
    this.stdin = child.stdin ? Writable.toWeb(child.stdin) as WritableStream<Uint8Array> : null;
    this.stdout = child.stdout ? Readable.toWeb(child.stdout) as ReadableStream<Uint8Array> : null;
    this.stderr = child.stderr ? Readable.toWeb(child.stderr) as ReadableStream<Uint8Array> : null;
    this.status = new Promise<ExitStatus>((resolve, reject) => {
      child.once("error", (e: NodeJS.ErrnoException) => {
        // An aborted signal kills the child; `close` follows with the signal.
        if (e.name === "AbortError") return;
        reject(e);
      });
      child.once("close", (code, signal) => resolve(exitStatus(code, signal)));
    });
    // Callers that only use the streams must not see an unhandled rejection.
    this.status.catch(() => {});
  }

  get pid(): number {
    return this.#child.pid ?? -1;
  }

  kill(signal: Signal = "SIGTERM"): void {
    if (this.#child.exitCode === null && this.#child.signalCode === null) {
      this.#child.kill(signal);
    }
  }
}

export function spawn(cmd: string, options: SpawnOptions = {}): ChildProcess {
  const [file, args, extra] = command(cmd, options.args ?? []);
  return new NodeChild(nodeSpawn(file, args, { ...nodeOptions(options, "spawn"), ...extra }));
}

export function exec(cmd: string, options: SpawnOptions = {}): Promise<ExecOutput> {
  const [file, args, extra] = command(cmd, options.args ?? []);
  return new Promise<ExecOutput>((resolve, reject) => {
    const child = nodeSpawn(file, args, { ...nodeOptions(options, "exec"), ...extra });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout?.on("data", (d: Buffer) => out.push(d));
    child.stderr?.on("data", (d: Buffer) => err.push(d));
    child.once("error", (e: NodeJS.ErrnoException) => {
      if (e.name !== "AbortError") reject(e);
    });
    child.once("close", (code, signal) =>
      resolve({
        ...exitStatus(code, signal),
        stdout: new Uint8Array(Buffer.concat(out)),
        stderr: new Uint8Array(Buffer.concat(err)),
      }));
  });
}

export function execSync(cmd: string, options: SpawnOptions = {}): ExecOutput {
  const [file, args, extra] = command(cmd, options.args ?? []);
  const r = nodeSpawnSync(file, args, { ...nodeOptions(options, "exec"), ...extra, maxBuffer: kMaxBuffer });
  if (r.error) throw r.error;
  return {
    ...exitStatus(r.status, r.signal),
    stdout: new Uint8Array(r.stdout ?? Buffer.alloc(0)),
    stderr: new Uint8Array(r.stderr ?? Buffer.alloc(0)),
  };
}

export function exit(code?: number): never {
  nodeProcess.exit(code ?? 0);
}

export function cwd(): string {
  return nodeProcess.cwd();
}

export function chdir(dir: string): void {
  nodeProcess.chdir(dir);
}

export function args(): string[] {
  return nodeProcess.argv.slice(2);
}

export function execPath(): string {
  return nodeProcess.execPath;
}

export function pid(): number {
  return nodeProcess.pid;
}

export function onSignal(signal: "SIGINT" | "SIGTERM", handler: () => void): void {
  nodeProcess.on(signal, handler);
}

const kEagainWait = new Int32Array(new SharedArrayBuffer(4));

function writeAllSync(fd: number, data: Uint8Array): number {
  let offset = 0;
  while (offset < data.length) {
    try {
      offset += writeSync(fd, data, offset, data.length - offset);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EAGAIN") {
        Atomics.wait(kEagainWait, 0, 0, 1);
        continue;
      }
      throw e;
    }
  }
  return offset;
}

export function writeStdoutSync(data: Uint8Array): number {
  return writeAllSync(1, data);
}

export function writeStderrSync(data: Uint8Array): number {
  return writeAllSync(2, data);
}

export function isTerminal(stream: "stdin" | "stdout" | "stderr"): boolean {
  return isatty(stream === "stdin" ? 0 : stream === "stdout" ? 1 : 2);
}

/** Send a signal to a process; a negative pid addresses a process group (POSIX). */
export function killProcess(pid: number, signal: Signal = "SIGTERM"): void {
  nodeProcess.kill(pid, signal);
}

/** Read standard input until EOF. */
export async function readStdin(): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of nodeProcess.stdin) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

/** Standard input as lines (without the line terminator). */
export async function* readStdinLines(): AsyncIterable<string> {
  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of nodeProcess.stdin) {
    pending += decoder.decode(chunk as Buffer, { stream: true });
    let nl: number;
    while ((nl = pending.indexOf("\n")) >= 0) {
      yield pending.slice(0, nl).replace(/\r$/, "");
      pending = pending.slice(nl + 1);
    }
  }
  pending += decoder.decode();
  if (pending.length > 0) {
    yield pending.replace(/\r$/, "");
  }
}
```

If PR 08 left other exports in the file (for example a `call` alias scheduled for removal in PR 25, or a `ProcessResult` re-export), `grep -n "^export" src/deno_ral/process.ts` before overwriting and keep them with the same bodies on top of `exec`.

- [ ] **Step 2: Run the contract and semantics tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/process.test.ts unit/deno-ral/process-node-semantics.test.ts`
Expected: all green. PR 08's contract cases (`process.spawn - piped stdin is echoed to piped stdout`, `process.spawn - kill ends the child with a failed status`, `process.exec - missing executable rejects with the command name`, `process - writeStdoutSync writes everything`) pass unchanged; if PR 08 added a case asserting that `spawn()` of a missing executable throws synchronously, replace it with the `status`-rejects case from this plan's semantics file (the interface comment in PR 08 reserved that change for this PR).

- [ ] **Step 3: Commit**

```bash
git add src/deno_ral/process.ts
git commit -m "deno_ral/process: spawn, exec, execSync and stdio on node:child_process"
```

### Task 3: `execProcess` reads output while writing stdin; no chunking

**Files:**
- Create: `tests/unit/deno-ral/process-stdin.test.ts`
- Modify: `src/core/process.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * process-stdin.test.ts
 *
 * A child that echoes stdin must receive 1 MiB without deadlock. Node pipes
 * hold 64 KiB; writing all of stdin before reading stdout hangs. Also pins
 * that stdin is written in one piece (no 4 KiB chunking).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assertEquals } from "../../asserts.ts";
import { runtime } from "../../../src/deno_ral/platform.ts";
import { execPath, spawn } from "../../../src/deno_ral/process.ts";
import { execProcess } from "../../../src/core/process.ts";

const kEcho = "process.stdin.pipe(process.stdout)";
function echoArgs(): string[] {
  return runtime().name === "deno" ? ["eval", kEcho] : ["-e", kEcho];
}
const kSize = 1024 * 1024;
const oneMiB = "x".repeat(kSize - 1) + "\n";

unitTest("execProcess - 1 MiB of stdin round-trips through an echoing child", async () => {
  const result = await execProcess(
    { cmd: execPath(), args: echoArgs(), stdout: "piped", stderr: "piped" },
    oneMiB,
    undefined,
    undefined,
    undefined,
    60000,
  );
  assertEquals(result.success, true, result.stderr);
  assertEquals(result.stdout?.length, kSize);
});

unitTest("spawn - 1 MiB written to stdin while stdout is read", async () => {
  const child = spawn(execPath(), { args: echoArgs(), stdin: "piped", stdout: "piped", stderr: "null" });
  let received = 0;
  const reading = (async () => {
    for await (const chunk of child.stdout!) received += chunk.length;
  })();
  const writer = child.stdin!.getWriter();
  await writer.write(new TextEncoder().encode(oneMiB));
  await writer.close();
  await reading;
  const status = await child.status;
  assertEquals(status.code, 0);
  assertEquals(received, kSize);
});
```

- [ ] **Step 2: Run it and see it fail (or hang)**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/process-stdin.test.ts`
Expected on Deno: may pass (Deno's pipes are more forgiving) — the test exists for the Node run (Task 4 and PR 31). If it passes, continue; the implementation change is still required by the Node evidence above.

- [ ] **Step 3: Implement**

In `src/core/process.ts`, inside `execProcess`, replace the block that starts at `if (stdin !== undefined) {` (the writer, the `kWindowSize` loop, `releaseLock` and the `stdin.close()` try/catch) and the following output-processing code up to `const status = await withTimeout(process.status)` with:

```ts
    // Start consuming stdout/stderr BEFORE writing stdin: a child that
    // produces output while reading its input (cat, Pandoc on large docs)
    // blocks on a full 64 KiB pipe otherwise, and so would we.
    let stdoutText = "";
    let stderrText = "";
    const outputPromises: Promise<void>[] = [];

    if (mergeOutput) {
      const multiplexIterator = new MuxAsyncIterator<Uint8Array>();
      const addStream = (
        iterator: AsyncIterableIterator<Uint8Array>,
        filter?: (output: string) => string,
      ) => {
        multiplexIterator.add(filter ? filteredAsyncIterator(iterator, filter) : iterator);
      };
      if (process.stdout) addStream(process.stdout.values());
      if (process.stderr) addStream(process.stderr.values(), stderrFilter);
      outputPromises.push(
        processOutput(
          multiplexIterator,
          mergeOutput === "stderr>stdout" ? options.stdout : options.stderr,
        ).then((text) => {
          if (mergeOutput === "stderr>stdout") stdoutText = text;
          else stderrText = text;
        }),
      );
    } else {
      if (process.stdout !== null) {
        outputPromises.push(
          processOutput(process.stdout.values(), options.stdout, respectStreams ? "stdout" : undefined)
            .then((text) => { stdoutText = text; }),
        );
      }
      if (process.stderr !== null) {
        const iterator = stderrFilter
          ? filteredAsyncIterator(process.stderr.values(), stderrFilter)
          : process.stderr.values();
        outputPromises.push(
          processOutput(iterator, options.stderr, respectStreams ? "stderr" : undefined)
            .then((text) => { stderrText = text; }),
        );
      }
    }

    if (stdin !== undefined) {
      if (!process.stdin) {
        unregisterForExitCleanup(thisProcessId);
        throw new Error("Process stdin not available");
      }
      const stdinWriter = process.stdin.getWriter();
      try {
        // One write: the stream applies back-pressure; no manual chunking.
        await stdinWriter.write(new TextEncoder().encode(stdin));
        await stdinWriter.close();
      } catch (e) {
        // The child may have closed its read end before our write/close
        // completed (exited fast, failed to spawn). The exit status reflects
        // any real problem; do not let this escape as an unhandled rejection
        // that aborts the render. See #14445.
        debug(`[execProcess] stdin write/close rejected: ${e}`);
      }
    }

    await withTimeout(Promise.all(outputPromises));
    const status = await withTimeout(process.status);
```

Everything else in `execProcess` (the `spawn(options.cmd, { ...options, stdin: stdin !== undefined ? "piped" : options.stdin, stdout: "piped", stderr: "piped" })` call from PR 08, `registerForExitCleanup`, the result object, the error wrapping) stays. Delete the `kWindowSize` constant and the `// write in 4k chunks (deno observed to overflow at > 64k)` comment. `processOutput` already uses `writeStdoutSync`/`writeStderrSync` (PR 08); if it still names `Deno.stdout.writeSync`, replace with `writeStdoutSync(chunk)` / `writeStderrSync(chunk)` from `../deno_ral/process.ts`.

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/process-stdin.test.ts unit/exec-process-stdin.test.ts unit/deno-ral/process.test.ts`
Expected: all green; `exec-process-stdin.test.ts` reports `0 unhandled rejections` for its four scenarios.

- [ ] **Step 5: Run the spawn-heavy smoke tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render.test.ts smoke/render/render-typst.test.ts smoke/jupyter/ smoke/knitr/ unit/windows-exec.test.ts unit/latexmk/`
Expected: all green (Pandoc with piped stdin, Typst, Jupyter kernel daemon, Rscript; `latexmk` tests exercise `safeWindowsExec` paths on Windows CI).

- [ ] **Step 6: Commit**

```bash
git add src/core/process.ts tests/unit/deno-ral/process-stdin.test.ts
git commit -m "execProcess: read child output while writing stdin; drop 4 KB chunking"
```

### Task 4: Node run of the new tests through the bundle, shim shrink

**Files:**
- Modify: `tools/node-bundle/deno-shim.js`

- [ ] **Step 1: Check the Windows quoting callers still go through `safeWindowsExec`**

Run: `grep -rn "requireQuoting" src/ --include=*.ts | grep -v "windows.ts"`
Expected: only `src/command/render/latexmk/texlive.ts`, `src/core/shell.ts`, `src/core/zip.ts`, each passing the quoted array to `safeWindowsExec` (which writes a `.bat` and runs `cmd /c`). If any caller passes `requireQuoting(...).args` straight to `execProcess`, its quotes would now be doubled by Node's own argument quoting: route it through `safeWindowsExec` like the others and add a case to `tests/unit/windows-exec.test.ts`.

- [ ] **Step 2: Rebuild the bundle and render on Node**

Run:
```bash
npm ci && node tools/node-bundle/build.mjs --check-shim
tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd
tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/jupyter.qmd
```
Expected: `0 missing`, a list of now-unused members (`Command`, `exit`, `execPath`, `pid`, `args`, `cwd`, `chdir`, `addSignalListener`, `removeSignalListener`, `kill`, `stdout`, `stderr`, `stdin`, `isatty` are the candidates), and both renders succeed. `jupyter.qmd` exercises the kernel daemon spawn with piped stdin.

- [ ] **Step 3: Run the 1 MiB test through the bundle by hand**

Until PR 31 lands, exercise the Node path of `execProcess` directly:

```bash
cat > /tmp/rt28-check.mjs <<'EOF'
import "/ABS/PATH/TO/quarto-cli/tools/node-bundle/deno-shim.js";
const { execProcess } = await import("/ABS/PATH/TO/quarto-cli/tools/node-bundle/dist/rt28-process.mjs");
const r = await execProcess({ cmd: process.execPath, args: ["-e", "process.stdin.pipe(process.stdout)"], stdout: "piped", stderr: "piped" }, "x".repeat(1024 * 1024));
console.log("code", r.code, "stdout bytes", r.stdout.length);
EOF
node tools/node-bundle/build.mjs --entry src/core/process.ts --out tools/node-bundle/dist/rt28-process.mjs
sed -i "s#/ABS/PATH/TO/quarto-cli#$PWD#g" /tmp/rt28-check.mjs
timeout 60 node /tmp/rt28-check.mjs
```
Expected: `code 0 stdout bytes 1048576` within a few seconds. A hang means the readers were not started before the stdin write.

- [ ] **Step 4: Delete the unused shim members, rebuild, commit**

Delete the `Deno.<name> = ...` lines (and the `Command`, `ChildProcess`, `stdio`, `spawnOptions`, `windowsCommand`, `exitStatus` helpers once nothing else uses them) that `--check-shim` reported unused; rebuild to confirm `0 missing`.

```bash
git add tools/node-bundle/deno-shim.js
git commit -m "node-bundle: drop shim members made unused by deno_ral/process"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/` → green.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/exec-process-stdin.test.ts unit/windows-exec.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts` → green (spawn, kill, stderr capture, fake executables).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/ smoke/jupyter/ smoke/knitr/ smoke/preview/` → green.
- `grep -c "Deno\." src/deno_ral/process.ts src/core/process.ts` → `0`, `0`.
- `quarto run --dev tools/check-runtime-boundary.ts` → zero.
- `node tools/node-bundle/build.mjs --check-shim` → `0 missing`; both spike renders succeed; the Task 4 step 3 check prints `stdout bytes 1048576`.
- Manual: `package/dist/bin/quarto render tests/docs/smoke-all/2023/02/08/4272.qmd` (large Pandoc stdin) and `package/dist/bin/quarto check` (many spawns, version parsing from stdout).
- Windows CI (the normal Deno matrix) covers the `.cmd` test; it is skipped elsewhere.

## Review checklist

- [ ] `spawn()` never throws synchronously; `status` rejects for ENOENT; `exec` rejects; `execSync` throws.
- [ ] Output readers are started before the stdin write in `execProcess`; no `kWindowSize`, no chunk loop.
- [ ] The #14445 swallow is kept (write **and** close are inside one try/catch, logged at debug level).
- [ ] `.cmd`/`.bat` route through `%ComSpec% /d /s /c` with a single quoted line and `windowsVerbatimArguments: true`; non-Windows and non-batch commands are spawned directly with `shell: false`.
- [ ] `exitStatus` maps signals to `128 + n` and keeps the signal name; `AbortError` does not reject `status`.
- [ ] `writeStdoutSync` loops on partial writes and retries `EAGAIN`.
- [ ] `clearEnv` produces exactly `options.env` (no inherited variables).
- [ ] No `Deno.` left in the two files; shim lost members, none added.

## Risks and rollback

- **Pipe back-pressure differences** could surface as hangs in a spawn-heavy path (Jupyter daemon, Typst gather). The new tests and `smoke/jupyter/` cover the known cases. Rollback: `git revert` the `execProcess` commit restores the old ordering (still correct on Deno).
- **Windows `.cmd` quoting**: an argument containing both spaces and double quotes may be mangled by `cmd /c` parsing. Quarto's `.cmd` spawns pass file paths and simple flags; `safeWindowsExec` remains the escape hatch for anything else. If a regression appears, route that caller through `safeWindowsExec`.
- **`process.exit` on Deno** skips Deno's own `unload` handlers in some versions; `src/core/cleanup.ts` runs Quarto's cleanup before calling `exit()`, so nothing user-visible depends on them. The test harness (`tests/test.ts`) registers an `unload` listener for GitHub summaries; it runs at the end of `deno test`, not through `exit()`.
- **Whole-PR rollback:** revert the four commits.

## Decisions needed

None.
