# PR 29: `net.ts`, `http.ts` (with `ws`) and `watch.ts` on Node APIs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement `src/deno_ral/net.ts` on `node:net`, `src/deno_ral/http.ts` on `node:http` plus the `ws` package, and `src/deno_ral/watch.ts` on `fs.watch({ recursive: true })`, so the preview server, the Jupyter kernel transport, port probing and file watching have one implementation that runs on Deno 2 today and on Node after the flip.
**Phase:** 2. **Depends on:** PR 25 (callers use the layer), PR 26 (root `package.json`, where `ws` is declared). **Unblocks:** PR 32.
**Branch:** `rt/29-ral-net-http-watch-on-node-apis`.
**Suggested executor:** Opus. Request/Response conversion, WebSocket upgrade plumbing and event coalescing need judgement.
**Size:** M (3 source files rewritten, `src/import_map.json`, `package.json`, 3 test files extended, shim shrink).
**Ships on:** Deno; the existing suite, including `smoke/preview/` and `unit/preview-*.test.ts`, must stay green. The PR 26 Node job must render the spike documents and (new in this PR's workflow step) serve a preview that a WebSocket client can reach.

## Spec

### Context

Assessment section 3.3 lists `Deno.serve`/`Deno.upgradeWebSocket` (preview, dev server, axe server), `Deno.listen`/`Deno.connect`/`Deno.Conn` (port probing, Jupyter kernel daemon) and `Deno.watchFs` (dev-mode source watch) as the runtime-shaped features with Node replacements `node:http` + `ws`, `node:net`, `fs.watch`. Section 11 gives each its own module (`net.ts`, `http.ts`, `watch.ts`) with Quarto-owned interfaces, created on Deno by PR 15, 16 and 17. Spike findings (section 10): `Deno.serve` on `node:http` and `Deno.upgradeWebSocket` on `ws` ran the preview server end to end (HTTP, `quarto-preview.js`, websocket, `render:start` push); `Deno.connect` needed a buffered `net.Socket` wrapper; port probing had to become async (done by PR 15).

Facts verified in this sandbox on Node 22.22 and Deno 2.7.14 (`node:` compat):

- `net.createServer().listen({ port, host, exclusive: true })` reports `EADDRINUSE` on a bound port; `net.createConnection` to a closed port reports `ECONNREFUSED`. Both runtimes.
- `http.createServer` + `fetch`: multiple `set-cookie` headers round-trip; `server.closeAllConnections` exists. Both runtimes.
- `ws` 8.22.0 `WebSocketServer({ noServer: true }).handleUpgrade` over a `node:http` `upgrade` event, with the runtime's global `WebSocket` client: echo round-trip succeeds on both runtimes.
- `fs.watch(dir, { recursive: true })` on Linux: a new subdirectory, a file created in it 500 ms later, a modification, a rename and a deletion are all reported (`rename`/`change` events with relative names). Deno additionally reports a `change` for the create. Node documents recursive watching on Linux since v19.1.0 (`fs.watch` history table) and it is not flagged experimental in Node 22.
- Node's `Response` constructor rejects status 101, so the websocket upgrade marker is a status-200 `Response` tracked in a `WeakSet` (as in the spike).

**Decision: `fs.watch` recursive, no `@parcel/watcher`.** The only consumer of `watchFs` is the dev-mode source watcher in `src/core/quarto.ts` (`quarto preview` restarts when a `.ts` under `src/` changes); project serving uses the polling watcher in `src/core/watch.ts` (`watchForFileChanges`), which is plain `statSync`. Node 22's Linux implementation adds inotify watches as it discovers directories, so a file written into a brand-new directory within the first milliseconds can be missed; for the dev-mode source watch that is irrelevant. If a future consumer needs guaranteed delivery on large Linux trees, the switch is one import in `watch.ts` (`@parcel/watcher` `subscribe(dir, cb)` has the same shape as the `fs.watch` callback used below) and one `dependencies` entry.

**Decision: `ws` is declared in the root `package.json` `dependencies` and in `src/import_map.json` as `"ws": "npm:ws@8.22.0"`**, so the Deno build resolves it with `npm:` (Deno runs `ws` on its `node:http`/`node:net` compat, verified above) and the Node bundle resolves it from `node_modules` through the PR 26 resolver. Types come from `@types/ws` via `// @ts-types="@types/ws"` with an import-map entry `"@types/ws": "npm:@types/ws@8.18.1"` (pin to the latest 8.x on JSR/npm at execution time if 8.18.1 is not the latest). PR 26's `check-deps.mjs` then requires both in `dependencies`; `ws` moves out of `devDependencies`.

### Scope

In:
- Rewrite `src/deno_ral/net.ts`, `src/deno_ral/http.ts`, `src/deno_ral/watch.ts` on `node:` APIs and `ws`; no `Deno.*` remains in them.
- `src/import_map.json`: `ws`, `@types/ws`. Root `package.json`: `ws` and `@types/ws` in `dependencies`; `package-lock.json` regenerated.
- Extend the PR 15/16/17 unit tests with the Node-sensitive cases listed below.
- Preview WebSocket smoke step in `.github/workflows/test-node-bundle.yml` using `dev-docs/runtime-migration/spike/tests/ws-client.mjs`.
- Shrink `tools/node-bundle/deno-shim.js` (`serve`, `upgradeWebSocket`, `connect`, `listen`, `watchFs` and their helpers).

Out:
- Callers (`src/core/http-server.ts`, `src/core/http-devserver.ts`, `src/command/preview/preview.ts`, `src/command/call/axe/cmd.ts`, `src/project/serve/serve.ts`, `src/core/port.ts`, `src/execute/jupyter/jupyter-kernel.ts`, `src/core/quarto.ts`): their signatures are the layer's; nothing changes.
- The Jupyter 1 KB temp-file workaround (`jupyter-kernel.ts` `writeKernelCommand`): it is harmless and its removal belongs with the flip (PR 37), when `Deno.Conn` is gone for good.
- HTTPS, HTTP/2, Unix sockets (no consumer: `jupyter-kernel.ts` hard-codes `tcp`).

### Interfaces

Unchanged from the shared vocabulary (`_TEMPLATE.md`, "`net.ts`", "`http.ts`", "`watch.ts`"). Behaviour made precise by this PR:

- `connectTcp({ hostname, port })`: resolves once connected; rejects with the socket error (`code: "ECONNREFUSED"` etc., recognised by `isConnectionRefused`). `read(buf)` returns bytes copied (buffered: data arriving before `read` is kept), `null` at EOF, rejects on a socket error. `write(data)` resolves with `data.length` once flushed to the kernel. `close()` destroys the socket.
- `isPortAvailable(port, hostname = "127.0.0.1")`: `true` when a listener binds with `exclusive: true` and is closed again; `false` on `EADDRINUSE` only (PR 15 contract); other errors (`EACCES` for a privileged port included) throw.
- `findOpenPort({ port, hostname = "127.0.0.1", attempts = 50 })`: returns `port` when given and available; otherwise tries random ports in `[3000, 8000)` up to `attempts` times; throws `Error("Unable to find open port")`. PR 15 kept `findOpenPort(defaultPort?)` in `src/core/port.ts` as the application API with Quarto's Chrome/Firefox-unsafe-port filter on top of the layer's generic probe; that split stays.
- `serveHttp({ port, hostname = "0.0.0.0", handler, signal, onListen })`: returns synchronously. `addr` is `{ hostname, port }` from the options until `listening`, then the bound address (`port: 0` picks an ephemeral port, read it from `addr` after `onListen`). `finished` resolves after `close`; it **rejects** with the listen error (`EADDRINUSE`) when binding fails, and `onListen` is not called (PR 16 contract). `shutdown()` stops accepting, closes idle keep-alive connections (`closeIdleConnections()`), waits for in-flight requests (`close()`), and is idempotent; after 2 s it calls `closeAllConnections()` so a stuck client cannot keep the process alive. Aborting `signal` is equivalent to `shutdown()`. A handler that throws yields a 500 and the error is logged at debug level. When `onListen` is omitted, `Listening on http://<hostname>:<port>/` is printed to stdout (PR 16 contract, matching Deno.serve).
- `upgradeWebSocket(req)`: valid only for a request delivered through the server's `upgrade` event; otherwise throws `TypeError("Request is not upgradable")`. Returns the `ws` socket (it satisfies `WebSocketLike`: `readyState`, `CLOSED`, `CLOSING`, `send`, `close`, `onmessage`/`onclose`/`onerror` setters; `onmessage` receives `{ data: string }` for text frames) and a marker `Response` (status 200) that the handler must return. If the handler returns anything else for an upgrade request, the socket is closed.
- `watchFs(paths, { recursive = true })`: one `fs.watch` per path; throws `ENOENT` synchronously for a missing path. Event mapping: `change` → `modify`; `rename` → `create` when the path exists, `remove` otherwise; a null filename → `other` with the watched root as the path. Events that arrive in the same macrotask are coalesced into one `FsEvent` per kind with de-duplicated absolute paths. `close()` stops all watchers and ends the iteration.

### Files

- Modify: `src/deno_ral/net.ts` (entire body)
- Modify: `src/deno_ral/http.ts` (entire body)
- Modify: `src/deno_ral/watch.ts` (entire body)
- Modify: `src/import_map.json` (add `ws`, `@types/ws`)
- Modify: `package.json`, `package-lock.json` (move `ws` to `dependencies`, add `@types/ws`)
- Modify: `.github/workflows/test-node-bundle.yml` (preview websocket step)
- Modify: `tools/node-bundle/deno-shim.js` (delete unused members)
- Test: `tests/unit/deno-ral/net.test.ts`, `tests/unit/deno-ral/http.test.ts`, `tests/unit/deno-ral/watch.test.ts` (PR 15/16/17 contracts; extended). Assumes these names; if PR 15–17 used others, extend the files `ls tests/unit/deno-ral/` shows.

### Acceptance criteria

- `grep -c "Deno\." src/deno_ral/net.ts src/deno_ral/http.ts src/deno_ral/watch.ts` → `0` each.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/` passes, with the new cases.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/ unit/preview-initial-path.test.ts unit/preview-external-links.test.ts unit/preview-subdir-knitr-cwd.test.ts unit/axe-postrender.test.ts smoke/jupyter/` passes.
- `node tools/node-bundle/check-deps.mjs` passes with `ws` and `@types/ws` in `dependencies`.
- The Node job's new step connects a WebSocket client to `quarto-node preview --no-browser` and receives a message.
- `quarto run --dev tools/check-runtime-boundary.ts` stays at zero; `--check-shim` lists fewer members.

## Plan

### Task 1: Dependencies (`ws`, `@types/ws`)

**Files:**
- Modify: `src/import_map.json`, `package.json`, `package-lock.json`

- [ ] **Step 1: Add the import-map entries**

In `src/import_map.json` `imports`, add (keep alphabetical with the other `npm:` entries):

```json
    "ws": "npm:ws@8.22.0",
    "@types/ws": "npm:@types/ws@8.18.1",
```

- [ ] **Step 2: Sync package.json**

Run:
```bash
node tools/node-bundle/check-deps.mjs --write
```
then remove `"ws"` from `devDependencies` by hand (it is now in `dependencies`), and:
```bash
npm install
node tools/node-bundle/check-deps.mjs
```
Expected: `package.json dependencies match src/import_map.json (N packages)` with N two higher than before.

- [ ] **Step 3: Confirm Deno resolves `ws`**

Run: `package/dist/bin/tools/x86_64/deno eval --import-map=src/import_map.json 'import { WebSocketServer } from "ws"; console.log(typeof WebSocketServer)'` (use the `tools/<arch>/deno` matching the machine).
Expected: `function`.

- [ ] **Step 4: Commit**

```bash
git add src/import_map.json package.json package-lock.json
git commit -m "deps: add ws and @types/ws for the http layer"
```

### Task 2: `net.ts`

**Files:**
- Modify: `tests/unit/deno-ral/net.test.ts` (append)
- Modify: `src/deno_ral/net.ts`

- [ ] **Step 1: Append the Node-sensitive cases to the PR 15 test**

(PR 15 already covers the echo round-trip, EOF, connection refused, a bound port and `findOpenPort`; these two add buffering before the first `read` and a write above 64 KiB.)

```ts
import { createServer } from "node:net";

unitTest("net - buffered read returns data that arrived before read() and null at EOF", async () => {
  const server = createServer((socket) => {
    socket.write("hello");
    socket.end(" world");
  });
  const port = await new Promise<number>((resolve) =>
    server.listen({ port: 0, host: "127.0.0.1" }, () => resolve((server.address() as { port: number }).port))
  );
  const conn = await connectTcp({ hostname: "127.0.0.1", port });
  await new Promise((r) => setTimeout(r, 100)); // data arrives before the first read
  const chunks: string[] = [];
  const buf = new Uint8Array(4);
  while (true) {
    const n = await conn.read(buf);
    if (n === null) break;
    chunks.push(new TextDecoder().decode(buf.subarray(0, n)));
  }
  assertEquals(chunks.join(""), "hello world");
  conn.close();
  await new Promise<void>((r) => server.close(() => r()));
});

unitTest("net - write resolves with the byte count and the peer receives it", async () => {
  let received = "";
  const server = createServer((socket) => socket.on("data", (d) => { received += d.toString(); }));
  const port = await new Promise<number>((resolve) =>
    server.listen({ port: 0, host: "127.0.0.1" }, () => resolve((server.address() as { port: number }).port))
  );
  const conn = await connectTcp({ hostname: "127.0.0.1", port });
  const data = new TextEncoder().encode("x".repeat(70000)); // > 64 KiB, the old Deno.Conn trouble zone
  assertEquals(await conn.write(data), data.length);
  await new Promise((r) => setTimeout(r, 200));
  assertEquals(received.length, data.length);
  conn.close();
  await new Promise<void>((r) => server.close(() => r()));
});
```

(Imports: `assertEquals` from `../../asserts.ts`; `connectTcp` from `../../../src/deno_ral/net.ts`.)

- [ ] **Step 2: Run on the PR 15 (Deno) body**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/net.test.ts`
Expected: the PR 15 cases pass; the new cases may pass on the Deno body too (they describe the contract). Continue.

- [ ] **Step 3: Implement**

```ts
/*
 * net.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * TCP layer on node:net. Runs on Node and on Deno 2 (node compat). Used by
 * core/port.ts (port probing) and execute/jupyter/jupyter-kernel.ts (kernel
 * daemon transport).
 */

import { createConnection, createServer, type Socket } from "node:net";

export interface TcpConnection {
  read(buf: Uint8Array): Promise<number | null>;
  write(data: Uint8Array): Promise<number>;
  close(): void;
}

// Buffers incoming chunks so read() never loses data that arrived before it
// was called (the spike found @deno/shim-deno's fd-based read failed with EAGAIN).
class BufferedTcpConnection implements TcpConnection {
  #socket: Socket;
  #chunks: Uint8Array[] = [];
  #waiters: Array<() => void> = [];
  #ended = false;
  #error: Error | undefined;

  constructor(socket: Socket) {
    this.#socket = socket;
    socket.on("data", (d: Buffer) => {
      this.#chunks.push(new Uint8Array(d.buffer, d.byteOffset, d.byteLength));
      this.#wake();
    });
    socket.on("end", () => { this.#ended = true; this.#wake(); });
    socket.on("close", () => { this.#ended = true; this.#wake(); });
    socket.on("error", (e: Error) => { this.#error = e; this.#ended = true; this.#wake(); });
  }

  #wake() {
    for (const w of this.#waiters.splice(0)) w();
  }

  async read(buf: Uint8Array): Promise<number | null> {
    while (this.#chunks.length === 0) {
      if (this.#error) throw this.#error;
      if (this.#ended) return null;
      await new Promise<void>((r) => this.#waiters.push(r));
    }
    const head = this.#chunks[0];
    const n = Math.min(head.length, buf.length);
    buf.set(head.subarray(0, n));
    if (n < head.length) this.#chunks[0] = head.subarray(n);
    else this.#chunks.shift();
    return n;
  }

  write(data: Uint8Array): Promise<number> {
    return new Promise((resolve, reject) => {
      this.#socket.write(data, (e?: Error | null) => (e ? reject(e) : resolve(data.length)));
    });
  }

  close(): void {
    this.#socket.destroy();
  }
}

export function connectTcp(options: { hostname: string; port: number }): Promise<TcpConnection> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: options.hostname, port: options.port });
    const onError = (e: Error) => reject(e);
    socket.once("error", onError);
    socket.once("connect", () => {
      socket.off("error", onError);
      socket.setNoDelay(true);
      resolve(new BufferedTcpConnection(socket));
    });
  });
}

export function isPortAvailable(port: number, hostname = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "EADDRINUSE") resolve(false);
      else reject(e);
    });
    server.listen({ port, host: hostname, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

const kMinPort = 3000;
const kMaxPort = 8000;

export async function findOpenPort(
  options: { port?: number; hostname?: string; attempts?: number } = {},
): Promise<number> {
  const hostname = options.hostname ?? "127.0.0.1";
  const attempts = options.attempts ?? 50;
  if (options.port !== undefined && await isPortAvailable(options.port, hostname)) {
    return options.port;
  }
  for (let i = 0; i < attempts; i++) {
    const port = kMinPort + Math.floor(Math.random() * (kMaxPort - kMinPort));
    if (await isPortAvailable(port, hostname)) return port;
  }
  throw new Error("Unable to find open port");
}
```

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/net.test.ts unit/chrome-launch.test.ts smoke/jupyter/`
Expected: all green (the Jupyter kernel daemon talks to the kernel over `connectTcp`; `chrome-launch` uses `findOpenPort`).

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/net.ts tests/unit/deno-ral/net.test.ts
git commit -m "deno_ral/net: buffered TCP connection and async port probing on node:net"
```

### Task 3: `http.ts`

**Files:**
- Modify: `tests/unit/deno-ral/http.test.ts` (append)
- Modify: `src/deno_ral/http.ts`

- [ ] **Step 1: Append the Node-sensitive cases to the PR 16 test**

```ts
unitTest("http - request body streams in, multiple set-cookie stream out", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  const server = serveHttp({
    port,
    hostname: "127.0.0.1",
    onListen: () => {},
    handler: async (req) => {
      const body = await req.text();
      const headers = new Headers({ "content-type": "text/plain" });
      headers.append("set-cookie", "a=1; Path=/");
      headers.append("set-cookie", "b=2; Path=/");
      return new Response(`${req.method}:${body.length}`, { status: 201, headers });
    },
  });
  const res = await fetch(`http://127.0.0.1:${port}/x`, { method: "POST", body: "y".repeat(100000) });
  assertEquals(res.status, 201);
  assertEquals(await res.text(), "POST:100000");
  assertEquals(res.headers.getSetCookie(), ["a=1; Path=/", "b=2; Path=/"]);
  await server.shutdown();
  await server.finished;
});

unitTest("http - abort signal closes keep-alive connections and resolves finished", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  const ac = new AbortController();
  const server = serveHttp({ port, hostname: "127.0.0.1", signal: ac.signal, onListen: () => {}, handler: () => new Response("ok") });
  assertEquals(await (await fetch(`http://127.0.0.1:${port}/`)).text(), "ok");
  const t0 = Date.now();
  ac.abort();
  await server.finished;
  assert(Date.now() - t0 < 2000, "finished should not wait for keep-alive timeouts");
  assertEquals(await isPortAvailable(port, "127.0.0.1"), true);
});

unitTest("http - upgradeWebSocket echoes a text frame through ws", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  const server = serveHttp({
    port,
    hostname: "127.0.0.1",
    onListen: () => {},
    handler: (req) => {
      if (req.headers.get("upgrade") === "websocket") {
        const { socket, response } = upgradeWebSocket(req);
        socket.onmessage = (ev) => socket.send(`echo:${ev.data}`);
        return response;
      }
      return new Response("plain");
    },
  });
  assertEquals(await (await fetch(`http://127.0.0.1:${port}/`)).text(), "plain");
  const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const got = await new Promise<string>((resolve, reject) => {
    client.onopen = () => client.send("hi");
    client.onmessage = (ev) => resolve(String(ev.data));
    client.onerror = () => reject(new Error("websocket error"));
    setTimeout(() => reject(new Error("timeout")), 5000);
  });
  assertEquals(got, "echo:hi");
  client.close();
  await server.shutdown();
});
```

(Imports: `assert`, `assertEquals` from `../../asserts.ts`; `serveHttp`, `upgradeWebSocket` from `../../../src/deno_ral/http.ts`; `findOpenPort`, `isPortAvailable` from `../../../src/deno_ral/net.ts`. PR 16 already covers the busy-port rejection, the plain-request `TypeError`, idempotent `shutdown` and the basic upgrade; these add request-body streaming, multiple `set-cookie`, keep-alive teardown and the `ws`-backed echo.)

- [ ] **Step 2: Run on the PR 16 (Deno) body**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/http.test.ts`
Expected: PR 16's cases pass; the new ones may pass too (they state the contract for the Node body).

- [ ] **Step 3: Implement**

```ts
/*
 * http.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * HTTP server layer on node:http plus `ws` for the WebSocket server (Node has
 * a WebSocket client but no server). Runs on Node and on Deno 2 (node compat).
 * Users: core/http-server.ts, core/http-devserver.ts, command/preview/preview.ts,
 * command/call/axe/cmd.ts.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { Readable } from "node:stream";
// @ts-types="@types/ws"
import { WebSocketServer } from "ws";
import { debug } from "./log.ts";

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

interface UpgradeContext {
  req: IncomingMessage;
  socket: Duplex;
  head: Buffer;
}

// Requests delivered through the `upgrade` event, keyed by the Request object
// handed to the handler, and the marker responses upgradeWebSocket() returns.
const upgradable = new WeakMap<Request, UpgradeContext>();
const upgraded = new WeakSet<Response>();
const wss = new WebSocketServer({ noServer: true });

function toRequest(req: IncomingMessage, hostname: string, port: number): Request {
  const url = `http://${req.headers.host ?? `${hostname}:${port}`}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }
  const hasBody = !(req.method === "GET" || req.method === "HEAD");
  const init: RequestInit & { duplex?: "half" } = { method: req.method, headers };
  if (hasBody) {
    init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    init.duplex = "half";
  }
  return new Request(url, init);
}

async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  for (const [k, v] of response.headers) {
    if (k !== "set-cookie") res.setHeader(k, v);
  }
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  if (response.body) {
    for await (const chunk of response.body) {
      if (!res.write(chunk)) {
        await new Promise<void>((r) => res.once("drain", r));
      }
    }
  }
  res.end();
}

function remote(req: IncomingMessage): { remoteAddr: { hostname: string; port: number } } {
  return { remoteAddr: { hostname: req.socket.remoteAddress ?? "", port: req.socket.remotePort ?? 0 } };
}

export function serveHttp(options: ServeOptions): HttpServer {
  const hostname = options.hostname ?? "0.0.0.0";
  const server: Server = createServer();
  let bound: { hostname: string; port: number } = { hostname, port: options.port };

  server.on("request", async (req, res) => {
    try {
      await sendResponse(res, await options.handler(toRequest(req, hostname, options.port), remote(req)));
    } catch (e) {
      debug(`[http] handler error: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    }
  });

  server.on("upgrade", async (req, socket, head) => {
    const request = toRequest(req, hostname, options.port);
    upgradable.set(request, { req, socket, head });
    try {
      const response = await options.handler(request, remote(req));
      if (!upgraded.has(response)) {
        socket.write(`HTTP/1.1 ${response.status} ${response.statusText || "Upgrade Refused"}\r\nConnection: close\r\n\r\n`);
        socket.destroy();
      }
    } catch (e) {
      debug(`[http] upgrade handler error: ${e instanceof Error ? e.message : String(e)}`);
      socket.destroy();
    } finally {
      upgradable.delete(request);
    }
  });

  let resolveFinished!: () => void;
  let rejectFinished!: (e: Error) => void;
  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });
  // A listen error is the only error that ends the server; surface it on
  // `finished`, which every caller awaits (preview.ts, serve.ts, axe).
  server.once("error", (e: Error) => rejectFinished(e));
  server.on("close", () => resolveFinished());
  // Callers that only call shutdown() must not see an unhandled rejection.
  finished.catch(() => {});

  server.listen({ port: options.port, host: hostname, exclusive: true }, () => {
    const address = server.address();
    if (address && typeof address === "object") {
      bound = { hostname: address.address, port: address.port };
    }
    if (options.onListen) {
      options.onListen(bound);
    } else {
      console.log(`Listening on http://${bound.hostname}:${bound.port}/`);
    }
  });

  let shuttingDown: Promise<void> | undefined;
  const shutdown = () => {
    if (shuttingDown) return shuttingDown;
    shuttingDown = new Promise<void>((resolve) => {
      if (!server.listening) {
        resolve();
        return;
      }
      // Graceful: stop accepting, drop idle keep-alive sockets, let in-flight
      // requests finish; force the rest after a bounded wait.
      server.closeIdleConnections();
      const force = setTimeout(() => server.closeAllConnections(), 2000);
      server.close(() => {
        clearTimeout(force);
        resolve();
      });
    });
    return shuttingDown;
  };
  options.signal?.addEventListener("abort", () => void shutdown(), { once: true });

  return {
    finished,
    get addr() {
      return bound;
    },
    shutdown,
  };
}

export function upgradeWebSocket(req: Request): { socket: WebSocketLike; response: Response } {
  const ctx = upgradable.get(req);
  if (!ctx) {
    throw new TypeError("Request is not upgradable");
  }
  let socket: WebSocketLike | undefined;
  // handleUpgrade writes the 101 handshake itself and calls back synchronously.
  wss.handleUpgrade(ctx.req, ctx.socket, ctx.head, (ws) => {
    socket = ws as unknown as WebSocketLike;
  });
  if (!socket) {
    throw new TypeError("WebSocket handshake failed");
  }
  // Node's Response rejects status 101; this marker tells the upgrade handler
  // the socket was taken over.
  const response = new Response(null, { status: 200 });
  upgraded.add(response);
  return { socket, response };
}
```

`ws`'s `onmessage` delivers `MessageEvent.data` as a string for text frames and a `Buffer` for binary ones; `core/http-devserver.ts` only sends and receives text. If the type checker complains about the `ws as unknown as WebSocketLike` cast, widen `WebSocketLike.onmessage`'s parameter to `{ data: string | Uint8Array | ArrayBuffer }` in the vocabulary comment and here.

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/http.test.ts smoke/preview/ unit/preview-initial-path.test.ts unit/preview-external-links.test.ts unit/axe-postrender.test.ts`
Expected: all green. `smoke/preview/` exercises `quarto preview` end to end (HTTP + websocket reload) on Deno through the new `node:http` body.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/http.ts tests/unit/deno-ral/http.test.ts
git commit -m "deno_ral/http: server on node:http with ws-based upgrades"
```

### Task 4: `watch.ts`

**Files:**
- Modify: `tests/unit/deno-ral/watch.test.ts` (append)
- Modify: `src/deno_ral/watch.ts`

- [ ] **Step 1: Append the Node-sensitive cases to the PR 17 test**

```ts
async function collect(watcher: FsWatcher, ms: number): Promise<FsEvent[]> {
  const events: FsEvent[] = [];
  const timer = setTimeout(() => watcher.close(), ms);
  for await (const ev of watcher) events.push(ev);
  clearTimeout(timer);
  return events;
}

unitTest("watch - create, modify and remove in a new nested directory are reported with absolute paths", async () => {
  const dir = makeTempDirSync({ prefix: "rt29-watch-" });
  const watcher = watchFs([dir], { recursive: true });
  const collecting = collect(watcher, 2500);
  await new Promise((r) => setTimeout(r, 200));
  mkdirSync(join(dir, "sub"));
  await new Promise((r) => setTimeout(r, 400));
  writeTextFileSync(join(dir, "sub", "a.ts"), "1");
  await new Promise((r) => setTimeout(r, 400));
  writeTextFileSync(join(dir, "sub", "a.ts"), "22");
  await new Promise((r) => setTimeout(r, 400));
  removeSync(join(dir, "sub", "a.ts"));
  const events = await collecting;
  const kindsFor = (name: string) =>
    events.filter((e) => e.paths.some((p) => p.endsWith(name))).map((e) => e.kind);
  assert(events.every((e) => e.paths.every((p) => isAbsolute(p))), "paths are absolute");
  assert(kindsFor(join("sub", "a.ts")).includes("create"), `expected create for sub/a.ts in ${JSON.stringify(events)}`);
  assert(kindsFor(join("sub", "a.ts")).includes("modify"), `expected modify for sub/a.ts in ${JSON.stringify(events)}`);
  assert(kindsFor(join("sub", "a.ts")).includes("remove"), `expected remove for sub/a.ts in ${JSON.stringify(events)}`);
  removeSync(dir, { recursive: true });
});

```

(Imports: `assert` from `../../asserts.ts`; `type FsEvent`, `type FsWatcher`, `watchFs` from `../../../src/deno_ral/watch.ts`; `mkdirSync`, `removeSync`, `writeTextFileSync` from `../../../src/deno_ral/fs.ts`; `isAbsolute`, `join` from `../../../src/deno_ral/path.ts`; `makeTempDirSync` from `../../../src/deno_ral/temp.ts`. PR 17 already covers create/modify at the top level, idempotent `close` and the missing-path throw; this adds the nested new directory and `remove`.)

- [ ] **Step 2: Run and observe**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/watch.test.ts`
Expected: the PR 17 (Deno.watchFs) body likely passes these; they are the contract for the Node body.

- [ ] **Step 3: Implement**

```ts
/*
 * watch.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Filesystem watching on fs.watch({ recursive: true }). Runs on Node 22+ and
 * on Deno 2 (node compat). Only consumer: the dev-mode source watcher in
 * core/quarto.ts; project serving polls (core/watch.ts).
 * Decision record: dev-docs/runtime-migration/29-ral-net-http-watch-on-node-apis.md
 * (fs.watch over @parcel/watcher).
 */

import { existsSync, type FSWatcher, watch } from "node:fs";
import { join, resolve } from "node:path";

export interface FsEvent {
  kind: "create" | "modify" | "remove" | "rename" | "other";
  paths: string[];
}

export interface FsWatcher extends AsyncIterable<FsEvent> {
  close(): void;
}

export function watchFs(paths: string[], options?: { recursive?: boolean }): FsWatcher {
  const recursive = options?.recursive ?? true;
  const pending = new Map<FsEvent["kind"], Set<string>>();
  const queue: FsEvent[] = [];
  const waiters: Array<() => void> = [];
  let closed = false;
  let flushScheduled = false;

  const wake = () => {
    for (const w of waiters.splice(0)) w();
  };
  // Coalesce everything that arrived in this macrotask into one event per kind.
  const flush = () => {
    flushScheduled = false;
    for (const [kind, set] of pending) {
      queue.push({ kind, paths: [...set] });
    }
    pending.clear();
    wake();
  };
  const push = (kind: FsEvent["kind"], path: string) => {
    if (closed) return;
    if (!pending.has(kind)) pending.set(kind, new Set());
    pending.get(kind)!.add(path);
    if (!flushScheduled) {
      flushScheduled = true;
      setImmediate(flush);
    }
  };

  // fs.watch throws ENOENT synchronously for a missing path, like Deno.watchFs.
  const watchers: FSWatcher[] = paths.map((root) => {
    const absRoot = resolve(root);
    const w = watch(absRoot, { recursive, persistent: true }, (eventType, filename) => {
      if (filename === null || filename === undefined) {
        push("other", absRoot);
        return;
      }
      const full = join(absRoot, filename.toString());
      if (eventType === "change") {
        push("modify", full);
      } else {
        push(existsSync(full) ? "create" : "remove", full);
      }
    });
    w.on("error", () => push("other", absRoot));
    return w;
  });

  return {
    close() {
      if (closed) return;
      closed = true;
      for (const w of watchers) w.close();
      wake();
    },
    async *[Symbol.asyncIterator]() {
      while (!closed) {
        if (queue.length > 0) {
          yield queue.shift()!;
          continue;
        }
        await new Promise<void>((r) => waiters.push(r));
      }
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/watch.test.ts`
Expected: all green.

- [ ] **Step 5: Manual dev-mode check**

Run: `QUARTO_DEBUG=true package/dist/bin/quarto preview dev-docs/runtime-migration/spike/tests/simple.qmd --no-browser --port 4399` in one terminal; in another `touch src/core/watch.ts`.
Expected: the preview prints `quarto src code changed` (from `terminatePreview` in `src/core/quarto.ts`) and exits.

- [ ] **Step 6: Commit**

```bash
git add src/deno_ral/watch.ts tests/unit/deno-ral/watch.test.ts
git commit -m "deno_ral/watch: fs.watch recursive with coalesced events"
```

### Task 5: Node job preview smoke, shim shrink

**Files:**
- Modify: `.github/workflows/test-node-bundle.yml`
- Modify: `tools/node-bundle/deno-shim.js`

- [ ] **Step 1: Add a preview websocket step after "Version and check"**

```yaml
      - name: Preview server answers a WebSocket client
        shell: bash
        run: |
          cp -r "$SPIKE_TESTS" "$RUNNER_TEMP/preview"
          tools/node-bundle/quarto-node preview "$RUNNER_TEMP/preview/simple.qmd" --no-browser --port 4321 > preview.log 2>&1 &
          PREVIEW_PID=$!
          for i in $(seq 1 60); do
            if grep -q "Browse at" preview.log; then break; fi
            sleep 1
          done
          grep -q "Browse at" preview.log || { echo "::error::preview did not start"; cat preview.log; kill $PREVIEW_PID; exit 1; }
          node "$SPIKE_TESTS/ws-client.mjs" 4321 /
          status=$?
          kill $PREVIEW_PID || true
          cat preview.log
          exit $status
```

`ws-client.mjs` resolves `ws` from the root `node_modules` (`npm ci` ran earlier); it prints `ws: connected` and exits 0 on the first message (the dev server pushes `reload`/`render:start` frames on connect).

- [ ] **Step 2: Rebuild, shrink the shim**

Run: `node tools/node-bundle/build.mjs --check-shim`
Expected: `0 missing` and `serve`, `upgradeWebSocket`, `connect`, `listen`, `watchFs` reported unused. Delete those members and their helpers (`toRequest`, `sendResponse`, `Conn`, `upgradable`, `upgraded`, `wss`, the `ws`/`http`/`net` imports if nothing else uses them) from `deno-shim.js`; rebuild; `0 missing` again.

- [ ] **Step 3: Run the preview smoke locally**

Run the step's commands by hand with `SPIKE_TESTS=dev-docs/runtime-migration/spike/tests` and `RUNNER_TEMP=/tmp/rt29`.
Expected: `ws: connected`, `ws: message …`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test-node-bundle.yml tools/node-bundle/deno-shim.js
git commit -m "node-bundle: preview websocket smoke; drop net/http/watch shim members"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/` → green.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/ smoke/jupyter/ unit/preview-initial-path.test.ts unit/preview-external-links.test.ts unit/preview-subdir-knitr-cwd.test.ts unit/preview-brand-cache.test.ts unit/axe-postrender.test.ts unit/chrome-launch.test.ts` → green.
- `grep -c "Deno\." src/deno_ral/net.ts src/deno_ral/http.ts src/deno_ral/watch.ts` → `0` each.
- `node tools/node-bundle/check-deps.mjs` → match; `node tools/node-bundle/build.mjs --check-shim` → `0 missing`.
- `quarto run --dev tools/check-runtime-boundary.ts` → zero.
- Manual: `package/dist/bin/quarto preview dev-docs/runtime-migration/spike/tests/website --no-browser`, open the URL, edit `about.qmd`, confirm the page reloads (websocket push through `ws`).
- Manual: `package/dist/bin/quarto call axe dev-docs/runtime-migration/spike/tests/website/_site` after rendering (serves the site dir on `serveHttp`, `findOpenPort`).
- Windows CI: the normal Deno matrix runs `smoke/preview/` on Windows; `fs.watch` recursive and `ws` are native there.

## Review checklist

- [ ] `connectTcp` rejects with the socket error; `read` is buffered and returns `null` at EOF; `write` resolves with the byte count.
- [ ] `isPortAvailable` uses `exclusive: true`, returns `false` on `EADDRINUSE` only, throws otherwise; the server is `unref`'d.
- [ ] `serveHttp` returns synchronously, `finished` rejects on listen errors, `onListen` runs only after `listening` (default prints `Listening on …`), `shutdown` is idempotent and graceful (`closeIdleConnections`, `close`, forced after 2 s), abort equals shutdown, default hostname `0.0.0.0`.
- [ ] Request bodies use `duplex: "half"`; `set-cookie` is sent as an array; response bodies respect `drain`.
- [ ] `upgradeWebSocket` throws `TypeError` for non-upgrade requests; a handler that does not return the marker response gets the socket closed; the marker is a status-200 `Response`.
- [ ] `watchFs` throws synchronously on a missing path, maps `rename` by existence, coalesces per macrotask, `close()` ends iteration.
- [ ] `ws` and `@types/ws` are in `src/import_map.json` and `package.json` `dependencies`; `check-deps.mjs` passes; `@ts-types` points at the import-map name, not an `npm:` URL.
- [ ] No `Deno.` in the three files; the shim lost `serve`, `upgradeWebSocket`, `connect`, `listen`, `watchFs`.

## Risks and rollback

- **Deno's `node:http` compat differs from Node** in edge cases (chunked uploads, header casing). `smoke/preview/` and the unit tests cover Quarto's usage (GET/POST JSON, static files, websocket). If a Deno-only failure appears, keep the Node body and add a guarded `runtime().name === "deno"` branch for that one operation, not a parallel implementation.
- **Listen errors now surface asynchronously.** `preview.ts` awaits `server.finished`, `serve.ts` awaits it too, `axe/cmd.ts` calls `stop()` then awaits `finished.catch(() => {})`. A caller that ignored `finished` would miss `EADDRINUSE`; the grep in the Review checklist (`server.finished`) confirms all three await it.
- **`fs.watch` recursive limitations on Linux** (missed events in brand-new directories): the single consumer is the dev-mode source watch; documented fallback is `@parcel/watcher`.
- **Whole-PR rollback:** revert the five commits; the import-map `ws` entry is harmless to keep.

## Decisions needed

None. The `fs.watch` decision and the `ws` placement are recorded above with the evidence.
