# Time-boxed spikes before and during Phase 2

Two spikes retire the bets Phase 2 makes before the code that depends on them
is written. Each has a goal, a time box, exact steps, exit criteria, and a
table saying which plan changes for each outcome. Results are recorded at the
end of this file (section "Results"), in the PR that closes the spike, and the
named plans are edited in the same PR.

| Spike | Time box | When | Owner | Blocks |
|---|---|---|---|---|
| #2 Dual runtime and Node-compat surfaces | 5 working days | after PR 26 is merged (it provides `tools/node-bundle/`), before PR 27 starts | Phase 2 worker (Opus) | PR 27, 28, 29, 33 (runtime switch), 34 (proxy row) |
| V Test runner: Vitest vs `node:test` | 2 working days | after PR 30 (the last of the Phase 2 ports 27, 27b, 28, 29, 30: the sample spawns processes, serves HTTP, opens the KV store and renders), before PR 31 is executed | Phase 2 worker (Opus) | PR 31, PR 32 |

Ground rules for both spikes:

- Work on a throwaway branch (`spike/2-dual-runtime`, `spike/v-test-runner`).
  Nothing from the branch is merged except the scripts under
  `dev-docs/runtime-migration/spike/spike2/` or `spike/runner/` (evidence,
  like the original `spike/`) and the edits to this file and to the plans.
- Pins: Deno 2.9.x as installed by PR 00a (`package/dist/bin/tools/<arch>/deno`;
  the commands below write `$DENO` for it), Node 26.12.0 or newer 26.x
  (`node --version` prints `v26.`), `ws` 8.22.0, `@cliffy/*` 1.3.1.
- Every command is run from the repository root unless it says otherwise.
- "Linux", "macOS", "Windows" means: run it there. A machine you do not have is
  covered by the dispatch workflow in step 2.0, which runs the same scripts on
  the three GitHub-hosted runners.

## Spike #2: the `node:` bundle on Deno, and the Node-compat surfaces Phase 2 relies on

### Goal

Answer seven questions with evidence, each on Deno 2.9.x and on Node 26:

| # | Question | Plans that depend on the answer |
|---|---|---|
| (a) | Does the Node bundle (`tools/node-bundle/dist/quarto.mjs`, `platform: "node"`) run on Deno 2.9 with `deno run`? This decides the dual-runtime prerelease window (decision 1). | PR 32, 33, 37 |
| (b) | Does a `node:http` server with a `ws` upgrade (the preview reload channel) work on Deno 2.9? | PR 29 |
| (c) | Does `fs.watch(dir, { recursive: true })` report create/modify/remove in nested and new directories on Deno and on Node, on all three OSes, including denoland/deno#36937 (a watcher opened on a directory that was deleted and recreated gets no events)? | PR 29 |
| (d) | Do `child_process.spawn({ detached: true })` + `process.kill(-pid)` kill a process group on Deno; does Deno's `child_process` honour `windowsVerbatimArguments`; does it refuse `.bat`/`.cmd` without a shell as Node does? | PR 28 |
| (e) | Do Cliffy 1.3.1 prompts work on Node (raw mode, `cbreak` ignored, Ctrl-C), and does any Quarto prompt path reach the unguarded `Deno.permissions` call in `@cliffy/prompt` path suggestions? | PR 26 (shim member), 33, 34 |
| (f) | Does Node's `--use-env-proxy` route Quarto's `fetch` calls through `HTTPS_PROXY` and honour `NO_PROXY`? | PR 33, 34 |
| (g) | Does `server.closeIdleConnections()` exist and behave on Deno's `node:http`? | PR 29 |

### Steps

#### 2.0 Setup (half a day)

- [ ] **Step 1: Branch and tool versions**

```bash
git checkout main && git pull && git checkout -b spike/2-dual-runtime
export DENO="$PWD/package/dist/bin/tools/$(uname -m | sed 's/arm64/aarch64/')/deno"
"$DENO" --version | head -1
node --version
npm ci
mkdir -p dev-docs/runtime-migration/spike/spike2
```

Expected: `deno 2.9.` and `v26.`. If `$DENO` is older than 2.9, PR 00a has not landed: stop and land it first (the spike's answers are only valid for the Deno version that ships).

- [ ] **Step 2: A dispatch workflow that runs the spike scripts on three OSes**

Create `.github/workflows/spike2.yml` on the spike branch only (never merged):

```yaml
name: Spike 2 (throwaway)
on: workflow_dispatch
jobs:
  spike:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 26
          cache: npm
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.9.x
      - run: npm ci
      - name: Run every spike script on both runtimes
        shell: bash
        run: |
          cd dev-docs/runtime-migration/spike/spike2
          for s in http-ws.mjs watch.mjs child.mjs; do
            echo "::group::node $s"; node "$s" || echo "::warning::node $s exited $?"; echo "::endgroup::"
            echo "::group::deno $s"; deno run --allow-all --no-config "$s" || echo "::warning::deno $s exited $?"; echo "::endgroup::"
          done
```

Run it after steps 2.2–2.4 with `gh workflow run spike2.yml --ref spike/2-dual-runtime && gh run watch`. The log is the evidence for the OSes you did not run locally.

#### 2.1 (a) The Node bundle on Deno (two days)

The bundle's banner imports `tools/node-bundle/deno-shim.mjs`; on Deno the shim is a no-op (PR 26 guards `globalThis.Deno` and keeps the real one), so `deno run` of the bundle exercises the bundling mechanics (ESM output, `createRequire` banner, inlined npm/JSR packages, `node:` built-ins, top-level await in `@b-fuze/deno-dom/wasm`, `import.meta` of a single file) against the real Deno APIs. The `deno_ral` bodies that PR 27–30 move onto `node:` APIs are run on Deno by every one of those PRs' own Deno CI, so they are not re-tested here; step 2.1.4 re-runs this check at the end of Phase 2.

- [ ] **Step 1: Build the bundle**

```bash
node tools/node-bundle/build.mjs --check-shim
ls -la tools/node-bundle/dist/quarto.mjs
```

Expected: `bundled src/quarto.ts -> tools/node-bundle/dist/quarto.mjs (...)` and `shim: ... 0 missing`.

- [ ] **Step 2: Run it on Deno against the spike documents**

```bash
rm -rf /tmp/spike2 && mkdir -p /tmp/spike2
for rt in deno-src deno-bundle node-bundle; do cp -r dev-docs/runtime-migration/spike/tests "/tmp/spike2/$rt"; done
export QUARTO_BIN_PATH="$PWD/package/dist/bin" QUARTO_SHARE_PATH="$PWD/src/resources" QUARTO_DEBUG=false
# --unstable-kv is needed until PR 30 removes Deno.openKv from the layer.
DENO_BUNDLE=("$DENO" run --allow-all --no-config --unstable-kv --v8-flags=--enable-experimental-regexp-engine,--max-old-space-size=8192 tools/node-bundle/dist/quarto.mjs)
"${DENO_BUNDLE[@]}" --version
for doc in simple.qmd website jupyter.qmd; do
  package/dist/bin/quarto render "/tmp/spike2/deno-src/$doc"
  "${DENO_BUNDLE[@]}" render "/tmp/spike2/deno-bundle/$doc"
  tools/node-bundle/quarto-node render "/tmp/spike2/node-bundle/$doc"
done
node tools/node-bundle/normalize-html.mjs --root /tmp/spike2/deno-src /tmp/spike2/deno-src
node tools/node-bundle/normalize-html.mjs --root /tmp/spike2/deno-bundle /tmp/spike2/deno-bundle
node tools/node-bundle/normalize-html.mjs --root /tmp/spike2/node-bundle /tmp/spike2/node-bundle
diff -r -x .quarto /tmp/spike2/deno-src /tmp/spike2/deno-bundle && echo "DENO BUNDLE IDENTICAL"
diff -r -x .quarto /tmp/spike2/deno-src /tmp/spike2/node-bundle && echo "NODE BUNDLE IDENTICAL"
```

Expected (success): `99.9.9`, three `Output created:` lines per runtime, `DENO BUNDLE IDENTICAL`, `NODE BUNDLE IDENTICAL`. Record every error verbatim (first stack frame and the bundle line, resolved through `tools/node-bundle/dist/quarto.mjs.map`).

- [ ] **Step 3: Commands that are not renders**

```bash
"${DENO_BUNDLE[@]}" check 2>&1 | tail -20
"${DENO_BUNDLE[@]}" preview /tmp/spike2/deno-bundle/simple.qmd --no-browser --port 4411 > /tmp/spike2/preview.log 2>&1 &
PREVIEW=$!; sleep 15
node dev-docs/runtime-migration/spike/tests/ws-client.mjs 4411 /; echo "ws exit=$?"
kill $PREVIEW
"${DENO_BUNDLE[@]}" inspect /tmp/spike2/deno-bundle/website | head -c 200; echo
/usr/bin/time -p "${DENO_BUNDLE[@]}" --version
/usr/bin/time -p package/dist/bin/quarto --version
```

Expected (success): `check` prints its table without a stack trace; `ws: connected` and `ws exit=0`; `inspect` prints JSON; the bundle's `--version` wall time is at most 1.5× the source launcher's (record both).

- [ ] **Step 4: Record the repeat check for the end of Phase 2**

Whatever the outcome, add to the "Results" section the exact `DENO_BUNDLE` command line used, so PR 32 can re-run steps 2–3 on the final layer (PR 32, Task "Dual-runtime smoke").

#### 2.2 (b) and (g): `node:http` + `ws` upgrade and `closeIdleConnections` (half a day)

- [ ] **Step 1: Write the probe**

`dev-docs/runtime-migration/spike/spike2/http-ws.mjs`:

```js
// Spike 2 (b)(g): node:http + ws upgrade, error events, closeIdleConnections.
// Copyright (C) 2026 Posit Software, PBC
import http from "node:http";
import { WebSocketServer } from "ws";

const rt = typeof Deno !== "undefined" ? `deno ${Deno.version.deno}` : `node ${process.versions.node}`;
const wss = new WebSocketServer({ noServer: true });
const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain", "set-cookie": ["a=1", "b=2"] });
  res.end("hello");
});
server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => ws.send("reload"));
});
let errors = 0;
server.on("error", (e) => { errors++; console.log(`server error ${errors}: ${e.code}`); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();

const res = await fetch(`http://127.0.0.1:${port}/`);
console.log("http", res.status, await res.text(), res.headers.getSetCookie());

const msg = await new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
  ws.onmessage = (ev) => { resolve(String(ev.data)); ws.close(); };
  ws.onerror = (e) => reject(new Error("ws error " + e.message));
});
console.log("ws message", msg);

// A second listen on the same port must surface EADDRINUSE through "error", twice.
const clash = http.createServer();
clash.on("error", (e) => console.log("clash error", e.code));
clash.listen(port, "127.0.0.1");
await new Promise((r) => setTimeout(r, 200));

console.log("closeIdleConnections", typeof server.closeIdleConnections, "closeAllConnections", typeof server.closeAllConnections);
// A keep-alive client leaves an idle socket open; closeIdleConnections must let close() finish promptly.
const agent = new http.Agent({ keepAlive: true });
await new Promise((r) => http.get({ port, host: "127.0.0.1", agent }, (r2) => { r2.resume(); r2.on("end", r); }));
const t0 = Date.now();
server.closeIdleConnections?.();
await new Promise((r) => server.close(r));
console.log(`close after idle cleanup: ${Date.now() - t0} ms`);
agent.destroy();
console.log(`${rt}: http-ws OK`);
```

- [ ] **Step 2: Run on both runtimes**

```bash
cd dev-docs/runtime-migration/spike/spike2
node http-ws.mjs
"$DENO" run --allow-all --no-config http-ws.mjs
cd -
```

Expected (success, both): `http 200 hello [ 'a=1', 'b=2' ]`, `ws message reload`, `clash error EADDRINUSE`, `closeIdleConnections function closeAllConnections function`, `close after idle cleanup: <N> ms` with N < 500, and `...: http-ws OK`.

#### 2.3 (c) `fs.watch` recursive, including denoland/deno#36937 (one day, three OSes)

- [ ] **Step 1: Write the probe**

`dev-docs/runtime-migration/spike/spike2/watch.mjs`:

```js
// Spike 2 (c): fs.watch recursive; recreated-root case (denoland/deno#36937).
// Copyright (C) 2026 Posit Software, PBC
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const rt = typeof Deno !== "undefined" ? `deno ${Deno.version.deno}` : `node ${process.versions.node}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const root = fs.mkdtempSync(path.join(os.tmpdir(), "spike2-watch-"));
const dir = path.join(root, "watched");
fs.mkdirSync(dir);

function watchInto(target, events) {
  const w = fs.watch(target, { recursive: true }, (type, name) => events.push(`${type}:${name ?? "<null>"}`));
  w.on("error", (e) => events.push(`error:${e.code}`));
  return w;
}

const first = [];
let w = watchInto(dir, first);
await sleep(200);
fs.mkdirSync(path.join(dir, "sub"));
await sleep(300);
fs.writeFileSync(path.join(dir, "sub", "a.txt"), "1");
await sleep(300);
fs.writeFileSync(path.join(dir, "sub", "a.txt"), "22");
await sleep(300);
fs.rmSync(path.join(dir, "sub", "a.txt"));
await sleep(500);
console.log("nested:", JSON.stringify(first));

// #36937: delete the watched directory, recreate it, open a NEW watcher, write a file.
fs.rmSync(dir, { recursive: true, force: true });
await sleep(300);
w.close();
fs.mkdirSync(dir);
const second = [];
w = watchInto(dir, second);
await sleep(200);
fs.writeFileSync(path.join(dir, "b.txt"), "x");
await sleep(800);
w.close();
console.log("recreated-root:", JSON.stringify(second));
console.log(`${rt}: nested ${first.some((e) => e.includes("a.txt")) ? "OK" : "MISSING"}; recreated-root ${second.some((e) => e.includes("b.txt")) ? "OK" : "MISSING (#36937)"}`);
fs.rmSync(root, { recursive: true, force: true });
```

- [ ] **Step 2: Run on both runtimes, locally and through the dispatch workflow**

```bash
cd dev-docs/runtime-migration/spike/spike2
node watch.mjs
"$DENO" run --allow-all --no-config watch.mjs
cd -
```

Expected: one summary line per runtime: `nested OK` everywhere; `recreated-root OK` on Node. On Deno the `recreated-root` result is the answer to #36937 for 2.9.x on that OS. Repeat on the other two OSes (dispatch workflow, step 2.0).

#### 2.4 (d) Process groups, `windowsVerbatimArguments`, `.bat` spawning (one day, three OSes)

- [ ] **Step 1: Write the probe**

`dev-docs/runtime-migration/spike/spike2/child.mjs`:

```js
// Spike 2 (d): detached process groups and Windows batch-file spawning.
// Copyright (C) 2026 Posit Software, PBC
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const rt = typeof Deno !== "undefined" ? `deno ${Deno.version.deno}` : `node ${process.versions.node}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

if (process.platform !== "win32") {
  // Child shell starts a grandchild and prints its pid.
  const child = spawn("sh", ["-c", "sleep 60 & echo $!; wait"], { detached: true, stdio: ["ignore", "pipe", "inherit"] });
  const grandchild = await new Promise((r) => child.stdout.once("data", (d) => r(Number(String(d).trim()))));
  console.log("child", child.pid, "grandchild", grandchild, "alive", alive(grandchild));
  process.kill(-child.pid, "SIGTERM");
  await sleep(500);
  console.log(`${rt}: group kill ${alive(grandchild) ? "FAILED (grandchild alive)" : "OK"}`);
} else {
  // windowsVerbatimArguments: Node passes the line to CreateProcess as is.
  const r = spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", '"echo "a b" ^& echo two"'], { windowsVerbatimArguments: true, encoding: "utf8" });
  console.log(`${rt}: verbatim stdout=${JSON.stringify(r.stdout)}`);
  // .bat without a shell: Node refuses with EINVAL (CVE-2024-27980). What does Deno do?
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spike2 bat "));
  const bat = path.join(dir, "echo.bat");
  fs.writeFileSync(bat, "@echo off\r\necho [%1] [%2]\r\n");
  const direct = spawnSync(bat, ["a&b", "%PATH%"], { encoding: "utf8" });
  console.log(`${rt}: direct .bat error=${direct.error?.code ?? "none"} stdout=${JSON.stringify(direct.stdout)}`);
  // Tree kill: taskkill /T on a cmd that starts a ping grandchild.
  const child = spawn("cmd.exe", ["/d", "/c", "ping -n 60 127.0.0.1 > nul"], { detached: true, stdio: "ignore", windowsHide: true });
  await sleep(1000);
  const tk = spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { encoding: "utf8" });
  console.log(`${rt}: taskkill /T status=${tk.status} ${tk.stdout.trim()}`);
  fs.rmSync(dir, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run**

```bash
cd dev-docs/runtime-migration/spike/spike2
node child.mjs
"$DENO" run --allow-all --no-config child.mjs
cd -
```

Expected on POSIX (both runtimes): `group kill OK`. Expected on Windows, Node: `verbatim stdout="\"a b\" \r\ntwo\r\n"` (exact quoting printed by `echo`), `direct .bat error=EINVAL`, `taskkill /T status=0`. The Deno lines are the answers: whether `windowsVerbatimArguments` is honoured (same stdout as Node), and whether Deno spawns the `.bat` directly (and with what escaping of `a&b` and `%PATH%`; Deno's `child_process` is built on its Rust `Command`, which applies the BatBadBut-safe escaping).

#### 2.5 (e) Cliffy 1.3.1 prompts on Node (half a day, Linux or macOS)

- [ ] **Step 1: Does the bundle reach `Deno.permissions`?**

```bash
grep -n "Deno.permissions\|Deno?.permissions" tools/node-bundle/dist/quarto.mjs | head
grep -rn "files: true\|suggestions:" src --include=*.ts | grep -v "core/lib/yaml-validation" | head
```

Expected: hits only inside `@cliffy/prompt`'s path-suggestion code and no Quarto `Input` prompt with `files: true` or `suggestions:`. If a Quarto prompt passes `files: true`, that prompt crashes on Node without the shim member.

- [ ] **Step 2: Drive a Select and a Confirm prompt through a pseudo-terminal**

`dev-docs/runtime-migration/spike/spike2/prompt.mjs` (built through the bundler so the import-map names `cliffy/prompt/*.ts` that `src/publish/**` uses resolve to `@cliffy/prompt` 1.3.1 exactly as in Quarto):

```js
// Spike 2 (e): Cliffy prompts on the current runtime.
// Copyright (C) 2026 Posit Software, PBC
import { Confirm } from "cliffy/prompt/confirm.ts";
import { Select } from "cliffy/prompt/select.ts";
const choice = await Select.prompt({ message: "Pick", options: ["one", "two"] });
const ok = await Confirm.prompt("Sure?");
console.log(`RESULT ${choice} ${ok}`);
```

```bash
node tools/node-bundle/build.mjs --entry dev-docs/runtime-migration/spike/spike2/prompt.mjs --out /tmp/spike2/prompt.mjs
# Down arrow, Enter, "y", Enter
printf '\033[B\ry\r' | script -q -c "node /tmp/spike2/prompt.mjs" /dev/null | tail -2
# Ctrl-C at the first prompt, then check the terminal mode was restored
( sleep 1; printf '\003' ) | script -q -c "node /tmp/spike2/prompt.mjs; echo EXIT=\$?; stty -a | grep -o '\-icanon\|icanon'" /dev/null | tail -3
```

(`script -q -c` is util-linux; on macOS use `script -q /dev/null node /tmp/spike2/prompt.mjs`.)

Expected (success): `RESULT two true`; on Ctrl-C an exit code of 130 (SIGINT) or 1 with no stack trace, and `icanon` (canonical mode restored) rather than `-icanon`. Record the actual behaviour; Deno's `cbreak` behaviour (Ctrl-C delivered as a key, prompt raises an error) is the baseline: run the same two commands with `"$DENO" run --allow-all --no-config /tmp/spike2/prompt.mjs`.

#### 2.6 (f) `--use-env-proxy` behind a proxy (half a day)

- [ ] **Step 1: A 25-line CONNECT proxy that logs what it tunnels**

`dev-docs/runtime-migration/spike/spike2/proxy.mjs`:

```js
// Spike 2 (f): minimal logging HTTP CONNECT proxy. Usage: node proxy.mjs [port]
// Copyright (C) 2026 Posit Software, PBC
import http from "node:http";
import net from "node:net";
const port = Number(process.argv[2] ?? 8899);
const server = http.createServer((req, res) => {
  console.log(`HTTP ${req.method} ${req.url}`);
  res.writeHead(502); res.end("plain HTTP proxying not supported by this test proxy");
});
server.on("connect", (req, client, head) => {
  console.log(`CONNECT ${req.url}`);
  const [host, p] = req.url.split(":");
  const upstream = net.connect(Number(p), host, () => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
  upstream.on("error", () => client.destroy());
  client.on("error", () => upstream.destroy());
});
server.listen(port, "127.0.0.1", () => console.log(`proxy listening on ${port}`));
```

- [ ] **Step 2: Plain fetch, then Quarto's fetch paths**

```bash
node dev-docs/runtime-migration/spike/spike2/proxy.mjs 8899 > /tmp/spike2/proxy.log 2>&1 &
PROXY=$!; sleep 1
export HTTPS_PROXY=http://127.0.0.1:8899 HTTP_PROXY=http://127.0.0.1:8899
node -e 'const r = await fetch("https://quarto.org/docs/download/_download.json"); console.log("no flag", r.status)'
node --use-env-proxy -e 'const r = await fetch("https://quarto.org/docs/download/_download.json"); console.log("flag", r.status)'
NO_PROXY=quarto.org node --use-env-proxy -e 'const r = await fetch("https://quarto.org/docs/download/_download.json"); console.log("no_proxy", r.status)'
QUARTO_BIN_PATH="$PWD/package/dist/bin" QUARTO_SHARE_PATH="$PWD/src/resources" \
  node --use-env-proxy --enable-experimental-regexp-engine tools/node-bundle/dist/quarto.mjs tools 2>&1 | tail -5
"$DENO" eval 'const r = await fetch("https://quarto.org/docs/download/_download.json"); console.log("deno", r.status)'
kill $PROXY; unset HTTPS_PROXY HTTP_PROXY
cat /tmp/spike2/proxy.log
```

Expected (success): `no flag 200` produces no `CONNECT` line (Node ignores the variables by default); `flag 200` produces `CONNECT quarto.org:443`; `no_proxy 200` produces no new line; `quarto tools` produces `CONNECT api.github.com:443` (the TinyTeX/Chromium latest-release lookups in `src/tools/github.ts`); `deno 200` produces a `CONNECT` line (Deno's baseline). Run once more with `NODE_USE_ENV_PROXY=1` instead of the flag to confirm the environment-variable form (PR 33 picks one for the launcher).

### Exit criteria

The spike ends after five working days or when every question (a)–(g) has a recorded answer on every OS it applies to, whichever is first. An unanswered question at the time box is recorded as "unknown" and is treated as a failure in the outcome table.

| Question | Success means |
|---|---|
| (a) | Steps 2.1.2 and 2.1.3 pass on Linux and on one of macOS/Windows: three renders identical, `check`/`preview`/`inspect` work, startup ≤ 1.5× |
| (b) | `http-ws OK` on Deno on all three OSes |
| (c) | `nested OK` on both runtimes on all three OSes; the `recreated-root` result on Deno recorded per OS |
| (d) | POSIX `group kill OK` on Deno; on Windows the Deno `verbatim` line equal to Node's, or the direct-`.bat` behaviour recorded |
| (e) | `RESULT two true` on Node; Ctrl-C leaves the terminal canonical; the `Deno.permissions` reachability recorded |
| (f) | `CONNECT` lines exactly as expected for the flag, `NO_PROXY` and `quarto tools` |
| (g) | `closeIdleConnections function` and a prompt close on Deno |

### What each outcome changes

| Q | Outcome | Plan change (made in the spike-closing PR) |
|---|---|---|
| (a) | success | PR 33 adds the launcher switch `QUARTO_RUNTIME=node\|deno` (default `node`; `deno` runs `deno run --allow-all --no-config --v8-flags=… bin/quarto.mjs`), ships both runtimes for one prerelease cycle; PR 32 adds the nightly "Dual-runtime smoke" job (steps 2.1.2–2.1.3 on the final bundle); PR 37 removes the switch and the Deno binary. |
| (a) | failure | PR 33 keeps only "Deno as a tool" (decision 1, point 2); no `QUARTO_RUNTIME`; PR 32 drops the dual-runtime job; the failure list goes to the Results section. |
| (b) | success | PR 29 keeps `node:http` + `ws` with no runtime branch. |
| (b) | failure | PR 29 keeps the Phase 1 `Deno.serve` body behind `runtime().name === "deno"` for `serveHttp`/`upgradeWebSocket` only, until PR 37 deletes it (the one sanctioned dual body, listed in PR 29's Risks). |
| (c) | Deno recreated-root OK | PR 29 sets `kRecreatedRootNeedsPolling = false`. |
| (c) | Deno recreated-root MISSING | PR 29 keeps `kRecreatedRootNeedsPolling = runtime().name === "deno"` (as written). |
| (c) | Node nested MISSING on an OS | PR 29 makes `QUARTO_WATCH_POLLING=1` the default on that OS (`watch.ts`, one constant) and records it. |
| (d) | Deno group kill fails | PR 28's `killProcess(-pid)` on Deno falls back to `taskkill`-style tree walk via `ps -o pid= --ppid` (POSIX) — the code is added to PR 28 Task 3 with the test from PR 14b. |
| (d) | Deno ignores `windowsVerbatimArguments` | PR 28's `.bat`/`.cmd` path spawns the file directly on Deno (Rust `Command` escaping) and uses the escaping `cmd.exe` line only on Node (`kBatchViaCmd = runtime().name === "node"`). |
| (e) | `Deno.permissions` reachable from a Quarto prompt | PR 26's shim keeps `permissions`; an upstream issue is filed on `c4spar/deno-cliffy`; PR 33 cannot delete the shim member until the Cliffy fix ships (its Risks list it). |
| (e) | Ctrl-C leaves raw mode or crashes | PR 34's runtime-environment contract gets a row "prompt interrupted" with a test, and a `process.on("SIGINT")` restore of `setRawMode(false)` in `src/core/lib/...` is added to PR 34. |
| (f) | flag works | PR 33's launcher passes `--use-env-proxy` (or exports `NODE_USE_ENV_PROXY=1`, whichever form the spike confirmed); PR 34's contract table row "HTTP(S)_PROXY/NO_PROXY" cites this spike. |
| (f) | flag does not cover a fetch path | PR 33 adds `http.setGlobalProxyFromEnv()` at startup (Node 26) and the uncovered call site is listed in PR 34. |
| (g) | `closeIdleConnections` missing or no-op on Deno | PR 29's `shutdown()` calls it only when it is a function and keeps the 2 s `closeAllConnections` fallback (already written that way). |

## Spike V: Vitest vs `node:test` for the test suite

### Goal

Decide the Node test runner for PR 31 from measurements (decision 4). PR 31 is
written runner-agnostic (the harness adapter interface in `_TEMPLATE.md` is
fixed); the sections marked "decided by Spike V" are filled from this spike.

### Inputs

- PR 02b landed (`import type` everywhere, no `enum`/parameter properties/`<T>`), PR 23 (harness adapter), PR 26 (`tools/node-bundle/import-map.mjs`), and the Phase 2 ports PR 27 (`fs.ts`), 27b (`env.ts`, `platform.ts`), 28 (`process.ts`), 29 (`net.ts`, `http.ts`, `watch.ts`) and 30 (`kv.ts`) on `node:` APIs. Files 4 (`ral/process.test.ts`), 5 (`sass-cache.test.ts`: KV store), 7–10 (in-process renders: Pandoc spawns, the Jupyter transport, the HTTP server) exercise those modules; run before the ports, their failures would measure unfinished runtime work, not the runner (`REVIEW-2026-10-16.md` R12).
- The two prototype harness branches are written in this spike from PR 31's "Variant N" and "Variant V" code blocks.

### The ten representative files

| # | File | Why |
|---|---|---|
| 1 | `tests/unit/path.test.ts` | pure unit |
| 2 | `tests/unit/text.test.ts` | pure unit |
| 3 | `tests/unit/ral/fs.test.ts` | layer, temp dirs |
| 4 | `tests/unit/ral/process.test.ts` | spawns children, signals |
| 5 | `tests/unit/sass-cache.test.ts` | KV store + fs |
| 6 | `tests/unit/harness-failure-reporting.test.ts` | self-spawning (`runHarness`), GitHub annotations |
| 7 | `tests/smoke/render/render-html.test.ts` | in-process render (imports `src/quarto.ts` through `tests/quarto-cmd.ts`) |
| 8 | `tests/smoke/smoke-all.test.ts` with `QUARTO_TEST_ARGS=docs/smoke-all/2023/02/08/4272.qmd` | smoke-all argument channel |
| 9 | `tests/smoke/project/project-website.test.ts` | project render, many modules |
| 10 | `tests/integration/playwright-tests.test.ts` with `QUARTO_TEST_ARGS=docs/playwright/html/tabsets/jupyter-tabsets.qmd` | Playwright-adjacent: renders, then spawns `npx playwright test` |

(If a path does not exist on `main` at spike time, pick the closest file in the same directory with `ls` and record the substitution.)

### Steps

- [ ] **Step 1: Branch and prototype both variants (day 1)**

```bash
git checkout main && git pull && git checkout -b spike/v-test-runner
npm install --save-dev vitest@3
```

Apply PR 31's Task "Variant N" (loader hook `tools/node-bundle/register-import-map.mjs`, harness `node:test` branch) and Task "Variant V" (`tests/vitest.config.mjs`, harness Vitest branch) code blocks. Both variants coexist on the spike branch: the harness selects Vitest when `process.env.VITEST` is set and `node:test` otherwise.

- [ ] **Step 2: Correctness on the ten files (day 1)**

```bash
cd tests
FILES="unit/path.test.ts unit/text.test.ts unit/ral/fs.test.ts unit/ral/process.test.ts unit/sass-cache.test.ts unit/harness-failure-reporting.test.ts smoke/render/render-html.test.ts smoke/project/project-website.test.ts"
QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $FILES                      # Deno baseline
node --import ../tools/node-bundle/register-import-map.mjs --test --test-concurrency=1 --test-force-exit --test-timeout=600000 \
  --test-reporter=dot --test-reporter=junit --test-reporter-destination=stdout --test-reporter-destination=/tmp/v-node.xml $FILES
npx vitest run --config vitest.config.mjs --reporter=dot --reporter=junit --outputFile.junit=/tmp/v-vitest.xml $FILES
QUARTO_TEST_ARGS=docs/smoke-all/2023/02/08/4272.qmd node --import ../tools/node-bundle/register-import-map.mjs --test smoke/smoke-all.test.ts
QUARTO_TEST_ARGS=docs/smoke-all/2023/02/08/4272.qmd npx vitest run --config vitest.config.mjs smoke/smoke-all.test.ts
cd ..
node tools/node-bundle/junit.mjs summary /tmp/v-node.xml
node tools/node-bundle/junit.mjs summary /tmp/v-vitest.xml
```

Expected: each command prints a pass/fail tally; `junit.mjs summary` (PR 26) prints `passed N, failed M, skipped K` for each report. Record the per-file pass count against the Deno baseline. File 10 needs `npx playwright install chromium` once.

- [ ] **Step 3: Timing (day 2 morning)**

```bash
cd tests
for i in 1 2 3; do
  /usr/bin/time -f "node:test %e s" node --import ../tools/node-bundle/register-import-map.mjs --test --test-concurrency=1 --test-force-exit --test-reporter=dot $FILES 2>&1 | tail -1
  /usr/bin/time -f "vitest %e s" npx vitest run --config vitest.config.mjs --reporter=dot $FILES 2>&1 | tail -1
  /usr/bin/time -f "deno %e s" ./run-tests.sh --agent $FILES 2>&1 | tail -1
done
# Per-file startup: the time to the first test of a trivial file
/usr/bin/time -f "node:test startup %e s" node --import ../tools/node-bundle/register-import-map.mjs --test unit/path.test.ts > /dev/null
/usr/bin/time -f "vitest startup %e s" npx vitest run --config vitest.config.mjs unit/path.test.ts > /dev/null
/usr/bin/time -f "node:test render-html.test.ts %e s" node --import ../tools/node-bundle/register-import-map.mjs --test smoke/render/render-html.test.ts > /dev/null
/usr/bin/time -f "vitest render-html.test.ts %e s" npx vitest run --config vitest.config.mjs smoke/render/render-html.test.ts > /dev/null
cd ..
```

Record the median of three for each line. `render-html.test.ts` startup is dominated by loading `src/quarto.ts` (~1,200 modules): it shows the cost of type stripping through the loader hook (node:test) against Vite's transform cache (Vitest).

- [ ] **Step 4: Features (day 2 afternoon)**

Fill this table on the spike branch, one row per feature, with the command used:

| Feature | node:test | Vitest | How checked |
|---|---|---|---|
| JUnit per run | `--test-reporter=junit` | `--reporter=junit --outputFile.junit=` | both XML files parse with `junit.mjs summary`; testcase names equal to Deno's `[unit] > …` names |
| Watch mode | `node --test --watch unit/path.test.ts` | `npx vitest unit/path.test.ts` | edit the file; the run repeats |
| `t.step` | native `t.test` | emulated in the harness (no nested tests) | `tests/unit/harness-node.test.ts` "origin and step results" passes |
| Sanitizers | none | none (`--pool=forks` isolates) | the harness supplies them on both (PR 31, "Leak guarantees": `runChecked()`); what the spike checks is the bound: a file whose opted-out test leaks a timer still ends (node:test with `--test-force-exit`; Vitest's worker terminated) and its exit code follows the test results |
| Per-test timeout | `--test-timeout` | `testTimeout` in config | a test sleeping 20 s with a 10 s limit fails as timed out, the next test and file still run |
| Type-only imports | requires PR 02b (strip-only) | elided by esbuild | revert one `import type` back to `import` in `unit/text.test.ts`'s import chain: node:test fails to link, Vitest passes |
| Serial files (grouping rule) | `--test-concurrency=1` | `fileParallelism: false` | GitHub `::group::` blocks do not interleave (`GITHUB_ACTIONS=true`) |
| CI bucketing | `run-tests-node.sh` per file, timing file as today | `vitest run <files>` per bucket | `tests/run-parallel-tests.mjs --dry-run` output feeds both |
| Dependencies | none | `vitest` + `vite` (dev only) | `npm ls vitest` |

### Exit criteria and decision rule

The spike ends after two working days. Decision:

0. **Classify every failure first.** A test that fails on *both* Node runners with the same error, in a module owned by PR 27–30 (a `node:` body of `src/deno_ral/`), is a runtime gap, not a runner result: record it in the Results section against the owning PR, which fixes it before PR 32 makes the Node matrix required; the test is set aside for rule 1 (it counts for neither runner). A test that fails on one runner only is a runner result. A file that cannot be classified in the time box is recorded as "unclassified" and treated as a runner failure of both runners.
1. A runner is **eligible** if it passes, on Linux, at least the same tests as the Deno baseline on files 1–9 (tests set aside under rule 0 excluded), produces parseable JUnit with the same test names, honours a per-test timeout, and runs files serially.
2. If only one runner is eligible, choose it.
3. If both are eligible, choose **Vitest** only when its bucket time (step 3, files 1–9) is at most 0.75× node:test's **or** node:test's `render-html.test.ts` startup exceeds 10 s; otherwise choose **`node:test`** (no runtime dependency, built into the pinned Node, same reporter names as the Deno JUnit pipeline).
4. If neither is eligible, the spike is **inconclusive**: record it as such in the Results section with the failing files and their classification, and record `node:test` as the **provisional** choice for PR 31's prototyping only (it needs no dependency and is the easier one to revert). An inconclusive spike is not a validated outcome: PR 31 proceeds with Variant N but keeps Variant V in its plan and in the harness (both branches, as during the spike), and PR 32 may not make the Node matrix required until the spike has been re-run (one day, files 1–9 after the owning PRs' fixes) and recorded a definitive choice under rules 1–3.

### What each outcome changes

| Outcome | PR 31 | PR 32 | Other |
|---|---|---|---|
| `node:test` | Variant N sections become the plan; Variant V sections are deleted from the plan in the spike-closing PR; PR 02b stays a hard dependency | runner commands `run-tests-node.sh`/`.ps1`; JUnit from `--test-reporter=junit` | none |
| Vitest | Variant V sections become the plan; `vitest` is pinned in `devDependencies` (exact version recorded here); PR 02b is still landed (dev loop, PR 35) but is no longer required by tests | runner commands `npx vitest run --config tests/vitest.config.mjs`; JUnit from `--reporter=junit`; per-bucket `--outputFile.junit` | `tools/node-bundle/check-deps.mjs` ignores `devDependencies` already, no change |
| inconclusive (rule 4) | Variant N is implemented as provisional; Variant V stays in the plan and both harness branches stay until the re-run; the Results section says "inconclusive" and lists the runtime gaps with their owning PRs | blocked at Task 6 (making Node required) until the re-run records a definitive choice; the Node matrix runs non-required meanwhile | the owning PRs of the set-aside tests fix them (their own `node-unit` runs show the fix); the re-run is scheduled in the spike-closing PR's description |

## Results

Filled by the spike-closing PRs. One subsection per spike: date, Deno and Node
versions, OS list, the answer to each question with the log excerpt, the
decision taken from the outcome table, and the list of plan edits made.

### Spike #2

Not run yet.

### Spike V

Not run yet.
