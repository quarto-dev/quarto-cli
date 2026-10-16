# PR 14b: Coverage first: preview reload (document and website), Jupyter daemon, inspect through a pipe, process-group and Windows tree kill

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the five automated tests that the riskiest Phase 1 and Phase 2 rewrites are gated on (preview server end to end for a single document and for a website project, Jupyter kernel daemon reuse, `quarto inspect` through a pipe, killing a process tree: through its group on POSIX, through `taskkill /T` on Windows), all passing on Deno on the three CI OSes before any of those rewrites starts.
**Phase:** 1, before PR 15. **Depends on:** PR 02 (`tests/asserts.ts`; the `tests` ratchet scope), PR 08 (`spawn`, `exec`, `killProcess`, `SpawnOptions.detached` in `src/deno_ral/process.ts`), PR 09 (`src/deno_ral/temp.ts`, `fs.ts` read/write/remove/stat). **Unblocks:** PR 15, PR 16, PR 17, PR 28, PR 29.
**Branch:** `rt/14b-coverage-first`.
**Suggested executor:** Opus. Five end-to-end tests around child processes, sockets and timing; the hard part is making them deterministic (mtime granularity, bind races, zombies, Windows tree kills), not writing them.
**Size:** S. 5 new test files, 2 new test helper modules, 1 new fixture document, 1 rules file edited.
**Ships on:** Deno; the existing test suite must stay green. These tests are coverage, not features: every one passes on `main` once PRs 02, 08 and 09 are in, on Linux, macOS and Windows (the suite runs on `ubuntu-latest` and `windows-latest` per PR, `test-smokes.yml`).

## Spec

### Context

`REVIEW-2026-10-15.md` S4: PRs 15, 16, 17, 28 and 29 rewrite the preview server, the WebSocket reload channel, the file watchers, the Jupyter kernel TCP transport and process-tree handling, and each cited a test that does not exist. `.claude/rules/preview/overview.md` states that no automated test starts the preview server. Every Jupyter smoke test passes `--no-execute-daemon` (`tests/smoke/jupyter/cache.test.ts:22,26,64,68`, `issue-10097.test.ts:19`, `issue-11990.test.ts:23`, `issue-12374.test.ts:17`), and the default (`src/execute/jupyter/jupyter.ts:475-482`) is `isInteractiveSession() && !runningInCI()`, false in CI, so `connectToKernel`/`denoConnectToKernel` (`src/execute/jupyter/jupyter-kernel.ts:374-491`) run in no test. S6: Deno writes stdout synchronously, Node's pipes are asynchronous and `process.exit()` truncates them, so `quarto inspect | head`/`| jq` is a regression surface with no test. S8 and PR 28: the preview server's external-process stop (`src/preview/preview-server.ts:73-79`, `Deno.kill(-process.pid, "SIGTERM")`) and `tests/quarto-cmd.ts:206-330` (`killProcessTree`, whose comment says avoiding its race "would require process-group support") depend on process-group semantics that PR 28 reimplements on `node:child_process`.

Facts the tests rely on (verified on `main` at `b86f98d`):

- `quarto preview <file> --no-browser --port <p>` renders, prints `Browse at http://localhost:<p>/` through `info()` on stderr (`src/core/previewurl.ts:65`), then binds `Deno.serve` on `127.0.0.1:<p>` (`src/command/preview/preview.ts:288`; `host` defaults to `kLocalhost` = `127.0.0.1`, `src/core/port-consts.ts`). Any request with `Upgrade: websocket` on any path reaches `httpDevServer` (`src/core/http-devserver.ts:115-117`, `preview.ts:772-773`).
- On a source change the polling watcher (`src/core/watch.ts`, interval `max(200, files)` ms, mtime comparison) re-renders; the render broadcasts `render:start:<lastRenderTime>` and `render:stop:<success>` (`http-devserver.ts:77-84`), and the output-file watch then sends `reload` (`http-devserver.ts:182-187`, queued behind the render in `preview.ts:628-636`). `log:<json>` messages are interleaved.
- `SIGTERM` runs `abend` → `exitWithCleanup(1)` (`src/core/main.ts:33-37,79-81`). The POSIX launcher `package/scripts/common/quarto:203-209` runs Deno as a child without `exec`, so signalling only the launcher's pid would orphan Deno; the test signals the process group.
- `messageStartingKernel` prints `Starting <kernelspec> kernel...` only when a new kernel daemon is started (`jupyter-kernel.ts:417-420,493-495`); a render that reaches an existing daemon prints nothing of the kind. `--execute-daemon` consumes the next argument as seconds (`src/command/render/flags.ts:234-240`); `--no-execute-daemon` makes the render one-shot, and the one-shot path first sends `abort` to an existing daemon (`jupyter-kernel.ts:37,151-172`).
- `quarto inspect <dir>` writes its JSON with one `Deno.stdout.writeSync` (`src/command/inspect/cmd.ts:58-66`); `quarto inspect <dir> <file>` writes the same bytes (`outputJson + "\n"`) to a file.
- Deno 2.7.14's `Deno.Command` option `detached: true` calls `setsid()` in the child on POSIX and sets `DETACHED_PROCESS`/new group on Windows (`ext/process/lib.rs` at `v2.7.14`, lines 561-562 and 685-689), so PR 08's `SpawnOptions.detached` exists on Deno today and a process group can be created without any new runtime feature.
- The largest project under `tests/docs` by number of inputs is `tests/docs/smoke-all/typst/margin-layout` (86 `.qmd` files; `find tests/docs -name _quarto.yml` then counting inputs per directory). Its `.quarto/` is gitignored (`tests/docs/smoke-all/typst/margin-layout/.gitignore:1`).
- A website project previews through `src/project/serve/serve.ts`, not `preview.ts`: it renders the whole project, prints `Watching files for changes` then `Browse at http://localhost:<p>/` (`serve.ts:328,366-370`, the same `printBrowsePreviewMessage`), serves the output directory and answers WebSocket upgrades through `previewControlChannelRequestHandler` → `watcher.handle(req)` (`serve.ts:409-418,801`). A change to an input re-renders the project and `devServer.reloadClients(target)` sends `reload<target>` (`src/project/serve/watch.ts:272-335`, debounced 100 ms); `render:start`/`render:stop` come from the same `HttpDevServerRenderMonitor` as the single-document path (`http-devserver.ts:76-84`). The server writes its pid to `<project>/.quarto/preview/lock` and removes it on cleanup (`serve.ts:896-926`).
- The Windows launcher `package/scripts/windows/quarto.cmd:168-171` runs `deno.exe` as a child of `cmd.exe` (there is no `exec` in batch), so a kill addressed to the launcher's pid orphans Deno, exactly as on POSIX. `tests/quarto-cmd.ts:213-257` already ends test processes with `taskkill /PID <pid> /T /F`. `taskkill /T` walks the parent-pid tree at the moment it runs (it does not use process groups, so it works whether or not the root was spawned `detached`); it exits 128 when the pid does not exist. `tasklist /FI "PID eq <pid>" /NH /FO CSV` prints one CSV row for a live process and `INFO: No tasks are running which match the specified criteria.` otherwise, exit 0 in both cases. `SIGTERM` listeners never fire on Windows (PR 08, `onSignal`), so Quarto's `abend` → `exitWithCleanup(1)` path cannot be driven from a test there.
- PR 08's `killProcess(pid, signal)` runs `taskkill /PID <-pid> /T /F` for a negative pid on Windows (the tree rooted at `-pid`) and `Deno.kill` otherwise; `preview-server.ts` stops the external preview server with `killProcess(-pid)` on every OS. PR 28 keeps that contract on `node:child_process` (`nodeSpawnSync("taskkill", ...)`), which is why the Windows case below is PR 28's Windows gate.

#### Windows coverage (review R10, triage A5)

The first draft ignored five of the six tests on Windows and PRs 28 and 34 still cited the suite as Windows evidence. This version runs the preview tests (document and website) and a Windows process-tree test on Windows, and states what has no Windows equivalent:

| POSIX assertion | Windows | Mechanism |
|---|---|---|
| The grandchild is in the group the detached child leads (`ps -o pgid=`) | no equivalent: Windows process groups are not observable from `tasklist`; the tree kill is asserted instead | n/a |
| `killProcess(-pid, "SIGKILL")` ends the group; the grandchild is gone (`ps -o stat=`) | `killProcess(-pid)` runs `taskkill /PID <pid> /T /F`; the grandchild is gone (`tasklist /FI "PID eq"`) | different mechanism, same test file, `process-group.test.ts` |
| Without `detached` the child stays in the caller's group | no equivalent (same reason as the first row) | n/a |
| `SIGTERM` to the preview's group → `abend` → exit 1, port released | `killProcess(-pid)` ends the `cmd.exe` + `deno.exe` tree with `taskkill /F`; exit is non-zero, port released. The graceful `abend` path is POSIX-only coverage | different mechanism, same test, `preview-reload.test.ts` and `preview-project-reload.test.ts` |
| `quarto inspect \| head -c 1` exits 0 without EPIPE; `\| wc -c` sees every byte | no equivalent in this PR (needs `bash`, `head`, `wc`); Node writes Windows pipes synchronously, PR 28's `process-exit-pipe.test.ts` says so and skips there too | n/a |

The Jupyter daemon test and both preview tests are the same code on every OS.

### Scope

In:
- `tests/process-helpers.ts`: `waitFor`, `collectText`, `processGroupOf` (POSIX), `isProcessGone` (`ps` on POSIX, `tasklist` on Windows).
- `tests/smoke/preview/preview-helpers.ts`: `startPreview`, `connectWebSocket`, `closeWebSocket`, `stopPreview` (shared by the two preview tests).
- `tests/unit/process-group.test.ts` (3 tests: two POSIX group tests, one Windows tree-kill test).
- `tests/smoke/preview/preview-reload.test.ts` (1 test, every OS).
- `tests/smoke/preview/preview-project-reload.test.ts` (1 test, every OS: a generated two-page website).
- `tests/smoke/jupyter/daemon.test.ts` (1 test, every OS) and its fixture `tests/docs/jupyter/daemon/daemon.qmd`.
- `tests/smoke/inspect/inspect-pipe.test.ts` (2 tests, POSIX: the largest `tests/docs` project, and a generated project whose output is over 1 MiB so the pipe is guaranteed to fill).
- `.claude/rules/preview/overview.md`: the "Verifying a preview change" paragraph names the two preview tests.

Out:
- Windows for the pipe tests and the two POSIX process-group tests (`ignore: isWindows`, reasons in each file and in the table above): no `bash`/`head`/`wc`, and no observable process groups. Everything else runs on Windows.
- Browser-side reload (Playwright), `quarto preview` inside RStudio or VS Code, an external `serve:` command in a project (manual: `/quarto-preview-test` skill).
- Any change under `src/`.

### Interfaces

No `src/` interface changes. `tests/process-helpers.ts` (new):

```ts
/** Polls `predicate` every 100 ms; rejects with `describe()` in the message after `timeoutMs`. */
export function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  describe: () => string,
): Promise<void>;
/** Appends the decoded text of `stream` to `sink` until the stream ends. */
export function collectText(stream: ReadableStream<Uint8Array> | null, sink: string[]): Promise<void>;
/** POSIX only: process group id of `pid` (`ps -o pgid=`), undefined when the process is gone. */
export function processGroupOf(pid: number): Promise<number | undefined>;
/** True when `pid` no longer exists or is a zombie: `ps -o stat=` on POSIX,
 *  `tasklist /FI "PID eq <pid>" /NH /FO CSV` on Windows. */
export function isProcessGone(pid: number): Promise<boolean>;
```

`tests/smoke/preview/preview-helpers.ts` (new, shared by the two preview tests):

```ts
export interface PreviewRun {
  child: ChildProcess;
  port: number;
  /** stderr and stdout so far, for failure messages. */
  log: () => string;
  /** Resolves when both pipes have closed. */
  collected: Promise<void>;
}
/** Spawns `quarto preview <args> --no-browser --port <free port>` in `cwd` as a
 *  detached child and waits for "Browse at" on stderr (60 s). */
export function startPreview(cwd: string, args: string[]): Promise<PreviewRun>;
/** Connects a WebSocket client to the preview server, retrying until it accepts. */
export function connectWebSocket(url: string, timeoutMs: number): Promise<WebSocket>;
export function closeWebSocket(ws: WebSocket): Promise<void>;
/** Ends the preview: killProcess(-pid, "SIGTERM") (POSIX: the group; Windows:
 *  taskkill /T on the cmd.exe + deno.exe tree), waits for the exit status and
 *  asserts it is not success and that the port is released within 10 s. */
export function stopPreview(run: PreviewRun): Promise<void>;
```

Assumptions (stated so the executor can check them first): PR 08 landed `spawn(cmd, { args, cwd, env, clearEnv, stdin, stdout, stderr, detached })` returning `ChildProcess` (`pid`, `stdout`, `stderr`, `status: Promise<ExitStatus>`), `exec(...)` returning `ExecOutput`, `killProcess(pid, signal)` with a negative pid addressing a process group on POSIX and running `taskkill /PID <-pid> /T /F` on Windows; PR 09 landed `makeTempDirSync` in `src/deno_ral/temp.ts` and `writeTextFileSync`, `readTextFileSync`, `removeSync`, `statSync`, `mkdirSync`, `existsSync` in `src/deno_ral/fs.ts`; PR 02 landed `tests/asserts.ts` exporting at least `assert` and `assertEquals`. Check with `grep -n 'detached\|taskkill\|export function killProcess' src/deno_ral/process.ts` and `ls tests/asserts.ts src/deno_ral/temp.ts`. If `detached` or the `taskkill` branch is missing, PR 08 is incomplete: add them there (`detached: options.detached` passed to `new Deno.Command`; the Windows branch of `killProcess` as PR 08's Interfaces describe it) as a fix-up commit on PR 08's code before starting.

### Files

- Create: `tests/process-helpers.ts`
- Create: `tests/unit/process-group.test.ts`
- Create: `tests/smoke/preview/preview-helpers.ts`
- Create: `tests/smoke/preview/preview-reload.test.ts`
- Create: `tests/smoke/preview/preview-project-reload.test.ts`
- Create: `tests/smoke/jupyter/daemon.test.ts`
- Create: `tests/docs/jupyter/daemon/daemon.qmd`
- Create: `tests/smoke/inspect/inspect-pipe.test.ts`
- Modify: `.claude/rules/preview/overview.md` (section "Verifying a preview change")

### Acceptance criteria

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/process-group.test.ts smoke/preview/preview-reload.test.ts smoke/preview/preview-project-reload.test.ts smoke/jupyter/daemon.test.ts smoke/inspect/inspect-pipe.test.ts` prints `ok | 7 passed | 0 failed | 1 ignored` on Linux and macOS (the Windows tree-kill case is ignored there), and `ok | 4 passed | 0 failed | 4 ignored` on Windows (the two POSIX group cases and the two pipe cases are ignored there). Both preview tests, the daemon test and the Windows tree-kill test pass on Windows CI: this is the Windows evidence PRs 28 and 34 cite.
- Each test fails when the behaviour it covers is broken (Task 7 proves it once per test by a temporary local break, not committed; the Windows break runs on a Windows machine or in a CI run from a scratch branch).
- `grep -n 'Deno\.' tests/process-helpers.ts tests/unit/process-group.test.ts tests/smoke/preview/preview-helpers.ts tests/smoke/preview/preview-reload.test.ts tests/smoke/preview/preview-project-reload.test.ts tests/smoke/jupyter/daemon.test.ts tests/smoke/inspect/inspect-pipe.test.ts` prints nothing; `quarto run --dev tools/check-runtime-boundary.ts` passes without `--accept-tests-increase`.
- The suite run in CI (`test-smokes-parallel.yml`) is green on the three OSes with the new files included, and the Windows job's log shows the four Windows cases as passed, not ignored.

## Plan

### Task 1: Shared helpers

**Files:**
- Create: `tests/process-helpers.ts`

- [ ] **Step 1: Write the module**

```ts
/*
 * process-helpers.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Helpers for tests that drive long-running child processes (quarto
 * preview, process groups and trees). Built only on src/deno_ral/process.ts
 * so the same tests run on the Node harness (PR 31).
 */

import { isWindows } from "../src/deno_ral/platform.ts";
import { exec } from "../src/deno_ral/process.ts";

export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  describe: () => string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() > deadline) {
      throw new Error(`timed out after ${timeoutMs} ms: ${describe()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function collectText(
  stream: ReadableStream<Uint8Array> | null,
  sink: string[],
): Promise<void> {
  if (!stream) {
    return;
  }
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    sink.push(decoder.decode(chunk, { stream: true }));
  }
  sink.push(decoder.decode());
}

// POSIX only: Windows process groups are not observable from tasklist.
export async function processGroupOf(
  pid: number,
): Promise<number | undefined> {
  const out = await exec("ps", { args: ["-o", "pgid=", "-p", String(pid)] });
  const text = new TextDecoder().decode(out.stdout).trim();
  return out.success && text !== "" ? Number(text) : undefined;
}

export async function isProcessGone(pid: number): Promise<boolean> {
  if (isWindows) {
    // One CSV row per live process; otherwise an "INFO: No tasks are
    // running ..." line. Both exit 0, so look at the output.
    const out = await exec("tasklist", {
      args: ["/FI", `PID eq ${pid}`, "/NH", "/FO", "CSV"],
    });
    const text = new TextDecoder().decode(out.stdout);
    return !text.includes(`","${pid}",`);
  }
  const out = await exec("ps", { args: ["-o", "stat=", "-p", String(pid)] });
  const stat = new TextDecoder().decode(out.stdout).trim();
  // `ps -p` exits 1 when the pid does not exist; a zombie ("Z") is dead
  // but not yet reaped by its new parent.
  return !out.success || stat === "" || stat.startsWith("Z");
}
```

- [ ] **Step 2: Type-check it**

Run: `cd tests && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=../src/import_map.json process-helpers.ts` (on Apple Silicon the directory is `aarch64`)
Expected: `Check file:///.../tests/process-helpers.ts`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add tests/process-helpers.ts
git commit -m "tests: add process-helpers (waitFor, collectText, process group probes)"
```

### Task 2: Process-group kill

**Files:**
- Create: `tests/unit/process-group.test.ts`

- [ ] **Step 1: Write the test**

```ts
/*
 * process-group.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * A child started with `detached: true` leads a new process group and
 * killProcess(-pid) reaches its descendants. quarto preview stops external
 * preview servers this way (src/preview/preview-server.ts), and PR 28
 * reimplements spawn/killProcess on node:child_process against this test.
 *
 * POSIX (two cases): group membership through `ps -o pgid=`, group kill.
 * Windows (one case): there are no observable process groups, so the case
 * asserts the mechanism Quarto uses there, killProcess(-pid) running
 * `taskkill /PID <pid> /T /F` on the tree, and checks the grandchild is
 * gone through `tasklist`. The "without detached" case has no Windows
 * equivalent.
 */

import { assert, assertEquals } from "../asserts.ts";
import { unitTest } from "../test.ts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import {
  ChildProcess,
  killProcess,
  spawn,
} from "../../src/deno_ral/process.ts";
import {
  isProcessGone,
  processGroupOf,
  waitFor,
} from "../process-helpers.ts";

// `sh` starts `sleep 30` in the background, prints its pid, and waits for it.
const kScript = "sleep 30 & echo $!; wait";

interface Tree {
  child: ChildProcess;
  grandchild: number;
  drained: Promise<void>;
}

async function startTree(detached: boolean): Promise<Tree> {
  const child = spawn("sh", {
    args: ["-c", kScript],
    stdin: "null",
    stdout: "piped",
    stderr: "null",
    detached,
  });
  const reader = child.stdout!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (!text.includes("\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  const grandchild = Number(text.trim().split("\n")[0]);
  assert(
    Number.isInteger(grandchild) && grandchild > 0,
    `no grandchild pid in ${JSON.stringify(text)}`,
  );
  // Keep reading: `sleep` inherited the pipe, which closes when it dies.
  const drained = (async () => {
    while (!(await reader.read()).done) {
      // discard
    }
    reader.releaseLock();
  })();
  return { child, grandchild, drained };
}

async function stopTree(tree: Tree): Promise<void> {
  for (const pid of [tree.grandchild, tree.child.pid]) {
    try {
      killProcess(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
  await tree.child.status;
  await tree.drained;
}

unitTest(
  "process group - killProcess(-pid) on a detached child kills its grandchild",
  async () => {
    const tree = await startTree(true);
    try {
      assertEquals(
        await processGroupOf(tree.grandchild),
        tree.child.pid,
        "the grandchild should be in the group the detached child leads",
      );
      killProcess(-tree.child.pid, "SIGKILL");
      const status = await tree.child.status;
      assertEquals(status.success, false);
      assertEquals(status.signal, "SIGKILL");
      await waitFor(
        () => isProcessGone(tree.grandchild),
        5000,
        () => `grandchild ${tree.grandchild} survived the group kill`,
      );
    } finally {
      await stopTree(tree);
    }
  },
  { ignore: isWindows },
);

unitTest(
  "process group - without detached the child stays in the caller's group",
  async () => {
    const tree = await startTree(false);
    try {
      const group = await processGroupOf(tree.child.pid);
      assert(group !== undefined, "child vanished");
      assert(
        group !== tree.child.pid,
        `child ${tree.child.pid} unexpectedly leads its own group`,
      );
      assertEquals(await processGroupOf(tree.grandchild), group);
    } finally {
      await stopTree(tree);
    }
  },
  { ignore: isWindows },
);

// Windows: PowerShell starts `ping -n 31 127.0.0.1` (a 30 s sleep that needs
// no console), prints the grandchild's pid, and waits for it. `-WindowStyle
// Hidden` because the detached child has no console to inherit.
const kWindowsScript = [
  "$ErrorActionPreference = 'Stop'",
  "$p = Start-Process -PassThru -WindowStyle Hidden ping -ArgumentList '-n','31','127.0.0.1'",
  "[Console]::Out.WriteLine($p.Id)",
  "Wait-Process -Id $p.Id",
].join("; ");

async function startWindowsTree(): Promise<Tree> {
  const child = spawn("powershell", {
    args: ["-NoProfile", "-NonInteractive", "-Command", kWindowsScript],
    stdin: "null",
    stdout: "piped",
    stderr: "null",
    detached: true,
  });
  const reader = child.stdout!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (!text.includes("\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  const grandchild = Number(text.trim().split(/\r?\n/)[0]);
  assert(
    Number.isInteger(grandchild) && grandchild > 0,
    `no grandchild pid in ${JSON.stringify(text)}`,
  );
  const drained = (async () => {
    while (!(await reader.read()).done) {
      // discard
    }
    reader.releaseLock();
  })();
  return { child, grandchild, drained };
}

unitTest(
  "process tree - killProcess(-pid) on Windows ends the detached child and its grandchild (taskkill /T)",
  async () => {
    const tree = await startWindowsTree();
    try {
      assert(!(await isProcessGone(tree.grandchild)), "grandchild not running");
      // taskkill /PID <pid> /T /F: the tree rooted at the child. It walks
      // parent pids, so the same call also covers preview-server.ts, which
      // does not spawn detached on Windows.
      killProcess(-tree.child.pid, "SIGTERM");
      const status = await tree.child.status;
      assertEquals(status.success, false, "taskkill /F should end the child");
      await waitFor(
        () => isProcessGone(tree.grandchild),
        5000,
        () => `grandchild ${tree.grandchild} survived taskkill /T`,
      );
      // A second call must report the tree as gone, as PR 08 specifies.
      let code: string | undefined;
      try {
        killProcess(-tree.child.pid, "SIGTERM");
      } catch (e) {
        code = (e as { code?: string }).code;
      }
      assertEquals(code, "ESRCH", "killing a dead tree should throw ESRCH");
    } finally {
      await stopTree(tree);
    }
  },
  { ignore: !isWindows },
);
```

- [ ] **Step 2: Run it**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/process-group.test.ts`
Expected: `..` then `ok | 2 passed | 0 failed | 1 ignored` (Linux, macOS); `ok | 1 passed | 0 failed | 2 ignored` on Windows. This passes immediately: it is coverage of PR 08's behaviour, not a new feature. If the first test fails with `the grandchild should be in the group`, PR 08's `spawn` does not forward `detached` to `Deno.Command`; if the Windows case fails inside `killProcess` with a `Deno.kill` error, PR 08's `killProcess` has no `taskkill` branch; fix either in `src/deno_ral/process.ts` as described under Interfaces.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/process-group.test.ts
git commit -m "tests: cover process-group kill (POSIX) and taskkill /T tree kill (Windows) through killProcess(-pid)"
```

### Task 3: Preview server end to end (single document)

**Files:**
- Create: `tests/smoke/preview/preview-helpers.ts`
- Create: `tests/smoke/preview/preview-reload.test.ts`

- [ ] **Step 1: Write the helpers**

```ts
/*
 * preview-helpers.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Start, observe and stop `quarto preview` from a test, on every OS. The
 * preview is spawned detached and stopped with killProcess(-pid): on POSIX
 * that signals the process group (the launcher script does not exec the
 * runtime), on Windows it runs taskkill /T on the cmd.exe + deno.exe tree.
 */

import { assert } from "../../asserts.ts";
import { quartoDevCmd } from "../../utils.ts";
import { quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import { collectText, waitFor } from "../../process-helpers.ts";
import { findOpenPort, waitForPort } from "../../../src/core/port.ts";
import {
  ChildProcess,
  killProcess,
  spawn,
} from "../../../src/deno_ral/process.ts";

export const kHost = "127.0.0.1";

export interface PreviewRun {
  child: ChildProcess;
  port: number;
  log: () => string;
  collected: Promise<void>;
}

export async function startPreview(
  cwd: string,
  args: string[],
): Promise<PreviewRun> {
  // findOpenPort is synchronous until PR 15 makes it async; the await
  // keeps this line correct on both sides of that change.
  const port = await findOpenPort();
  const child = spawn(quartoDevCmd(), {
    args: ["preview", ...args, "--no-browser", "--port", String(port)],
    cwd,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
    // Neither launcher execs the runtime: stop the whole group (POSIX) or
    // tree (Windows), never the launcher pid alone.
    detached: true,
    ...quartoSpawnEnvOptions(),
  });
  const out: string[] = [];
  const err: string[] = [];
  const collected = Promise.all([
    collectText(child.stdout, out),
    collectText(child.stderr, err),
  ]).then(() => undefined);
  const log = () => `stderr:\n${err.join("")}\nstdout:\n${out.join("")}`;
  try {
    await waitFor(() => err.join("").includes("Browse at"), 60000, log);
  } catch (e) {
    await stopPreview({ child, port, log, collected }, false);
    throw e;
  }
  return { child, port, log, collected };
}

// "Browse at" is printed just before the server binds; retry until it accepts.
export async function connectWebSocket(
  url: string,
  timeoutMs: number,
): Promise<WebSocket> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      return await new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.onopen = () => resolve(ws);
        ws.onerror = () => reject(new Error(`cannot connect to ${url}`));
      });
    } catch (e) {
      if (Date.now() > deadline) throw e;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

export function closeWebSocket(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);
    ws.onclose = () => {
      clearTimeout(timer);
      resolve();
    };
    ws.close();
  });
}

/** Stops the preview and, when `check` is true, asserts it exited non-zero
 *  and released its port. POSIX: SIGTERM to the group runs Quarto's abend
 *  path (exit 1). Windows: taskkill /F ends cmd.exe and deno.exe without a
 *  signal; the exit code is taskkill's TerminateProcess code (1), and the
 *  graceful path has no Windows equivalent. */
export async function stopPreview(
  run: PreviewRun,
  check = true,
): Promise<void> {
  try {
    killProcess(-run.child.pid, "SIGTERM");
  } catch {
    // already gone
  }
  const status = await run.child.status;
  await run.collected;
  if (check) {
    assert(!status.success, `preview exited 0 after being stopped\n${run.log()}`);
    assert(
      await waitForPort({ port: run.port, hostname: kHost }, 10000),
      `port ${run.port} still bound 10 s after the stop\n${run.log()}`,
    );
  }
}
```

- [ ] **Step 2: Write the test**

```ts
/*
 * preview-reload.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * End-to-end coverage for `quarto preview` of a single document: the server
 * starts on the requested port, a WebSocket client connects, editing the
 * source triggers render:start / render:stop:true / reload, and stopping
 * the process group (POSIX: SIGTERM) or tree (Windows: taskkill /T) ends the
 * server and frees the port. PRs 15 (ports), 16 (http + WebSocket), 17
 * (watchers), 28 and 29 (Node implementations) are gated on it. Runs on
 * every OS.
 */

import { assert } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { waitFor } from "../../process-helpers.ts";
import {
  closeWebSocket,
  connectWebSocket,
  kHost,
  startPreview,
  stopPreview,
} from "./preview-helpers.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { removeSync, writeTextFileSync } from "../../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";

const kDoc = "---\ntitle: Preview reload\n---\n\nFirst version.\n";

unitTest(
  "preview - editing the document re-renders and sends reload over the WebSocket",
  async () => {
    const dir = makeTempDirSync({ prefix: "quarto-preview-reload" });
    const doc = join(dir, "doc.qmd");
    writeTextFileSync(doc, kDoc);
    const run = await startPreview(dir, ["doc.qmd"]);
    const messages: string[] = [];
    const shown = () =>
      `messages: ${JSON.stringify(messages.map((m) => m.slice(0, 60)))}\n${run.log()}`;
    let ws: WebSocket | undefined;
    try {
      ws = await connectWebSocket(`ws://${kHost}:${run.port}/`, 10000);
      ws.onmessage = (ev) => messages.push(String(ev.data));

      // The polling watcher compares mtimes; step past 1 s granularity.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      writeTextFileSync(doc, kDoc + "\nSecond version.\n");

      await waitFor(
        () => messages.some((m) => m.startsWith("reload")),
        30000,
        shown,
      );
      const start = messages.findIndex((m) => m.startsWith("render:start:"));
      const stop = messages.indexOf("render:stop:true");
      const reload = messages.findIndex((m) => m.startsWith("reload"));
      assert(start >= 0, `no render:start before reload\n${shown()}`);
      assert(stop > start, `no render:stop:true after render:start\n${shown()}`);
      assert(reload > stop, `reload arrived before the render finished\n${shown()}`);
    } finally {
      if (ws) await closeWebSocket(ws);
      await stopPreview(run);
      removeSync(dir, { recursive: true });
    }
  },
  {
    // The preview server's half of the WebSocket and the killed child's
    // pipes are released asynchronously after the body returns.
    sanitize: { resources: false, ops: false },
  },
);
```

- [ ] **Step 3: Run it**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts`
Expected: `.` then `ok | 1 passed | 0 failed`, in about 10–20 s (one initial render, one re-render), on Linux, macOS and Windows. On Windows, `quartoDevCmd()` is `quarto.cmd`; `Deno.Command` runs it through `cmd.exe` (the existing smoke tests spawn it the same way) and `taskkill /T` ends both processes.

- [ ] **Step 4: Run it in binary mode once**

Run: `cd tests && QUARTO_TEST_BIN=/path/to/installed/quarto QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts`
Expected: `ok | 1 passed | 0 failed` (the installed launcher is the same shell script or `quarto.cmd`; `quartoSpawnEnvOptions()` strips the dev environment).

- [ ] **Step 5: Commit**

```bash
git add tests/smoke/preview/preview-helpers.ts tests/smoke/preview/preview-reload.test.ts
git commit -m "tests: end-to-end quarto preview test (serve, WebSocket reload, group or tree stop) on every OS"
```

### Task 4: Website project preview end to end

**Files:**
- Create: `tests/smoke/preview/preview-project-reload.test.ts`

- [ ] **Step 1: Write the test**

```ts
/*
 * preview-project-reload.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * End-to-end coverage for `quarto preview` of a website project, which runs
 * through src/project/serve/serve.ts rather than preview.ts: the project
 * renders, the server starts, a WebSocket client connects, editing one page
 * re-renders and sends reload, and stopping the group (POSIX) or tree
 * (Windows) ends the server, frees the port and removes the preview
 * lockfile. PRs 16, 17, 28 and 29 are gated on it together with
 * preview-reload.test.ts. Runs on every OS.
 */

import { assert } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { waitFor } from "../../process-helpers.ts";
import {
  closeWebSocket,
  connectWebSocket,
  kHost,
  startPreview,
  stopPreview,
} from "./preview-helpers.ts";
import { join } from "../../../src/deno_ral/path.ts";
import {
  existsSync,
  mkdirSync,
  removeSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";

const kConfig = `project:
  type: website
website:
  title: Preview project
  navbar:
    left:
      - index.qmd
      - about.qmd
`;
const kAbout = "---\ntitle: About\n---\n\nFirst version.\n";

unitTest(
  "preview - a website project re-renders an edited page and sends reload; stop removes the lockfile",
  async () => {
    const dir = makeTempDirSync({ prefix: "quarto-preview-project" });
    const project = join(dir, "site");
    mkdirSync(project);
    writeTextFileSync(join(project, "_quarto.yml"), kConfig);
    writeTextFileSync(join(project, "index.qmd"), "---\ntitle: Home\n---\n\nHome.\n");
    const about = join(project, "about.qmd");
    writeTextFileSync(about, kAbout);
    const lockfile = join(project, ".quarto", "preview", "lock");

    const run = await startPreview(project, []);
    const messages: string[] = [];
    const shown = () =>
      `messages: ${JSON.stringify(messages.map((m) => m.slice(0, 60)))}\n${run.log()}`;
    let ws: WebSocket | undefined;
    try {
      assert(existsSync(lockfile), `no preview lockfile at ${lockfile}\n${run.log()}`);
      ws = await connectWebSocket(`ws://${kHost}:${run.port}/`, 10000);
      ws.onmessage = (ev) => messages.push(String(ev.data));

      await new Promise((resolve) => setTimeout(resolve, 1100));
      writeTextFileSync(about, kAbout + "\nSecond version.\n");

      await waitFor(
        () => messages.some((m) => m.startsWith("reload")),
        60000,
        shown,
      );
      const start = messages.findIndex((m) => m.startsWith("render:start:"));
      const stop = messages.indexOf("render:stop:true");
      const reload = messages.findIndex((m) => m.startsWith("reload"));
      assert(start >= 0, `no render:start before reload\n${shown()}`);
      assert(stop > start, `no render:stop:true after render:start\n${shown()}`);
      assert(reload > stop, `reload arrived before the render finished\n${shown()}`);
      // The page is served from the output directory after the re-render.
      const page = await fetch(`http://${kHost}:${run.port}/about.html`);
      const html = await page.text();
      assert(page.ok && html.includes("Second version."), `about.html not re-rendered\n${shown()}`);
    } finally {
      if (ws) await closeWebSocket(ws);
      await stopPreview(run);
      removeSync(dir, { recursive: true });
    }
  },
  {
    sanitize: { resources: false, ops: false },
  },
);
```

The lockfile is asserted while the server runs (every OS). Its removal (`safeRemoveSync(previewLockFile(project))` from `onCleanup`, `serve.ts:926`) is reached by SIGTERM on POSIX and not by `taskkill /F`, so it is not asserted and the test stays one body on every OS; a POSIX-only `assert(!existsSync(lockfile))` after `stopPreview` is acceptable if a reviewer asks for it, with that reason in a comment.

- [ ] **Step 2: Run it**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-project-reload.test.ts`
Expected: `.` then `ok | 1 passed | 0 failed`, in about 15–30 s (a two-page website render, one re-render), on Linux, macOS and Windows.

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/preview/preview-project-reload.test.ts
git commit -m "tests: end-to-end website preview test (project serve, WebSocket reload, stop) on every OS"
```

### Task 5: Jupyter kernel daemon

**Files:**
- Create: `tests/docs/jupyter/daemon/daemon.qmd`
- Create: `tests/smoke/jupyter/daemon.test.ts`

- [ ] **Step 1: The fixture**

`tests/docs/jupyter/daemon/daemon.qmd`:

````markdown
---
title: "Jupyter kernel daemon"
jupyter: python3
---

The cell prints the kernel's process id, so two renders served by the same
daemon print the same number.

```{python}
import os
print(f"KERNEL_PID={os.getpid()}")
```
````

- [ ] **Step 2: Write the test**

```ts
/*
 * daemon.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Coverage for the Jupyter kernel daemon (connectToKernel and the TCP
 * transport in src/execute/jupyter/jupyter-kernel.ts), which every other
 * Jupyter smoke test bypasses with --no-execute-daemon. Two renders with
 * --execute-daemon share one kernel; a render with --no-execute-daemon
 * aborts the daemon and runs a fresh kernel. PR 15 rewrites the transport
 * and PR 29 ports it to node:net; both are gated on this test.
 */

import { assert, assertEquals } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { docs, outputForInput, quartoDevCmd } from "../../utils.ts";
import { quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import {
  existsSync,
  readTextFileSync,
  removeSync,
} from "../../../src/deno_ral/fs.ts";
import { exec } from "../../../src/deno_ral/process.ts";

const input = docs("jupyter/daemon/daemon.qmd");
const output = outputForInput(input, "html");
const kStarting = "Starting python3 kernel";

async function render(...flags: string[]) {
  const result = await exec(quartoDevCmd(), {
    args: ["render", input, "--to", "html", ...flags],
    ...quartoSpawnEnvOptions(),
  });
  const stderr = new TextDecoder().decode(result.stderr);
  assert(result.success, `quarto render ${flags.join(" ")} failed:\n${stderr}`);
  const match = readTextFileSync(output.outputPath).match(/KERNEL_PID=(\d+)/);
  assert(match, `no KERNEL_PID in ${output.outputPath}`);
  return { stderr, pid: Number(match[1]) };
}

unitTest(
  "jupyter daemon - a second render reuses the kernel; --no-execute-daemon stops it",
  async () => {
    // --no-execute-daemon reads (and drops) the next argument, and
    // --execute-daemon parses it as seconds: keep both last.
    // Start clean: a daemon left by an earlier run would be reused.
    await render("--no-execute-daemon");

    const first = await render("--execute-daemon", "120");
    assert(first.stderr.includes(kStarting), `first render started no daemon:\n${first.stderr}`);

    const second = await render("--execute-daemon", "120");
    assert(
      !second.stderr.includes(kStarting),
      `second render started a new kernel instead of reusing the daemon:\n${second.stderr}`,
    );
    assertEquals(second.pid, first.pid, "the daemon's kernel should run both renders");

    const oneshot = await render("--no-execute-daemon");
    assert(oneshot.stderr.includes(kStarting), oneshot.stderr);
    assert(oneshot.pid !== first.pid, "one-shot render reused the daemon kernel");
  },
  {
    teardown: () => {
      if (existsSync(output.outputPath)) removeSync(output.outputPath);
      if (existsSync(output.supportPath)) {
        removeSync(output.supportPath, { recursive: true });
      }
      return Promise.resolve();
    },
  },
);
```

- [ ] **Step 3: Run it**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/jupyter/daemon.test.ts`
Expected: `.` then `ok | 1 passed | 0 failed` on Linux, macOS and Windows (four renders, about 30 s). `git status --short tests/docs/jupyter/daemon` afterwards shows only `daemon.qmd` (outputs removed by teardown).

- [ ] **Step 4: Commit**

```bash
git add tests/docs/jupyter/daemon/daemon.qmd tests/smoke/jupyter/daemon.test.ts
git commit -m "tests: cover Jupyter kernel daemon reuse and abort (--execute-daemon)"
```

### Task 6: `quarto inspect` through a pipe

**Files:**
- Create: `tests/smoke/inspect/inspect-pipe.test.ts`

- [ ] **Step 1: Write the test**

```ts
/*
 * inspect-pipe.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * `quarto inspect` writes its JSON with one synchronous write and exits.
 * When the reader goes away early (`| head -c 1`) it must exit 0 with no
 * broken-pipe error; when the reader reads to the end (`| wc -c`) every byte
 * must arrive. This is the exit/broken-pipe contract of the vocabulary
 * (_TEMPLATE.md, process.ts `exit`), which PR 28 implements on Node. Deno's stdout writes are synchronous; on Node a pipe is
 * asynchronous and process.exit() truncates it, which PR 28's exit() must
 * prevent (review S6). Ignored on Windows: needs bash, head and wc.
 */

import { assert, assertEquals } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { docs, quartoDevCmd } from "../../utils.ts";
import { quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import {
  mkdirSync,
  removeSync,
  statSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { exec } from "../../../src/deno_ral/process.ts";

// Largest project under tests/docs by number of inputs (86 documents).
const kLargestProject = docs("smoke-all/typst/margin-layout");
// A generated project's output must exceed any pipe buffer (64 KiB on Linux).
const kGeneratedMinBytes = 1024 * 1024;

async function bash(script: string, ...args: string[]) {
  const out = await exec("bash", {
    args: ["-c", `set -o pipefail; ${script}`, "inspect-pipe", ...args],
    ...quartoSpawnEnvOptions(),
  });
  const decoder = new TextDecoder();
  return {
    code: out.code,
    stdout: decoder.decode(out.stdout),
    stderr: decoder.decode(out.stderr),
  };
}

async function checkPipes(project: string, scratch: string, minBytes: number) {
  const outFile = join(scratch, "inspect.json");
  const unpiped = await exec(quartoDevCmd(), {
    args: ["inspect", project, outFile],
    ...quartoSpawnEnvOptions(),
  });
  assert(unpiped.success, new TextDecoder().decode(unpiped.stderr));
  const size = statSync(outFile).size;
  console.log(`quarto inspect ${project}: ${size} bytes`);
  assert(size > minBytes, `inspect output is ${size} bytes, expected more than ${minBytes}`);

  const head = await bash(`"$1" inspect "$2" | head -c 1`, quartoDevCmd(), project);
  assertEquals(head.code, 0, `quarto inspect | head -c 1 exited ${head.code}\n${head.stderr}`);
  assertEquals(head.stdout, "{");
  assert(!/broken ?pipe|EPIPE|os error 32/i.test(head.stderr), head.stderr);

  const count = await bash(`"$1" inspect "$2" | wc -c`, quartoDevCmd(), project);
  assertEquals(count.code, 0, count.stderr);
  assertEquals(Number(count.stdout.trim()), size, "bytes through the pipe");
}

unitTest(
  "inspect - largest tests/docs project through head -c 1 and wc -c",
  async () => {
    const scratch = makeTempDirSync({ prefix: "quarto-inspect-pipe" });
    try {
      await checkPipes(kLargestProject, scratch, 0);
    } finally {
      removeSync(scratch, { recursive: true });
    }
  },
  { ignore: isWindows },
);

unitTest(
  "inspect - output larger than a pipe buffer through head -c 1 and wc -c",
  async () => {
    const scratch = makeTempDirSync({ prefix: "quarto-inspect-pipe" });
    const project = join(scratch, "project");
    try {
      mkdirSync(project);
      writeTextFileSync(join(project, "_quarto.yml"), "project:\n  type: default\n");
      // 200 documents with a 6 KB description each: about 1.3 MB of JSON.
      const description = "x".repeat(6000);
      for (let i = 0; i < 200; i++) {
        const name = `doc-${String(i).padStart(3, "0")}.qmd`;
        writeTextFileSync(
          join(project, name),
          `---\ntitle: Doc ${i}\ndescription: "${description}"\n---\n\nBody ${i}.\n`,
        );
      }
      await checkPipes(project, scratch, kGeneratedMinBytes);
    } finally {
      removeSync(scratch, { recursive: true });
    }
  },
  { ignore: isWindows },
);
```

- [ ] **Step 2: Run it**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/inspect/inspect-pipe.test.ts`
Expected: `..` then `ok | 2 passed | 0 failed`. Record the two `quarto inspect ...: N bytes` lines (printed by the test) in the PR description; the second is above 1,048,576. On Deno this passes today: one `writeSync` into a pipe whose reader has gone returns a short count, which `inspect` ignores, and Rust ignores `SIGPIPE`, so the process exits 0.

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/inspect/inspect-pipe.test.ts
git commit -m "tests: quarto inspect through head -c 1 and wc -c (pipe exit contract)"
```

### Task 7: Prove each test can fail, then update the preview rule

**Files:**
- Modify: `.claude/rules/preview/overview.md`

- [ ] **Step 1: Break each behaviour locally (do not commit)**

Run each pair, then `git checkout -- src` after each:

1. `sed -i 's/await reloader.reloadClients(reloadTarget);/void 0;/' src/command/preview/preview.ts` → `./run-tests.sh --agent smoke/preview/preview-reload.test.ts` fails with `timed out after 30000 ms: messages: [...]`.
2. In `src/execute/jupyter/jupyter-kernel.ts`, make `readKernelTransportFile` return `null` on its first line → `smoke/jupyter/daemon.test.ts` fails with `second render started a new kernel`.
3. In `src/command/inspect/cmd.ts:61`, replace the single `writeSync` with two writes of the two halves of the buffer → `smoke/inspect/inspect-pipe.test.ts` fails on the generated project with `Broken pipe` in stderr (the second write hits the closed pipe).
4. In `src/deno_ral/process.ts`, drop `detached` from the `Deno.Command` options → `unit/process-group.test.ts` fails with `the grandchild should be in the group the detached child leads`.
5. `sed -i 's/devServer.reloadClients(reloadTarget);/void 0;/' src/project/serve/watch.ts` → `smoke/preview/preview-project-reload.test.ts` fails with `timed out after 60000 ms: messages: [...]`.
6. Windows only (a Windows machine, or a CI run from a scratch branch): in `src/deno_ral/process.ts`, make `killProcess` call `Deno.kill(pid, signal)` for every pid → `unit/process-group.test.ts` fails inside `killProcess` (`Deno.kill` rejects a negative pid on Windows) and the `ping` grandchild is still listed by `tasklist`; `smoke/preview/preview-reload.test.ts` and `preview-project-reload.test.ts` fail the same way in `stopPreview`.

Expected: each of the six runs fails with the stated message; after `git checkout -- src` all pass again. Note the six failure messages (the Windows one from the Windows run) in the PR description.

- [ ] **Step 2: Update `.claude/rules/preview/overview.md`**

Replace the paragraph under `## Verifying a preview change` with:

```markdown
`tests/smoke/preview/preview-reload.test.ts` starts `quarto preview` on a single document and `tests/smoke/preview/preview-project-reload.test.ts` on a generated website project (`src/project/serve/`); each connects a WebSocket client, edits a source file and expects `render:start`, `render:stop:true` and `reload`, then stops the server through its process group (POSIX, SIGTERM) or process tree (Windows, `taskkill /T`) and checks the port is released. They run on Linux, macOS and Windows. Run them for any change to the preview server, the dev server, the project serve path, the watchers or the port helpers. They do not cover the browser side of the reload, an external `serve:` command, or RStudio/VS Code integration: verify those manually with the `/quarto-preview-test` skill. Unit tests call preview internals directly, and the Playwright suite serves pre-rendered files with `python -m http.server`. Keep throwaway harness scripts outside the repo; a reusable technique goes in that skill's `references/`, not in `tests/`.
```

- [ ] **Step 3: Commit**

```bash
git add .claude/rules/preview/overview.md
git commit -m "preview rules: name the automated preview tests and what they do not cover"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/process-group.test.ts smoke/preview/preview-reload.test.ts smoke/preview/preview-project-reload.test.ts smoke/jupyter/daemon.test.ts smoke/inspect/inspect-pipe.test.ts` → `ok | 7 passed | 0 failed | 1 ignored` (Linux/macOS), `ok | 4 passed | 0 failed | 4 ignored` (Windows), the Windows log showing the tree-kill case and both preview tests as passed.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/jupyter/ -name '*.test.ts') $(find smoke/inspect/ -name '*.test.ts')` → the existing Jupyter and inspect tests still pass next to the new ones.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes; `tests` count unchanged (no `Deno.` in the new files).
- The six local breaks in Task 7 each make their test fail (the sixth on Windows).

## Review checklist

- [ ] No `Deno.` in any new file; assertions come from `tests/asserts.ts`; files go through `src/deno_ral/fs.ts`/`temp.ts`, processes through `src/deno_ral/process.ts`.
- [ ] The preview tests stop the process group (POSIX) or tree (Windows) through `killProcess(-pid)`, never the launcher pid alone, and assert the port is released (proves the runtime process exited, not only the shell or `cmd.exe` launcher).
- [ ] The Windows tree-kill case runs on Windows CI (not ignored) and asserts through `tasklist` that the grandchild is gone; the Windows coverage table in Context says which POSIX assertions have no Windows equivalent.
- [ ] The daemon test starts from a clean state (`--no-execute-daemon` first) and ends by aborting the daemon, so no kernel outlives the test.
- [ ] The inspect test's generated project is above 1 MiB, so the pipe fills on every OS; the margin-layout size is recorded in the PR.
- [ ] Every ignored test states its reason in the file header, and nothing downstream (PRs 28, 34) cites an ignored case as Windows evidence.
- [ ] Timeouts: document preview ≤ 60 + 10 + 30 + 10 s, website preview ≤ 60 + 10 + 60 + 10 s; both under `unitTest`'s 120 s limit only because the waits overlap little in practice (initial render 5–15 s); if the website test nears the limit on Windows CI, lower its reload budget to 45 s.
- [ ] `.claude/rules/preview/overview.md` no longer says no test starts the preview server.

## Risks and rollback

- Flakiness from timing: the preview tests wait for the server's own `Browse at` line, retry the WebSocket connection, step past mtime granularity and have a 30 s (document) or 60 s (website) reload budget. If one flakes on macOS or Windows CI, adjust the budgets to keep the total under 120 s; follow `dev-docs/debugging-flaky-tests.md` before disabling anything.
- Windows tree kill: `taskkill /T` enumerates children when it runs, so a grandchild spawned after the enumeration survives; the test spawns its grandchild before the kill, and `preview-server.ts` has the same window in production (unchanged behaviour). `taskkill /F` leaves no chance for cleanup, so the Windows preview tests do not assert anything `onCleanup` does (lockfile removal).
- The daemon test depends on the kernelspec being named `python3` (true for the `tests/` uv environment, `tests/pyproject.toml`). A machine whose default kernelspec has another name fails on `first render started no daemon`; the fixture pins `jupyter: python3` so this only happens without the test environment.
- New tests have no entry in `tests/timing-for-ci.txt`; `run-parallel-tests.ts` places unknown files by its default weight. Regenerate timings in the usual periodic update, not here.
- Rollback: revert the seven commits; no source file changes.

## Decisions needed

None. Not changed because: the review asked for a "kill-grandchild test for process groups" that passes on Deno today. Deno 2.7.14's `Deno.Command` already supports `detached` (`setsid` on POSIX), so the test is not written as `ignore: true` waiting for PR 08; it only needs PR 08's layer to forward the option, which this PR depends on.
