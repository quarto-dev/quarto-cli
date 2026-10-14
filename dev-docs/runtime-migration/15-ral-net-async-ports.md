# PR 15: `deno_ral/net.ts`, async port probing, Jupyter kernel transport on it

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Quarto its own TCP interface (`connectTcp`, `TcpConnection`, `isPortAvailable`, `findOpenPort`, all async) in `src/deno_ral/net.ts`, make `src/core/port.ts` async on top of it, and move the Jupyter kernel daemon transport off `Deno.connect`/`Deno.Conn`.
**Phase:** 1. **Depends on:** PR 08 (`spawn` in `src/deno_ral/process.ts`), PR 02 (ratchet). **Unblocks:** PR 16, PR 21, PR 29.
**Branch:** `rt/15-ral-net-async-ports`.
**Suggested executor:** Opus. The `findOpenPort` sync-to-async change ripples through 12 call sites in preview, serve, cri and axe, two of which (`withCriClient`, `runPreviewControlService`) are synchronous functions whose callers must be inspected; the kernel read loop is subtle.
**Size:** M. 1 new module, 1 new test, 14 modified files (`src/core/port.ts`, `src/execute/jupyter/jupyter-kernel.ts`, 9 callers in `src/`, 3 test files).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 10, finding 1: `src/core/port.ts` probes ports with a synchronous `Deno.listen`, and Node can only bind asynchronously. Assessment section 11, module plan row `net.ts`: own `TcpConnection` (`read`, `write`, `close`); `findOpenPort`/`isPortAvailable` become async; users are `core/port.ts` and `execute/jupyter/jupyter-kernel.ts`. Ground rule 4 of `README.md`: no synchronous network calls in any interface.

Today `src/core/port.ts` (250 lines) exports `findOpenPort(defaultPort?: number): number` (sync), `isPortAvailableSync(options)`, `getAvailablePortSync(options)` and `waitForPort(options, timeout)` (already async but polling the sync probe). `src/execute/jupyter/jupyter-kernel.ts` calls `Deno.connect` in `denoConnectToKernel` (lines 464–491), types the connection as `Deno.Conn` in `writeKernelCommand` (line 261), `connectToKernel` (line 377) and `denoConnectToKernel` (line 466), and reads the kernel's response in a `conn.read(buffer)` loop at lines 90–133.

After this PR, application code imports `src/deno_ral/net.ts`; the implementation inside `net.ts` still uses `Deno.listen`/`Deno.connect` (that is allowed: `src/deno_ral/` is the only place the ratchet exempts). PR 29 reimplements `net.ts` on `node:net` behind the same interface and the same unit test.

### Scope

In:
- `src/deno_ral/net.ts` with the four exports from the shared vocabulary.
- `src/core/port.ts`: `findOpenPort` and `waitForPort` become async and delegate to `net.ts`; `isPortAvailableSync` and `getAvailablePortSync` are deleted (no caller outside `port.ts`, verified with `grep -rn 'isPortAvailableSync\|getAvailablePortSync' src tests package`).
- Every caller of `findOpenPort` gets an `await`: `src/project/serve/serve.ts:423`, `src/command/call/axe/cmd.ts:401,463`, `src/command/preview/preview-shiny.ts:158`, `src/command/preview/preview.ts:132`, `src/core/previewurl.ts:42`, `src/core/cri/cri.ts:28`, `src/core/cri/launch.ts:253`, `tests/unit/chrome-launch.test.ts:67,99,235,262`, `tests/unit/chrome-launch-flags.test.ts:77`, `tests/smoke/axe/axe-transport-failclosed.test.ts:92,110`.
- `src/execute/jupyter/jupyter-kernel.ts` on `TcpConnection`.
- Unit test `tests/unit/deno-ral/net.test.ts`.

Out:
- `src/resources/extension-subtrees/julia-engine/src/julia-engine.ts` (`Deno.connect` at line 532, `Deno.TcpConn` at 562, `Deno.Conn` at 837). It is a git subtree maintained in its own repository (`dev-docs/subtree-extensions.md`); file an issue there, do not edit it here.
- Removing the >1 KB temp-file workaround in `writeKernelCommand` (kept, see Task 4; PR 29 decides).
- `Deno.Command("tail")` / `Deno.ChildProcess` at `jupyter-kernel.ts:63-69`: PR 08's codemod of direct `Deno.Command` sites covers it. If PR 08 left it, replace it in Task 4 with `spawn("tail", { args: [...], stdout: "inherit", stderr: "inherit" })` from `src/deno_ral/process.ts` and type the variable as `ChildProcess | undefined`.
- `waitForPort`'s semantics (it returns `true` when the port is *free*, which callers use to mean "the requested port can be bound"); unchanged.

### Interfaces

`src/deno_ral/net.ts` (new):

```ts
/*
 * net.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * TCP client connections and port probing. The only place in the code base
 * that may call Deno.connect / Deno.listen.
 */

/** A connected TCP stream. `read` resolves to null at EOF. */
export interface TcpConnection {
  /** Reads up to buf.length bytes into buf; resolves to the byte count, or null at EOF. */
  read(buf: Uint8Array): Promise<number | null>;
  /** Writes all of `data`; resolves to data.length. Rejects if the peer closed. */
  write(data: Uint8Array): Promise<number>;
  /** Closes the connection; idempotent. */
  close(): void;
}

/** Connects to hostname:port over TCP. Rejects with the runtime's connection
 * error (ECONNREFUSED on both runtimes; `isConnectionRefused` from errors.ts
 * recognises it). */
export function connectTcp(
  options: { hostname: string; port: number },
): Promise<TcpConnection>;

/** True when `port` can be bound on `hostname` (default 127.0.0.1) right now.
 * Only "address in use" maps to false; any other bind error is rethrown. */
export function isPortAvailable(
  port: number,
  hostname?: string,
): Promise<boolean>;

/** Returns `options.port` when it is available, otherwise a random browser-safe
 * port in [3000, 8000) that is available. Tries `attempts` (default 50)
 * random ports before throwing `Error("Unable to find open port")`. */
export function findOpenPort(
  options?: { port?: number; hostname?: string; attempts?: number },
): Promise<number>;
```

`src/core/port.ts` (changed signatures). `net.findOpenPort` is the generic probe (a random free port in [3000, 8000)); `core/port.ts` keeps Quarto's Chrome/Firefox-unsafe-port filter (`isPortSafe`) on top of it and keeps the public names callers already import. PR 29 reimplements `net.ts` with exactly this split, so the filter must not move into the layer (see Task 2):

```ts
export async function findOpenPort(defaultPort?: number): Promise<number>;
export async function waitForPort(
  options: { port: number; hostname?: string },
  timeout = 5000,
): Promise<boolean>;
```

`src/execute/jupyter/jupyter-kernel.ts` (changed signatures):

```ts
async function writeKernelCommand(conn: TcpConnection, command: string, secret: string, options: Record<string, unknown>): Promise<void>;
async function connectToKernel(options: JupyterExecuteOptions, startIfRequired = true): Promise<[TcpConnection, KernelTransport]>;
async function tcpConnectToKernel(transport: KernelTransport): Promise<[TcpConnection, KernelTransport]>; // renamed from denoConnectToKernel
```

### Files

- Create: `src/deno_ral/net.ts` (TCP connect, port probing; the only `Deno.connect`/`Deno.listen` caller).
- Create: `tests/unit/deno-ral/net.test.ts` (compatibility contract for PR 29).
- Modify: `src/core/port.ts:49-250` (async `findOpenPort`, `waitForPort`; delete `isPortAvailableSync`, `getAvailablePortSync`, `getRandomPortSync`, `random`, `withinRange`, the `IPortRange`/`IListenerOptions`/`IOptions` interfaces).
- Modify: `src/core/previewurl.ts:42`, `src/command/preview/preview.ts:132`, `src/command/preview/preview-shiny.ts:119-162`, `src/project/serve/serve.ts:389-431`, `src/command/call/axe/cmd.ts:401,463`, `src/core/cri/cri.ts:22-30`, `src/core/cri/launch.ts:253` (add `await`, make enclosing functions async where needed).
- Modify: `src/execute/jupyter/jupyter-kernel.ts:7-26,63-69,90-133,260-285,374-377,464-491`.
- Modify: `tests/unit/chrome-launch.test.ts:67,99,235,262`, `tests/unit/chrome-launch-flags.test.ts:77`, `tests/smoke/axe/axe-transport-failclosed.test.ts:92,110` (add `await`).
- Modify: `.claude/rules/typescript/deno-ral.md` table (add the `net.ts` row).

### Acceptance criteria

- `grep -rn 'Deno\.connect\|Deno\.listen\|Deno\.Conn\b' src --include=*.ts | grep -v '^src/deno_ral/' | grep -v extension-subtrees` prints nothing.
- `grep -rn 'isPortAvailableSync\|getAvailablePortSync' src tests package --include=*.ts` prints nothing.
- `grep -rn 'findOpenPort(' src tests --include=*.ts | grep -v 'await findOpenPort\|async function findOpenPort\|export function findOpenPort\|import'` prints nothing (every call is awaited).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/net.test.ts` passes.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts smoke/axe/axe-transport-failclosed.test.ts smoke/jupyter/` passes (the Jupyter smoke tests exercise the kernel daemon).
- `quarto run --dev tools/check-runtime-boundary.ts` reports a lower `Deno.*` count for `src/` than the committed baseline (8 sites removed from `src/core/port.ts` and `jupyter-kernel.ts`), and `--update-baseline` is committed.

## Plan

### Task 1: `net.ts` with its unit test

**Files:**
- Create: `src/deno_ral/net.ts`
- Create: `tests/unit/deno-ral/net.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * net.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Compatibility contract for src/deno_ral/net.ts. The server side of each
 * test uses Deno.listen on purpose: the module under test only implements
 * the client side and port probing, and PR 29 reruns this file against the
 * Node implementation.
 */

import { assert, assertEquals, assertRejects } from "testing/asserts";
import { unitTest } from "../../test.ts";
import {
  connectTcp,
  findOpenPort,
  isPortAvailable,
} from "../../../src/deno_ral/net.ts";

const kHost = "127.0.0.1";

// Echo server on an ephemeral port; returns the port and a close function.
function startEchoServer(): { port: number; close: () => void } {
  const listener = Deno.listen({ hostname: kHost, port: 0 });
  (async () => {
    for await (const conn of listener) {
      (async () => {
        const buf = new Uint8Array(1024);
        while (true) {
          const n = await conn.read(buf);
          if (n === null) break;
          await conn.write(buf.subarray(0, n));
        }
        conn.close();
      })().catch(() => {});
    }
  })().catch(() => {});
  return {
    port: (listener.addr as Deno.NetAddr).port,
    close: () => listener.close(),
  };
}

unitTest("net - connectTcp round-trips bytes through an echo server", async () => {
  const server = startEchoServer();
  try {
    const conn = await connectTcp({ hostname: kHost, port: server.port });
    try {
      const payload = new TextEncoder().encode("hello kernel\n");
      const written = await conn.write(payload);
      assertEquals(written, payload.length);
      const buf = new Uint8Array(64);
      const n = await conn.read(buf);
      assert(n !== null, "expected bytes, got EOF");
      assertEquals(new TextDecoder().decode(buf.subarray(0, n)), "hello kernel\n");
    } finally {
      conn.close();
    }
  } finally {
    server.close();
  }
});

unitTest("net - read resolves to null when the peer closes", async () => {
  const listener = Deno.listen({ hostname: kHost, port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  const accepted = (async () => {
    const c = await listener.accept();
    c.close();
  })();
  try {
    const conn = await connectTcp({ hostname: kHost, port });
    await accepted;
    const n = await conn.read(new Uint8Array(8));
    assertEquals(n, null);
    conn.close();
    conn.close(); // idempotent
  } finally {
    listener.close();
  }
});

unitTest("net - connectTcp rejects when nothing listens", async () => {
  const port = await findOpenPort();
  await assertRejects(() => connectTcp({ hostname: kHost, port }));
});

unitTest("net - isPortAvailable is false for a bound port and true after close", async () => {
  const listener = Deno.listen({ hostname: kHost, port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  try {
    assertEquals(await isPortAvailable(port, kHost), false);
  } finally {
    listener.close();
  }
  assertEquals(await isPortAvailable(port, kHost), true);
});

unitTest("net - findOpenPort honours a free requested port and skips a bound one", async () => {
  const listener = Deno.listen({ hostname: kHost, port: 0 });
  const bound = (listener.addr as Deno.NetAddr).port;
  try {
    const other = await findOpenPort({ port: bound, hostname: kHost });
    assert(other !== bound, `expected a port other than bound ${bound}`);
    assert(other >= 3000 && other < 8000, `fallback port ${other} outside [3000, 8000)`);
    assertEquals(await isPortAvailable(other, kHost), true);
  } finally {
    listener.close();
  }
  const same = await findOpenPort({ port: bound, hostname: kHost });
  assertEquals(same, bound);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/net.test.ts`
Expected: fails at type-check (`--check` is on) with `Module not found "file:///.../src/deno_ral/net.ts"`.

- [ ] **Step 3: Implement `net.ts`**

```ts
/*
 * net.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * TCP client connections and port probing. This is the only module outside
 * tests that may call Deno.connect or Deno.listen. PR 29 replaces the bodies
 * with node:net; the exported interface and tests/unit/deno-ral/net.test.ts
 * are the contract.
 */

import { isAddrInUse } from "./errors.ts";

export interface TcpConnection {
  read(buf: Uint8Array): Promise<number | null>;
  write(data: Uint8Array): Promise<number>;
  close(): void;
}

export async function connectTcp(
  options: { hostname: string; port: number },
): Promise<TcpConnection> {
  const conn = await Deno.connect({
    transport: "tcp",
    hostname: options.hostname,
    port: options.port,
  });
  let closed = false;
  return {
    read: (buf) => conn.read(buf),
    write: async (data) => {
      // Deno.Conn.write may write fewer bytes than requested; loop until done.
      let offset = 0;
      while (offset < data.length) {
        offset += await conn.write(data.subarray(offset));
      }
      return data.length;
    },
    close: () => {
      if (closed) return;
      closed = true;
      try {
        conn.close();
      } catch {
        // already closed by the peer
      }
    },
  };
}

export async function isPortAvailable(
  port: number,
  hostname = "127.0.0.1",
): Promise<boolean> {
  try {
    const listener = Deno.listen({ transport: "tcp", hostname, port });
    listener.close();
    return true;
  } catch (e) {
    if (isAddrInUse(e)) {
      return false;
    }
    throw e;
  }
}

// Random ports are drawn from this range; src/core/port.ts filters out the
// ones browsers refuse to connect to.
const kMinPort = 3000;
const kMaxPort = 8000;

function randomPort(): number {
  return kMinPort + Math.floor(Math.random() * (kMaxPort - kMinPort));
}

export async function findOpenPort(
  options: { port?: number; hostname?: string; attempts?: number } = {},
): Promise<number> {
  const hostname = options.hostname ?? "127.0.0.1";
  const attempts = options.attempts ?? 100;
  if (options.port !== undefined && await isPortAvailable(options.port, hostname)) {
    return options.port;
  }
  for (let i = 0; i < attempts; i++) {
    const port = randomPort();
    if (await isPortAvailable(port, hostname)) {
      return port;
    }
  }
  throw new Error("Unable to find open port");
}
```

Assumption: PR 09 landed `src/deno_ral/errors.ts` with `isAddrInUse(e)` (`e instanceof Deno.errors.AddrInUse` on Deno, `EADDRINUSE` on Node). If `errors.ts` does not exist on `main` when you start, create it with that one function and the file header, and note it in the PR description so PR 09 merges rather than duplicates it.

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/net.test.ts`
Expected: `.....` then `ok | 5 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/net.ts tests/unit/deno-ral/net.test.ts
git commit -m "deno_ral: add net.ts (connectTcp, isPortAvailable, findOpenPort) with unit test"
```

### Task 2: `src/core/port.ts` becomes an async wrapper

**Files:**
- Modify: `src/core/port.ts` (whole file)

- [ ] **Step 1: Replace the file**

Replace the entire content of `src/core/port.ts` with:

```ts
/*
 * port.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  findOpenPort as findOpenPortRal,
  isPortAvailable,
} from "../deno_ral/net.ts";
import { sleep } from "./wait.ts";
import { kLocalhost } from "./port-consts.ts";

function isPortSafe(port: number): boolean {
  // cf https://superuser.com/a/188070
  // and netwerk/base/nsIOService.cpp in Firefox's source
  //
  // excludes port numbers that Chrome or Firefox consider unsafe
  return ![
    3659, // apple-sasl / PasswordServer
    4045, // lockd
    4160, // sieve
    5060, // sip
    5061, // sips
    6000, // X11
    6566, // sane-port
    6665, // Alternate IRC [Apple addition]
    6666, // Alternate IRC [Apple addition]
    6667, // Standard IRC [Apple addition]
    6668, // Alternate IRC [Apple addition]
    6669, // Alternate IRC [Apple addition]
    6679, // osaut
    6697, // IRC + TLS
    7000, // As of 2024-10-21, Chrome doesn't appear to like this port anymore
  ].includes(port);
}

/**
 * Returns `defaultPort` when it can be bound on localhost, otherwise a random
 * free port in [3000, 8000) that browsers accept. Throws when none is found.
 */
export async function findOpenPort(defaultPort?: number): Promise<number> {
  if (
    defaultPort !== undefined &&
    await isPortAvailable(defaultPort, kLocalhost)
  ) {
    return defaultPort;
  }
  const kAttempts = 100;
  for (let i = 0; i < kAttempts; i++) {
    const port = await findOpenPortRal({ hostname: kLocalhost });
    if (isPortSafe(port)) {
      return port;
    }
  }
  throw new Error("Unable to find open port");
}

/**
 * Polls every 200 ms, for up to `timeout` ms, until `options.port` can be
 * bound. Resolves true when the port became available, false on timeout.
 */
export async function waitForPort(
  options: { port: number; hostname?: string },
  timeout = 5000,
): Promise<boolean> {
  const kWaitInterval = 200;
  let waited = 0;
  while (waited <= timeout) {
    if (await isPortAvailable(options.port, options.hostname ?? kLocalhost)) {
      return true;
    }
    await sleep(kWaitInterval);
    waited += kWaitInterval;
  }
  return false;
}
```

This deletes `isPortAvailableSync`, `getAvailablePortSync`, `getRandomPortSync`, `randomSafePort`, `random`, `withinRange`, the three option interfaces, and the imports of `./lodash.ts` and `./random.ts` (both used only by the deleted code; `grep -n 'ld\.\|randomInt' src/core/port.ts` must print nothing after the edit). `isPortSafe` and its list are byte-for-byte the existing ones (lines 17–39).

- [ ] **Step 2: Type-check to list the callers that now fail**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts 2>&1 | grep -c 'error'`
(On macOS arm64 the tools directory is `aarch64`.)
Expected: errors in exactly these files (number→Promise<number> mismatches): `core/previewurl.ts`, `command/preview/preview.ts`, `command/preview/preview-shiny.ts`, `project/serve/serve.ts`, `command/call/axe/cmd.ts`, `core/cri/cri.ts`, `core/cri/launch.ts`. Task 3 fixes them.

- [ ] **Step 3: Commit (red state is fine on a feature branch; keep the commit atomic for review)**

```bash
git add src/core/port.ts
git commit -m "core/port: findOpenPort and waitForPort are async on deno_ral/net"
```

### Task 3: Await `findOpenPort` at every caller

**Files:**
- Modify: `src/core/previewurl.ts:42`
- Modify: `src/command/preview/preview.ts:132`
- Modify: `src/command/preview/preview-shiny.ts:112,119-162`
- Modify: `src/project/serve/serve.ts:389-431`
- Modify: `src/command/call/axe/cmd.ts:401,463`
- Modify: `src/core/cri/cri.ts:22-30`
- Modify: `src/core/cri/launch.ts:253`
- Modify: `tests/unit/chrome-launch.test.ts:67,99,235,262`, `tests/unit/chrome-launch-flags.test.ts:77`, `tests/smoke/axe/axe-transport-failclosed.test.ts:92,110`

- [ ] **Step 1: The already-async callers (plain `await`)**

`src/core/previewurl.ts:42` (inside `export async function resolveHostAndPort`):

```ts
    port = await findOpenPort();
```

`src/command/preview/preview.ts:132` (inside `export async function resolvePreviewOptions`):

```ts
    resolved.port = await findOpenPort();
```

`src/command/call/axe/cmd.ts:401` and `:463` (inside the async `action` handler; verify with `sed -n 360,380p` that the enclosing function is `async`):

```ts
  const sitePort = await findOpenPort();
```

```ts
    browser = await launchScanBrowser(await findOpenPort(9222));
```

`src/core/cri/launch.ts:253` (inside `export async function launchChrome`):

```ts
  const port = options.port ?? await findOpenPort(9222);
```

- [ ] **Step 2: `withCriClient` in `src/core/cri/cri.ts:22-30`**

The function is synchronous and returns `criSemaphore.runExclusive(...)`, a promise. Move the port lookup inside the exclusive section so the signature stays `Promise<T>`:

```ts
export function withCriClient<T>(
  fn: (client: CriClient) => Promise<T>,
  appPath?: string,
  port?: number,
): Promise<T> {
  return criSemaphore.runExclusive(async () => {
    if (port === undefined) {
      port = await findOpenPort(9222);
    }
    const lifetime = getNamedLifetime(kRenderFileLifetime);
```

Leave the rest of the function body unchanged (it already uses `port` after this point).

- [ ] **Step 3: `runPreviewControlService` in `src/command/preview/preview-shiny.ts:119-162`**

Make it async and await it at its single call site (line 112):

```ts
  if (renderToken()) {
    await runPreviewControlService(options, changeHandler.render);
  }
```

```ts
async function runPreviewControlService(
  options: PreviewShinyOptions,
  renderHandler: (to?: string) => Promise<RenderForPreviewResult | undefined>,
) {
```

and at line 158:

```ts
  const port = await findOpenPort();
```

Note while you are there: line 160 passes `{ ...handlerOptions, handler }` to `handleHttpRequests` without `port`, so the control service binds Deno's default port 8000, not `port`. That is a pre-existing bug; fix it in the same edit since it is one token (PR 16 moves this call onto `serveHttp` and needs an explicit port anyway):

```ts
  onCleanup(handleHttpRequests({ ...handlerOptions, port, handler }).stop);
```

- [ ] **Step 4: `externalPreviewServer` in `src/project/serve/serve.ts:389-431`**

The function already returns `Promise<PreviewServer>` but is not declared `async`. Declare it async (the single caller at the top of `serveProject` already awaits it; confirm with `grep -n 'externalPreviewServer(' src/project/serve/serve.ts`) and await the port:

```ts
async function externalPreviewServer(
  project: ProjectContext,
  serve: ProjectServe,
  options: ServeOptions,
  renderManager: ServeRenderManager,
  watcher: ProjectWatcher,
  extensionDirs: string[],
  resourceFiles: string[],
  flags: RenderFlags,
  pandocArgs: string[],
): Promise<PreviewServer> {
```

```ts
    const handler = httpFileRequestHandler(handlerOptions);
    const port = await findOpenPort();
```

If the function body ends with `return Promise.resolve({...})` or a bare object, leave it; `async` accepts both.

- [ ] **Step 5: Tests**

`tests/unit/chrome-launch.test.ts` lines 67, 99, 235, 262 and `tests/unit/chrome-launch-flags.test.ts:77`: each is inside an `async () => {` test body, so:

```ts
    const port = await findOpenPort();
```

`tests/smoke/axe/axe-transport-failclosed.test.ts:92,110` (inside `execute: async () => {`):

```ts
      const browser = await launchScanBrowser(await findOpenPort(9222));
```

- [ ] **Step 6: Type-check and run the touched tests**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no output (exit 0).

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts smoke/axe/axe-transport-failclosed.test.ts`
Expected: dots then `ok | N passed | 0 failed` (N is the number of tests in those three files; chrome tests need a Chrome install for `axe-transport-failclosed`, which is skipped with a warning when absent).

Manual check: `package/dist/bin/quarto preview tests/docs/smoke-all/2023/05/24/5657-raw.qmd --no-browser --port 4321` prints `Browse at http://localhost:4321/` and `Ctrl-C` exits cleanly; then run it a second time while the first is still running and expect `ERROR: Requested port 4321 is already in use.`

- [ ] **Step 7: Commit**

```bash
git add src/core/previewurl.ts src/command/preview/preview.ts src/command/preview/preview-shiny.ts src/project/serve/serve.ts src/command/call/axe/cmd.ts src/core/cri/cri.ts src/core/cri/launch.ts tests/unit/chrome-launch.test.ts tests/unit/chrome-launch-flags.test.ts tests/smoke/axe/axe-transport-failclosed.test.ts
git commit -m "await the async findOpenPort at every caller; fix control-service port in preview-shiny"
```

### Task 4: Jupyter kernel transport on `TcpConnection`

**Files:**
- Modify: `src/execute/jupyter/jupyter-kernel.ts:7-26,63-69,90-133,260-285,374-377,464-491`

- [ ] **Step 1: Imports**

Add after line 26 (`import { isWindows } ...`):

```ts
import { connectTcp, TcpConnection } from "../../deno_ral/net.ts";
```

- [ ] **Step 2: `writeKernelCommand` (lines 260–285)**

```ts
async function writeKernelCommand(
  conn: TcpConnection,
  command: string,
  secret: string,
  options: Record<string, unknown>,
) {
  let messageBytes = new TextEncoder().encode(
    kernelCommand(command, secret, options) + "\n",
  );

  // Messages over 1 KB are written to a temp file and only the path is sent.
  // Deno's TCP connection silently truncated or reordered larger writes
  // (https://github.com/quarto-dev/quarto-cli/issues/7737#issuecomment-1830665357).
  // TcpConnection.write now loops until every byte is written, so this is a
  // belt-and-braces workaround; PR 29 (net.ts on node:net) may remove it
  // once the Jupyter smoke tests pass without it on both runtimes.
  if (messageBytes.length > 1024) {
    const tempFile = Deno.makeTempFileSync();
    Deno.writeFileSync(tempFile, messageBytes);
    const msg = kernelCommand("file", secret, { file: tempFile }) + "\n";
    messageBytes = new TextEncoder().encode(msg);
  }

  const bytesWritten = await conn.write(messageBytes);
  if (bytesWritten !== messageBytes.length) {
    throw new Error("Internal Error");
  }
}
```

(`Deno.makeTempFileSync`/`Deno.writeFileSync` on lines 275–276 are PR 13's codemod territory; if PR 13 already landed they read `makeTempFileSync`/`writeFileSync` from the layer. Keep whichever form the file has; do not re-introduce `Deno.`.)

- [ ] **Step 3: `connectToKernel` signature (line 374–377) and `denoConnectToKernel` (lines 464–491)**

```ts
async function connectToKernel(
  options: JupyterExecuteOptions,
  startIfRequired = true,
): Promise<[TcpConnection, KernelTransport]> {
```

Rename the two calls at lines 403 and 449 from `denoConnectToKernel(` to `tcpConnectToKernel(` and replace the function at 464–491 with:

```ts
async function tcpConnectToKernel(
  transport: KernelTransport,
): Promise<[TcpConnection, KernelTransport]> {
  // `type` is always "tcp" (see connectToKernel); the unix branch was dead
  // code kept from before the osx domain-socket hang was observed.
  if (transport.type !== "tcp") {
    throw new Error(
      `Unsupported kernel transport type: ${transport.type}`,
    );
  }
  return [
    await connectTcp({
      hostname: "127.0.0.1",
      port: transport.port as number,
    }),
    transport,
  ];
}
```

- [ ] **Step 4: The read loop (lines 90–133) needs no change**

`conn.read(buffer)` returning `number | null` is the same contract; verify the loop still compiles unchanged. Only the variable type changed through `connectToKernel`'s return type.

- [ ] **Step 5: Type-check and run the Jupyter smoke tests**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: exit 0.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/jupyter/`
Expected: `ok | N passed | 0 failed`. These render with `execute: daemon: true` (the default), so they go through `executeKernelKeepalive` → `connectToKernel` → `tcpConnectToKernel`, including the >1 KB temp-file path for any notebook with long options.

Manual check of the daemon reuse path: `cd tests/docs/smoke-all/2024/03/14 && ../../../../../package/dist/bin/quarto render 9076.qmd --execute-daemon-restart && ../../../../../package/dist/bin/quarto render 9076.qmd` — second render prints `Starting python3 kernel...` only if the daemon timed out; otherwise it reuses the connection and finishes faster.

- [ ] **Step 6: Commit**

```bash
git add src/execute/jupyter/jupyter-kernel.ts
git commit -m "jupyter-kernel: connect to the kernel daemon through deno_ral/net TcpConnection"
```

### Task 5: Ratchet, docs

**Files:**
- Modify: `tools/runtime-boundary-baseline.json`
- Modify: `.claude/rules/typescript/deno-ral.md`

- [ ] **Step 1: Update the baseline**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline`
Expected: prints the new, lower count for `src/` (8 fewer `Deno.*` sites: 2 in `port.ts` (`Deno.listen`, `Deno.errors.AddrInUse`), 6 in `jupyter-kernel.ts` (`Deno.Conn` ×3 in signatures, the comment at line 272, `Deno.connect` ×2)) and rewrites `tools/runtime-boundary-baseline.json` (`"src": { "denoCalls": ..., "stdImportFiles": ... }`).

- [ ] **Step 2: Add the module to the rules table**

In `.claude/rules/typescript/deno-ral.md`, add a row to the "Available Modules" table:

```markdown
| `net.ts` | TCP client, port probing (all async) | `connectTcp`, `isPortAvailable`, `findOpenPort` |
```

- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet baseline after net.ts; document net.ts in deno-ral rules"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/net.test.ts` → `ok | 5 passed | 0 failed`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts smoke/axe/axe-transport-failclosed.test.ts smoke/jupyter/ smoke/preview/` → all pass.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- `grep -rn 'Deno\.connect\|Deno\.listen\|Deno\.Conn\b' src --include=*.ts | grep -v '^src/deno_ral/' | grep -v extension-subtrees` → empty.
- Manual: `package/dist/bin/quarto preview <qmd> --port 4321` twice (second fails with "already in use"); `quarto render` of a Jupyter document twice (daemon reuse).

## Review checklist

- [ ] `net.ts` is the only non-test file calling `Deno.connect`/`Deno.listen`.
- [ ] `net.findOpenPort` only returns ports in [3000, 8000) unless the requested port is free and carries no browser-safety logic; `core/port.ts` keeps the unsafe-port list byte-for-byte and applies it (PR 29 relies on this split).
- [ ] `waitForPort` keeps its polarity (true = port is free).
- [ ] Every `findOpenPort(` call site is awaited; `withCriClient` still serialises through `criSemaphore`.
- [ ] `preview-shiny.ts` control service now binds the port it prints.
- [ ] Temp-file workaround in `writeKernelCommand` kept, with the comment pointing at PR 29.
- [ ] Unit test closes every listener and connection (no Deno resource-sanitizer failures).
- [ ] Baseline count went down; `--update-baseline` output committed.

## Risks and rollback

- A missed `await` on `findOpenPort` compiles only if the result is passed where `number | Promise<number>` is accepted (e.g. into a template string); the acceptance grep catches it. Symptom: a URL like `http://localhost:[object Promise]/`.
- `isPortAvailable` throws on bind errors other than "address in use" (e.g. `EACCES` for ports < 1024 as non-root). Previous behaviour was identical (`throw error`), so nothing changes.
- `connectTcp.write` now loops on short writes. If a kernel daemon misbehaves on larger single messages, the temp-file path still applies above 1 KB, so behaviour is unchanged for large payloads.
- Rollback: revert the five commits; no data format or file layout changes.

## Decisions needed

None.
