# PR 16: `deno_ral/http.ts`; preview server, dev server, axe server on it

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put an HTTP server and WebSocket upgrade interface (`serveHttp`, `HttpServer`, `upgradeWebSocket`, `WebSocketLike`) in `src/deno_ral/http.ts`, implemented on `Deno.serve`/`Deno.upgradeWebSocket` for now, and move every server in `src/` onto it.
**Phase:** 1. **Depends on:** PR 15 (async `findOpenPort`; the `preview-shiny.ts` port fix), PR 02 (ratchet). **Unblocks:** PR 21, PR 29.
**Branch:** `rt/16-ral-http`.
**Suggested executor:** Opus. The WebSocket adapter must preserve the dev server's client-tracking semantics (`readyState`, `onclose` debounce) and the axe command's shutdown ordering; both are easy to subtly break.
**Size:** M. 1 new module, 1 new test, 5 modified files (`src/core/http-server.ts`, `src/core/http-devserver.ts`, `src/command/preview/preview.ts`, `src/command/call/axe/cmd.ts`, `.claude/rules/typescript/deno-ral.md`), plus the baseline.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 3.3 lists `Deno.serve` and `Deno.upgradeWebSocket` as Deno-specific runtime features used by `src/core/http-server.ts`, `src/core/http-devserver.ts`, `src/command/preview/preview.ts` and `src/command/call/axe/cmd.ts`; the Node replacement is `node:http` plus the `ws` package. Section 11, module plan row `http.ts`: `serveHttp({ port, hostname, handler, signal, onListen })` returning `{ finished, shutdown }`; `upgradeWebSocket(req)` returning a browser-shaped socket. The spike's `deno-shim.js` (`Deno.serve` and `Deno.upgradeWebSocket` sections) is the proof that the interface below can be implemented on Node: it builds a `Request` from `http.IncomingMessage`, streams the `Response` body back, and uses `ws`'s `WebSocketServer.handleUpgrade` for upgrades.

Call sites today (verified 2026-10-14):

- `src/core/http-server.ts:18`: `Deno.serve({ ...options, signal })` inside `handleHttpRequests`, which returns `{ server, stop }`. Callers: `src/project/serve/serve.ts:424` (uses `stop`), `src/project/serve/serve.ts:775-781` (uses `server.finished`), `src/command/call/axe/cmd.ts:402-422` (uses `server.stop()` and `server.server.finished`), `src/command/preview/preview-shiny.ts:160` (uses `.stop`).
- `src/core/http-devserver.ts:130`: `Deno.upgradeWebSocket(req)`; the client list is typed `{ socket: WebSocket }` (line 44); `socket.readyState !== WebSocket.CLOSED` at line 54; `socket.onmessage` (132), `socket.onclose` (138), `socket.send` (69, 187), `socket.close()` (193).
- `src/command/preview/preview.ts:288-301`: `Deno.serve({ signal, port, hostname }, handler)` then `await server.finished`.
- `src/command/call/axe/cmd.ts:413-418`: a comment about `Deno.serve` tearing down asynchronously (the code goes through `handleHttpRequests`).
- `src/project/serve/serve.ts` does not call `Deno.serve` directly; it is covered through `handleHttpRequests` and needs no edit beyond compiling against the new return type.

### Scope

In:
- `src/deno_ral/http.ts` with the vocabulary's `ServeOptions`, `HttpServer`, `serveHttp`, `WebSocketLike`, `upgradeWebSocket`.
- `src/core/http-server.ts` reimplemented on `serveHttp`; `port` becomes required (every caller passes one after PR 15).
- `src/core/http-devserver.ts` on `upgradeWebSocket`/`WebSocketLike`.
- `src/command/preview/preview.ts` on `serveHttp`.
- `src/command/call/axe/cmd.ts` comment update (code unchanged).
- Unit test `tests/unit/deno-ral/http.test.ts`.

Out:
- `src/core/http.ts:228-240` `maybeDisplaySocketError` (`instanceof Deno.errors.*`): error predicates are PR 09's `errors.ts`; the `Deno.errors` sweep is handled by the fs codemod PRs (10–13) which carry the `errors` rule. Not touched here.
- `src/core/http.ts:47` `Deno.readFileSync`: PR 10.
- The WebSocket *client* (`new WebSocket(...)` in `src/core/cri/` and puppeteer): browser-global API, available on Node 22, not a runtime seam.
- The `!socket.CLOSED && !socket.CLOSING` condition at `http-devserver.ts:191`: `CLOSED`/`CLOSING` are the numeric constants 3 and 2, so the condition is always false and `socket.close()` is never reached. This PR preserves that behaviour (the browser closes the socket when it reloads). Fixing it is a separate behaviour change; the plan adds a comment, nothing else.

### Interfaces

`src/deno_ral/http.ts` (new):

```ts
/*
 * http.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * HTTP server and WebSocket upgrade. The only module that may call
 * Deno.serve / Deno.upgradeWebSocket. PR 29 reimplements it on node:http + ws.
 */

export interface ServeOptions {
  /** Port to bind; 0 picks an ephemeral port (read it from `addr` or `onListen`). */
  port: number;
  /** Defaults to "0.0.0.0" (Deno.serve's default). */
  hostname?: string;
  handler: (
    req: Request,
    info: { remoteAddr: { hostname: string; port: number } },
  ) => Response | Promise<Response>;
  /** Aborting it stops the server; `finished` then resolves. */
  signal?: AbortSignal;
  /** Called once bound. When omitted, serveHttp prints
   * `Listening on http://<hostname>:<port>/` to stdout, matching Deno.serve's
   * default, so `quarto preview` output does not change. */
  onListen?: (addr: { hostname: string; port: number }) => void;
}

export interface HttpServer {
  /** Resolves after the server stops (abort or shutdown) and in-flight
   * requests finish. */
  readonly finished: Promise<void>;
  /** Bound address, valid after `onListen` fired. */
  readonly addr: { hostname: string; port: number };
  /** Stops accepting connections, waits for in-flight requests. Idempotent. */
  shutdown(): Promise<void>;
}

/** Starts listening immediately and never throws synchronously: when the
 * port cannot be bound, `onListen` is not called and `finished` rejects with
 * the bind error (`isAddrInUse(e)` from errors.ts recognises it). PR 29
 * implements the same contract on node:http, where binding is asynchronous. */
export function serveHttp(options: ServeOptions): HttpServer;

/** Browser-shaped subset of WebSocket that both Deno's socket and ws's socket
 * can be adapted to. `readyState` compares against the instance's own
 * `CLOSED`/`CLOSING` constants. */
export interface WebSocketLike {
  readonly readyState: number;
  readonly CLOSED: number;
  readonly CLOSING: number;
  send(data: string | Uint8Array): void;
  close(): void;
  onmessage: ((ev: { data: string | Uint8Array }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

/** Upgrades `req` (which must carry `Upgrade: websocket`). The returned
 * `response` must be returned from the serve handler. Throws TypeError when
 * the request is not upgradable. */
export function upgradeWebSocket(
  req: Request,
): { socket: WebSocketLike; response: Response };
```

`src/core/http-server.ts` (changed):

```ts
import { HttpServer, serveHttp } from "../deno_ral/http.ts";

export function handleHttpRequests(options: {
  port: number;              // was optional
  hostname?: string;
  handler: (req: Request) => Promise<Response>;
  onListen?: (params: { hostname: string; port: number }) => void;
}): { server: HttpServer; stop: () => void };
```

`src/core/http-devserver.ts`: `Client.socket` is `WebSocketLike`; no exported signature changes.

### Files

- Create: `src/deno_ral/http.ts` (serve + upgrade; sole `Deno.serve`/`Deno.upgradeWebSocket` caller).
- Create: `tests/unit/deno-ral/http.test.ts`.
- Modify: `src/core/http-server.ts:1-25` (whole file).
- Modify: `src/core/http-devserver.ts:42-55,122-147,182-201`.
- Modify: `src/command/preview/preview.ts:286-301`.
- Modify: `src/command/call/axe/cmd.ts:413-418` (comment only).
- Modify: `.claude/rules/typescript/deno-ral.md` (module table row).
- Modify: `tools/runtime-boundary-baseline.json` (via `--update-baseline`).

### Acceptance criteria

- `grep -rn 'Deno\.serve\|Deno\.upgradeWebSocket\|Deno\.HttpServer\|Deno\.ServeHandler' src --include=*.ts | grep -v '^src/deno_ral/'` prints nothing (the comment in `axe/cmd.ts` is rewritten too).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/http.test.ts` passes.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/ unit/preview-compatibility.test.ts unit/axe-*.test.ts smoke/axe/` passes.
- Manual: `quarto preview` of a document reloads the browser on save (the WebSocket path) and exits on Ctrl-C; `quarto preview` of a website project (`tests/docs/websites/search`) serves and reloads.
- Baseline count for `src/` is lower by 6 (`http-server.ts` 2, `http-devserver.ts` 1, `preview.ts` 2, `axe/cmd.ts` 1 comment), committed.

## Plan

### Task 1: `http.ts` with its unit test

**Files:**
- Create: `src/deno_ral/http.ts`
- Create: `tests/unit/deno-ral/http.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * http.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Compatibility contract for src/deno_ral/http.ts (rerun by PR 29 on Node).
 */

import { assert, assertEquals, assertThrows } from "testing/asserts";
import { unitTest } from "../../test.ts";
import {
  HttpServer,
  serveHttp,
  upgradeWebSocket,
} from "../../../src/deno_ral/http.ts";

const kHost = "127.0.0.1";

// Serves on an ephemeral port and resolves once bound.
function serveEphemeral(
  handler: Parameters<typeof serveHttp>[0]["handler"],
  signal?: AbortSignal,
): Promise<{ server: HttpServer; port: number }> {
  return new Promise((resolve) => {
    const server = serveHttp({
      port: 0,
      hostname: kHost,
      handler,
      signal,
      onListen: (addr) => resolve({ server, port: addr.port }),
    });
  });
}

unitTest("http - serveHttp answers a request and reports its address", async () => {
  const { server, port } = await serveEphemeral((req, info) => {
    assertEquals(info.remoteAddr.hostname, kHost);
    return new Response(`path=${new URL(req.url).pathname}`, {
      headers: { "content-type": "text/plain" },
    });
  });
  try {
    assertEquals(server.addr.port, port);
    assertEquals(server.addr.hostname, kHost);
    const res = await fetch(`http://${kHost}:${port}/hello`);
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "path=/hello");
  } finally {
    await server.shutdown();
    await server.finished;
  }
});

unitTest("http - aborting the signal stops the server and resolves finished", async () => {
  const ac = new AbortController();
  const { server, port } = await serveEphemeral(
    () => new Response("ok"),
    ac.signal,
  );
  const res = await fetch(`http://${kHost}:${port}/`);
  assertEquals(await res.text(), "ok");
  ac.abort();
  await server.finished;
  let refused = false;
  try {
    await fetch(`http://${kHost}:${port}/`);
  } catch {
    refused = true;
  }
  assert(refused, "expected connection refused after abort");
});

unitTest("http - finished rejects when the port is busy and onListen is not called", async () => {
  const { server: first, port } = await serveEphemeral(() => new Response("first"));
  try {
    let listened = false;
    const second = serveHttp({
      port,
      hostname: kHost,
      handler: () => new Response("second"),
      onListen: () => {
        listened = true;
      },
    });
    let rejected: unknown;
    try {
      await second.finished;
    } catch (e) {
      rejected = e;
    }
    assert(rejected !== undefined, "expected finished to reject");
    assertEquals(listened, false);
    await second.shutdown(); // no throw on a server that never bound
  } finally {
    await first.shutdown();
    await first.finished;
  }
});

unitTest("http - shutdown is idempotent", async () => {
  const { server } = await serveEphemeral(() => new Response("ok"));
  await server.shutdown();
  await server.shutdown();
  await server.finished;
});

unitTest("http - upgradeWebSocket exchanges one message with the global WebSocket client", async () => {
  const serverGotMessage = Promise.withResolvers<string>();
  const { server, port } = await serveEphemeral((req) => {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("not a websocket", { status: 400 });
    }
    const { socket, response } = upgradeWebSocket(req);
    socket.onmessage = (ev) => {
      serverGotMessage.resolve(String(ev.data));
      socket.send(`echo:${ev.data}`);
    };
    return response;
  });
  try {
    const ws = new WebSocket(`ws://${kHost}:${port}/`);
    const clientGotMessage = new Promise<string>((resolve, reject) => {
      ws.onmessage = (ev) => resolve(String(ev.data));
      ws.onerror = (ev) => reject(ev);
    });
    await new Promise<void>((resolve) => ws.onopen = () => resolve());
    ws.send("ping");
    assertEquals(await serverGotMessage.promise, "ping");
    assertEquals(await clientGotMessage, "echo:ping");
    const closed = new Promise<void>((resolve) => ws.onclose = () => resolve());
    ws.close();
    await closed;
  } finally {
    await server.shutdown();
    await server.finished;
  }
});

unitTest("http - upgradeWebSocket throws on a plain request", async () => {
  assertThrows(
    () => upgradeWebSocket(new Request("http://localhost/")),
    TypeError,
  );
  await Promise.resolve();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/http.test.ts`
Expected: type-check error `Module not found "file:///.../src/deno_ral/http.ts"`.

- [ ] **Step 3: Implement `http.ts`**

```ts
/*
 * http.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * HTTP server and WebSocket upgrade. The only module that may call
 * Deno.serve / Deno.upgradeWebSocket. PR 29 reimplements it on node:http + ws;
 * tests/unit/deno-ral/http.test.ts is the contract.
 */

export interface ServeOptions {
  port: number;
  hostname?: string;
  handler: (
    req: Request,
    info: { remoteAddr: { hostname: string; port: number } },
  ) => Response | Promise<Response>;
  signal?: AbortSignal;
  onListen?: (addr: { hostname: string; port: number }) => void;
}

export interface HttpServer {
  readonly finished: Promise<void>;
  readonly addr: { hostname: string; port: number };
  shutdown(): Promise<void>;
}

export function serveHttp(options: ServeOptions): HttpServer {
  const hostname = options.hostname ?? "0.0.0.0";
  const onListen = options.onListen ??
    ((addr: { hostname: string; port: number }) => {
      console.log(`Listening on http://${addr.hostname}:${addr.port}/`);
    });
  let server: Deno.HttpServer;
  try {
    server = Deno.serve(
      {
        port: options.port,
        hostname,
        signal: options.signal,
        onListen: (addr) => onListen({ hostname: addr.hostname, port: addr.port }),
      },
      (req, info) =>
        options.handler(req, {
          remoteAddr: {
            hostname: (info.remoteAddr as Deno.NetAddr).hostname,
            port: (info.remoteAddr as Deno.NetAddr).port,
          },
        }),
    );
  } catch (e) {
    // Deno binds synchronously and throws (AddrInUse, PermissionDenied...).
    // Report it the way the Node implementation has to: through `finished`.
    const finished = Promise.reject(e);
    finished.catch(() => {}); // callers that never await finished must not see an unhandled rejection
    return {
      finished,
      addr: { hostname, port: options.port },
      shutdown: () => Promise.resolve(),
    };
  }
  let shutdownPromise: Promise<void> | undefined;
  return {
    finished: server.finished,
    get addr() {
      return { hostname: server.addr.hostname, port: server.addr.port };
    },
    shutdown: () => {
      shutdownPromise ??= server.shutdown().catch(() => {});
      return shutdownPromise;
    },
  };
}

export interface WebSocketLike {
  readonly readyState: number;
  readonly CLOSED: number;
  readonly CLOSING: number;
  send(data: string | Uint8Array): void;
  close(): void;
  onmessage: ((ev: { data: string | Uint8Array }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

function adaptWebSocket(ws: WebSocket): WebSocketLike {
  const like: WebSocketLike = {
    get readyState() {
      return ws.readyState;
    },
    CLOSED: WebSocket.CLOSED,
    CLOSING: WebSocket.CLOSING,
    send: (data) => ws.send(data),
    close: () => ws.close(),
    onmessage: null,
    onclose: null,
    onerror: null,
  };
  ws.onmessage = (ev) => like.onmessage?.({ data: ev.data });
  ws.onclose = (ev) => like.onclose?.(ev);
  ws.onerror = (ev) => like.onerror?.(ev);
  return like;
}

export function upgradeWebSocket(
  req: Request,
): { socket: WebSocketLike; response: Response } {
  // Deno throws TypeError("Invalid Header: 'upgrade' header must contain 'websocket'")
  // for a plain request; keep that behaviour (callers catch and log it).
  const { socket, response } = Deno.upgradeWebSocket(req);
  return { socket: adaptWebSocket(socket), response };
}
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/http.test.ts`
Expected: `......` then `ok | 6 passed | 0 failed`. If Deno's resource sanitizer reports a leaked `fetch` body in the abort test, read the body (`await res.text()`) before aborting, as the test does; do not disable the sanitizer.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/http.ts tests/unit/deno-ral/http.test.ts
git commit -m "deno_ral: add http.ts (serveHttp, upgradeWebSocket) with unit test"
```

### Task 2: `http-server.ts` on `serveHttp`

**Files:**
- Modify: `src/core/http-server.ts` (whole file)

- [ ] **Step 1: Replace the file**

```ts
/*
 * http-server.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { HttpServer, serveHttp } from "../deno_ral/http.ts";

export function handleHttpRequests(
  options: {
    port: number;
    hostname?: string;
    handler: (req: Request) => Promise<Response>;
    // serveHttp logs "Listening on ..." unless a callback is supplied; pass a
    // no-op to serve quietly.
    onListen?: (params: { hostname: string; port: number }) => void;
  },
): { server: HttpServer; stop: () => void } {
  const abortController = new AbortController();
  const server = serveHttp({
    port: options.port,
    hostname: options.hostname,
    handler: (req) => options.handler(req),
    onListen: options.onListen,
    signal: abortController.signal,
  });
  return {
    server,
    stop: () => {
      abortController.abort();
    },
  };
}
```

- [ ] **Step 2: Type-check**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: exit 0. If `src/command/preview/preview-shiny.ts:160` reports `Property 'port' is missing`, PR 15's fix did not land; apply it there: `onCleanup(handleHttpRequests({ ...handlerOptions, port, handler }).stop);`.

`src/project/serve/serve.ts:424-428` and `:775-781` compile unchanged: `stop` is `() => void` and `server.finished` exists on `HttpServer`. `src/command/call/axe/cmd.ts:419-422` compiles unchanged (`server.server.finished.catch(...)`).

- [ ] **Step 3: Update the comment in `src/command/call/axe/cmd.ts:413-418`**

```ts
  // The HTTP server tears down asynchronously after stop() aborts it. Exiting
  // the process mid-teardown intermittently segfaults Deno 2.7 (SIGSEGV on a
  // tokio-runtime-worker, observed three times on macOS with identical
  // stacks; "segfault at exit" is a known upstream bug family). Awaiting the
  // server's own finished promise before returning toward exit closes the
  // widest of those races.
```

- [ ] **Step 4: Run the axe and serve tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/axe-config.test.ts smoke/axe/`
Expected: `ok | N passed | 0 failed` (Chrome-dependent tests skip with a warning without Chrome).

- [ ] **Step 5: Commit**

```bash
git add src/core/http-server.ts src/command/call/axe/cmd.ts
git commit -m "core/http-server: handleHttpRequests on deno_ral/http serveHttp"
```

### Task 3: `preview.ts` on `serveHttp`

**Files:**
- Modify: `src/command/preview/preview.ts:286-301`

- [ ] **Step 1: Add the import**

Next to the `httpDevServer` import at lines 30–33:

```ts
import { serveHttp } from "../../deno_ral/http.ts";
```

- [ ] **Step 2: Replace lines 287–301**

```ts
  // serve project
  const server = serveHttp({
    signal: ac.signal,
    port: options.port!,
    hostname: options.host,
    handler: async (req: Request) => {
      try {
        return await handler(req);
      } catch (err) {
        if (err instanceof Error) {
          warning(err.message);
        }
        throw err;
      }
    },
  });
  await server.finished;
```

Also delete the stale comment at line 220 (`// const listener = Deno.listen({ port: options.port!, hostname: options.host });`), which the ratchet counts.

- [ ] **Step 3: Type-check and run the preview tests**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: exit 0.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/ unit/preview-compatibility.test.ts`
Expected: `ok | N passed | 0 failed`.

Manual: `package/dist/bin/quarto preview tests/docs/smoke-all/2023/05/24/5657-raw.qmd --no-browser` prints `Listening on http://127.0.0.1:<port>/` (unchanged from before) and `Browse at http://localhost:<port>/`; Ctrl-C exits with no stack trace.

- [ ] **Step 4: Commit**

```bash
git add src/command/preview/preview.ts
git commit -m "preview: serve through deno_ral/http serveHttp"
```

### Task 4: `http-devserver.ts` on `upgradeWebSocket`

**Files:**
- Modify: `src/core/http-devserver.ts:7-17,42-55,122-147,182-201`

- [ ] **Step 1: Import**

After line 8 (`import { join } ...`):

```ts
import { upgradeWebSocket, WebSocketLike } from "../deno_ral/http.ts";
```

- [ ] **Step 2: Client type and liveness check (lines 42–55)**

```ts
  // track clients
  interface Client {
    socket: WebSocketLike;
  }
  const clients: Client[] = [];

  // socket close handler  that waits 2 seconds (debounced) and then
  // stops the server is there are no more clients and we are not in the
  // middle of a render. don't do this for rstudio b/c rstudio manages
  // the lifetime of quarto preview directly
  const hasClients = () => {
    return isRendering() ||
      !!clients.find((client) =>
        client.socket.readyState !== client.socket.CLOSED
      );
  };
```

- [ ] **Step 3: Upgrade (lines 128–146)**

```ts
      } else {
        try {
          const { socket, response } = upgradeWebSocket(req);
          const client: Client = { socket };
          socket.onmessage = (ev) => {
            if (ev.data === "stop") {
              stopServer();
            }
          };
          if (onSocketClose) {
            socket.onclose = onSocketClose;
          }
          clients.push(client);
          return Promise.resolve(response);
        } catch (e) {
          maybeDisplaySocketError(e);
          return Promise.resolve(undefined);
        }
      }
```

- [ ] **Step 4: `reloadClients` (lines 182–201)**

```ts
    reloadClients: async (reloadTarget = "") => {
      for (let i = clients.length - 1; i >= 0; i--) {
        const socket = clients[i].socket;
        try {
          const message = "reload";
          socket.send(`${message}${reloadTarget}`);
        } catch (e) {
          maybeDisplaySocketError(e);
        } finally {
          // Pre-existing: CLOSED and CLOSING are the numeric constants 3 and
          // 2, so this condition is always false and the socket is never
          // closed here; the browser closes it when it reloads. Kept as is
          // so this PR changes no behaviour.
          if (!socket.CLOSED && !socket.CLOSING) {
            try {
              socket.close();
            } catch (e) {
              maybeDisplaySocketError(e);
            }
          }
          clients.splice(i, 1);
        }
      }
    },
```

(The `await` before `socket.send` is dropped: `send` is synchronous on both the browser API and `WebSocketLike`; awaiting `void` was a no-op.)

- [ ] **Step 5: Type-check, run tests, manual reload check**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: exit 0.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/ unit/preview-compatibility.test.ts unit/preview-brand-cache.test.ts`
Expected: `ok | N passed | 0 failed`.

Manual (the only end-to-end WebSocket check short of Playwright): `package/dist/bin/quarto preview tests/docs/smoke-all/2023/05/24/5657-raw.qmd`, open the browser, edit the title in the file, save; the page reloads and the terminal prints the re-render. Close the browser tab; after the timeout (`--timeout 5`), the preview exits (that is the `onclose` debounce path). For the structured procedure use `quarto-preview-test` skill topics "live reload" and "timeout".

- [ ] **Step 6: Commit**

```bash
git add src/core/http-devserver.ts
git commit -m "core/http-devserver: websocket clients through deno_ral/http upgradeWebSocket"
```

### Task 5: Ratchet and docs

**Files:**
- Modify: `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`

- [ ] **Step 1: Baseline**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline`
Expected: the `src/` count drops by 6 (`http-server.ts` 2 including its comment, `http-devserver.ts` 1, `preview.ts` 2 including the removed comment, `axe/cmd.ts` 1 for the rewritten comment) and the JSON file is rewritten.

- [ ] **Step 2: Rules table row**

```markdown
| `http.ts` | HTTP server, WebSocket upgrade | `serveHttp`, `upgradeWebSocket`, `HttpServer`, `WebSocketLike` |
```

- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet baseline after http.ts; document http.ts in deno-ral rules"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/http.test.ts` → `ok | 6 passed | 0 failed`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/ unit/preview-compatibility.test.ts unit/preview-brand-cache.test.ts smoke/axe/ unit/axe-config.test.ts` → all pass.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- `grep -rn 'Deno\.serve\|Deno\.upgradeWebSocket\|Deno\.listen' src --include=*.ts | grep -v '^src/deno_ral/' | grep -v extension-subtrees` → empty.
- Manual: preview live reload and timeout exit as described in Task 4 step 5; `quarto preview tests/docs/websites/search` serves the site and reloads on edit.

## Review checklist

- [ ] `serveHttp` prints the `Listening on` line only when `onListen` is omitted, exactly as `Deno.serve` did, so `quarto preview` output is unchanged.
- [ ] `hostname` default is `0.0.0.0` (what `Deno.serve` used for `preview-shiny`'s control service before).
- [ ] `WebSocketLike.readyState` is a live getter, not a snapshot.
- [ ] `http-devserver.ts` compares `readyState` against the instance's `CLOSED`, no `WebSocket` global reference left (`grep -n 'WebSocket\.' src/core/http-devserver.ts` prints nothing).
- [ ] `shutdown()` is idempotent and never rejects; a bind failure surfaces only through `finished` (no synchronous throw), matching what PR 29 can do on Node.
- [ ] `onListen` default prints `Listening on http://<host>:<port>/` (PR 29's draft assumed a no-op default; `quarto preview` and `quarto serve` relied on Deno's default line, so PR 29 must print it too).
- [ ] axe comment no longer names `Deno.serve`; axe teardown still awaits `finished`.
- [ ] Unit test closes the server in every `finally`; no sanitizer opt-outs.

## Risks and rollback

- Deno's `server.shutdown()` rejects if called after the signal already aborted the server; the wrapper swallows that so `stop(); await shutdown()` sequences are safe. If the axe command starts failing with "server already closed", the `.catch` is missing.
- `Deno.serve` with `port: 0` is used only by the unit test; production callers always pass a probed port.
- The `onListen` default message is printed with `console.log`, as Deno did; the logger is not involved, so `--quiet` does not suppress it (same as before).
- Rollback: revert the five commits.

## Decisions needed

None.
