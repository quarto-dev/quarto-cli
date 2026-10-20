# PR 29: `net.ts`, `http.ts` (with `ws`) and `watch.ts` on Node APIs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement `src/deno_ral/net.ts` on `node:net`, `src/deno_ral/http.ts` on `node:http` plus the `ws` package, and `src/deno_ral/watch.ts` on `fs.watch({ recursive: true })`, so the preview server, the Jupyter kernel transport, port probing and file watching have one implementation that runs on Deno 2 today and on Node after the flip.
**Phase:** 2. **Depends on:** PR 25 (callers use the layer), PR 26 (root `package.json` where `ws` is declared, the shim, the `node-unit` job), PR 27b (`runtime()` answers `node` in the bundle; `watch.ts` reads it), PR 14b (`tests/smoke/preview/preview-reload.test.ts`, `tests/smoke/preview/preview-project-reload.test.ts`, `tests/smoke/jupyter/daemon.test.ts`: the end-to-end coverage this rewrite is gated on). Starts after Spike #2 closes (`SPIKES.md`, questions (b), (c), (g)). **Unblocks:** PR 31, 32.
**Branch:** `rt/29-ral-net-http-watch-on-node-apis`.
**Suggested executor:** Opus. Request/Response conversion, WebSocket upgrade plumbing and event coalescing need judgement.
**Size:** M (3 source files rewritten, `src/import_map.json`, `package.json`, 3 test files extended, shim shrink).
**Ships on:** Deno; the existing suite, including PR 14b's `smoke/preview/preview-reload.test.ts`, `smoke/preview/preview-project-reload.test.ts` and `unit/preview-*.test.ts`, must stay green. Node: the PR 26 `node-unit` job runs `tests/unit/ral/{net,http,watch}.test.ts` on real Node (Linux, Windows) and their entries in `tools/node-bundle/known-failures.json` are removed; the `node-render` job gains a step that serves a preview a WebSocket client reaches.

## Spec

### Context

Assessment section 3.3 lists `Deno.serve`/`Deno.upgradeWebSocket` (preview, dev server, axe server), `Deno.listen`/`Deno.connect`/`Deno.Conn` (port probing, Jupyter kernel daemon) and `Deno.watchFs` (dev-mode source watch) as the runtime-shaped features with Node replacements `node:http` + `ws`, `node:net`, `fs.watch`. Section 11 gives each its own module (`net.ts`, `http.ts`, `watch.ts`) with Quarto-owned interfaces, created on Deno by PR 15, 16 and 17. Spike findings (section 10): `Deno.serve` on `node:http` and `Deno.upgradeWebSocket` on `ws` ran the preview server end to end (HTTP, `quarto-preview.js`, websocket, `render:start` push); `Deno.connect` needed a buffered `net.Socket` wrapper; port probing had to become async (done by PR 15).

Facts verified in this sandbox on Node 22.22 and Deno 2.7.14 (`node:` compat):

- `net.createServer().listen({ port, host, exclusive: true })` reports `EADDRINUSE` on a bound port; `net.createConnection` to a closed port reports `ECONNREFUSED`. Both runtimes.
- `http.createServer` + `fetch`: multiple `set-cookie` headers round-trip; `server.closeAllConnections` exists. Both runtimes.
- `ws` 8.22.0 `WebSocketServer({ noServer: true }).handleUpgrade` over a `node:http` `upgrade` event, with the runtime's global `WebSocket` client: echo round-trip succeeds on both runtimes.
- `fs.watch(dir, { recursive: true })` on Linux: a new subdirectory, a file created in it 500 ms later, a modification, a rename and a deletion are all reported (`rename`/`change` events with relative names). Deno additionally reports a `change` for the create. Node documents recursive watching on Linux since v19.1.0 (`fs.watch` history table) and it is not flagged experimental in Node 22 or 26.
- Node's `Response` constructor rejects status 101, so the websocket upgrade marker is a status-200 `Response` tracked in a `WeakSet` (as in the spike).
- Server lifecycle on Node 22 (measured for R07; Deno's `node:http` not checked, see Risks): `server.listening` is `false` when `listen()` returns, for an IP host as for a hostname, and `close()` called before the bind settles answers `ERR_SERVER_NOT_RUNNING`; awaiting the `listening` promise and then calling `close()` settles in under 10 ms for both kinds of host, and the same sequence racing a bind failure ends with the bind error. `closeAllConnections()` does not touch a socket handed to the `upgrade` event, `getConnections()` keeps counting it, and `close()`'s callback waits for it: a server with one live WebSocket never reaches `finished` unless the layer closes that socket. `ws` 8's `WebSocketServer.close()` does not close its clients (8.0 change); `ws.close(1001)` to the runtime's `WebSocket` client completes the handshake and frees the server in about 60 ms, to a peer that ignores the close frame the socket stays `CLOSING` (ws's own close timeout is 30 s) and `terminate()` ends it at once. `IncomingMessage`'s `close` fires after every completed response (Node ≥ 16), so it is not a disconnect signal; `ServerResponse`'s `close` with `writableFinished === false` is, and when a client leaves mid-body `drain` never fires while that `close` does. `addEventListener("abort")` on an already-aborted signal never fires; `new Request(url, { signal })` follows the controller. A socket handed to `upgrade` is paused: a client that leaves while the handler is still pending is not noticed until `handleUpgrade` resumes it. The `http.ts` body of Task 3 and the ten cases of its Step 1 were run as written on Node 22.22 with `ws` 8.22 (type-stripped, `net.ts` from Task 2, a stub `log.ts`): all pass, the deaf-peer case in about 2 s; the previous body hangs on four of the five R07 cases and fails the fifth. The re-read of the review's "Later validation" lines (2026-10-16) added the two bind cases (a hostname still being resolved, a bind that fails under the shutdown) and ran the twelve cases again on Node 26.12.0 and 22.22, all passing on both.

Review findings on the earlier draft, all addressed here: it relied on `tests/smoke/preview/`, which did not exist (PR 14b now creates `tests/smoke/preview/preview-reload.test.ts`: serve, WebSocket, file change → reload, shutdown; it is this PR's end-to-end gate); `server.once("error")` left every later server error unhandled (an `error` event without a listener crashes the process): the server now keeps an `on("error")` listener for its whole life; `server.closeIdleConnections()` had only been checked on Node (Spike #2 (g) checks Deno; the call is guarded and the 2 s `closeAllConnections()` fallback stays); `fs.watch` on Deno 2.9 has denoland/deno#36937 (a watcher opened on a directory that was deleted and recreated receives no events): the watcher now re-creates itself when a watched root reappears and falls back to polling for that root where Spike #2 (c) found re-created watchers deaf, with `QUARTO_WATCH_POLLING=1` forcing polling everywhere. Vocabulary changes applied: `HttpServer.listening: Promise<void>` (rejects on bind failure), the default `onListen` prints `Listening on http://<host>:<port>/` to **stderr**, `findOpenPort`'s default `attempts` is 100, `ws` 8.22. Codex review R07 (`REVIEW-2026-10-16.md`; triage decision A7) on the draft of this PR: `shutdown()` resolved while a bind was still pending, upgraded sockets were nobody's to close, a response wait on `drain` never settled when the client left and the `Request` had no disconnect signal. The "Server lifecycle" rule in Interfaces answers all three, with the measurements above as the evidence.

**Decision: `fs.watch` recursive, no `@parcel/watcher`.** The only consumer of `watchFs` is the dev-mode source watcher in `src/core/quarto.ts` (`quarto preview` restarts when a `.ts` under `src/` changes); project serving uses the polling watcher in `src/core/watch.ts` (`watchForFileChanges`), which is plain `statSync`. Node 22's Linux implementation adds inotify watches as it discovers directories, so a file written into a brand-new directory within the first milliseconds can be missed; for the dev-mode source watch that is irrelevant. If a future consumer needs guaranteed delivery on large Linux trees, the switch is one import in `watch.ts` (`@parcel/watcher` `subscribe(dir, cb)` has the same shape as the `fs.watch` callback used below) and one `dependencies` entry. The polling fallback in `watch.ts` (a stat snapshot every 500 ms, the same approach as `src/core/watch.ts`) covers the recreated-root case and network or container file systems where native events are unreliable.

**Decision: `ws` is declared in the root `package.json` `dependencies` and in `src/import_map.json` as `"ws": "npm:ws@8.22.0"`**, so the Deno build resolves it with `npm:` (Deno runs `ws` on its `node:http`/`node:net` compat, verified above) and the Node bundle resolves it from `node_modules` through the PR 26 resolver. Types come from `@types/ws` via `// @ts-types="@types/ws"` with an import-map entry `"@types/ws": "npm:@types/ws@8.18.1"` (pin to the latest 8.x on JSR/npm at execution time if 8.18.1 is not the latest). PR 26's `check-deps.mjs` then requires both in `dependencies`; `ws` moves out of `devDependencies`.

### Scope

In:
- Rewrite `src/deno_ral/net.ts`, `src/deno_ral/http.ts`, `src/deno_ral/watch.ts` on `node:` APIs and `ws`; no `Deno.*` remains in them.
- `src/import_map.json`: `ws`, `@types/ws`. Root `package.json`: `ws` and `@types/ws` in `dependencies`; `package-lock.json` regenerated.
- Extend the PR 15/16/17 unit tests with the Node-sensitive cases listed below.
- Preview WebSocket smoke step in `.github/workflows/test-node-bundle.yml` using `dev-docs/runtime-migration/spike/tests/ws-client.mjs`.
- Shrink `tools/node-bundle/deno-shim.mjs` (`serve`, `upgradeWebSocket`, `connect`, `listen`, `watchFs` and their helpers).

Out:
- Callers (`src/core/http-server.ts`, `src/core/http-devserver.ts`, `src/command/preview/preview.ts`, `src/command/call/axe/cmd.ts`, `src/project/serve/serve.ts`, `src/core/port.ts`, `src/execute/jupyter/jupyter-kernel.ts`, `src/core/quarto.ts`): their signatures are the layer's; nothing changes.
- The Jupyter 1 KB temp-file workaround (`jupyter-kernel.ts` `writeKernelCommand`): it is harmless and its removal belongs with the flip (PR 37), when `Deno.Conn` is gone for good.
- HTTPS, HTTP/2, Unix sockets (no consumer: `jupyter-kernel.ts` hard-codes `tcp`).

### Interfaces

Unchanged from the shared vocabulary (`_TEMPLATE.md`, "`net.ts`", "`http.ts`", "`watch.ts`"). Behaviour made precise by this PR:

- `connectTcp({ hostname, port })`: resolves once connected; rejects with the socket error (`code: "ECONNREFUSED"` etc., recognised by `isConnectionRefused`). `read(buf)` returns bytes copied (buffered: data arriving before `read` is kept), `null` at EOF, rejects on a socket error. `write(data)` resolves with `data.length` once flushed to the kernel. `close()` destroys the socket.
- `isPortAvailable(port, hostname = "127.0.0.1")`: `true` when a listener binds with `exclusive: true` and is closed again; `false` on `EADDRINUSE` only (PR 15 contract); other errors (`EACCES` for a privileged port included) throw.
- `findOpenPort({ port, hostname = "127.0.0.1", attempts = 100 })`: returns `port` when given and available; otherwise tries random ports in `[3000, 8000)` up to `attempts` times; throws `Error("Unable to find open port")`. PR 15 kept `findOpenPort(defaultPort?)` in `src/core/port.ts` as the application API with Quarto's Chrome/Firefox-unsafe-port filter on top of the layer's generic probe; that split stays.
- `serveHttp({ port, hostname = "0.0.0.0", handler, signal, onListen })`: returns synchronously. `addr` is `{ hostname, port }` from the options until `listening` resolves, then the bound address (`port: 0` picks an ephemeral port). `listening` resolves once bound and **rejects** with the bind error (`EADDRINUSE`, `EACCES`); `finished` resolves after `close` and also rejects with the bind error; neither rejection is ever unhandled (both promises carry a no-op `catch`), and `onListen` is not called on a bind failure (PR 16 contract). The server keeps an `error` listener for its whole life: a bind error goes to `listening`/`finished`, any later server error is logged at debug level instead of crashing the process. `shutdown()` and the abort of `signal` follow the "Server lifecycle" rule below. A handler that throws yields a 500 and the error is logged at debug level. When `onListen` is omitted, `Listening on http://<hostname>:<port>/` is printed to **stderr** (vocabulary; Deno.serve prints it there).
- **Server lifecycle** (R07; triage decision A7: the layer owns upgraded sockets). A server is *binding* from `serveHttp()` until `listening` settles, *listening* until the first `shutdown()` or abort, then *closing* until `finished` resolves. `node:http` binds asynchronously (`server.listening` is `false` when `serveHttp()` returns, for an IP host as for a hostname), so:
  - `shutdown()` while *binding* waits for `listening` to settle. If the bind failed it resolves at once (`finished` already rejected with the bind error); otherwise it continues as below. It never resolves while a bind is pending, so a server cannot start listening after its shutdown settled.
  - `shutdown()` while *listening*: `close()` (stop accepting), `closeIdleConnections()` (guarded, Spike #2 (g)), a close frame with code 1001 to every WebSocket the server owns, then wait for in-flight requests and close handshakes. After 2 s the forced path runs: `closeAllConnections()` for the HTTP sockets and `terminate()` for the WebSockets still open. Node's `closeAllConnections()` does not reach upgraded sockets and `close()` waits for them, so without the second half one live preview client keeps `finished` pending for ever. `finished` resolves on the server's `close` event.
  - Idempotent and never rejects. A `signal` already aborted when `serveHttp()` is called is an immediate `shutdown()`: the port is bound, `onListen` runs, then it is released and `finished` resolves. A later abort is the same as calling `shutdown()`.
  - **Socket ownership.** Each server owns the `ws` sockets created from its own `upgrade` event, in a per-server set that `upgradeWebSocket()` fills and the socket's `close` event empties. The module-level `WebSocketServer` is a stateless handshake helper (`clientTracking: false`); `ws` 8's `WebSocketServer.close()` does not close clients, so nothing relies on it. `http-devserver.ts` keeps closing its own clients when it stops; the layer's close is the backstop for every other handler and for abort.
  - **Request cancellation.** `Request.signal` aborts when the client is gone before the response completed: `ServerResponse`'s `close` with `writableFinished === false` (`IncomingMessage`'s own `close` is not that signal: it fires after every completed response). For an upgrade request it aborts when the upgrade socket closes before the handler returned, best effort: Node does not read a paused upgrade socket, so a client that leaves while an asynchronous upgrade handler is pending is noticed when the handshake runs. The response body is pulled through a reader; a `write` that returns `false` waits for `drain` **or** `close`; on `close`, or when the response is already destroyed, the loop stops and the reader is cancelled, so a file stream or render-log producer behind a vanished client is released and the request stops counting as in flight for `close()`.
- `upgradeWebSocket(req)`: valid only for a request delivered through the server's `upgrade` event; otherwise throws `TypeError("Request is not upgradable")`. Returns the `ws` socket (it satisfies `WebSocketLike`: `readyState`, `CLOSED`, `CLOSING`, `send`, `close`, `onmessage`/`onclose`/`onerror` setters; `onmessage` receives `{ data: string }` for text frames) and a marker `Response` (status 200) that the handler must return. If the handler returns anything else for an upgrade request, the socket is closed.
- `watchFs(paths, { recursive = true, poll })`: `poll` (default: `QUARTO_WATCH_POLLING === "1"`) polls every root instead of using `fs.watch`; this optional field is an addition to the vocabulary signature. Otherwise one `fs.watch` per path; throws `ENOENT` synchronously for a missing path. Event mapping: `change` → `modify`; `rename` → `create` when the path exists, `remove` otherwise; a null filename → `other` with the watched root as the path. Events that arrive in the same macrotask are coalesced into one `FsEvent` per kind with de-duplicated absolute paths. When a watched root disappears, a `remove` event for the root is emitted and the root is checked every 500 ms; when it reappears a `create` event is emitted and watching resumes on the new directory: with a new `fs.watch`, or with polling where native events on a recreated directory are known to be lost (Deno, denoland/deno#36937, unless Spike #2 (c) recorded otherwise). `QUARTO_WATCH_POLLING=1` makes every root polled (500 ms stat snapshots; `create`/`modify`/`remove` by path). `close()` stops all watchers and pollers and ends the iteration.

### Files

- Modify: `src/deno_ral/net.ts` (entire body)
- Modify: `src/deno_ral/http.ts` (entire body)
- Modify: `src/deno_ral/watch.ts` (entire body)
- Modify: `src/import_map.json` (add `ws`, `@types/ws`)
- Modify: `package.json`, `package-lock.json` (move `ws` to `dependencies`, add `@types/ws`)
- Modify: `.github/workflows/test-node-bundle.yml` (preview websocket step)
- Modify: `tools/node-bundle/deno-shim.mjs` (delete unused members), `tools/node-bundle/known-failures.json` (Task 5 step 2 removes this PR's entries; shared with PRs 28 and 30, README ground rule 8)
- Test: `tests/unit/ral/net.test.ts`, `tests/unit/ral/http.test.ts`, `tests/unit/ral/watch.test.ts` (PR 15/16/17 contracts; extended). Assumes these names; if PR 15–17 used others, extend the files `ls tests/unit/ral/` shows.

### Acceptance criteria

- `grep -c "Deno\." src/deno_ral/net.ts src/deno_ral/http.ts src/deno_ral/watch.ts` → `0` each.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` passes, with the new cases.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts smoke/preview/preview-project-reload.test.ts smoke/jupyter/daemon.test.ts unit/preview-initial-path.test.ts unit/preview-external-links.test.ts unit/preview-subdir-knitr-cwd.test.ts unit/axe-postrender.test.ts $(find smoke/jupyter/ -name '*.test.ts')` passes (PR 14b's preview end-to-end tests, document and website, and its Jupyter daemon test included).
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` passes with no `net`/`http`/`watch` entry left (Linux here, Windows in the `node-unit` job).
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
- Modify: `tests/unit/ral/net.test.ts` (append)
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

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/net.test.ts`
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
  const attempts = options.attempts ?? 100;
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

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/net.test.ts unit/chrome-launch.test.ts $(find smoke/jupyter/ -name '*.test.ts')`
Expected: all green (the Jupyter kernel daemon talks to the kernel over `connectTcp`; `chrome-launch` uses `findOpenPort`).

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/net.ts tests/unit/ral/net.test.ts
git commit -m "deno_ral/net: buffered TCP connection and async port probing on node:net"
```

### Task 3: `http.ts`

**Files:**
- Modify: `tests/unit/ral/http.test.ts` (append)
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

unitTest("http - listening resolves once bound and rejects on a busy port; nothing is left unhandled", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  const first = serveHttp({ port, hostname: "127.0.0.1", onListen: () => {}, handler: () => new Response("one") });
  await first.listening;
  assertEquals(first.addr.port, port);
  let listenCalled = false;
  const second = serveHttp({ port, hostname: "127.0.0.1", onListen: () => { listenCalled = true; }, handler: () => new Response("two") });
  let code: string | undefined;
  try {
    await second.listening;
  } catch (e) {
    code = (e as { code?: string }).code;
  }
  assertEquals(code, "EADDRINUSE");
  assert(!listenCalled, "onListen is not called on a bind failure");
  let finishedRejected = false;
  await second.finished.catch(() => { finishedRejected = true; });
  assert(finishedRejected, "finished rejects with the bind error too");
  await first.shutdown();
});

unitTest("http - a server error after binding is logged, not thrown", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  const server = serveHttp({ port, hostname: "127.0.0.1", onListen: () => {}, handler: () => new Response("ok") });
  await server.listening;
  // A client that sends garbage makes node:http emit clientError/error paths;
  // the process must keep serving.
  const conn = await connectTcp({ hostname: "127.0.0.1", port });
  await conn.write(new TextEncoder().encode("NOT HTTP\r\n\r\n"));
  conn.close();
  assertEquals(await (await fetch(`http://127.0.0.1:${port}/`)).text(), "ok");
  await server.shutdown();
});

// R07 (Server lifecycle rule): shutdown during the bind, an already-aborted
// signal, WebSocket ownership, and cancellation when the client is gone.

unitTest("http - shutdown before the bind settles closes the server and frees the port", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  const server = serveHttp({ port, hostname: "127.0.0.1", onListen: () => {}, handler: () => new Response("ok") });
  // No await on `listening`: node:http binds asynchronously, so the bind is
  // still pending here. The server must not end up listening after this.
  await server.shutdown();
  await server.finished;
  assertEquals(await isPortAvailable(port, "127.0.0.1"), true);
});

unitTest("http - shutdown while the hostname is still being resolved", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  // A name, not an IP: node:net looks it up before binding, so the bind is
  // pending for longer than with 127.0.0.1 and shutdown() must still wait.
  const server = serveHttp({ port, hostname: "localhost", onListen: () => {}, handler: () => new Response("ok") });
  const t0 = Date.now();
  await server.shutdown();
  await server.finished;
  assert(Date.now() - t0 < 2000, "no forced path");
  assertEquals(await isPortAvailable(port, server.addr.hostname), true);
});

unitTest("http - shutdown during a bind that then fails resolves and leaves the other server alone", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  const first = serveHttp({ port, hostname: "127.0.0.1", onListen: () => {}, handler: () => new Response("one") });
  await first.listening;
  const second = serveHttp({ port, hostname: "127.0.0.1", onListen: () => {}, handler: () => new Response("two") });
  await second.shutdown(); // the bind is pending; it fails with EADDRINUSE
  let code: string | undefined;
  await second.finished.catch((e) => { code = (e as { code?: string }).code; });
  assertEquals(code, "EADDRINUSE", "shutdown resolved on the failed bind; finished carries the error");
  assertEquals(await (await fetch(`http://127.0.0.1:${port}/`)).text(), "one", "the server that owns the port is untouched");
  await first.shutdown();
  await first.finished;
});

unitTest("http - an already-aborted signal is an immediate shutdown", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  const ac = new AbortController();
  ac.abort();
  const server = serveHttp({ port, hostname: "127.0.0.1", signal: ac.signal, onListen: () => {}, handler: () => new Response("ok") });
  const t0 = Date.now();
  await server.finished;
  assert(Date.now() - t0 < 2000, "finished without the forced path");
  assertEquals(await isPortAvailable(port, "127.0.0.1"), true);
});

const upgradeOnly = (req: Request) => upgradeWebSocket(req).response; // every request is an upgrade

unitTest("http - shutdown closes a live WebSocket client with 1001 and finished resolves", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  const server = serveHttp({ port, hostname: "127.0.0.1", onListen: () => {}, handler: upgradeOnly });
  await server.listening;
  const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await new Promise<void>((resolve, reject) => {
    client.onopen = () => resolve();
    client.onerror = () => reject(new Error("websocket error"));
  });
  const closeCode = new Promise<number>((resolve) => {
    client.onclose = (ev) => resolve(ev.code);
  });
  const t0 = Date.now();
  await server.shutdown();
  await server.finished;
  assertEquals(await closeCode, 1001);
  assert(Date.now() - t0 < 2000, "a cooperating client does not need the forced path");
  assertEquals(await isPortAvailable(port, "127.0.0.1"), true);
});

unitTest("http - a WebSocket peer that ignores the close frame is terminated in the forced path", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  const server = serveHttp({ port, hostname: "127.0.0.1", onListen: () => {}, handler: upgradeOnly });
  await server.listening;
  // A raw client that completes the handshake and then answers nothing.
  const conn = await connectTcp({ hostname: "127.0.0.1", port });
  await conn.write(new TextEncoder().encode(
    "GET /ws HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n" +
      "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n",
  ));
  const n = await conn.read(new Uint8Array(1024));
  assert(n !== null && n > 0, "101 handshake received");
  const t0 = Date.now();
  await server.shutdown();
  await server.finished;
  // About 2 s: the forced path, not ws's 30 s close timeout and not for ever.
  assert(Date.now() - t0 < 5000, "terminated by the forced path");
  // The peer sees the close frame, then EOF or a reset.
  let ended = false;
  while (!ended) {
    const got = await conn.read(new Uint8Array(1024)).catch(() => null);
    ended = got === null;
  }
  conn.close();
  assertEquals(await isPortAvailable(port, "127.0.0.1"), true);
});

unitTest("http - a client that disconnects mid-response aborts the request and cancels the body", async () => {
  const port = await findOpenPort({ hostname: "127.0.0.1" });
  let aborted = false;
  let cancelled = false;
  const chunk = new Uint8Array(1024 * 1024);
  const server = serveHttp({
    port,
    hostname: "127.0.0.1",
    onListen: () => {},
    handler: (req) => {
      req.signal.addEventListener("abort", () => { aborted = true; });
      const body = new ReadableStream<Uint8Array>({
        pull(controller) { controller.enqueue(chunk); }, // endless producer
        cancel() { cancelled = true; },
      });
      return new Response(body, { headers: { "content-type": "application/octet-stream" } });
    },
  });
  await server.listening;
  const ac = new AbortController();
  const res = await fetch(`http://127.0.0.1:${port}/big`, { signal: ac.signal });
  await res.body!.getReader().read(); // the first chunk arrived; the socket buffers fill up behind it
  ac.abort();
  const t0 = Date.now();
  // The vanished client's request must not hold close() until the forced path.
  await server.shutdown();
  await server.finished;
  assert(Date.now() - t0 < 2000, "the disconnected request ended before the forced path");
  await new Promise((r) => setTimeout(r, 100)); // the cancel runs after the socket's close event
  assert(aborted, "req.signal aborted on disconnect");
  assert(cancelled, "the response body was cancelled");
});
```

(Imports: `assert`, `assertEquals` from `../../asserts.ts`; `serveHttp`, `upgradeWebSocket` from `../../../src/deno_ral/http.ts`; `connectTcp`, `findOpenPort`, `isPortAvailable` from `../../../src/deno_ral/net.ts`. PR 16 already covers the busy-port rejection, the plain-request `TypeError`, idempotent `shutdown` and the basic upgrade; these add request-body streaming, multiple `set-cookie`, keep-alive teardown, the `ws`-backed echo, and the seven R07 cases of the "Server lifecycle" rule: shutdown during the bind (an IP host, a hostname still being resolved, a bind that then fails under the shutdown), an already-aborted signal, a cooperating WebSocket client closed with 1001, a deaf peer terminated by the forced path (this case takes about 2 s by design), and a client that leaves mid-response. On the PR 16 Deno body the WebSocket and mid-response cases may fail or hang; they state the contract for Step 3.)

- [ ] **Step 2: Run on the PR 16 (Deno) body**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts`
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
 * command/call/axe/cmd.ts. Lifecycle rule (bind states, socket ownership,
 * cancellation): dev-docs/runtime-migration/29-ral-net-http-watch-on-node-apis.md,
 * Interfaces, "Server lifecycle".
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import process from "node:process";
import type { Duplex } from "node:stream";
import { Readable } from "node:stream";
// @ts-types="@types/ws"
import { type WebSocket as WsSocket, WebSocketServer } from "ws";
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
  /** Resolves once bound; rejects with the bind error (EADDRINUSE, EACCES). */
  readonly listening: Promise<void>;
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
  /** The owning server's upgraded sockets; upgradeWebSocket() adds the new one. */
  owned: Set<WsSocket>;
}

// Requests delivered through the `upgrade` event, keyed by the Request object
// handed to the handler, and the marker responses upgradeWebSocket() returns.
const upgradable = new WeakMap<Request, UpgradeContext>();
const upgraded = new WeakSet<Response>();
// Handshake helper only: each server tracks the sockets it owns (ws 8's
// WebSocketServer.close() would not close them anyway).
const wss = new WebSocketServer({ noServer: true, clientTracking: false });

// Graceful shutdown waits this long for in-flight requests and WebSocket
// close handshakes before the forced path.
const kForceCloseMs = 2000;

function toRequest(req: IncomingMessage, hostname: string, port: number, signal: AbortSignal): Request {
  const url = `http://${req.headers.host ?? `${hostname}:${port}`}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }
  const hasBody = !(req.method === "GET" || req.method === "HEAD");
  const init: RequestInit & { duplex?: "half" } = { method: req.method, headers, signal };
  if (hasBody) {
    init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    init.duplex = "half";
  }
  return new Request(url, init);
}

// Aborts when the client is gone before the response completed. The request's
// own `close` is not that signal: since Node 16 it fires after every completed
// response. The response's `close` fires in both cases; `writableFinished`
// tells them apart.
function abortOnDisconnect(res: ServerResponse): AbortController {
  const ac = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) ac.abort();
  });
  return ac;
}

// Resolves true on `drain`, false when the response closed first (a client
// that left mid-body never drains) or was already destroyed.
function drained(res: ServerResponse): Promise<boolean> {
  return new Promise((resolve) => {
    if (res.destroyed) {
      resolve(false);
      return;
    }
    const onDrain = () => {
      res.off("close", onClose);
      resolve(true);
    };
    const onClose = () => {
      res.off("drain", onDrain);
      resolve(false);
    };
    res.once("drain", onDrain);
    res.once("close", onClose);
  });
}

async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  for (const [k, v] of response.headers) {
    if (k !== "set-cookie") res.setHeader(k, v);
  }
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  try {
    while (!res.destroyed) {
      const { done, value } = await reader.read();
      if (done || res.destroyed) break;
      if (!res.write(value) && !(await drained(res))) break;
    }
  } finally {
    if (res.destroyed) {
      // The client is gone: release the producer (a file stream, a render log).
      await reader.cancel().catch(() => {});
    } else {
      res.end();
    }
  }
}

function remote(req: IncomingMessage): { remoteAddr: { hostname: string; port: number } } {
  return { remoteAddr: { hostname: req.socket.remoteAddress ?? "", port: req.socket.remotePort ?? 0 } };
}

export function serveHttp(options: ServeOptions): HttpServer {
  const hostname = options.hostname ?? "0.0.0.0";
  const server: Server = createServer();
  let bound: { hostname: string; port: number } = { hostname, port: options.port };
  // WebSockets this server owns (Server lifecycle rule, "Socket ownership"):
  // shutdown() closes them with 1001, the forced path terminates them.
  const owned = new Set<WsSocket>();

  server.on("request", async (req, res) => {
    const ac = abortOnDisconnect(res);
    try {
      const response = await options.handler(toRequest(req, hostname, options.port, ac.signal), remote(req));
      await sendResponse(res, response);
    } catch (e) {
      debug(`[http] handler error: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
      if (res.destroyed) return; // the client left; nothing to answer
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    }
  });

  server.on("upgrade", async (req, socket, head) => {
    const ac = new AbortController();
    // Best effort: Node does not read a socket handed to `upgrade`, so a
    // client that leaves while the handler is still pending is seen when
    // handleUpgrade resumes it, not before.
    socket.once("close", () => ac.abort());
    const request = toRequest(req, hostname, options.port, ac.signal);
    upgradable.set(request, { req, socket, head, owned });
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
  let resolveListening!: () => void;
  let rejectListening!: (e: Error) => void;
  const listening = new Promise<void>((resolve, reject) => {
    resolveListening = resolve;
    rejectListening = reject;
  });
  // Callers that await only one of the two must not see an unhandled rejection.
  finished.catch(() => {});
  listening.catch(() => {});
  // One listener for the server's whole life (an `error` event without a
  // listener crashes the process): before binding, the error is the bind
  // failure and ends the server; afterwards it is logged.
  let bound_ = false;
  server.on("error", (e: Error) => {
    if (!bound_) {
      rejectListening(e);
      rejectFinished(e);
    } else {
      debug(`[http] server error: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    }
  });
  server.on("close", () => resolveFinished());

  server.listen({ port: options.port, host: hostname, exclusive: true }, () => {
    bound_ = true;
    const address = server.address();
    if (address && typeof address === "object") {
      bound = { hostname: address.address, port: address.port };
    }
    resolveListening();
    if (options.onListen) {
      options.onListen(bound);
    } else {
      // Deno.serve prints this line to stderr; so does the layer (vocabulary).
      process.stderr.write(`Listening on http://${bound.hostname}:${bound.port}/\n`);
    }
  });

  let shuttingDown: Promise<void> | undefined;
  const shutdown = () => {
    if (shuttingDown) return shuttingDown;
    shuttingDown = (async () => {
      // Binding: node:http binds asynchronously (`server.listening` is false
      // until then, for an IP host too). Let the bind settle first, so the
      // server cannot start listening after this promise resolved. A failed
      // bind already rejected `finished`; nothing to close.
      try {
        await listening;
      } catch {
        return;
      }
      // Listening: stop accepting, drop idle keep-alive sockets, ask every
      // WebSocket to leave, let in-flight requests and close handshakes
      // finish. Guarded: Spike #2 (g) checks that Deno's node:http provides
      // closeIdleConnections.
      if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
      for (const ws of owned) ws.close(1001, "Server shutting down");
      // Forced path after a bounded wait. closeAllConnections() does not reach
      // sockets handed to `upgrade`, and close() waits for them: a deaf peer
      // (ws would wait 30 s for its close frame) is terminated here.
      const force = setTimeout(() => {
        server.closeAllConnections();
        for (const ws of owned) ws.terminate();
      }, kForceCloseMs);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      clearTimeout(force);
    })();
    return shuttingDown;
  };
  if (options.signal?.aborted) {
    // An "abort" listener never fires for an already-aborted signal.
    void shutdown();
  } else {
    options.signal?.addEventListener("abort", () => void shutdown(), { once: true });
  }

  return {
    listening,
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
  let socket: WsSocket | undefined;
  // handleUpgrade writes the 101 handshake itself and calls back synchronously.
  wss.handleUpgrade(ctx.req, ctx.socket, ctx.head, (ws) => {
    socket = ws;
  });
  if (!socket) {
    throw new TypeError("WebSocket handshake failed");
  }
  // The server owns the socket until it closes (Server lifecycle rule).
  const ws = socket;
  ctx.owned.add(ws);
  ws.once("close", () => ctx.owned.delete(ws));
  // Node's Response rejects status 101; this marker tells the upgrade handler
  // the socket was taken over.
  const response = new Response(null, { status: 200 });
  upgraded.add(response);
  return { socket: ws as unknown as WebSocketLike, response };
}
```

`ws`'s `onmessage` delivers `MessageEvent.data` as a string for text frames and a `Buffer` for binary ones; `core/http-devserver.ts` only sends and receives text. If the type checker complains about the `ws as unknown as WebSocketLike` cast, widen `WebSocketLike.onmessage`'s parameter to `{ data: string | Uint8Array | ArrayBuffer }` in the vocabulary comment and here.

- [ ] **Step 4: Run the tests**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts smoke/preview/preview-reload.test.ts smoke/preview/preview-project-reload.test.ts unit/preview-initial-path.test.ts unit/preview-external-links.test.ts unit/axe-postrender.test.ts; cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/http.test.ts
```
Expected: all green on Deno; on Node, no new failure. PR 14b's `preview-reload.test.ts` and `preview-project-reload.test.ts` exercise `quarto preview` end to end (serve, WebSocket, file change → reload, shutdown; a single document and a website) on Deno through the new `node:http` body, on Linux and Windows in the Deno matrix; the Node run of the same flow is the workflow step in Task 5 (Linux), and PR 32's `node-suite` runs the two tests themselves on Node on Linux and Windows.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/http.ts tests/unit/ral/http.test.ts
git commit -m "deno_ral/http: server on node:http with ws-based upgrades"
```

### Task 4: `watch.ts`

**Files:**
- Modify: `tests/unit/ral/watch.test.ts` (append)
- Modify: `src/deno_ral/watch.ts`

- [ ] **Step 1: Append the Node-sensitive cases to the PR 17 test**

```ts
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function collect(watcher: FsWatcher, ms: number): Promise<FsEvent[]> {
  const events: FsEvent[] = [];
  const timer = setTimeout(() => watcher.close(), ms);
  for await (const ev of watcher) events.push(ev);
  clearTimeout(timer);
  return events;
}

function has(events: FsEvent[], kind: FsEvent["kind"], suffix: string): boolean {
  return events.some((e) => e.kind === kind && e.paths.some((p) => p.endsWith(suffix)));
}

for (const poll of [false, true]) {
  unitTest(`watch - create, modify and remove in a new nested directory, absolute paths (poll: ${poll})`, async () => {
    const dir = makeTempDirSync({ prefix: "rt29-watch-" });
    const watcher = watchFs([dir], { recursive: true, poll });
    const collecting = collect(watcher, 4000);
    await sleep(200);
    mkdirSync(join(dir, "sub"));
    await sleep(700);
    writeTextFileSync(join(dir, "sub", "a.ts"), "1");
    await sleep(700);
    writeTextFileSync(join(dir, "sub", "a.ts"), "22");
    await sleep(700);
    removeSync(join(dir, "sub", "a.ts"));
    const events = await collecting;
    assert(events.every((e) => e.paths.every((p) => isAbsolute(p))), "paths are absolute");
    const a = join("sub", "a.ts");
    assert(has(events, "create", a) || has(events, "modify", a), `expected create for sub/a.ts in ${JSON.stringify(events)}`);
    assert(has(events, "modify", a), `expected modify for sub/a.ts in ${JSON.stringify(events)}`);
    assert(has(events, "remove", a), `expected remove for sub/a.ts in ${JSON.stringify(events)}`);
    removeSync(dir, { recursive: true });
  });
}

unitTest("watch - a deleted and recreated root keeps reporting changes (denoland/deno#36937)", async () => {
  const parent = makeTempDirSync({ prefix: "rt29-watch-root-" });
  const dir = join(parent, "watched");
  mkdirSync(dir);
  const watcher = watchFs([dir], { recursive: true });
  const collecting = collect(watcher, 6000);
  await sleep(300);
  removeSync(dir, { recursive: true });
  await sleep(1200); // more than two presence checks (500 ms)
  mkdirSync(dir);
  await sleep(1200); // the presence check sees the new directory and resumes watching
  writeTextFileSync(join(dir, "after.txt"), "x");
  await sleep(1500); // one polling interval when the recreated root is polled
  const events = await collecting;
  assert(has(events, "remove", "watched"), `expected remove of the root in ${JSON.stringify(events)}`);
  assert(has(events, "create", "watched"), `expected create of the root in ${JSON.stringify(events)}`);
  assert(has(events, "create", "after.txt") || has(events, "modify", "after.txt"), `expected after.txt in ${JSON.stringify(events)}`);
  removeSync(parent, { recursive: true });
});
```

(Imports: `assert` from `../../asserts.ts`; `type FsEvent`, `type FsWatcher`, `watchFs` from `../../../src/deno_ral/watch.ts`; `mkdirSync`, `removeSync`, `writeTextFileSync` from `../../../src/deno_ral/fs.ts`; `isAbsolute`, `join` from `../../../src/deno_ral/path.ts`; `makeTempDirSync` from `../../../src/deno_ral/temp.ts`. PR 17 already covers create/modify at the top level, idempotent `close` and the missing-path throw; this adds the nested new directory, `remove`, the polling mode and the recreated root.)

- [ ] **Step 2: Run and observe**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts; cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/watch.test.ts
```
Expected: the `poll: true` cases fail to type-check or ignore the option on the PR 17 body (`poll` is new); the recreated-root case fails on Deno (#36937, and the PR 17 body does not re-watch) and on Node (no re-watch). These are the contract for Step 3.

- [ ] **Step 3: Implement**

```ts
/*
 * watch.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Filesystem watching on fs.watch({ recursive: true }), with a polling
 * fallback. Runs on Node 26 and on Deno 2 (node compat). Consumer: the
 * dev-mode source watcher in core/quarto.ts; project serving polls on its own
 * (core/watch.ts). Decision record:
 * dev-docs/runtime-migration/29-ral-net-http-watch-on-node-apis.md.
 */

import { existsSync, type FSWatcher, readdirSync, statSync, watch } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { runtime } from "./platform.ts";

export interface FsEvent {
  kind: "create" | "modify" | "remove" | "rename" | "other";
  paths: string[];
}

export interface FsWatcher extends AsyncIterable<FsEvent> {
  close(): void;
}

const kPollMs = 500;

// SPIKES.md, Spike #2 (c): on Deno 2.9 a watcher opened on a directory that
// was deleted and recreated receives no events (denoland/deno#36937), so a
// recreated root is polled there. If the spike recorded that re-watching works
// on Deno, set this to false.
const kRecreatedRootNeedsPolling = runtime().name === "deno";

type Snapshot = Map<string, string>; // absolute path -> "mtimeMs:size"

function snapshot(root: string, recursive: boolean): Snapshot {
  const out: Snapshot = new Map();
  const visit = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // removed while scanning
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      try {
        const st = statSync(full);
        out.set(full, `${st.mtimeMs}:${st.size}`);
      } catch {
        continue;
      }
      if (recursive && e.isDirectory()) visit(full);
    }
  };
  visit(root);
  return out;
}

export function watchFs(
  paths: string[],
  options?: { recursive?: boolean; poll?: boolean },
): FsWatcher {
  const recursive = options?.recursive ?? true;
  const forcePoll = options?.poll ?? (process.env.QUARTO_WATCH_POLLING === "1");
  const pending = new Map<FsEvent["kind"], Set<string>>();
  const queue: FsEvent[] = [];
  const waiters: Array<() => void> = [];
  const stops: Array<() => void> = [];
  let closed = false;
  let flushScheduled = false;

  const wake = () => {
    for (const w of waiters.splice(0)) w();
  };
  // Coalesce everything that arrived in this macrotask into one event per kind.
  const flush = () => {
    flushScheduled = false;
    for (const [kind, set] of pending) queue.push({ kind, paths: [...set] });
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

  const watchNative = (root: string): () => void => {
    const w: FSWatcher = watch(root, { recursive, persistent: true }, (eventType, filename) => {
      if (filename === null || filename === undefined) {
        push("other", root);
        return;
      }
      const full = join(root, filename.toString());
      if (eventType === "change") push("modify", full);
      else push(existsSync(full) ? "create" : "remove", full);
    });
    // A watcher whose directory vanished may error; the presence check handles it.
    w.on("error", () => push("other", root));
    return () => w.close();
  };

  const watchPolling = (root: string): () => void => {
    let previous = snapshot(root, recursive);
    const timer = setInterval(() => {
      const next = snapshot(root, recursive);
      for (const [p, sig] of next) {
        const old = previous.get(p);
        if (old === undefined) push("create", p);
        else if (old !== sig) push("modify", p);
      }
      for (const p of previous.keys()) {
        if (!next.has(p)) push("remove", p);
      }
      previous = next;
    }, kPollMs);
    return () => clearInterval(timer);
  };

  const start = (root: string, recreated: boolean) =>
    forcePoll || (recreated && kRecreatedRootNeedsPolling) ? watchPolling(root) : watchNative(root);

  for (const p of paths) {
    const root = resolve(p);
    // Throws ENOENT synchronously for a missing path, like Deno.watchFs.
    statSync(root);
    let stop: (() => void) | undefined = start(root, false);
    let present = true;
    // The root itself: when it disappears, stop its watcher; when it comes
    // back (preview after an output-dir cleanup), watch the new directory.
    const presence = setInterval(() => {
      const exists = existsSync(root);
      if (present && !exists) {
        present = false;
        stop?.();
        stop = undefined;
        push("remove", root);
      } else if (!present && exists) {
        present = true;
        stop = start(root, true);
        push("create", root);
      }
    }, kPollMs);
    stops.push(() => {
      clearInterval(presence);
      stop?.();
    });
  }

  return {
    close() {
      if (closed) return;
      closed = true;
      for (const s of stops) s();
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

- [ ] **Step 4: Run the tests on both runtimes**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts; cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/watch.test.ts
```
Expected: all green on Deno and on Node (Linux here; the `node-unit` job adds Windows; macOS runs the Deno suite).

- [ ] **Step 5: Manual dev-mode check, including the recreated root**

Run: `QUARTO_DEBUG=true package/dist/bin/quarto preview dev-docs/runtime-migration/spike/tests/simple.qmd --no-browser --port 4399` in one terminal; in another `touch src/core/watch.ts`.
Expected: the preview prints `quarto src code changed` (from `terminatePreview` in `src/core/quarto.ts`) and exits. Repeat with `QUARTO_WATCH_POLLING=1`: same message within a second.

- [ ] **Step 6: Commit**

```bash
git add src/deno_ral/watch.ts tests/unit/ral/watch.test.ts
git commit -m "deno_ral/watch: fs.watch recursive, re-watch a recreated root, polling fallback"
```

### Task 5: Node job preview smoke, shim and known-failures shrink

**Files:**
- Modify: `.github/workflows/test-node-bundle.yml`
- Modify: `tools/node-bundle/deno-shim.mjs`, `tools/node-bundle/known-failures.json`

- [ ] **Step 1: Add a preview websocket step to the `node-render` job, after "Version and check"**

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

- [ ] **Step 2: Rebuild, shrink the shim and the known-failures list**

Run: `node tools/node-bundle/build.mjs --check-shim`
Expected: `0 missing` and `serve`, `upgradeWebSocket`, `connect`, `listen`, `watchFs` in the `unused` list (unless `src/resources/**/*.js` still references one: `julia-engine.js` uses `Deno.connect`, which then stays until the subtree pull, decision 7). Delete the listed members and their helpers (`toRequest`, `sendResponse`, `Conn`, `upgradable`, `upgraded`, `wss`, the `ws`/`http`/`net` imports if nothing else uses them) from `deno-shim.mjs`; rebuild; `0 missing`, no `unused` list. Then run `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/`, delete the `net`/`http`/`watch` entries it reports as passing (Linux; Windows from this branch's `node-unit` run), rerun: `no change`, exit 0.

- [ ] **Step 3: Run the preview smoke locally**

Run the step's commands by hand with `SPIKE_TESTS=dev-docs/runtime-migration/spike/tests` and `RUNNER_TEMP=/tmp/rt29`.
Expected: `ws: connected`, `ws: message …`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test-node-bundle.yml tools/node-bundle/deno-shim.mjs tools/node-bundle/known-failures.json
git commit -m "node-bundle: preview websocket smoke; drop net/http/watch shim members and known failures"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` → green.
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` → `no change`, exit 0, no `net`/`http`/`watch` entry left.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts smoke/preview/preview-project-reload.test.ts smoke/jupyter/daemon.test.ts $(find smoke/jupyter/ -name '*.test.ts') unit/preview-initial-path.test.ts unit/preview-external-links.test.ts unit/preview-subdir-knitr-cwd.test.ts unit/preview-brand-cache.test.ts unit/axe-postrender.test.ts unit/chrome-launch.test.ts` → green.
- `grep -c "Deno\." src/deno_ral/net.ts src/deno_ral/http.ts src/deno_ral/watch.ts` → `0` each.
- `node tools/node-bundle/check-deps.mjs` → match; `node tools/node-bundle/build.mjs --check-shim` → `0 missing`.
- `quarto run --dev tools/check-runtime-boundary.ts` → zero.
- Manual: `package/dist/bin/quarto preview dev-docs/runtime-migration/spike/tests/website --no-browser`, open the URL, edit `about.qmd`, confirm the page reloads (websocket push through `ws`).
- Manual: `package/dist/bin/quarto call axe dev-docs/runtime-migration/spike/tests/website/_site` after rendering (serves the site dir on `serveHttp`, `findOpenPort`).
- Windows CI: the normal Deno matrix runs `smoke/preview/preview-reload.test.ts` and `smoke/preview/preview-project-reload.test.ts` on Windows (PR 14b runs both there, not ignored: reload and shutdown of a document and of a website preview, the preview tree ended with `taskkill /T`); the `node-unit` job runs `tests/unit/ral/{net,http,watch}.test.ts` on Node on Windows; `fs.watch` recursive and `ws` are native there. The Node preview smoke of Task 5 runs on Linux only (`node-render` is Linux until PR 32); the first Node run of the two preview tests on Windows is PR 32's `node-suite`, which is why PR 32, not this PR, is the Windows Node preview gate.
- Manual, recreated output directory: `QUARTO_DEBUG=true package/dist/bin/quarto preview dev-docs/runtime-migration/spike/tests/website --no-browser`, then `rm -rf dev-docs/runtime-migration/spike/tests/website/_site` and edit `about.qmd`: the page reloads (project serving uses the polling watcher in `src/core/watch.ts`, unaffected by #36937; this check guards against a regression in the serve path while `watch.ts` changes).

## Review checklist

- [ ] `connectTcp` rejects with the socket error; `read` is buffered and returns `null` at EOF; `write` resolves with the byte count.
- [ ] `isPortAvailable` uses `exclusive: true`, returns `false` on `EADDRINUSE` only, throws otherwise; the server is `unref`'d.
- [ ] `serveHttp` returns synchronously; `listening` and `finished` reject on bind errors and carry no-op catches; the server's `error` listener is `on`, not `once`, and logs post-bind errors; `onListen` runs only after binding (default prints `Listening on …` to stderr); default hostname `0.0.0.0`.
- [ ] Server lifecycle rule: `shutdown` awaits `listening` before anything else (an IP host, a hostname still being resolved) and resolves on a failed bind (the three bind cases of Task 3 Step 1); while listening it calls `close`, `closeIdleConnections` (when it is a function), `close(1001)` on every owned WebSocket, and after 2 s `closeAllConnections` plus `terminate()`; it is idempotent; an already-aborted `signal` shuts down at once and a later abort equals `shutdown`; the owned set is per server, filled by `upgradeWebSocket` and emptied on the socket's `close`; the shared `WebSocketServer` has `clientTracking: false`.
- [ ] Request cancellation: `Request.signal` comes from the response's `close` with `writableFinished === false` (not from `req.on("close")`), or from the upgrade socket's `close`; the body loop checks `res.destroyed`, races `drain` with `close`, and cancels the reader when the client is gone; a handler rejection after the client left is logged at debug and does not touch the destroyed response.
- [ ] `findOpenPort` defaults to 100 attempts.
- [ ] Request bodies use `duplex: "half"`; `set-cookie` is sent as an array; response bodies respect `drain`.
- [ ] `upgradeWebSocket` throws `TypeError` for non-upgrade requests; a handler that does not return the marker response gets the socket closed; the marker is a status-200 `Response`.
- [ ] `watchFs` throws synchronously on a missing path, maps `rename` by existence, coalesces per macrotask, emits `remove`/`create` for a vanishing/reappearing root and resumes watching it (polling on Deno while `kRecreatedRootNeedsPolling` is true), honours `poll`/`QUARTO_WATCH_POLLING=1`, and `close()` stops watchers, pollers and the presence timer and ends iteration.
- [ ] `known-failures.json` lost the `net`/`http`/`watch` entries and gained none; the shim lost members and gained none.
- [ ] `ws` and `@types/ws` are in `src/import_map.json` and `package.json` `dependencies`; `check-deps.mjs` passes; `@ts-types` points at the import-map name, not an `npm:` URL.
- [ ] No `Deno.` in the three files; the shim lost `serve`, `upgradeWebSocket`, `connect`, `listen`, `watchFs`.

## Risks and rollback

- **Deno's `node:http` compat differs from Node** in edge cases (chunked uploads, header casing). PR 14b's `preview-reload.test.ts` and the unit tests cover Quarto's usage (GET/POST JSON, static files, websocket). If a Deno-only failure appears, keep the Node body and add a guarded `runtime().name === "deno"` branch for that one operation, not a parallel implementation. If Spike #2 (b) found `node:http` + `ws` broken on Deno 2.9, the outcome table in `SPIKES.md` applies: the Phase 1 `Deno.serve` body stays behind `runtime().name === "deno"` for `serveHttp`/`upgradeWebSocket` only, the one sanctioned dual body, deleted by PR 37.
- **Listen errors now surface asynchronously.** `preview.ts` awaits `server.finished`, `serve.ts` awaits it too, `axe/cmd.ts` calls `stop()` then awaits `finished.catch(() => {})`. A caller that ignored `finished` would miss `EADDRINUSE`; the grep in the Review checklist (`server.finished`) confirms all three await it.
- **`fs.watch` recursive limitations on Linux** (missed events in brand-new directories) and on network or container file systems: the single consumer is the dev-mode source watch; `QUARTO_WATCH_POLLING=1` is the user-facing escape hatch (documented in the PR description and in `dev-docs/runtime-migration/node-bundle.md`), `@parcel/watcher` the documented next step.
- **Presence timer cost**: one `existsSync` per watched root every 500 ms (one root in practice); negligible.
- **Graceful close waits for client close handshakes.** `shutdown()` with live preview clients now takes as long as the slowest handshake, bounded by the 2 s forced path (the runtime's `WebSocket` client answers in tens of milliseconds; a frozen tab or a deaf proxy hits the bound). `preview.ts` awaits `finished` on the way out, so `quarto preview` exits up to 2 s later than before in that case and never hangs; previously the dev server closed its clients itself and the layer did not wait. If the bound is felt, lower `kForceCloseMs`, do not remove the wait.
- **Deno's `node:http` and the upgraded sockets.** Whether Deno's `server.close()` also waits for upgraded sockets, and whether its `closeAllConnections()` reaches them, was not measured (Spike #2 (g) checks `closeIdleConnections` only). The layer closes and terminates its own sockets on both runtimes, so `finished` settles either way; the only difference Deno could show is a `close` event arriving before the last WebSocket's `close`, which the per-server set tolerates (a late `delete` on an emptied set).
- **Whole-PR rollback:** revert the five commits; the import-map `ws` entry is harmless to keep.

## Decisions needed

None. The `fs.watch` decision, the recreated-root handling, the polling flag and the `ws` placement are recorded above with the evidence; the two runtime-dependent constants (`kRecreatedRootNeedsPolling`, and the guarded `closeIdleConnections`) follow Spike #2 (c) and (g). Triage decision A7 (graceful HTTP shutdown owns the upgraded sockets: 1001 on graceful, `terminate()` on forced) is taken and written into the "Server lifecycle" rule.

Re-read against the review's "Later validation" lines (2026-10-16). R07: the already-aborted signal, the active WebSocket during shutdown (a cooperating client closed with 1001, a deaf peer terminated by the forced path) and the slow streamed response whose client leaves under backpressure were already Task 3 Step 1 cases; "immediate shutdown during hostname resolution/bind" had only the IP-host case, so two cases join it: `hostname: "localhost"` (the lookup keeps the bind pending longer) and a bind that fails with `EADDRINUSE` while `shutdown()` waits for it (`shutdown()` resolves, `finished` rejects, the server that owns the port keeps serving). The twelve cases ran on Node 26.12.0 and 22.22 against the Task 3 body. R10 cites this PR as a consumer of PR 14b's Windows evidence: the preview reload and shutdown line is PR 14b's two preview tests, which run on Windows in the Deno matrix, so this PR now names `preview-project-reload.test.ts` (the website path R10 asked for) next to `preview-reload.test.ts` everywhere it gates on the document one, and the Verification says where the Node run of the two happens (Linux in Task 5, Linux and Windows in PR 32's `node-suite`); the child-tree termination and argument/path lines are PR 28's, and the Jupyter line is `smoke/jupyter/daemon.test.ts`, already in the acceptance (Julia's `julia-engine.js` keeps `Deno.connect` through the shim until the subtree pull, Task 5 Step 2).
