# PR 16: `deno_ral/http.ts`; preview server, dev server, axe server on it

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put an HTTP server and WebSocket upgrade interface (`serveHttp`, `HttpServer` with `listening`/`finished`, `upgradeWebSocket`, `WebSocketLike`) in `src/deno_ral/http.ts`, implemented on `Deno.serve`/`Deno.upgradeWebSocket` for now, and move every server in `src/` onto it, with callers awaiting the bind.
**Phase:** 1. **Depends on:** PR 15 (async `findOpenPort`; the `preview-shiny.ts` port fix), PR 14b (`tests/smoke/preview/preview-reload.test.ts`), PR 08 (`writeStderrSync`), PR 02 (ratchet; `tests/asserts.ts`). **Unblocks:** PR 25, PR 29.
**Branch:** `rt/16-ral-http`.
**Suggested executor:** Opus. The WebSocket adapter must preserve the dev server's client-tracking semantics (`readyState`, `onclose` debounce), the axe command's shutdown ordering, and the exact "Listening on" line; all are easy to subtly break.
**Size:** M. 1 new module, 1 new test, 6 modified files (`src/core/http-server.ts`, `src/core/http-devserver.ts`, `src/command/preview/preview.ts`, `src/command/preview/preview-shiny.ts`, `src/project/serve/serve.ts`, `src/command/call/axe/cmd.ts`), the rules doc and the baseline.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 3.3 lists `Deno.serve` and `Deno.upgradeWebSocket` as Deno-specific runtime features used by `src/core/http-server.ts`, `src/core/http-devserver.ts`, `src/command/preview/preview.ts` and `src/command/call/axe/cmd.ts`; the Node replacement is `node:http` plus the `ws` package. Section 11, module plan row `http.ts`: `serveHttp({ port, hostname, handler, signal, onListen })` returning `{ finished, shutdown }`; `upgradeWebSocket(req)` returning a browser-shaped socket. The spike's shim (`Deno.serve` and `Deno.upgradeWebSocket` sections) is the proof that the interface below can be implemented on Node: it builds a `Request` from `http.IncomingMessage`, streams the `Response` body back, and uses `ws`'s `WebSocketServer.handleUpgrade` for upgrades.

Call sites today (verified on `main` at `b86f98d`):

- `src/core/http-server.ts:18`: `Deno.serve({ ...options, signal })` inside `handleHttpRequests`, which returns `{ server, stop }`. Callers: `src/project/serve/serve.ts:423-430` (uses `stop`, then prints `Preview service running (<port>)`), `src/project/serve/serve.ts:775-781` (uses `server.finished`), `src/command/call/axe/cmd.ts:402-422` (uses `server.stop()` and `server.server.finished`), `src/command/preview/preview-shiny.ts:160` (uses `.stop`, then prints `Preview service running`).
- `src/core/http-devserver.ts:130`: `Deno.upgradeWebSocket(req)`; the client list is typed `{ socket: WebSocket }` (line 44); `socket.readyState !== WebSocket.CLOSED` at line 54; `socket.onmessage` (132), `socket.onclose` (138), `socket.send` (69, 187), `socket.close()` (193). No consumer uses streaming responses, `req.signal`, `remoteAddr`, `onopen` or `onerror`.
- `src/command/preview/preview.ts:288-301`: `Deno.serve({ signal, port, hostname }, handler)` then `await server.finished`; it passes no `onListen`, so Deno prints its default line.
- `src/command/call/axe/cmd.ts:413-418`: a comment naming `Deno.serve` and `Deno.exit` (the code goes through `handleHttpRequests`).

Two behaviours to preserve or fix:

- **Bind failure.** `Deno.serve` binds synchronously and throws (`AddrInUse`, `PermissionDenied`); Node binds asynchronously. A layer that reports the failure only through a rejected `finished` (the first draft) silently breaks `serve.ts:423-430` and `preview-shiny.ts:160`, which never await `finished` and would print "Preview service running" with nothing listening. The layer therefore adds `listening: Promise<void>` (resolves once bound, rejects with the bind error), and both callers await it before printing.
- **Default `onListen`.** Deno's default (`ext/http/00_serve.ts:983-995` at `v2.7.14`) logs `Listening on <scheme><host>:<port>/` through `import.meta.log("info", …)`, i.e. on stderr, where `<host>` is `localhost` for `0.0.0.0`/`::` on Windows and bracketed for IPv6, and appends ` (http://localhost:<port>/)` when bound to `0.0.0.0`/`::` elsewhere. `quarto preview` relies on that line (it passes no `onListen`). The layer reproduces it exactly on stderr; a `console.log` default (first draft) would move it to stdout.

Coverage: `tests/smoke/preview/preview-reload.test.ts` (PR 14b) drives `preview.ts` and `http-devserver.ts` end to end (bind, WebSocket upgrade, `render:*`/`reload` messages, SIGTERM shutdown, port release). The new unit test pins the layer contract, including keep-alive teardown, which PR 29 must reproduce on `node:http` (where `server.close()` waits for idle keep-alive sockets unless `closeIdleConnections()` is called).

### Scope

In:
- `src/deno_ral/http.ts` with the vocabulary's `ServeOptions`, `HttpServer` (with `listening`), `serveHttp`, `WebSocketLike`, `upgradeWebSocket`.
- `src/core/http-server.ts` reimplemented on `serveHttp`; `port` becomes required (every caller passes one after PR 15).
- `serve.ts:423-430`, `preview-shiny.ts:158-162`, `axe/cmd.ts:402-412` await `server.listening`.
- `src/core/http-devserver.ts` on `upgradeWebSocket`/`WebSocketLike`.
- `src/command/preview/preview.ts` on `serveHttp`.
- `src/command/call/axe/cmd.ts` comment rewrite.
- Unit test `tests/unit/ral/http.test.ts`.

Out:
- `src/core/http.ts:228-240` `maybeDisplaySocketError` (`instanceof Deno.errors.*`): PR 10's `errors` rule.
- `src/core/http.ts:47` `Deno.readFileSync`, `http-devserver.ts:126` `Deno.readFile`: PR 10.
- The WebSocket *client* (`new WebSocket(...)` in `src/core/cri/`): browser-global API, available on Node 22+, not a runtime seam.
- The `!socket.CLOSED && !socket.CLOSING` condition at `http-devserver.ts:191`: `CLOSED`/`CLOSING` are the numeric constants 3 and 2, so the condition is always false and `socket.close()` is never reached. This PR preserves that behaviour (the browser closes the socket when it reloads); the plan adds a comment, nothing else.

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
  /** Port to bind; 0 picks an ephemeral port (read it from `addr` after `listening`). */
  port: number;
  /** Defaults to "0.0.0.0" (Deno.serve's default). */
  hostname?: string;
  handler: (
    req: Request,
    info: { remoteAddr: { hostname: string; port: number } },
  ) => Response | Promise<Response>;
  /** Aborting it stops the server; `finished` then resolves. */
  signal?: AbortSignal;
  /** Called once bound. When omitted, serveHttp writes Deno.serve's default
   * line to stderr: `Listening on http://<host>:<port>/`, plus
   * ` (http://localhost:<port>/)` when bound to 0.0.0.0 or :: (not on
   * Windows, where such a host is shown as localhost). */
  onListen?: (addr: { hostname: string; port: number }) => void;
}

export interface HttpServer {
  /** Resolves once the port is bound (after onListen ran); rejects with the
   * bind error (`isAddrInUse(e)` recognises "address in use"). */
  readonly listening: Promise<void>;
  /** Resolves after the server stops (abort or shutdown) and in-flight
   * requests finish; rejects with the bind error if it never bound. */
  readonly finished: Promise<void>;
  /** Bound address; valid after `listening` resolved. */
  readonly addr: { hostname: string; port: number };
  /** Stops accepting connections, closes idle keep-alive connections, waits
   * for in-flight requests. Idempotent; never rejects. */
  shutdown(): Promise<void>;
}

/** Starts listening and never throws synchronously: a bind failure rejects
 * `listening` and `finished` (both have a handler attached, so an unawaited
 * one is not an unhandled rejection) and `onListen` is not called. */
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
- Create: `tests/unit/ral/http.test.ts`.
- Modify: `src/core/http-server.ts:1-25` (whole file).
- Modify: `src/project/serve/serve.ts:423-430`, `src/command/preview/preview-shiny.ts:158-162` (await `listening`).
- Modify: `src/core/http-devserver.ts:7-17,42-55,122-147,182-201`.
- Modify: `src/command/preview/preview.ts:30-33,220,286-301`.
- Modify: `src/command/call/axe/cmd.ts:402-422` (await `listening`; comment rewrite).
- Modify: `.claude/rules/typescript/deno-ral.md` (module table row).
- Modify: `tools/runtime-boundary-baseline.json` (via `--update-baseline`).

### Acceptance criteria

- `grep -rn 'Deno\.serve\|Deno\.upgradeWebSocket\|Deno\.HttpServer\|Deno\.ServeHandler' src --include=*.ts | grep -v '^src/deno_ral/'` prints nothing (the comment in `axe/cmd.ts` is rewritten too).
- `grep -n 'Deno\.' tests/unit/ral/http.test.ts` prints nothing.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts` passes.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts unit/preview-brand-cache.test.ts unit/axe-config.test.ts smoke/axe/` passes.
- `quarto preview <doc> --no-browser --port 4321 2>/dev/null` prints nothing on stdout about listening, and `2>&1 >/dev/null` shows `Listening on http://127.0.0.1:4321/` (unchanged from Deno's default).
- `grep -n 'server.listening' src/project/serve/serve.ts src/command/preview/preview-shiny.ts src/command/call/axe/cmd.ts` prints one line per file (the control services report "Preview service running" only after the bind succeeded; the bind-failure path itself is pinned by the unit test "a busy port rejects listening and finished", since the control ports are chosen at random).
- Baseline count for `src` is lower by 7 (`http-server.ts` 2 including its comment, `http-devserver.ts` 1, `preview.ts` 2 including the dead `Deno.listen` comment at line 220, `axe/cmd.ts` 2 for `Deno.serve` and `Deno.exit` in its comment), committed.

## Plan

### Task 1: `http.ts` with its unit test

**Files:**
- Create: `src/deno_ral/http.ts`
- Create: `tests/unit/ral/http.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * http.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Compatibility contract for src/deno_ral/http.ts (rerun by PR 29 on Node).
 * Raw sockets come from node:net, which both runtimes provide.
 */

import { connect } from "node:net";
import { assert, assertEquals, assertThrows } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { HttpServer, serveHttp, upgradeWebSocket } from "../../../src/deno_ral/http.ts";

const kHost = "127.0.0.1";

// Serves on an ephemeral port and resolves once bound.
async function serveEphemeral(
  handler: Parameters<typeof serveHttp>[0]["handler"],
  signal?: AbortSignal,
): Promise<{ server: HttpServer; port: number }> {
  const server = serveHttp({ port: 0, hostname: kHost, handler, signal, onListen: () => {} });
  await server.listening;
  return { server, port: server.addr.port };
}

function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not happen within ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

unitTest("http - serveHttp answers a request and reports its address", async () => {
  const { server, port } = await serveEphemeral((req, info) => {
    assertEquals(info.remoteAddr.hostname, kHost);
    return new Response(`path=${new URL(req.url).pathname}`, {
      headers: { "content-type": "text/plain" },
    });
  });
  try {
    assert(port > 0);
    assertEquals(server.addr.hostname, kHost);
    const res = await fetch(`http://${kHost}:${port}/hello`);
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "path=/hello");
  } finally {
    await server.shutdown();
    await server.finished;
  }
});

unitTest("http - onListen receives the bound address before listening resolves", async () => {
  let seen: { hostname: string; port: number } | undefined;
  const server = serveHttp({
    port: 0,
    hostname: kHost,
    handler: () => new Response("ok"),
    onListen: (addr) => {
      seen = addr;
    },
  });
  await server.listening;
  assertEquals(seen, { hostname: kHost, port: server.addr.port });
  await server.shutdown();
  await server.finished;
});

unitTest("http - aborting the signal stops the server and resolves finished", async () => {
  const ac = new AbortController();
  const { server, port } = await serveEphemeral(() => new Response("ok"), ac.signal);
  const res = await fetch(`http://${kHost}:${port}/`);
  assertEquals(await res.text(), "ok");
  ac.abort();
  await within(server.finished, 5000, "finished after abort");
  let refused = false;
  try {
    await fetch(`http://${kHost}:${port}/`);
  } catch {
    refused = true;
  }
  assert(refused, "expected connection refused after abort");
});

unitTest("http - a busy port rejects listening and finished; onListen is not called", async () => {
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
    let bindError: unknown;
    try {
      await second.listening;
    } catch (e) {
      bindError = e;
    }
    assert(bindError !== undefined, "expected listening to reject");
    let finishedError: unknown;
    try {
      await second.finished;
    } catch (e) {
      finishedError = e;
    }
    assert(finishedError !== undefined, "expected finished to reject");
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

unitTest("http - shutdown closes an idle keep-alive connection and finished resolves", async () => {
  const { server, port } = await serveEphemeral(() => new Response("ok"));
  const socket = connect(port, kHost);
  const closedByServer = new Promise<void>((resolve) => socket.on("close", () => resolve()));
  const firstResponse = new Promise<string>((resolve) =>
    socket.once("data", (chunk) => resolve(String(chunk)))
  );
  socket.write(`GET / HTTP/1.1\r\nHost: ${kHost}\r\nConnection: keep-alive\r\n\r\n`);
  assert((await firstResponse).startsWith("HTTP/1.1 200"));
  // The connection is now idle and kept alive by the client.
  await within(server.shutdown(), 5000, "shutdown with an idle keep-alive client");
  await within(server.finished, 5000, "finished with an idle keep-alive client");
  await within(closedByServer, 5000, "server closing the idle connection");
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
  assertThrows(() => upgradeWebSocket(new Request("http://localhost/")), TypeError);
  await Promise.resolve();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts`
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
 * tests/unit/ral/http.test.ts is the contract.
 */

import { isWindows } from "./platform.ts";
import { writeStderrSync } from "./process.ts";

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
  readonly listening: Promise<void>;
  readonly finished: Promise<void>;
  readonly addr: { hostname: string; port: number };
  shutdown(): Promise<void>;
}

// Deno.serve's default onListen (ext/http/00_serve.ts, formatHostName and
// onListen), reproduced so `quarto preview` prints the same line on stderr.
function defaultOnListen(addr: { hostname: string; port: number }) {
  const wildcard = addr.hostname === "0.0.0.0" || addr.hostname === "::";
  const host = isWindows && wildcard
    ? "localhost"
    : addr.hostname.includes(":")
    ? `[${addr.hostname}]`
    : addr.hostname;
  const helper = host !== "localhost" && wildcard
    ? ` (http://localhost:${addr.port}/)`
    : "";
  writeStderrSync(
    new TextEncoder().encode(
      `Listening on http://${host}:${addr.port}/${helper}\n`,
    ),
  );
}

function handled(promise: Promise<void>): Promise<void> {
  // Mark as handled so a caller that never awaits it does not crash the
  // process with an unhandled rejection; awaiting it still rejects.
  promise.catch(() => {});
  return promise;
}

export function serveHttp(options: ServeOptions): HttpServer {
  const hostname = options.hostname ?? "0.0.0.0";
  const onListen = options.onListen ?? defaultOnListen;
  let server: Deno.HttpServer<Deno.NetAddr>;
  try {
    // Deno binds synchronously; onListen runs inside this call.
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
            hostname: info.remoteAddr.hostname,
            port: info.remoteAddr.port,
          },
        }),
    );
  } catch (e) {
    // Report the bind error the way the Node implementation must: through
    // the promises, never synchronously.
    const failed = handled(Promise.reject(e));
    return {
      listening: failed,
      finished: failed,
      addr: { hostname, port: options.port },
      shutdown: () => Promise.resolve(),
    };
  }
  let shutdownPromise: Promise<void> | undefined;
  return {
    listening: Promise.resolve(),
    finished: server.finished,
    get addr() {
      return { hostname: server.addr.hostname, port: server.addr.port };
    },
    shutdown: () => {
      // Deno's graceful shutdown also closes idle keep-alive connections.
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

(`Deno.HttpServer<Deno.NetAddr>`: with `hostname`/`port` options `Deno.serve` returns that type in Deno 2; if `deno check` reports the generic is not accepted, drop it and cast `server.addr as Deno.NetAddr` in the `addr` getter.)

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts`
Expected: `........` then `ok | 8 passed | 0 failed`. If Deno's resource sanitizer reports a leaked `fetch` body in the abort test, read the body (`await res.text()`) before aborting, as the test does; do not disable the sanitizer.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/http.ts tests/unit/ral/http.test.ts
git commit -m "deno_ral: add http.ts (serveHttp with listening/finished, upgradeWebSocket) with unit test"
```

### Task 2: `http-server.ts` on `serveHttp`; callers await the bind

**Files:**
- Modify: `src/core/http-server.ts` (whole file), `src/project/serve/serve.ts:423-430`, `src/command/preview/preview-shiny.ts:158-162`, `src/command/call/axe/cmd.ts:402-422`

- [ ] **Step 1: Replace `src/core/http-server.ts`**

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
    // serveHttp prints "Listening on ..." to stderr unless a callback is
    // supplied; pass a no-op to serve quietly.
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

- [ ] **Step 2: `src/project/serve/serve.ts:423-430`**

`externalPreviewServer` is async since PR 15. Replace

```ts
    ({ stop } = handleHttpRequests({
      port,
      hostname: kLocalhost,
      handler,
    }));
    // .abortController;
    info(`Preview service running (${port})`);
```

with

```ts
    const control = handleHttpRequests({
      port,
      hostname: kLocalhost,
      handler,
    });
    stop = control.stop;
    // Fail here, not later, when the port could not be bound.
    await control.server.listening;
    info(`Preview service running (${port})`);
```

- [ ] **Step 3: `src/command/preview/preview-shiny.ts:158-162`**

`runPreviewControlService` is async since PR 15. Replace

```ts
  onCleanup(
    handleHttpRequests({ port, hostname: kLocalhost, handler }).stop,
  );
  info(`Preview service running (${port})`);
```

with

```ts
  const control = handleHttpRequests({ port, hostname: kLocalhost, handler });
  onCleanup(control.stop);
  await control.server.listening;
  info(`Preview service running (${port})`);
```

- [ ] **Step 4: `src/command/call/axe/cmd.ts:402-422`**

After the `handleHttpRequests({...})` call (lines 402–411) add:

```ts
  await server.server.listening;
```

and replace the comment at lines 413–418 with:

```ts
  // The HTTP server tears down asynchronously after stop() aborts it. Exiting
  // the process mid-teardown intermittently segfaults Deno 2.7 (SIGSEGV on a
  // tokio-runtime-worker, observed three times on macOS with identical
  // stacks; "segfault at exit" is a known upstream bug family). Awaiting the
  // server's own finished promise before returning toward exit closes the
  // widest of those races.
```

(`server.server.finished.catch(() => {})` at line 421 is unchanged.)

- [ ] **Step 5: Type-check**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts`
Expected: exit 0. `serve.ts:775-781` compiles unchanged (`server.finished` exists on `HttpServer`). If `preview-shiny.ts` reports `Property 'port' is missing`, PR 15's fix did not land; apply PR 15 Task 3 step 3 here.

- [ ] **Step 6: Run the axe and preview tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/axe-config.test.ts smoke/axe/ smoke/preview/preview-reload.test.ts`
Expected: `ok | N passed | 0 failed` (Chrome-dependent tests skip with a warning without Chrome).

- [ ] **Step 7: Commit**

```bash
git add src/core/http-server.ts src/project/serve/serve.ts src/command/preview/preview-shiny.ts src/command/call/axe/cmd.ts
git commit -m "core/http-server on deno_ral/http; control services and axe await the bind before reporting"
```

### Task 3: `preview.ts` on `serveHttp`

**Files:**
- Modify: `src/command/preview/preview.ts:30-33,220,286-301`

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

(No `onListen`: the default prints Deno's line on stderr, as before. A bind failure rejects `finished`, which propagates out of `preview()` as the synchronous `Deno.serve` throw did.)

Also delete the stale comment at line 220 (`// const listener = Deno.listen({ port: options.port!, hostname: options.host });`), which the ratchet counts.

- [ ] **Step 3: Type-check and run the preview tests**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts`
Expected: exit 0.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts unit/preview-initial-path.test.ts`
Expected: `ok | N passed | 0 failed`.

Manual: `package/dist/bin/quarto preview tests/docs/smoke-all/2023/05/24/5657-raw.qmd --no-browser --port 4321 2>&1 >/dev/null | grep Listening` → `Listening on http://127.0.0.1:4321/`; the same command with `2>/dev/null | grep -c Listening` → `0` (nothing on stdout). Ctrl-C exits with no stack trace.

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

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts`
Expected: exit 0.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts unit/preview-brand-cache.test.ts`
Expected: `ok | N passed | 0 failed`. `preview-reload.test.ts` is the end-to-end check of this task: it receives `render:start`, `render:stop:true` and `reload` through `upgradeWebSocket`.

Manual (browser side and timeout path, not covered by the test): `package/dist/bin/quarto preview tests/docs/smoke-all/2023/05/24/5657-raw.qmd --timeout 5`, open the browser, edit the title, save; the page reloads. Close the tab; after 5 s the preview exits (the `onclose` debounce path). Use the `/quarto-preview-test` skill topics "live reload" and "timeout" for the structured procedure.

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
Expected: the `src` count drops by 7 (`http-server.ts` 2 including its comment, `http-devserver.ts` 1, `preview.ts` 2 including the removed comment, `axe/cmd.ts` 2 for the rewritten comment's `Deno.serve` and `Deno.exit`); `tests` unchanged. The JSON file is rewritten.

- [ ] **Step 2: Rules table row**

```markdown
| `http.ts` | HTTP server, WebSocket upgrade | `serveHttp` (`listening`, `finished`, `shutdown`), `upgradeWebSocket`, `HttpServer`, `WebSocketLike` |
```

- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet baseline after http.ts; document http.ts in deno-ral rules"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts` → `ok | 8 passed | 0 failed`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts unit/preview-brand-cache.test.ts smoke/axe/ unit/axe-config.test.ts` → all pass.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- `grep -rn 'Deno\.serve\|Deno\.upgradeWebSocket\|Deno\.listen' src --include=*.ts | grep -v '^src/deno_ral/' | grep -v extension-subtrees` → empty.
- Manual: the stderr/stdout check of Task 3 step 3; the browser reload and timeout exit of Task 4 step 5; `package/dist/bin/quarto preview tests/docs/website-image-base --no-browser` serves the website (through `src/project/serve/serve.ts`, which the automated test does not cover) and reloads on an edit of one of its pages.

## Review checklist

- [ ] `serveHttp`'s default `onListen` writes Deno's exact text to stderr (helper suffix for `0.0.0.0`/`::`, `localhost` on Windows, IPv6 brackets) and nothing to stdout.
- [ ] `listening` resolves after `onListen` and rejects on a bind error; `finished` rejects with the same error; neither produces an unhandled rejection when not awaited.
- [ ] `serve.ts`, `preview-shiny.ts` and `axe/cmd.ts` await `server.listening` before reporting or using the port.
- [ ] `hostname` default is `0.0.0.0` (Deno's); production callers pass a host.
- [ ] `WebSocketLike.readyState` is a live getter, not a snapshot.
- [ ] `http-devserver.ts` compares `readyState` against the instance's `CLOSED`, no `WebSocket` global reference left (`grep -n 'WebSocket\.' src/core/http-devserver.ts` prints nothing).
- [ ] `shutdown()` is idempotent, never rejects, and closes idle keep-alive connections (unit test); PR 29 must call `closeIdleConnections()` to match.
- [ ] axe comment no longer names `Deno.serve`/`Deno.exit`; axe teardown still awaits `finished`.
- [ ] Unit test closes the server in every `finally`; no sanitizer opt-outs; no `Deno.` in the test.

## Risks and rollback

- Deno's `server.shutdown()` rejects if called after the signal already aborted the server; the wrapper swallows that so `stop(); await shutdown()` sequences are safe. If the axe command starts failing with "server already closed", the `.catch` is missing.
- The default "Listening on" line now goes through `writeStderrSync` instead of Deno's internal logger; Deno's logger also writes to stderr, so `2>/dev/null` users see no change. `--quiet` did not suppress it before and does not now.
- Phase 2 risk recorded for Spike #2: Deno's own `node:http` is built on `Deno.serve`, so running PR 29's `node:http` + `ws` implementation on Deno 2 tests Deno's shim, not Node; the keep-alive test above is what both runtimes must pass.
- Rollback: revert the five commits.

## Decisions needed

None. Not changed because: the review asked whether a `listening` promise or an awaiting `handleHttpRequests` should fix the silent bind failure; the promise is chosen because `preview.ts` and the unit test also need it, and `handleHttpRequests` stays synchronous so its `stop` can be registered for cleanup before the bind settles.
