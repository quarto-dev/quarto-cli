# PR 28: `process.ts` on `node:child_process`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement `src/deno_ral/process.ts` on `node:child_process`, `node:process`, `node:fs` and `node:tty` with three guarantees Deno gives today and Node does not by default: `.bat`/`.cmd` arguments escaped against `cmd.exe` injection (BatBadBut, CVE-2024-24576/CVE-2024-27980), no output lost when `exit()` follows a large write to a pipe, and process groups that can be killed as a whole; make `execProcess` read a child's output while it writes stdin, and delete the 4 KB stdin chunking.
**Phase:** 2. **Depends on:** PR 25 (every spawn goes through `src/deno_ral/process.ts` or `src/core/process.ts`), PR 26 (shim, `node-unit` job, `tests/unit/ral/layer-script.ts`), PR 27b (`runtime()` answers `node` inside the test bundles), PR 14b (`tests/smoke/inspect/inspect-pipe.test.ts`, `tests/unit/process-group.test.ts`, `tests/smoke/jupyter/daemon.test.ts`). Starts after Spike #2 closes (`SPIKES.md`, question (d)). **Unblocks:** PR 31, 32.
**Branch:** `rt/28-ral-process-on-node-apis`.
**Suggested executor:** Opus. Spawn-failure semantics, Windows batch escaping, stdio draining and the stdin/stdout concurrency need judgement.
**Size:** M (2 source files rewritten, 1 created, 4 test files and 1 fixture, shim shrink).
**Ships on:** Deno; the whole existing suite must stay green. Node: the PR 26 `node-unit` job runs this PR's `tests/unit/ral/process*.test.ts` and `batch-command-line.test.ts` on real Node on Linux and Windows; the `process` entries in `tools/node-bundle/known-failures.json` are removed and none is added.

## Spec

### Context

Assessment section 11, module plan row `process.ts`: "Own `SpawnOptions`, `ChildProcess` (stdin writer, stdout/stderr as streams, `status` promise, `kill`) … Drop the 4 KB stdin chunking once off Deno." Section 10, spike finding: `Deno.Command` was shimmed on `child_process.spawn` with `Readable.toWeb`/`Writable.toWeb` and rendering (Pandoc with piped stdin, Dart Sass, Typst, Jupyter) worked.

After PR 08 and PR 25, `src/deno_ral/process.ts` exposes the shared-vocabulary interface implemented on `Deno.Command` and friends, and `src/core/process.ts` `execProcess` is built on `spawn`. This PR replaces the bodies.

Review findings on the earlier draft of this plan, all addressed here (review S3, S6, S8):

- **Batch-file quoting (S8).** The draft routed `.cmd`/`.bat` through `cmd.exe /d /s /c "<line>"`, quoting an argument only when it contained whitespace or `"` and escaping `"` as `\"`, which `cmd.exe` does not understand. An argument such as `a&calc` or `%PATH%` went through unquoted or expanded: the BatBadBut class (CVE-2024-24576 in Rust's `Command`, CVE-2024-27980 in Node). Deno's `Command` is Rust's, which has escaped batch arguments since Rust 1.77.2, so the draft was a security regression at the flip.
- **`exit()` truncation (S6).** `process.exit()` right after a large write to a piped stdout loses data on POSIX (pipes are asynchronous in Node; Deno's writes are synchronous). Verified in this sandbox on Node 22.22: `process.stdout.write(4 MiB); process.exit(0)` into `(sleep 1; wc -c)` delivers 65,536 bytes; with `process.stdout._handle.setBlocking(true)` first, 4,194,304; `console.log` lines likewise. `quarto inspect | jq` and `quarto render -o -` hit this.
- **Process groups.** `src/preview/preview-server.ts:75` kills `-pid` (a process group) on POSIX; PR 08 added `SpawnOptions.detached` (vocabulary) so the child leads its own group. Node needs `detached: true`; Windows has no `kill(-pid)`, so the layer kills the tree with `taskkill /T /F` (PR 08's Deno body already does; this PR keeps the contract on `spawnSync`).
- **Unverified Deno compat.** `windowsVerbatimArguments` and `process.kill(-pid)` on Deno's `node:child_process` are Spike #2 (d); this PR reads the recorded answer (Task 2, `kDenoHonoursVerbatim`).
- **Tests named but absent.** `smoke/knitr/` and `smoke/preview/` do not exist; this plan uses `tests/smoke/render/render-r.test.ts` (knitr) and PR 14b's `tests/smoke/preview/preview-reload.test.ts`, `tests/smoke/jupyter/daemon.test.ts`, `tests/smoke/inspect/inspect-pipe.test.ts` and `tests/unit/process-group.test.ts`.

Facts verified in this sandbox (Node 22.22 and Deno 2.7.14, `node:child_process` compat):

- `spawn("cat")` with `Writable.toWeb(child.stdin)` / `Readable.toWeb(child.stdout)` moves 1 MiB through the child on both runtimes **only when stdout is read concurrently with the stdin write**. Writing all of stdin before reading stdout deadlocks on Node (the 64 KiB pipe fills) and happens to pass on Deno. The current `execProcess` writes stdin first and reads output afterwards; Task 4 reorders it.
- A missing executable: `spawn()` returns a `ChildProcess` with `pid === undefined` and emits `error` (`code: "ENOENT"`) asynchronously, then `close`. `spawnSync()` returns `{ error: { code: "ENOENT" }, status: null }`. Deno's `Deno.Command.spawn()` throws synchronously; the interface keeps `spawn()` non-throwing and makes `status` reject.
- `spawnSync` honours `maxBuffer`; the shim used 1 GiB and Pandoc's largest outputs fit.
- `fs.writeSync(1, data)` and `isatty(1)` work on both runtimes; after `setBlocking(true)`, `fs.writeSync(1, 4 MiB)` after a `console.log` delivers every byte (no `EAGAIN`).
- With blocking stdio, a write to a pipe whose reader has gone (`| head -c 1`) emits `error` with `code: "EPIPE"` on the stream; without a listener that is an uncaught exception with a stack trace.

**Decision: the layer escapes batch-file arguments itself, with Rust's algorithm; not through `safeWindowsExec`.** Options were (a) route `.bat`/`.cmd` through the existing `safeWindowsExec` (`src/core/windows.ts`, which writes `[program, ...args].join(" ")` into a temporary `.bat` and runs `cmd /c` on it), or (b) port Rust std's `make_bat_command_line` (the CVE-2024-24576 fix Deno ships today) into a small layer module and pass its output to `cmd.exe /e:ON /v:OFF /d /c "<line>"` with `windowsVerbatimArguments: true`. Chosen: (b). Reasons: `safeWindowsExec` does not escape at all (`requireQuoting` only wraps arguments containing ` <>()|\:&;#?*'` in `"`, so `%PATH%` is expanded inside the `.bat` and an argument containing `"` closes the quote), so routing through it would keep the injection; (b) reproduces exactly what Deno does today, so behaviour does not change at the flip; (b) needs no temporary file per spawn; and the algorithm is small (forty lines) and has a published test corpus. `safeWindowsExec` stays for its own purpose (running a command line through `cmd` with `chcp 65001`), unchanged.

**Decision: `exit()` drains by making stdio blocking, not by waiting.** The vocabulary asks that `exit(code)` flush stdout and stderr before exiting ("`process.exitCode = code` then end after both streams drained"). A function typed `never` cannot wait for a stream's `finish` event (it would return to its caller, which then runs on: every `exit(1)` in an error branch would keep going). The layer instead makes the stdout and stderr handles blocking when it loads (`_handle.setBlocking(true)`, available on pipe and TCP handles; files and Windows pipes are synchronous in Node already), which is Deno's model: every write completes before the next statement. `exit(code)` then sets `process.exitCode = code` and calls `process.exit(code)`, and nothing is queued. A broken pipe (`EPIPE`) ends the process quietly with the current `process.exitCode`.

### Scope

In:
- Rewrite `src/deno_ral/process.ts` on `node:` APIs; no `Deno.*` remains in it.
- Create `src/deno_ral/batch-command-line.ts` (Rust's batch escaping).
- `src/core/process.ts`: start stdout/stderr readers before writing stdin; write stdin in one `write()`; keep the stdin `close()` rejection swallow (#14445); keep `registerForExitCleanup`, merge/filter behaviour, timeout.
- Tests: `tests/unit/ral/process-node-semantics.test.ts`, `tests/unit/ral/batch-command-line.test.ts` (string vectors on every OS, end-to-end on Windows), `tests/unit/ral/process-stdin.test.ts`, `tests/unit/ral/process-exit-pipe.test.ts` with its fixture `tests/unit/ral/fixtures/exit-pipe-child.ts`.
- Shrink `tools/node-bundle/deno-shim.mjs` (`Command`, `exit`, `execPath`, `pid`, `args`, `cwd`, `chdir`, `addSignalListener`, `removeSignalListener`, `kill`, `stdout`, `stderr`, `stdin`, `isatty`: whatever `--check-shim` reports unused), and remove the fixed entries from `tools/node-bundle/known-failures.json`.

Out:
- Callers of `execProcess` (signature unchanged).
- `src/core/windows.ts` `safeWindowsExec`/`requireQuoting` (unchanged; its unescaped `.bat` line is pre-existing and its four callers pass Quarto-controlled paths; tracked under Risks).
- `net.ts`, `http.ts`, `watch.ts` (PR 29).

### Interfaces

Unchanged from the shared vocabulary (`_TEMPLATE.md`, "`process.ts`"), including PR 08's additions (`Signal`, `killProcess`, `readStdin`, `readStdinLines`, `SpawnOptions.detached`). New layer-internal module:

```ts
// src/deno_ral/batch-command-line.ts
/** The command line cmd.exe must receive to run `script` (a .bat/.cmd path) with `args` so that the
 *  batch file sees exactly `args`: Rust std's make_bat_command_line (CVE-2024-24576), as Deno's Command
 *  applies it. Returns `"<script>" <arg>...`; the caller wraps it as `cmd.exe /e:ON /v:OFF /d /c "<line>"`
 *  with windowsVerbatimArguments. Throws an Error with code "EINVAL" for a script path containing `"` or
 *  ending in `\`, and for an argument containing CR, LF or NUL. */
export function batchCommandLine(script: string, args: string[]): string;
```

Behaviour made precise by this PR:

- `spawn(cmd, options)`: never throws for a missing executable (PR 08 reserved this change for this PR); `status` rejects with the spawn error (`code: "ENOENT"`, so `isNotFound(e)` is true). It throws synchronously (code `EINVAL`) only for an invalid batch-file argument, as Deno's `Command` does. `pid` is `-1` until Node assigns one. `stdin`/`stdout`/`stderr` are `null` unless the option is `"piped"`. When `options.signal` aborts, the child is killed with SIGTERM and `status` resolves with `signal: "SIGTERM"`.
- `detached: true`: POSIX, the child calls `setsid` (Node `detached: true`) and leads a new process group whose id is its pid; Windows, `CREATE_NEW_PROCESS_GROUP` (Node `detached: true`, with `windowsHide: true` so no console window appears).
- `env`: merged over the inherited environment unless `clearEnv: true`; on Windows an override replaces an inherited variable whose name differs only in case (`Path` vs `PATH`).
- `exec(cmd, options)`: defaults `stdin: "null"`, `stdout: "piped"`, `stderr: "piped"`; resolves with collected buffers; rejects with the spawn error for a missing executable.
- `execSync(cmd, options)`: `spawnSync` with `maxBuffer: 1 GiB`; throws the spawn error for a missing executable; otherwise returns `ExecOutput` even for a non-zero exit.
- `ExitStatus.code` for a signal-terminated child is `128 + signal number`, `signal` is the name.
- `kill(signal)`: `child.kill(signal)`; a no-op when the child already exited.
- `killProcess(pid, signal)`: POSIX `process.kill(pid, signal)` (a negative pid addresses a process group); Windows with a negative pid: `taskkill /PID <-pid> /T /F` (the whole tree; Windows has no signals), throwing an Error with `code: "ESRCH"` when `taskkill` reports no such process (exit 128); Windows with a positive pid: `process.kill(pid, signal)`. Same contract as PR 08's Deno body; PR 14b's `process-group.test.ts` pins it on Windows CI.
- `writeStdoutSync`/`writeStderrSync`: loop until every byte is written (`EAGAIN` waits 1 ms with `Atomics.wait` and retries; with blocking stdio it does not occur); a 0-byte write returns 0 and does not throw.
- `exit(code)`: `process.exitCode = code; process.exit(code)`, with stdio made blocking at module load (see the decision above), so output written before `exit()` reaches a pipe in full.
- Broken pipe: an `EPIPE` on stdout or stderr ends the process with `process.exitCode ?? 0` and no message (the reader of `quarto inspect | head -c 1` went away; PR 14b's `inspect-pipe.test.ts` pins "no EPIPE crash" and the exit code).
- `onSignal(signal, handler)`: `process.on(signal, handler)`. On Windows `SIGTERM` listeners never fire (Node and Deno alike); `SIGINT` fires on Ctrl-C.
- `isTerminal(stream)`: `isatty(0|1|2)`.
- `execPath()`: `process.execPath`, the executable running the current process and nothing more: Node, or the Deno tool under PR 33's `QUARTO_RUNTIME=deno` (the bundle on Deno). It is not "a Node binary": `src/` code that spawns Node uses `architectureToolsPath("node")`, code that spawns Deno uses `requireDenoToolBinary()` (PR 33, "Dual-runtime combinations until PR 37", which also lists the legitimate callers: `package/src` and the `tests/` self-spawn helpers that branch on `runtime().name`, as this PR's batch-file test does).

### Files

- Modify: `src/deno_ral/process.ts` (entire body)
- Create: `src/deno_ral/batch-command-line.ts`
- Modify: `src/core/process.ts`: `execProcess` (stdin write and output readers reordered; chunk loop removed)
- Test: `tests/unit/ral/process-node-semantics.test.ts` (new), `tests/unit/ral/batch-command-line.test.ts` (new), `tests/unit/ral/process-stdin.test.ts` (new), `tests/unit/ral/process-exit-pipe.test.ts` (new), `tests/unit/ral/fixtures/exit-pipe-child.ts` (new fixture, not a test)
- Test: `tests/unit/ral/process.test.ts` (PR 08 contract; unchanged, must pass), `tests/unit/exec-process-stdin.test.ts` (existing #14445 regression), PR 14b's `tests/unit/process-group.test.ts`, `tests/smoke/inspect/inspect-pipe.test.ts`, `tests/smoke/jupyter/daemon.test.ts`, `tests/smoke/preview/preview-reload.test.ts` (must pass)
- Modify: `tools/node-bundle/deno-shim.mjs`, `tools/node-bundle/known-failures.json`

### Acceptance criteria

- `grep -c "Deno\." src/deno_ral/process.ts src/core/process.ts src/deno_ral/batch-command-line.ts` → `0` for each.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') unit/exec-process-stdin.test.ts unit/windows-exec.test.ts unit/process-group.test.ts` passes on Deno (Linux, macOS, Windows CI).
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` passes on Linux and Windows (the `node-unit` job) with no `process*` or `batch-command-line` entry in the list.
- `process-exit-pipe.test.ts` shows on Node: 2 MiB written then `exit(7)` reaches `wc -c` in full with status 7, and through `head -c 1` the process ends with status 0 (the broken-pipe rule of the vocabulary: EPIPE ends the process with `process.exitCode ?? 0`, and `exit(7)` has not run yet when the write fails) and no `EPIPE` in stderr.
- The CVE vectors in `batch-command-line.test.ts` round-trip unchanged through a forwarding `.cmd` on Windows, and no injected command runs.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-r.test.ts smoke/render/render-stdout.test.ts $(find smoke/jupyter/ -name '*.test.ts') smoke/inspect/inspect-pipe.test.ts smoke/preview/preview-reload.test.ts` passes.
- `quarto run --dev tools/check-runtime-boundary.ts` stays at zero; `node tools/node-bundle/build.mjs --check-shim` → `0 missing`, no `unused` list.

## Plan

### Task 1: Semantics tests for the layer

**Files:**
- Create: `tests/unit/ral/process-node-semantics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * process-node-semantics.test.ts
 *
 * Spawn-failure, exit-status, environment and stdio semantics of
 * src/deno_ral/process.ts that differ between Deno.Command and
 * node:child_process.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects, assertThrows } from "../../asserts.ts";
import { isWindows, runtime } from "../../../src/deno_ral/platform.ts";
import { isNotFound } from "../../../src/deno_ral/errors.ts";
import { env } from "../../../src/deno_ral/env.ts";
import {
  exec,
  execPath,
  execSync,
  isTerminal,
  spawn,
  writeStderrSync,
  writeStdoutSync,
} from "../../../src/deno_ral/process.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { removeSync } from "../../../src/deno_ral/fs.ts";

// A JavaScript one-liner that runs under `deno eval` and `node -e` alike
// (process is a global on both runtimes).
function evalArgs(code: string): string[] {
  return runtime().name === "deno" ? ["eval", code] : ["-e", code];
}

unitTest("process - spawn of a missing executable rejects status with ENOENT, does not throw", async () => {
  const child = spawn("quarto-rt28-definitely-missing", { stdout: "piped", stderr: "piped" });
  let caught: unknown;
  try {
    await child.status;
  } catch (e) {
    caught = e;
  }
  assert(isNotFound(caught), `expected ENOENT, got ${caught}`);
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

unitTest("process - env is merged over the inherited environment; clearEnv replaces it", async () => {
  const dir = makeTempDirSync({ prefix: "rt28-cwd-" });
  // HOME (POSIX) / USERPROFILE (Windows) is always inherited and never passed explicitly below.
  const homeVar = isWindows ? "USERPROFILE" : "HOME";
  const probe = `process.stdout.write([process.cwd(), process.env.RT28 ?? "", String(process.env.PATH !== undefined || process.env.Path !== undefined), String(process.env.${homeVar} !== undefined)].join("|"))`;
  try {
    const merged = await exec(execPath(), { args: evalArgs(probe), cwd: dir, env: { RT28: "yes" } });
    const [cwd1, rt28, hasPath, hasHome] = new TextDecoder().decode(merged.stdout).split("|");
    assert(cwd1.replaceAll("\\", "/").endsWith(dir.replaceAll("\\", "/").split("/").pop()!));
    assertEquals([rt28, hasPath, hasHome], ["yes", "true", "true"], "the override is added and the parent environment kept");
    const cleared = await exec(execPath(), {
      args: evalArgs(probe),
      env: { RT28: "only", PATH: env.get("PATH") ?? "", ...(isWindows ? { SystemRoot: env.get("SystemRoot") ?? "" } : {}) },
      clearEnv: true,
    });
    const [, rt28b, , hasHomeB] = new TextDecoder().decode(cleared.stdout).split("|");
    assertEquals([rt28b, hasHomeB], ["only", "false"], "clearEnv drops inherited variables");
  } finally {
    removeSync(dir, { recursive: true });
  }
});

unitTest("process - on Windows an env override replaces the inherited variable regardless of case", async () => {
  if (!isWindows) return;
  const out = await exec(execPath(), {
    args: evalArgs("process.stdout.write(process.env.PATH)"),
    env: { path: `C:\\rt28-marker;${env.get("PATH") ?? ""}` },
  });
  assert(new TextDecoder().decode(out.stdout).startsWith("C:\\rt28-marker;"));
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

unitTest("process - isTerminal is a boolean; 0-byte writes return 0", async () => {
  for (const s of ["stdin", "stdout", "stderr"] as const) assertEquals(typeof isTerminal(s), "boolean");
  assertEquals(writeStdoutSync(new Uint8Array(0)), 0);
  assertEquals(writeStderrSync(new Uint8Array(0)), 0);
});
```

(`runtime()` reports the real runtime since PR 27b, including inside PR 26's test bundles. `process` is a global on Deno 2 and Node; referencing it in a child's source string is not a `Deno.*` use.)

- [ ] **Step 2: Run it and see it fail**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process-node-semantics.test.ts; cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/process-node-semantics.test.ts
```
Expected on Deno: `spawn of a missing executable …` fails (Deno's `Command.spawn()` throws synchronously); the signal/code case may fail (`code` differs). On Node (shim `Deno.Command`): the missing-executable case passes, the Windows env-case test fails on the Windows `node-unit` job (the shim spreads `process.env` first).

- [ ] **Step 3: Commit the test**

```bash
git add tests/unit/ral/process-node-semantics.test.ts
git commit -m "tests: pin node:child_process semantics for deno_ral/process"
```

### Task 2: Batch-file escaping (`batch-command-line.ts`)

**Files:**
- Create: `tests/unit/ral/batch-command-line.test.ts`
- Create: `src/deno_ral/batch-command-line.ts`

- [ ] **Step 1: Write the failing test (string vectors, every OS)**

The expected strings are Rust std's output for the same input (the CVE-2024-24576 fix Deno's `Command` applies; algorithm in `library/std/src/sys/pal/windows/args.rs`, `make_bat_command_line` and `append_bat_arg`).

```ts
/*
 * batch-command-line.test.ts
 *
 * cmd.exe command lines for .bat/.cmd files (BatBadBut, CVE-2024-24576 /
 * CVE-2024-27980). String-level on every OS; end to end on Windows.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects, assertThrows } from "../../asserts.ts";
import { batchCommandLine } from "../../../src/deno_ral/batch-command-line.ts";
import { isWindows, runtime } from "../../../src/deno_ral/platform.ts";
import { exec, execPath } from "../../../src/deno_ral/process.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { existsSync, removeSync, writeTextFileSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";

const kScript = "C:\\t\\x.cmd";

unitTest("batchCommandLine - quotes and escapes like Rust std", async () => {
  const line = (...args: string[]) => batchCommandLine(kScript, args);
  assertEquals(line("plain"), `"C:\\t\\x.cmd" plain`);
  assertEquals(line("two words"), `"C:\\t\\x.cmd" "two words"`);
  assertEquals(line("a&b"), `"C:\\t\\x.cmd" "a&b"`);
  assertEquals(line("a^b|c<d>e"), `"C:\\t\\x.cmd" "a^b|c<d>e"`);
  assertEquals(line("%PATH%"), `"C:\\t\\x.cmd" "%%cd:~,%PATH%%cd:~,%"`);
  assertEquals(line('he said "hi"'), `"C:\\t\\x.cmd" "he said ""hi"""`);
  assertEquals(line('"&echo INJECTED'), `"C:\\t\\x.cmd" """&echo INJECTED"`);
  assertEquals(line("trailing\\"), `"C:\\t\\x.cmd" "trailing\\\\"`);
  assertEquals(line(""), `"C:\\t\\x.cmd" ""`);
  assertEquals(line("C:\\dir\\file.qmd", "--to", "html"), `"C:\\t\\x.cmd" C:\\dir\\file.qmd --to html`);
});

unitTest("batchCommandLine - rejects what cmd.exe cannot carry", async () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return (e as { code?: string }).code;
    }
    return "no error";
  };
  assertEquals(code(() => batchCommandLine(kScript, ["a\nb"])), "EINVAL");
  assertEquals(code(() => batchCommandLine(kScript, ["a\rb"])), "EINVAL");
  assertEquals(code(() => batchCommandLine(kScript, ["a\0b"])), "EINVAL");
  assertEquals(code(() => batchCommandLine('C:\\bad"name.cmd', [])), "EINVAL");
  assertEquals(code(() => batchCommandLine("C:\\dir\\", [])), "EINVAL");
});

// A forwarding .cmd hands its arguments (%*) to a script that prints them as JSON.
// The vectors are the BatBadBut ones: shell metacharacters, %VAR% expansion,
// quote breaking, trailing backslash, empty argument.
const kVectors = ["plain", "two words", "a&b", "a|b", "a^b", "50%", "%PATH%", "%%PATH%%", "<in", ">out", 'he said "hi"', '"&echo INJECTED', "trailing\\", ""];

unitTest("process - batch files receive their arguments verbatim and nothing is injected (Windows)", async () => {
  if (!isWindows) return;
  const dir = makeTempDirSync({ prefix: "rt28 batch " }); // a space in the path, on purpose
  const argvScript = join(dir, "argv.mjs");
  writeTextFileSync(argvScript, "console.log(JSON.stringify(process.argv.slice(2)));\n");
  const runner = runtime().name === "deno"
    ? `"${execPath()}" run --allow-all --no-config "${argvScript}"`
    : `"${execPath()}" "${argvScript}"`;
  const cmd = join(dir, "forward.cmd");
  writeTextFileSync(cmd, `@echo off\r\n${runner} %*\r\n`);
  const out = await exec(cmd, { args: kVectors, cwd: dir });
  assertEquals(out.code, 0, new TextDecoder().decode(out.stderr));
  const lines = new TextDecoder().decode(out.stdout).trim().split(/\r?\n/);
  assertEquals(lines.length, 1, `an injected command printed output: ${lines.join(" | ")}`);
  assertEquals(JSON.parse(lines[0]), kVectors);
  assert(!existsSync(join(dir, "out")), "no redirection happened");
  await assertRejects(() => exec(cmd, { args: ["a\nb"] }));
  removeSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/batch-command-line.test.ts`
Expected: `Module not found … src/deno_ral/batch-command-line.ts`.

- [ ] **Step 3: Implement**

```ts
/*
 * batch-command-line.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * cmd.exe command line for running a .bat/.cmd file with arguments that the
 * batch file receives verbatim. Port of Rust std's make_bat_command_line /
 * append_bat_arg (the CVE-2024-24576 "BatBadBut" fix), which is what Deno's
 * Command does on Windows; Node refuses to spawn batch files without a shell
 * (CVE-2024-27980) and does not escape for cmd.exe. Used by process.ts only.
 */

function invalid(message: string): Error {
  return Object.assign(new Error(message), { code: "EINVAL" });
}

// ASCII characters that never need quoting; everything else ASCII forces
// quotes ("assume all ASCII symbols must be quoted unless known to be good").
const kUnquoted = /^[A-Za-z0-9#$*+\-./:?@\\_]$/;

function appendArg(arg: string): string {
  if (/[\r\n\0]/.test(arg)) {
    // A newline would end the cmd.exe command; NUL truncates it.
    throw invalid("batch file arguments are invalid (CR, LF or NUL)");
  }
  let quote = arg.length === 0 || arg.endsWith("\\");
  for (const ch of arg) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80 ? !kUnquoted.test(ch) : /\p{Cc}/u.test(ch)) quote = true;
  }
  let out = "";
  let backslashes = 0;
  for (const ch of arg) {
    if (ch === "\\") {
      backslashes++;
      out += ch;
      continue;
    }
    if (ch === '"') {
      // n backslashes before a quote become 2n, and the quote is doubled.
      out += "\\".repeat(backslashes) + '"';
    } else if (ch === "%") {
      // %VAR% must not expand: "%" becomes "%%cd:~,%", an empty substring of
      // the always-defined %cd% variable, which leaves a literal "%".
      out += "%%cd:~,";
    }
    backslashes = 0;
    out += ch;
  }
  return quote ? `"${out}${"\\".repeat(backslashes)}"` : out;
}

export function batchCommandLine(script: string, args: string[]): string {
  if (script.includes('"') || script.endsWith("\\")) {
    throw invalid(`batch file path may not contain '"' or end with '\\': ${script}`);
  }
  return [`"${script}"`, ...args.map(appendArg)].join(" ");
}
```

- [ ] **Step 4: Run the string tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/batch-command-line.test.ts`
Expected: the two string tests pass on every OS; the Windows end-to-end case passes on Windows CI only after Task 3 (it runs through `exec`; on Deno it already passes because Deno's `Command` escapes the same way).

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/batch-command-line.ts tests/unit/ral/batch-command-line.test.ts
git commit -m "deno_ral: BatBadBut-safe cmd.exe command lines for .bat/.cmd (Rust std algorithm)"
```

### Task 3: Rewrite `src/deno_ral/process.ts`

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
 * compat). See dev-docs/runtime-migration/_TEMPLATE.md for the interface and
 * dev-docs/runtime-migration/28-ral-process-on-node-apis.md for the decisions
 * (batch-file escaping, blocking stdio for exit(), process-group kill).
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
import { batchCommandLine } from "./batch-command-line.ts";
import { runtime } from "./platform.ts";

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
  /** POSIX: new process group (setsid); Windows: CREATE_NEW_PROCESS_GROUP. */
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
const kIsWindows = nodeProcess.platform === "win32";

// SPIKES.md, Spike #2 (d): whether Deno 2.9's node:child_process honours
// windowsVerbatimArguments. true = it does (the batch path below is used on
// both runtimes). If the spike recorded that it does not, set this to false:
// on Deno the .bat/.cmd file is then spawned directly and Deno's Rust Command
// applies the same escaping itself.
const kDenoHonoursVerbatim = true;
const kBatchThroughCmd = runtime().name !== "deno" || kDenoHonoursVerbatim;

// ---------------------------------------------------------------- stdio
// Deno writes stdout/stderr synchronously; Node's pipe and socket handles are
// asynchronous on POSIX, so process.exit() after a large write loses the
// queued tail (verified: 4 MiB written, 65,536 bytes delivered). Making the
// handles blocking restores Deno's model: every write completes before the
// next statement, and exit() never truncates. Files are synchronous already,
// and Windows pipes are synchronous in Node.
function makeStdioBlocking(): void {
  for (const stream of [nodeProcess.stdout, nodeProcess.stderr]) {
    // deno-lint-ignore no-explicit-any
    const handle = (stream as any)._handle;
    if (handle && typeof handle.setBlocking === "function") handle.setBlocking(true);
  }
}

// The reader went away (`quarto inspect | head -c 1`): stop quietly, as a
// CLI tool does on SIGPIPE, keeping the exit code already set.
function exitOnBrokenPipe(e: NodeJS.ErrnoException): void {
  if (e.code === "EPIPE") nodeProcess.exit(nodeProcess.exitCode ?? 0);
  throw e;
}

if (runtime().name === "node") {
  makeStdioBlocking();
  nodeProcess.stdout.on("error", exitOnBrokenPipe);
  nodeProcess.stderr.on("error", exitOnBrokenPipe);
}

// ---------------------------------------------------------------- spawn options
function stdio(value: StdioOption | undefined, def: "pipe" | "inherit" | "ignore"): "pipe" | "inherit" | "ignore" {
  if (value === undefined) return def;
  return value === "piped" ? "pipe" : value === "null" ? "ignore" : "inherit";
}

function mergedEnv(options: SpawnOptions): Record<string, string | undefined> {
  if (options.clearEnv) return { ...(options.env ?? {}) };
  const base: Record<string, string | undefined> = { ...nodeProcess.env };
  if (kIsWindows && options.env) {
    // Windows variable names are case-insensitive: an override "PATH" must
    // replace the inherited "Path", not sit next to it.
    const overridden = new Set(Object.keys(options.env).map((k) => k.toUpperCase()));
    for (const k of Object.keys(base)) {
      if (overridden.has(k.toUpperCase())) delete base[k];
    }
  }
  return { ...base, ...(options.env ?? {}) };
}

function nodeOptions(options: SpawnOptions, mode: "spawn" | "exec"): NodeSpawnOptions {
  const defIn = mode === "spawn" ? "inherit" : "ignore";
  const defOut = mode === "spawn" ? "inherit" : "pipe";
  return {
    cwd: options.cwd,
    env: mergedEnv(options),
    stdio: [stdio(options.stdin, defIn), stdio(options.stdout, defOut), stdio(options.stderr, defOut)],
    windowsHide: true,
    signal: options.signal,
    detached: options.detached ?? false,
  };
}

// Node refuses .bat/.cmd without a shell (CVE-2024-27980); run them through
// cmd.exe with the escaped line from batch-command-line.ts and pass it
// verbatim (no Node quoting on top).
function command(cmd: string, args: string[]): [string, string[], NodeSpawnOptions] {
  if (!kIsWindows || !/\.(cmd|bat)$/i.test(cmd) || !kBatchThroughCmd) {
    return [cmd, args, {}];
  }
  return [
    nodeProcess.env.ComSpec ?? "cmd.exe",
    ["/e:ON", "/v:OFF", "/d", "/c", `"${batchCommandLine(cmd, args)}"`],
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
  return new Promise<ExecOutput>((resolve, reject) => {
    // Inside the executor: an invalid batch argument rejects instead of throwing.
    const [file, args, extra] = command(cmd, options.args ?? []);
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

// Output is never lost: stdio is blocking (makeStdioBlocking), so every
// write has completed before this runs.
export function exit(code?: number): never {
  nodeProcess.exitCode = code ?? 0;
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

/** The executable running this process (Node, or the Deno tool under QUARTO_RUNTIME=deno).
 *  Not the Node to spawn children on: use architectureToolsPath("node") for Node and
 *  requireDenoToolBinary() for Deno (PR 33, "Dual-runtime combinations until PR 37"). */
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
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "EAGAIN") {
        Atomics.wait(kEagainWait, 0, 0, 1);
        continue;
      }
      if (code === "EPIPE") nodeProcess.exit(nodeProcess.exitCode ?? 0);
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

/** Send a signal to a process; a negative pid addresses a process group on
 * POSIX, and the process tree rooted at -pid on Windows (taskkill /T /F). */
export function killProcess(pid: number, signal: Signal = "SIGTERM"): void {
  if (kIsWindows && pid < 0) {
    const r = nodeSpawnSync("taskkill", ["/PID", String(-pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    if (r.error) throw r.error;
    if (r.status === 128) {
      throw Object.assign(new Error(`taskkill: no process ${-pid}`), { code: "ESRCH" });
    }
    return;
  }
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

If PR 08 left other exports in the file (`grep -n "^export" src/deno_ral/process.ts` before overwriting), keep them with the same bodies on top of `exec`.

- [ ] **Step 2: Run the contract, semantics, batch and process-group tests**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts unit/ral/process-node-semantics.test.ts unit/ral/batch-command-line.test.ts unit/process-group.test.ts; cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/process.test.ts tests/unit/ral/process-node-semantics.test.ts tests/unit/ral/batch-command-line.test.ts
```
Expected: green on Deno; on Node either `no change` or `now passes on Node …` for `process` entries (removed in Task 6). PR 08's contract cases pass unchanged; if PR 08 added a case asserting that `spawn()` of a missing executable throws synchronously, replace it with the `status`-rejects case from Task 1 (PR 08 reserved that change for this PR). PR 14b's `process-group.test.ts` has two POSIX cases (`detached: true` makes the child a group leader; `killProcess(-pid)` ends the grandchild) and one Windows case (`killProcess(-pid)` runs `taskkill /T` on a detached PowerShell child and its `ping` grandchild, checked through `tasklist`; a second call throws `ESRCH`); each runs where it applies and is ignored elsewhere, so the Windows evidence for this PR's `killProcess` is the Windows case on the Windows `node-unit`/Deno jobs, not a green run of ignored tests. The Windows group membership itself is not observable and is not asserted (PR 14b, "Windows coverage").

- [ ] **Step 3: Commit**

```bash
git add src/deno_ral/process.ts
git commit -m "deno_ral/process: node:child_process body; batch escaping, blocking stdio, group kill"
```

### Task 4: `execProcess` reads output while writing stdin; no chunking

**Files:**
- Create: `tests/unit/ral/process-stdin.test.ts`
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

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process-stdin.test.ts`
Expected on Deno: may pass (Deno's pipes are more forgiving). Then on Node: `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/process-stdin.test.ts` → the `execProcess` case times out (300 s per-file timeout of the PR 26 runner; interrupt it after 30 s): the deadlock the next step removes.

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

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process-stdin.test.ts unit/exec-process-stdin.test.ts unit/ral/process.test.ts`
Expected: all green; `exec-process-stdin.test.ts` reports `0 unhandled rejections` for its four scenarios.

- [ ] **Step 5: Run the spawn-heavy smoke tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-typst-package-staging.test.ts smoke/render/render-r.test.ts smoke/render/render-stdout.test.ts $(find smoke/jupyter/ -name '*.test.ts') smoke/jupyter/daemon.test.ts unit/windows-exec.test.ts $(find unit/latexmk/ -name '*.test.ts')`
Expected: all green (Pandoc with piped stdin, Typst, Rscript through knitr, `render -o -`, the Jupyter kernel daemon from PR 14b's `daemon.test.ts`; `latexmk` tests exercise `safeWindowsExec` paths on Windows CI).

- [ ] **Step 6: Commit**

```bash
git add src/core/process.ts tests/unit/ral/process-stdin.test.ts
git commit -m "execProcess: read child output while writing stdin; drop 4 KB chunking"
```

### Task 5: `exit()` loses nothing on a pipe; a closed reader ends quietly

**Files:**
- Create: `tests/unit/ral/fixtures/exit-pipe-child.ts`
- Create: `tests/unit/ral/process-exit-pipe.test.ts`

- [ ] **Step 1: Write the fixture**

```ts
/*
 * exit-pipe-child.ts
 *
 * Fixture for process-exit-pipe.test.ts (not a test). Writes 2 MiB to stdout,
 * then calls exit(<code>). Mode "console": 1 MiB through console.log (an
 * asynchronous stream on Node pipes) and 1 MiB through writeStdoutSync.
 * Mode "layer": 2 MiB through writeStdoutSync (the path `quarto inspect` uses).
 * Usage: exit-pipe-child.ts <console|layer> <code>
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { args, exit, writeStdoutSync } from "../../../../src/deno_ral/process.ts";

const [mode, code] = args().slice(-2);
const line = "x".repeat(1023);
const bytes = new TextEncoder().encode(line + "\n");
if (mode === "console") {
  for (let i = 0; i < 1024; i++) console.log(line);
  for (let i = 0; i < 1024; i++) writeStdoutSync(bytes);
} else {
  for (let i = 0; i < 2048; i++) writeStdoutSync(bytes);
}
exit(Number(code));
```

- [ ] **Step 2: Write the failing test**

```ts
/*
 * process-exit-pipe.test.ts
 *
 * Vocabulary contract for exit(): output written before exit() reaches a pipe
 * in full (Node pipes are asynchronous on POSIX; process.exit() used to
 * truncate at 64 KiB), and a reader that goes away (`| head -c 1`) ends the
 * writer quietly, without an EPIPE stack trace. PR 14b's
 * tests/smoke/inspect/inspect-pipe.test.ts checks the same on `quarto inspect`.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "../../asserts.ts";
import { isWindows, runtime } from "../../../src/deno_ral/platform.ts";
import { exec } from "../../../src/deno_ral/process.ts";
import { layerScriptCommand } from "./layer-script.ts";

const kFixture = "unit/ral/fixtures/exit-pipe-child.ts";
const kTwoMiB = 2048 * 1024;

async function shell(script: string): Promise<{ out: string; err: string }> {
  const r = await exec("bash", { args: ["-c", script] });
  return { out: new TextDecoder().decode(r.stdout).trim(), err: new TextDecoder().decode(r.stderr) };
}
const quote = (parts: string[]) => parts.map((a) => `'${a.replaceAll("'", "'\\''")}'`).join(" ");

unitTest("process - exit() after 2 MiB on a pipe delivers every byte and the exit code", async () => {
  if (isWindows) return; // Node writes Windows pipes synchronously; the POSIX pipe is the case at risk
  const { cmd, args } = await layerScriptCommand(kFixture, ["console", "7"]);
  const r = await shell(`${quote([cmd, ...args])} | wc -c; echo "status=\${PIPESTATUS[0]}"`);
  const [bytes, status] = r.out.split("\n").map((s) => s.trim());
  assertEquals(Number(bytes), kTwoMiB, r.err);
  assertEquals(status, "status=7");
});

unitTest("process - a reader that closes early ends the writer quietly with status 0", async () => {
  if (isWindows) return;
  const { cmd, args } = await layerScriptCommand(kFixture, ["layer", "7"]);
  const r = await shell(`${quote([cmd, ...args])} | head -c 1 > /dev/null; echo "status=\${PIPESTATUS[0]}"`);
  assertEquals(r.out, "status=0");
  assert(!/EPIPE|Broken pipe|BrokenPipe/i.test(r.err), `no broken-pipe error expected, got: ${r.err}`);
  if (runtime().name === "node") {
    // console.log's stream reports EPIPE asynchronously; the handler ends the process the same way.
    const { cmd: c2, args: a2 } = await layerScriptCommand(kFixture, ["console", "7"]);
    const r2 = await shell(`${quote([c2, ...a2])} | head -c 1 > /dev/null; echo "status=\${PIPESTATUS[0]}"`);
    assertEquals(r2.out, "status=0");
    assert(!/EPIPE/i.test(r2.err), r2.err);
  }
});
```

- [ ] **Step 3: Run it on both runtimes**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process-exit-pipe.test.ts; cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/process-exit-pipe.test.ts
```
Expected: green on both (verified against the Task 3 body on Node 22.22: `2097152` and `status=7`; `status=0` with an empty stderr for both modes through `head -c 1`). To see the test catch the bug, comment out `makeStdioBlocking()` in `src/deno_ral/process.ts` and rerun on Node: the first case reports far fewer bytes than 2,097,152. Restore the line.

- [ ] **Step 4: Run PR 14b's end-to-end checks**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/inspect/inspect-pipe.test.ts smoke/render/render-stdout.test.ts unit/process-group.test.ts`
Expected: green (the `inspect | head -c 1` exit code and absence of an EPIPE crash, full `inspect | wc -c` output, `render -o -`, process-group kill). If `inspect-pipe.test.ts` pinned a non-zero exit code for the broken pipe (Deno 2.9's `BrokenPipe` behaviour at the time PR 14b recorded it), change its expectation to `0` in this PR, on both runtimes, and say so in the PR description: a reader that stops reading is not an error of the command, and the layer now behaves the same on Deno and Node.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/ral/fixtures/exit-pipe-child.ts tests/unit/ral/process-exit-pipe.test.ts
git commit -m "tests: exit() drains piped stdout; broken pipe ends quietly"
```

### Task 6: Node run, shim and known-failures shrink

**Files:**
- Modify: `tools/node-bundle/deno-shim.mjs`, `tools/node-bundle/known-failures.json`

- [ ] **Step 1: Check the Windows quoting callers still go through `safeWindowsExec`**

Run: `grep -rn "requireQuoting" src/ --include=*.ts | grep -v "windows.ts"`
Expected: only `src/command/render/latexmk/texlive.ts`, `src/core/shell.ts`, `src/core/zip.ts`, each passing the quoted array to `safeWindowsExec` (which writes a `.bat` and runs `cmd /c <file>`; `cmd` is not a batch file, so the layer spawns it directly). If any caller passes `requireQuoting(...).args` straight to `execProcess` with a `.bat`/`.cmd` program, its quotes would now be escaped a second time: route it through `safeWindowsExec` like the others and add a case to `tests/unit/windows-exec.test.ts`.

- [ ] **Step 2: Rebuild, shrink the shim, render on Node**

Run:
```bash
npm ci && node tools/node-bundle/build.mjs --check-shim
tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd
tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/jupyter.qmd
```
Expected: `0 missing` and an `unused` list (candidates: `Command`, `exit`, `execPath`, `pid`, `args`, `cwd`, `chdir`, `addSignalListener`, `removeSignalListener`, `kill`, `stdout`, `stderr`, `stdin`, `isatty`); members still referenced by `src/resources/**/*.js` (`julia-engine.js` uses `Deno.Command`) are not listed and stay. Delete the listed `Deno.<name> = ...` lines and the helpers only they used (`ChildProcess`, `stdio`, `spawnOptions`, `windowsCommand`, `batchCommandLine`, `exitStatus`, `lazy`), rebuild to confirm `0 missing` and no `unused` list, then both renders succeed (`jupyter.qmd` exercises the kernel daemon spawn with piped stdin).

- [ ] **Step 3: Remove the fixed known failures**

Run: `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/`
Expected: `now passes on Node, remove it …` for the `process` entries (exit 1). Delete them (Linux; Windows from this branch's `node-unit` run), rerun, `no change`, exit 0. A failure in the new files on Node is a bug in this PR: fix it, do not list it.

- [ ] **Step 4: Commit**

```bash
git add tools/node-bundle/deno-shim.mjs tools/node-bundle/known-failures.json
git commit -m "node-bundle: drop shim members and known failures made obsolete by deno_ral/process"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` → green.
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` → `no change`, exit 0, and no `process*`/`batch-command-line` entry remains.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/exec-process-stdin.test.ts unit/windows-exec.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/process-group.test.ts` → green (spawn, kill, stderr capture, fake executables, group kill).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-r.test.ts smoke/render/render-stdout.test.ts $(find smoke/jupyter/ -name '*.test.ts') smoke/inspect/inspect-pipe.test.ts smoke/preview/preview-reload.test.ts` → green (knitr through `render-r`, the Jupyter daemon through PR 14b's `daemon.test.ts`, the preview server's external process through `preview-reload.test.ts`).
- `grep -c "Deno\." src/deno_ral/process.ts src/core/process.ts src/deno_ral/batch-command-line.ts` → `0`, `0`, `0`.
- `quarto run --dev tools/check-runtime-boundary.ts` → zero.
- `node tools/node-bundle/build.mjs --check-shim` → `0 missing`, no `unused` list; both spike renders succeed.
- Manual: `package/dist/bin/quarto render tests/docs/smoke-all/2023/02/08/4272.qmd` (large Pandoc stdin) and `package/dist/bin/quarto check` (many spawns, version parsing from stdout); `tools/node-bundle/quarto-node inspect tests/docs/smoke-all/book/simple | head -c 1; echo " status=${PIPESTATUS[0]}"` prints one character and `status=0`.
- Windows CI (the normal Deno matrix and the PR 26 `node-unit` Windows job) runs the batch end-to-end vectors and the env-case test; they are skipped elsewhere.

## Review checklist

- [ ] `spawn()` throws synchronously only for an invalid batch argument; `status` rejects with an ENOENT-coded error for a missing executable; `exec` rejects (never throws); `execSync` throws.
- [ ] Output readers are started before the stdin write in `execProcess`; no `kWindowSize`, no chunk loop; the #14445 swallow is kept (write **and** close inside one try/catch, logged at debug level).
- [ ] `.bat`/`.cmd` route through `cmd.exe /e:ON /v:OFF /d /c "<batchCommandLine(...)>"` with `windowsVerbatimArguments: true`; `batchCommandLine` matches Rust std (string vectors) and the Windows end-to-end vectors round-trip with nothing injected; `kDenoHonoursVerbatim` holds the value Spike #2 (d) recorded.
- [ ] `detached` maps to Node `detached: true`; `killProcess(-pid)` uses `process.kill` on POSIX and `taskkill /T /F` on Windows.
- [ ] `env` overrides are merged over the inherited environment, case-insensitively on Windows; `clearEnv` produces exactly `options.env`.
- [ ] Stdio is made blocking at module load on Node; `exit()` sets `process.exitCode` and exits; EPIPE on stdout/stderr (stream or `writeSync`) exits quietly with the current exit code; 0-byte writes return 0.
- [ ] `exitStatus` maps signals to `128 + n` and keeps the signal name; `AbortError` does not reject `status`.
- [ ] No `Deno.` left in the three files; the shim lost members, none added; `known-failures.json` lost entries, none added.
- [ ] `execPath()` carries the doc comment (the executable running this process; Node children use `architectureToolsPath("node")`), and no `src/` caller in this PR spawns Node on it.

## Risks and rollback

- **`_handle.setBlocking` is a Node-internal API.** It has existed on pipe, TCP and TTY handles since Node 0.x and is what Node itself relies on for synchronous TTYs; it is guarded (`typeof … === "function"`), so a Node without it falls back to asynchronous pipes and the `process-exit-pipe.test.ts` case fails on the `node-unit` job, which is the signal. Cost of blocking stdio: a stalled reader blocks Quarto, exactly as on Deno today.
- **Blocking stdio and the event loop.** A slow terminal or pipe reader now slows Quarto's own progress output instead of buffering it in memory; this is Deno's behaviour and the one users have.
- **Pipe back-pressure differences** could surface as hangs in a spawn-heavy path (Jupyter daemon, Typst gather). The new tests, PR 14b's `daemon.test.ts` and `smoke/jupyter/` cover the known cases. Rollback: `git revert` the `execProcess` commit restores the old ordering (still correct on Deno).
- **Windows batch escaping.** A batch file receives `"a""b"` for an argument `a"b` (cmd.exe has no other way to carry a quote inside a quoted argument); a batch file that re-parses `%1` itself sees the doubled quote, as it does under Deno today. Quarto's batch spawns (`quarto.cmd`, `npm.cmd`, `tlmgr.bat` via `safeWindowsExec`) pass paths and flags.
- **Deno compat (Spike #2 (d)).** If Deno 2.9 ignores `windowsVerbatimArguments`, `kDenoHonoursVerbatim = false` makes Deno spawn batch files directly (Rust escaping) and Node use the `cmd.exe` line; if Deno cannot kill a process group with `process.kill(-pid)`, the spike's outcome table adds a `ps`-based tree walk to `killProcess` on Deno, tested by PR 14b's `process-group.test.ts`.
- **Pre-existing: `safeWindowsExec`** writes its command line into a `.bat` without escaping (`%VAR%` expands, `"` is not escaped). Its four callers pass Quarto-controlled paths; out of scope here, filed as a follow-up issue linked from the PR.
- **`process.exit` on Deno** skips Deno's own `unload` handlers in some versions; `src/core/cleanup.ts` runs Quarto's cleanup before calling `exit()`, so nothing user-visible depends on them.
- **Whole-PR rollback:** revert the commits; no caller changed.

## Decisions needed

None. Batch escaping (Rust's algorithm in the layer, not `safeWindowsExec`) and draining by blocking stdio are decided in the Spec with their reasons; the one runtime-dependent constant (`kDenoHonoursVerbatim`) is set from Spike #2 (d).
