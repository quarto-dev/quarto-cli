// Spike-only global `Deno` shim for running the quarto-cli bundle on Node.
// Base: @deno/shim-deno (filesystem, env, process basics). Added here: Deno.Command,
// Deno.openKv, Deno.serve, Deno.upgradeWebSocket, Deno.dlopen (throws), version info.
import { Deno as shimDeno } from "@deno/shim-deno";
import { spawn, spawnSync } from "node:child_process";
import { Readable, Writable } from "node:stream";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";

const Deno = { ...shimDeno };
const stats = { commands: 0, kvOpens: 0, serves: 0, upgrades: 0 };

// ---------------------------------------------------------------- Command
function stdio(v, def) {
  if (v === undefined) return def;
  if (typeof v === "number") return v;
  return v === "piped" ? "pipe" : v === "null" ? "ignore" : "inherit";
}

function spawnOptions(opts, mode) {
  const env = opts.clearEnv ? { ...(opts.env ?? {}) } : { ...process.env, ...(opts.env ?? {}) };
  const defIn = mode === "spawn" ? "inherit" : "ignore";
  const defOut = mode === "spawn" ? "inherit" : "pipe";
  return {
    cwd: opts.cwd,
    env,
    stdio: [stdio(opts.stdin, defIn), stdio(opts.stdout, defOut), stdio(opts.stderr, defOut)],
    windowsHide: true,
    signal: opts.signal,
  };
}

function exitStatus(code, signal) {
  return { success: code === 0, code: code ?? (signal ? 128 : 1), signal: signal ?? null };
}

class ChildProcess {
  constructor(child) {
    this.child = child;
    this.pid = child.pid;
    this.stdin = child.stdin ? Writable.toWeb(child.stdin) : null;
    this.stdout = child.stdout ? Readable.toWeb(child.stdout) : null;
    this.stderr = child.stderr ? Readable.toWeb(child.stderr) : null;
    this.status = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code, signal) => resolve(exitStatus(code, signal)));
    });
    this.status.catch(() => {});
  }
  async output() {
    const st = await this.status;
    return { ...st, stdout: new Uint8Array(), stderr: new Uint8Array() };
  }
  kill(sig = "SIGTERM") { this.child.kill(sig); }
  ref() { this.child.ref(); }
  unref() { this.child.unref(); }
}

class Command {
  constructor(cmd, opts = {}) { this.cmd = cmd; this.opts = opts; }
  spawn() {
    stats.commands++;
    return new ChildProcess(spawn(this.cmd, this.opts.args ?? [], spawnOptions(this.opts, "spawn")));
  }
  output() {
    stats.commands++;
    return new Promise((resolve, reject) => {
      const child = spawn(this.cmd, this.opts.args ?? [], spawnOptions(this.opts, "output"));
      const out = [], err = [];
      child.stdout?.on("data", (d) => out.push(d));
      child.stderr?.on("data", (d) => err.push(d));
      child.on("error", reject);
      child.on("close", (code, signal) =>
        resolve({ ...exitStatus(code, signal), stdout: new Uint8Array(Buffer.concat(out)), stderr: new Uint8Array(Buffer.concat(err)) }));
    });
  }
  outputSync() {
    stats.commands++;
    const r = spawnSync(this.cmd, this.opts.args ?? [], { ...spawnOptions(this.opts, "output"), maxBuffer: 1024 * 1024 * 1024 });
    if (r.error) throw r.error;
    return {
      ...exitStatus(r.status, r.signal),
      stdout: new Uint8Array(r.stdout ?? Buffer.alloc(0)),
      stderr: new Uint8Array(r.stderr ?? Buffer.alloc(0)),
    };
  }
}
Deno.Command = Command;

// ---------------------------------------------------------------- Kv (JSON file backed)
class Kv {
  constructor(file) {
    this.file = file;
    this.data = {};
    this.vs = 0;
    try { this.data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* new */ }
  }
  flush() { fs.writeFileSync(this.file, JSON.stringify(this.data)); }
  async get(key) {
    const e = this.data[JSON.stringify(key)];
    return { key, value: e === undefined ? null : e.value, versionstamp: e ? e.vs : null };
  }
  async set(key, value) {
    const vs = String(Date.now()) + "-" + (++this.vs);
    this.data[JSON.stringify(key)] = { value, vs };
    this.flush();
    return { ok: true, versionstamp: vs };
  }
  async delete(key) { delete this.data[JSON.stringify(key)]; this.flush(); }
  async *list({ prefix = [] } = {}) {
    for (const [k, e] of Object.entries(this.data)) {
      const key = JSON.parse(k);
      if (prefix.every((p, i) => key[i] === p)) yield { key, value: e.value, versionstamp: e.vs };
    }
  }
  close() { this.flush(); }
  [Symbol.dispose]() { this.close(); }
}
Deno.openKv = async (file) => { stats.kvOpens++; fs.mkdirSync(path.dirname(file), { recursive: true }); return new Kv(file); };

// ---------------------------------------------------------------- serve + websockets
const upgradable = new WeakMap();
const kUpgraded = Symbol("upgraded");
const wss = new WebSocketServer({ noServer: true });

function toRequest(req, hostname, port) {
  const url = `http://${req.headers.host ?? `${hostname}:${port}`}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const hasBody = !(req.method === "GET" || req.method === "HEAD");
  return new Request(url, { method: req.method, headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: hasBody ? "half" : undefined });
}

async function sendResponse(res, response) {
  if (!response) { res.statusCode = 500; res.end(); return; }
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  if (response.body) for await (const chunk of response.body) res.write(chunk);
  res.end();
}

Deno.serve = (a, b) => {
  stats.serves++;
  const opts = typeof a === "function" ? {} : a;
  const handler = typeof a === "function" ? a : (b ?? opts.handler);
  const port = opts.port ?? 8000;
  const hostname = opts.hostname ?? "0.0.0.0";
  const server = http.createServer();
  const info = (req) => ({ remoteAddr: { transport: "tcp", hostname: req.socket.remoteAddress, port: req.socket.remotePort } });
  server.on("request", async (req, res) => {
    try { await sendResponse(res, await handler(toRequest(req, hostname, port), info(req))); }
    catch (e) { console.error("[shim serve]", e); res.statusCode = 500; res.end(); }
  });
  server.on("upgrade", async (req, socket, head) => {
    const request = toRequest(req, hostname, port);
    upgradable.set(request, { req, socket, head });
    try {
      const r = await handler(request, info(req));
      if (!(r && r[kUpgraded])) socket.destroy();
    } catch (e) { console.error("[shim upgrade]", e); socket.destroy(); }
  });
  const finished = new Promise((resolve) => server.on("close", resolve));
  let addr;
  server.listen(port, hostname, () => {
    addr = server.address();
    const onListen = opts.onListen ?? (({ hostname, port }) => console.log(`Listening on http://${hostname}:${port}/`));
    onListen({ hostname: addr.address, port: addr.port, transport: "tcp" });
  });
  server.on("error", (e) => console.error("[shim serve] listen error", e));
  const shutdown = () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); });
  opts.signal?.addEventListener("abort", shutdown);
  return { finished, get addr() { return { hostname: addr?.address, port: addr?.port, transport: "tcp" }; }, shutdown, ref: () => server.ref(), unref: () => server.unref() };
};

Deno.upgradeWebSocket = (request) => {
  const u = upgradable.get(request);
  if (!u) throw new TypeError("Request is not upgradable");
  stats.upgrades++;
  let socket;
  wss.handleUpgrade(u.req, u.socket, u.head, (ws) => { socket = ws; });
  // Node's Response rejects status 101; the handshake was already written by ws,
  // so this response is only a marker that the request was upgraded.
  const response = new Response(null, { status: 200 });
  response[kUpgraded] = true;
  return { socket, response };
};

// ---------------------------------------------------------------- temp files
// @deno/shim-deno 0.19.2 joins `prefix` as a directory component; replace with
// Deno semantics: <dir ?? tmpdir>/<prefix><random><suffix>.
import os from "node:os";
import crypto from "node:crypto";
function tempPath(o = {}) {
  const dir = o.dir ?? os.tmpdir();
  return path.join(dir, `${o.prefix ?? ""}${crypto.randomBytes(6).toString("hex")}${o.suffix ?? ""}`);
}
Deno.makeTempDirSync = (o) => { const p = tempPath(o); fs.mkdirSync(p); return p; };
Deno.makeTempDir = async (o) => Deno.makeTempDirSync(o);
Deno.makeTempFileSync = (o) => { const p = tempPath(o); fs.writeFileSync(p, ""); return p; };
Deno.makeTempFile = async (o) => Deno.makeTempFileSync(o);

// ---------------------------------------------------------------- listen
// Deno.listen binds synchronously; Node cannot. quarto only uses it to probe for a
// free port (isPortAvailableSync), so report every port as free and let Deno.serve
// fail loudly on EADDRINUSE. Finding: port probing must become async on Node.
Deno.listen = (opts) => { stats.listens = (stats.listens ?? 0) + 1; return { addr: { hostname: opts.hostname ?? "0.0.0.0", port: opts.port, transport: "tcp" }, close() {}, [Symbol.asyncIterator]: async function* () {} }; };

// ---------------------------------------------------------------- connect (TCP)
// @deno/shim-deno's Conn.read uses a blocking fd read that fails with EAGAIN on a
// non-blocking socket. Wrap net.Socket with a buffered async read() instead.
import net from "node:net";
class Conn {
  constructor(socket) {
    this.socket = socket;
    this.chunks = [];
    this.waiters = [];
    this.ended = false;
    socket.on("data", (d) => { this.chunks.push(d); this.#wake(); });
    socket.on("end", () => { this.ended = true; this.#wake(); });
    socket.on("close", () => { this.ended = true; this.#wake(); });
    socket.on("error", (e) => { this.error = e; this.ended = true; this.#wake(); });
    this.localAddr = { transport: "tcp", hostname: socket.localAddress, port: socket.localPort };
    this.remoteAddr = { transport: "tcp", hostname: socket.remoteAddress, port: socket.remotePort };
  }
  #wake() { const w = this.waiters.splice(0); for (const r of w) r(); }
  async read(buf) {
    while (this.chunks.length === 0) {
      if (this.error) throw this.error;
      if (this.ended) return null;
      await new Promise((r) => this.waiters.push(r));
    }
    const head = this.chunks[0];
    const n = Math.min(head.length, buf.length);
    buf.set(head.subarray(0, n));
    if (n < head.length) this.chunks[0] = head.subarray(n); else this.chunks.shift();
    return n;
  }
  write(data) {
    return new Promise((resolve, reject) => this.socket.write(data, (e) => e ? reject(e) : resolve(data.length)));
  }
  close() { this.socket.destroy(); }
  closeWrite() { return new Promise((r) => this.socket.end(r)); }
  setNoDelay(v = true) { this.socket.setNoDelay(v); }
  setKeepAlive(v = true) { this.socket.setKeepAlive(v); }
  ref() { this.socket.ref(); }
  unref() { this.socket.unref(); }
}
Deno.connect = (opts) => new Promise((resolve, reject) => {
  stats.connects = (stats.connects ?? 0) + 1;
  if (opts.transport && opts.transport !== "tcp") return reject(new Error("spike shim: only tcp"));
  const socket = net.createConnection({ host: opts.hostname ?? "127.0.0.1", port: opts.port });
  socket.once("connect", () => resolve(new Conn(socket)));
  socket.once("error", (e) => { if (e.code === "ECONNREFUSED") { const err = new shimDeno.errors.ConnectionRefused(e.message); reject(err); } else reject(e); });
});

// ---------------------------------------------------------------- misc
Deno.dlopen = () => { throw new Error("FFI not available on Node (spike shim)"); };
Deno.version = { deno: `node-shim/${process.versions.node}`, v8: process.versions.v8, typescript: "n/a" };
Deno.__shimStats = stats;

globalThis.Deno = Deno;
globalThis.__denoShimStats = stats;
