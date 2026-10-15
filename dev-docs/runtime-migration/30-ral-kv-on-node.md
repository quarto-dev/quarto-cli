# PR 30: `kv.ts` as a locked JSON index (`<name>.json`); drop `--unstable-kv` from Quarto's own launchers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Deno.Kv`-backed `src/deno_ral/kv.ts` with a JSON index file per store (`<dir>/<name>.json`, a file name no Deno-based Quarto ever opens), written under a lock directory with per-key merge and atomic replacement, so parallel renders, preview plus render, and Quarto versions on either runtime share cache directories without losing or corrupting entries; then remove `--unstable-kv` from Quarto's own launchers and test runners.
**Phase:** 2. **Depends on:** PR 18 (`openKeyValueStore(dir, name)`, both caches on it, the cross-handle and cross-process contract cases), PR 25 (boundary at zero), PR 26 (shim, `node-unit` job, `tests/unit/ral/layer-script.ts`), PR 27b (`runtime()` correct inside the test bundles, which `layer-script.ts` relies on). **Unblocks:** PR 31, 32.
**Branch:** `rt/30-ral-kv-on-node`.
**Suggested executor:** Opus. The store is small, but the lock, the stale-lock break and the cross-version file layout need judgement; the flag removal is a grep.
**Size:** S (1 source file rewritten, 1 test file and 1 fixture added, 11 flag sites, shim shrink).
**Ships on:** Deno; the existing suite, in particular `unit/sass-cache.test.ts` and `smoke/render/`, must stay green. Node: the PR 26 `node-unit` job runs `tests/unit/ral/kv.test.ts` and `kv-json.test.ts` on real Node (Linux, Windows); their entries in `tools/node-bundle/known-failures.json` are removed and none is added.

## Spec

### Context

Assessment section 3.3: `Deno.openKv` (unstable) backs two small key → file-hash indexes, the project cache (`src/core/cache/cache.ts`) and the Sass cache (`src/core/sass/cache.ts`); "a JSON index file with atomic writes is sufficient; `node:sqlite` … if a real store is wanted". Section 11 module row `kv.ts`: "Deno implementation wraps `Deno.Kv` today; the Node one is a JSON index or `node:sqlite`."

Review findings on the earlier draft (S7 and the Phase 2 report), all addressed here:

- **Shared state across Quarto versions.** The Sass cache lives in a user-global, unversioned `quartoCacheDir("sass")` shared by every installed Quarto (the RStudio-bundled copy and the CLI), and the project cache in `.quarto/project-cache` is shared by whichever Quarto renders the project. The draft rewrote the existing file in place as JSON and bumped the cache versions: an older Deno-based Quarto would then throw on open ("newer than supported") or fail `Deno.openKv` on a non-SQLite file, and the draft's "delete a foreign SQLite file" step would destroy the other version's index. Now the **backend chooses the file** (vocabulary): this JSON backend uses `<dir>/<name>.json`, Deno's `Deno.openKv` backend (PR 18, Quarto ≤ 1.11) uses `<dir>/<name>.kv`. Neither ever opens the other's file, so no version bump and no deletion are needed. The two indexes share the blob files next to them (content-hashed names); each cache already tolerates a blob that disappeared (the Sass cache checks the file before a hit, the project cache's `_getAs` drops the key on NotFound), so one version clearing its index costs the other at most a recompute.
- **"Last writer wins per key" was false.** Read-modify-rename without a lock loses another process's keys and deletes: two processes read the same old file, each writes its own key, the second rename drops the first key. Now every `set`/`delete` takes a lock directory (`<name>.json.lock`), re-reads the file under the lock, applies its single change and replaces the file; verified on Node 22.22 with three processes writing 60 keys each into one store: 180 entries survive.
- **Windows rename failures.** Antivirus and indexers hold files open briefly; `rename` over such a file fails with `EPERM`/`EACCES`/`EBUSY`. The write retries with backoff (about 1.6 s in total) before failing.
- **Reads saw only their own process's writes.** The vocabulary's contract test includes "a second handle on the same store sees a committed set": `get`/`list` reload when the file's signature (inode, mtime, size) changed; every write replaces the file, so a committed write always changes it.

**Decision: JSON index, not `node:sqlite`.** Both stores hold a few hundred entries at most, values are a hash string plus a type tag or a small `Uint8Array`/string, and the access pattern is read-mostly with occasional single-key writes. `node:sqlite` is still Stability 1.2 in Node 26.12, and a SQLite file would bring back the cross-version format question. Revisit only if a cache grows past tens of thousands of entries.

**Decision: a lock directory, written here, not the `proper-lockfile` package.** `mkdir` is atomic on every OS and on network file systems, which is all `proper-lockfile` relies on; the holder keeps the lock for one read-modify-rename (milliseconds), so the package's mtime refresh loop is unnecessary, and a dependency for forty lines is not worth a supply-chain entry. A lock older than 10 s belongs to a crashed process and is broken by renaming it away (only one breaker wins the rename); waiting longer than 15 s throws, and a cache write then fails like any other I/O error. Residual race, accepted: two processes that both observed the same stale lock before either broke it can, in a window of microseconds, both proceed; the consequence is at worst one lost cache entry (a recompute), never a torn file, because the file is only ever replaced by `rename`.

**Decision: one backend on both runtimes.** After this PR the Deno build also uses the JSON store (it runs on `node:fs`), so `Deno.Kv` leaves Quarto entirely and the `--unstable-kv` flag goes from the launchers, `quarto-bld`, `package/src/util/deno.ts` and the test runners. Users of a Deno-based Quarto (1.11 and earlier) keep their `<name>.kv` files untouched; the first render with this build starts a `<name>.json` index (one cold cache).

### Scope

In:
- Rewrite `src/deno_ral/kv.ts`; no `Deno.*` remains.
- Tests: `tests/unit/ral/kv-json.test.ts` (new), its fixture `tests/unit/ral/fixtures/kv-writer.ts`; PR 18's `tests/unit/ral/kv.test.ts` must pass unchanged.
- Remove `--unstable-kv` from: `package/src/util/deno.ts` (2), `package/src/quarto-bld`, `package/src/quarto-bld.cmd`, `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs`, `tests/run-tests.sh` (2), `tests/run-tests.ps1`, and the harness flags in `tests/utils.ts` (`kHarnessFlags`, PR 23; on `main` the flag sits in `tests/unit/smoke-all-prerender-isolation.test.ts:169` and `tests/unit/harness-failure-reporting.test.ts:60`, which PR 23 routed through `runHarness`).
- Shim shrink (`openKv`, `Kv`, `freeze`, `revive`); `known-failures.json` shrink.

Out:
- `src/core/run/deno.ts:63` keeps `--unstable-kv`: it is the flag set for **user** scripts run by `quarto run` on Deno, which may call `Deno.openKv` themselves; PR 35 decides `quarto run`'s flags.
- `--unstable-ffi` (PR 20 removes it with the deno_dom plugin).
- Cache keys, blob layout, the `ProjectCache` interface, the cache version constants (not bumped: the file name already separates the formats).
- `node:sqlite`.
- The callers' store names (PR 18 chose them; this PR only adds the `.json` file for each).

### Interfaces

Unchanged from the shared vocabulary (`_TEMPLATE.md`, "`kv.ts`"):

```ts
export type KvKey = (string | number)[];
export interface KvEntry<T> { key: KvKey; value: T; }
export interface KeyValueStore {
  get<T>(key: KvKey): Promise<T | null>;
  set<T>(key: KvKey, value: T): Promise<void>;
  delete(key: KvKey): Promise<void>;
  list<T>(prefix: KvKey): AsyncIterable<KvEntry<T>>;
  close(): void;
}
/** The backend chooses the file: <dir>/<name>.json here (Deno.openKv used <dir>/<name>.kv). */
export function openKeyValueStore(dir: string, name: string): Promise<KeyValueStore>;
```

Behaviour made precise:

- **Files:** the index `<dir>/<name>.json`; while a write is in progress, the lock directory `<dir>/<name>.json.lock` and a temporary `<dir>/<name>.json.<pid>.<8 hex>.tmp`. Nothing else is created; `<dir>/<name>.kv` and its `-wal`/`-shm` files are never opened or removed.
- **Format:** `{ "format": 1, "entries": { "<JSON key>": <encoded value>, ... } }`. The key string is `JSON.stringify(key)`. `Uint8Array` values are encoded as `{ "$bytes": "<base64>" }` (recursively inside plain objects and arrays); functions, symbols and bigints throw `TypeError` at `set`.
- **Writes (`set`, `delete`):** take the lock (create the lock directory; on `EEXIST` wait 20 ms and retry; break a lock older than 10 s; throw after 15 s), re-read the index, apply the one change, write the temporary file, `rename` it over the index (on Windows, retry `EPERM`/`EACCES`/`EBUSY` with backoff 10 ms doubling to 500 ms, eight retries), release the lock. Two processes writing different keys both persist.
- **Reads (`get`, `list`):** from memory, reloaded first when the index file's inode, mtime or size changed since the last load, so a second handle (or process) sees a committed write.
- **`list(prefix)` ordering:** keys sorted element-wise; at each position strings sort before numbers (Deno KV order), strings by code unit, numbers numerically; a key that is a strict prefix of another sorts first. `list([])` lists everything.
- **A corrupt index** (not JSON, or JSON without `"format": 1`) is removed and the store starts empty; this store never writes a partial file itself.
- **`close()`** flushes nothing (every write already reached the disk) and marks the store closed: later calls throw `Error("Key-value store <path> is closed")`; `close()` is idempotent (PR 18 contract).

### Files

- Modify: `src/deno_ral/kv.ts` (entire body)
- Test: `tests/unit/ral/kv-json.test.ts` (new), `tests/unit/ral/fixtures/kv-writer.ts` (new fixture, not a test)
- Test: `tests/unit/ral/kv.test.ts` (PR 18 contract; unchanged, must pass; assumes that path, per the vocabulary rule for layer tests), `tests/unit/sass-cache.test.ts` (existing)
- Modify: the 11 flag sites listed in Scope
- Modify: `tools/node-bundle/deno-shim.mjs`, `tools/node-bundle/known-failures.json`

### Acceptance criteria

- `grep -rn "unstable-kv" package/ tests/ src/ | grep -v node_modules` → exactly one line, `src/core/run/deno.ts` (user scripts).
- `grep -c "Deno\." src/deno_ral/kv.ts` → `0`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts unit/ral/kv-json.test.ts unit/sass-cache.test.ts` passes on Deno; `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` passes on Node with no `kv` entry left.
- A project rendered by this build next to an existing `.quarto/project-cache/<name>.kv` leaves that file byte-identical and creates `<name>.json`; a Sass cache directory with `sass.kv` likewise keeps it and gains `sass.json`.
- `package/dist/bin/quarto render <doc>` and `package/dist/bin/quarto preview` work without `--unstable-kv` in the launcher.

## Plan

### Task 1: Contract tests for the JSON store

**Files:**
- Create: `tests/unit/ral/fixtures/kv-writer.ts`
- Create: `tests/unit/ral/kv-json.test.ts`

- [ ] **Step 1: Write the fixture**

```ts
/*
 * kv-writer.ts
 *
 * Fixture for kv-json.test.ts (not a test): writes <count> keys [<prefix>, i]
 * into the store <dir>/index.json, one set() at a time.
 * Usage: kv-writer.ts <dir> <prefix> <count>
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { args } from "../../../../src/deno_ral/process.ts";
import { openKeyValueStore } from "../../../../src/deno_ral/kv.ts";

const [dir, prefix, count] = args().slice(-3);
const kv = await openKeyValueStore(dir, "index");
for (let i = 0; i < Number(count); i++) {
  await kv.set([prefix, i], { i, bytes: new Uint8Array([i % 256]) });
}
kv.close();
```

- [ ] **Step 2: Write the failing test**

```ts
/*
 * kv-json.test.ts
 *
 * The JSON store behind src/deno_ral/kv.ts: its own file name next to a
 * Deno KV file, Uint8Array values, list order, cross-handle and
 * cross-process writes, the lock, corrupt files.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import {
  mkdirSync,
  readDirSync,
  readFileSync,
  readTextFileSync,
  removeSync,
  utimeSync,
  writeFileSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";
import { exec } from "../../../src/deno_ral/process.ts";
import { openKeyValueStore } from "../../../src/deno_ral/kv.ts";
import { layerScriptCommand } from "./layer-script.ts";

const names = (dir: string) => readDirSync(dir).map((e) => e.name).sort();

unitTest("kv - the store is <name>.json and a <name>.kv beside it is never touched", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-" });
  const sqlite = new TextEncoder().encode("SQLite format 3\u0000older Quarto's Deno KV index");
  writeFileSync(join(dir, "sass.kv"), sqlite);
  writeTextFileSync(join(dir, "sass.kv-wal"), "");
  const kv = await openKeyValueStore(dir, "sass");
  await kv.set(["version"], 1);
  await kv.set(["entry", "abc"], { key: "k", hash: "h" });
  kv.close();
  assertEquals(names(dir), ["sass.json", "sass.kv", "sass.kv-wal"], "no lock or temp file left behind");
  assertEquals([...readFileSync(join(dir, "sass.kv"))], [...sqlite], "the Deno KV file is unchanged");
  const raw = JSON.parse(readTextFileSync(join(dir, "sass.json")));
  assertEquals(raw.format, 1);
  assertEquals(raw.entries['["version"]'], 1);
  const again = await openKeyValueStore(dir, "sass");
  assertEquals(await again.get(["entry", "abc"]), { key: "k", hash: "h" });
  assertEquals(await again.get(["missing"]), null);
  await again.delete(["version"]);
  assertEquals(await again.get(["version"]), null);
  removeSync(dir, { recursive: true });
});

unitTest("kv - Uint8Array nested in objects round-trips; functions are rejected", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-" });
  const kv = await openKeyValueStore(dir, "index");
  await kv.set(["b"], { value: new Uint8Array([0, 1, 2, 250, 255]), type: "buffer-immediate" });
  const reopened = await openKeyValueStore(dir, "index");
  const got = await reopened.get<{ value: Uint8Array; type: string }>(["b"]);
  assert(got !== null && got.value instanceof Uint8Array);
  assertEquals([...got!.value], [0, 1, 2, 250, 255]);
  assertEquals(got!.type, "buffer-immediate");
  await assertRejects(() => kv.set(["fn"], { f: () => 1 } as unknown as object), TypeError);
  removeSync(dir, { recursive: true });
});

unitTest("kv - list(prefix) is ordered: strings before numbers, prefixes first", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-" });
  const kv = await openKeyValueStore(dir, "index");
  await kv.set(["entry", 2], "n2");
  await kv.set(["entry", "b"], "sb");
  await kv.set(["entry"], "root");
  await kv.set(["entry", "a", 1], "sa1");
  await kv.set(["entry", 10], "n10");
  await kv.set(["other"], "x");
  const keys: unknown[] = [];
  for await (const e of kv.list(["entry"])) keys.push(e.key);
  assertEquals(keys, [["entry"], ["entry", "a", 1], ["entry", "b"], ["entry", 2], ["entry", 10]]);
  const all: unknown[] = [];
  for await (const e of kv.list([])) all.push(e.key);
  assertEquals(all.length, 6);
  removeSync(dir, { recursive: true });
});

unitTest("kv - a second handle on the same store sees a committed set", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-" });
  const a = await openKeyValueStore(dir, "index");
  const b = await openKeyValueStore(dir, "index");
  assertEquals(await b.get(["k"]), null);
  await a.set(["k"], "from a");
  assertEquals(await b.get(["k"]), "from a");
  await b.set(["j"], "from b");
  const keys: unknown[] = [];
  for await (const e of a.list([])) keys.push(e.key);
  assertEquals(keys, [["j"], ["k"]]);
  removeSync(dir, { recursive: true });
});

unitTest("kv - two processes writing different keys both persist", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-procs-" });
  const run = async (prefix: string) => {
    const { cmd, args } = await layerScriptCommand("unit/ral/fixtures/kv-writer.ts", [dir, prefix, "60"]);
    return exec(cmd, { args });
  };
  const results = await Promise.all([run("a"), run("b"), run("c")]);
  for (const r of results) assertEquals(r.code, 0, new TextDecoder().decode(r.stderr));
  const kv = await openKeyValueStore(dir, "index");
  let count = 0;
  for await (const _ of kv.list([])) count++;
  assertEquals(count, 180, "no process lost another's keys");
  assertEquals(names(dir), ["index.json"]);
  removeSync(dir, { recursive: true });
});

unitTest("kv - a stale lock is broken, a live lock is waited for", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-lock-" });
  const kv = await openKeyValueStore(dir, "index");
  const lock = join(dir, "index.json.lock");
  mkdirSync(lock);
  const old = new Date(Date.now() - 60_000);
  utimeSync(lock, old, old);
  await kv.set(["after-stale"], 1); // must not wait 15 s
  assertEquals(await kv.get(["after-stale"]), 1);
  mkdirSync(lock);
  setTimeout(() => removeSync(lock, { recursive: true }), 300);
  const t0 = Date.now();
  await kv.set(["after-live"], 2);
  assert(Date.now() - t0 >= 250, "the write waited for the live lock");
  assertEquals(names(dir), ["index.json"]);
  removeSync(dir, { recursive: true });
});

unitTest("kv - a corrupt index is replaced; a closed store rejects", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-" });
  writeTextFileSync(join(dir, "index.json"), "{ not json");
  const kv = await openKeyValueStore(dir, "index");
  assertEquals(await kv.get(["version"]), null);
  await kv.set(["version"], "1");
  assertEquals(JSON.parse(readTextFileSync(join(dir, "index.json"))).entries['["version"]'], "1");
  kv.close();
  kv.close();
  await assertRejects(() => kv.get(["version"]));
  removeSync(dir, { recursive: true });
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv-json.test.ts`
Expected on the PR 18 (`Deno.Kv`) body: the first case fails (no `sass.json`; the file is `sass.kv` and is opened as SQLite), and the lock case fails (no lock is taken). The cross-process case may pass on `Deno.Kv` (SQLite handles it): it is the contract the JSON store must keep.

- [ ] **Step 4: Commit the tests**

```bash
git add tests/unit/ral/kv-json.test.ts tests/unit/ral/fixtures/kv-writer.ts
git commit -m "tests: pin the JSON key-value store contract (file name, lock, cross-process)"
```

### Task 2: The JSON store

**Files:**
- Modify: `src/deno_ral/kv.ts`

- [ ] **Step 1: Implement**

```ts
/*
 * kv.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Key-value index as a JSON file (<dir>/<name>.json) with a lock directory
 * and atomic replacement. Users: core/cache/cache.ts (project cache) and
 * core/sass/cache.ts (Sass cache), each a few hundred key -> hash entries.
 * Runs on Node and on Deno 2. Decision record:
 * dev-docs/runtime-migration/30-ral-kv-on-node.md.
 */

import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import nodeProcess from "node:process";
import { isAlreadyExists, isNotFound } from "./errors.ts";

export type KvKey = (string | number)[];

export interface KvEntry<T> {
  key: KvKey;
  value: T;
}

export interface KeyValueStore {
  get<T>(key: KvKey): Promise<T | null>;
  set<T>(key: KvKey, value: T): Promise<void>;
  delete(key: KvKey): Promise<void>;
  list<T>(prefix: KvKey): AsyncIterable<KvEntry<T>>;
  close(): void;
}

const kFormat = 1;
const kLockStaleMs = 10_000;
const kLockWaitMs = 15_000;
const kLockRetryMs = 20;
const kRenameRetries = 8;

interface IndexFile {
  format: number;
  entries: Record<string, unknown>;
}

// Uint8Array is the only non-JSON value the caches store (project cache
// "buffer-immediate" entries); tag it so it survives JSON.
function encode(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { $bytes: Buffer.from(value).toString("base64") };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = encode(v);
    return out;
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new TypeError(`KeyValueStore cannot store a ${typeof value}`);
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.$bytes === "string" && Object.keys(obj).length === 1) {
      return new Uint8Array(Buffer.from(obj.$bytes, "base64"));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = decode(v);
    return out;
  }
  return value;
}

function keyString(key: KvKey): string {
  return JSON.stringify(key);
}

function comparePart(a: string | number, b: string | number): number {
  if (typeof a === typeof b) {
    if (typeof a === "number") return a - (b as number);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return typeof a === "string" ? -1 : 1; // strings before numbers (Deno KV order)
}

function compareKey(a: KvKey, b: KvKey): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const c = comparePart(a[i], b[i]);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

function hasPrefix(key: KvKey, prefix: KvKey): boolean {
  return prefix.length <= key.length && prefix.every((p, i) => key[i] === p);
}

// ---------------------------------------------------------------- on-disk index

interface Signature {
  ino: number;
  mtimeMs: number;
  size: number;
}

function signatureOf(path: string): Signature | undefined {
  try {
    const st = statSync(path);
    return { ino: st.ino, mtimeMs: st.mtimeMs, size: st.size };
  } catch (e) {
    if (isNotFound(e)) return undefined;
    throw e;
  }
}

function sameSignature(a: Signature | undefined, b: Signature | undefined): boolean {
  return a === b || (!!a && !!b && a.ino === b.ino && a.mtimeMs === b.mtimeMs && a.size === b.size);
}

function readIndex(path: string): IndexFile {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if (isNotFound(e)) return { format: kFormat, entries: {} };
    throw e;
  }
  try {
    const parsed = JSON.parse(text) as IndexFile;
    if (parsed && parsed.format === kFormat && parsed.entries && typeof parsed.entries === "object") {
      return parsed;
    }
  } catch {
    // fall through: not our format
  }
  // A corrupt or foreign <name>.json (edited by hand): start over. Writes are
  // rename-atomic, so this store never leaves a partial file itself.
  rmSync(path, { force: true });
  return { format: kFormat, entries: {} };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Windows: antivirus and indexers briefly hold files open, and rename over a
// file open without FILE_SHARE_DELETE fails with EPERM/EACCES/EBUSY. Retry with
// backoff (10 ms doubling to 500 ms, about 1.6 s in total), like graceful-fs.
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0;; attempt++) {
    try {
      renameSync(from, to);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      const transient = nodeProcess.platform === "win32" &&
        (code === "EPERM" || code === "EACCES" || code === "EBUSY");
      if (!transient || attempt >= kRenameRetries) throw e;
      await sleep(Math.min(10 * 2 ** attempt, 500));
    }
  }
}

async function writeIndex(path: string, index: IndexFile): Promise<void> {
  const tmp = `${path}.${nodeProcess.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmp, JSON.stringify(index));
  try {
    await renameWithRetry(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

// ---------------------------------------------------------------- lock
// A lock directory next to the index (<name>.json.lock). mkdir is atomic on
// every OS and on network file systems; the holder keeps it for one
// read-modify-rename (milliseconds). A lock older than kLockStaleMs belongs to
// a crashed process and is broken by renaming it away: only one breaker wins
// the rename, the others see ENOENT and retry. Waiting longer than
// kLockWaitMs throws: a cache write then fails like any other I/O error.
async function withLock<T>(indexPath: string, fn: () => Promise<T>): Promise<T> {
  const lock = `${indexPath}.lock`;
  const deadline = Date.now() + kLockWaitMs;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (e) {
      if (!isAlreadyExists(e)) throw e;
    }
    let age: number;
    try {
      age = Date.now() - statSync(lock).mtimeMs;
    } catch (e) {
      if (isNotFound(e)) continue; // released between mkdir and stat
      throw e;
    }
    if (age > kLockStaleMs) {
      const stale = `${lock}.stale.${nodeProcess.pid}.${randomBytes(4).toString("hex")}`;
      try {
        renameSync(lock, stale);
        rmSync(stale, { recursive: true, force: true });
      } catch (e) {
        if (!isNotFound(e)) throw e; // another process broke it first
      }
      continue;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${kLockWaitMs} ms waiting for ${lock}`);
    }
    await sleep(kLockRetryMs);
  }
  try {
    return await fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- store

class JsonKeyValueStore implements KeyValueStore {
  #path: string;
  #index: IndexFile;
  #signature: Signature | undefined;
  #closed = false;

  constructor(path: string) {
    this.#path = path;
    this.#signature = signatureOf(path);
    this.#index = readIndex(path);
  }

  async get<T>(key: KvKey): Promise<T | null> {
    this.#check();
    this.#refresh();
    const raw = this.#index.entries[keyString(key)];
    return raw === undefined ? null : (decode(raw) as T);
  }

  async set<T>(key: KvKey, value: T): Promise<void> {
    this.#check();
    const encoded = encode(value);
    await this.#mutate((entries) => {
      entries[keyString(key)] = encoded;
    });
  }

  async delete(key: KvKey): Promise<void> {
    this.#check();
    await this.#mutate((entries) => {
      delete entries[keyString(key)];
    });
  }

  async *list<T>(prefix: KvKey): AsyncIterable<KvEntry<T>> {
    this.#check();
    this.#refresh();
    const entries = Object.entries(this.#index.entries)
      .map(([k, v]) => ({ key: JSON.parse(k) as KvKey, value: decode(v) as T }))
      .filter((e) => hasPrefix(e.key, prefix))
      .sort((a, b) => compareKey(a.key, b.key));
    for (const e of entries) yield e;
  }

  close(): void {
    // Nothing is buffered; every write already reached the disk.
    this.#closed = true;
  }

  #check(): void {
    if (this.#closed) {
      throw new Error(`Key-value store ${this.#path} is closed`);
    }
  }

  // Another handle or process committed a write: every write replaces the
  // file (new inode, new mtime), so a changed signature means reload.
  #refresh(): void {
    const now = signatureOf(this.#path);
    if (!sameSignature(now, this.#signature)) {
      this.#index = readIndex(this.#path);
      this.#signature = now;
    }
  }

  // Under the lock: re-read the file (other processes' keys are kept), apply
  // this one change, replace the file atomically.
  async #mutate(change: (entries: Record<string, unknown>) => void): Promise<void> {
    await withLock(this.#path, async () => {
      const fresh = readIndex(this.#path);
      change(fresh.entries);
      await writeIndex(this.#path, fresh);
      this.#index = fresh;
      this.#signature = signatureOf(this.#path);
    });
  }
}

/** Opens (creating on first write) the store `<dir>/<name>.json`. The JSON
 * backend never opens the `<name>.kv` SQLite file Deno.openKv used, so Quarto
 * versions on either format can share a cache directory (review S7). */
export async function openKeyValueStore(dir: string, name: string): Promise<KeyValueStore> {
  mkdirSync(dir, { recursive: true });
  return new JsonKeyValueStore(join(dir, `${name}.json`));
}
```

- [ ] **Step 2: Run the tests on both runtimes**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts unit/ral/kv-json.test.ts unit/sass-cache.test.ts; cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/kv.test.ts tests/unit/ral/kv-json.test.ts
```
Expected: green on Deno; on Node, `now passes on Node …` for the `kv` entries (removed in Task 5) and no new failure. (The design was exercised on Node 22.22 before writing this plan: three processes, 60 keys each, 180 entries, no leftover files; a 60 s old lock broken in 2 ms; a live lock waited for 314 ms.)

- [ ] **Step 3: Commit**

```bash
git add src/deno_ral/kv.ts
git commit -m "deno_ral/kv: locked JSON index <name>.json instead of Deno.Kv"
```

### Task 3: Cross-version layout check

**Files:** none (verification of the behaviour the review asked for).

- [ ] **Step 1: A project and a Sass cache that a Deno-based Quarto already used**

Run:
```bash
rm -rf /tmp/rt30 && cp -r dev-docs/runtime-migration/spike/tests/website /tmp/rt30
# A Deno-based Quarto (an installed 1.10 or 1.11 release) renders first and writes its .kv files.
quarto --version && quarto render /tmp/rt30
ls /tmp/rt30/.quarto/project-cache/ | tee /tmp/rt30-before.txt
sha256sum /tmp/rt30/.quarto/project-cache/*.kv /tmp/rt30/.quarto/project-cache/deno-kv-file 2>/dev/null | tee /tmp/rt30-before.sha
package/dist/bin/quarto render /tmp/rt30
ls /tmp/rt30/.quarto/project-cache/
sha256sum -c /tmp/rt30-before.sha
quarto render /tmp/rt30
```
Expected: the installed release (a Deno build) renders; this build renders next to it and adds `<name>.json` to `.quarto/project-cache/`; `sha256sum -c` prints `OK` for every file the release wrote (untouched); the release renders again without a cache error or warning. For the Sass cache, `QUARTO_LOG_LEVEL=DEBUG package/dist/bin/quarto render /tmp/rt30 2>&1 | grep "Creating SassCache at"` prints its directory; list it and check that `sass.kv` (from the release) and `sass.json` (from this build) both exist, that `sass.kv`'s checksum is unchanged, and that the release still renders. If no installed release is available, copy a `sass.kv` from any machine's cache into the directory before rendering: the check is that this build leaves it byte-identical.

### Task 4: Remove `--unstable-kv` from Quarto's own launchers and runners

**Files:** the 11 sites in Scope.

- [ ] **Step 1: Edit the shell, cmd and Rust sites**

Run: `grep -rn "unstable-kv" package/ tests/ src/ | grep -v node_modules`
Expected: the sites listed in Scope plus `src/core/run/deno.ts:63`, which stays. For each other line, delete the flag token only:

- `package/src/util/deno.ts`: delete both `denoBundleCmd.push("--unstable-kv");` lines (55 and 87 on `main`).
- `package/src/quarto-bld` (line 21) and `package/src/quarto-bld.cmd` (line 13): remove ` --unstable-kv` from the `deno run` line.
- `package/scripts/common/quarto` line 186: `QUARTO_DENO_OPTIONS="--unstable-ffi --no-config --no-lock ${QUARTO_CACHE_OPTIONS} --allow-all ${QUARTO_DENO_OPTIONS}"`.
- `package/scripts/windows/quarto.cmd` line 131: `SET "QUARTO_DENO_OPTIONS=--unstable-ffi --no-config --no-lock --allow-all !QUARTO_DENO_OPTIONS!"`.
- `package/launcher/src/main.rs` line 85: delete `String::from("--unstable-kv"),`.
- `tests/run-tests.sh` lines 72 and 268, `tests/run-tests.ps1` line 130: remove ` --unstable-kv`.
- `tests/utils.ts` `kHarnessFlags` (PR 23; on `main` the element sits in `tests/unit/smoke-all-prerender-isolation.test.ts:169` and `tests/unit/harness-failure-reporting.test.ts:60`): delete the `"--unstable-kv",` element wherever the grep shows it.

(`--unstable-ffi` stays until PR 20, if PR 20 has not removed it yet.)

- [ ] **Step 2: Verify**

Run:
```bash
grep -rn "unstable-kv" package/ tests/ src/ | grep -v node_modules
package/dist/bin/quarto render dev-docs/runtime-migration/spike/tests/simple.qmd
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts unit/ral/kv.test.ts unit/ral/kv-json.test.ts unit/sass-cache.test.ts
cd .. && package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts
```
Expected: one line, `src/core/run/deno.ts:63`; the render succeeds (launcher without the flag); tests green; ratchet at zero.

The Rust launcher is rebuilt by `.github/workflows/create-release.yml` (`cargo build --release --manifest-path package/launcher/Cargo.toml`); run `cargo check --manifest-path package/launcher/Cargo.toml` if `cargo` is installed.

- [ ] **Step 3: Commit**

```bash
git add package/src/util/deno.ts package/src/quarto-bld package/src/quarto-bld.cmd package/scripts/common/quarto package/scripts/windows/quarto.cmd package/launcher/src/main.rs tests/run-tests.sh tests/run-tests.ps1 tests/utils.ts tests/unit/smoke-all-prerender-isolation.test.ts tests/unit/harness-failure-reporting.test.ts
git commit -m "Drop --unstable-kv from Quarto's launchers and runners (Deno KV no longer used)"
```

(`git add` of a file the grep did not list is a no-op.)

### Task 5: Shim and known-failures shrink

**Files:**
- Modify: `tools/node-bundle/deno-shim.mjs`, `tools/node-bundle/known-failures.json`

- [ ] **Step 1: Rebuild, delete `openKv`**

Run: `node tools/node-bundle/build.mjs --check-shim`
Expected: `openKv` in the `unused` list. Delete `Deno.openKv = ...`, the `Kv` class and the `freeze`/`revive` helpers; rebuild; `0 missing`, no `unused` list.

- [ ] **Step 2: Remove the fixed known failures**

Run: `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/`
Expected: `now passes on Node …` for `kv` entries (exit 1); delete them (Linux; Windows from this branch's `node-unit` run); rerun: `no change`, exit 0.

- [ ] **Step 3: Render on Node with a warm cache twice**

Run:
```bash
rm -rf /tmp/rt30n && cp -r dev-docs/runtime-migration/spike/tests/website /tmp/rt30n
tools/node-bundle/quarto-node render /tmp/rt30n && tools/node-bundle/quarto-node render /tmp/rt30n
ls /tmp/rt30n/.quarto/project-cache/
```
Expected: both renders succeed; the directory holds the `<name>.json` index and blob files, no `.lock` or `.tmp` entry.

- [ ] **Step 4: Commit**

```bash
git add tools/node-bundle/deno-shim.mjs tools/node-bundle/known-failures.json
git commit -m "node-bundle: drop the openKv shim and the kv known failures"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/ unit/sass-cache.test.ts` → green.
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` → `no change`, exit 0, no `kv` entry left.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/ smoke/project/` → green (project cache and Sass cache in use).
- `grep -rn "unstable-kv" package/ tests/ src/ | grep -v node_modules` → only `src/core/run/deno.ts`; `grep -c "Deno\." src/deno_ral/kv.ts` → `0`.
- `quarto run --dev tools/check-runtime-boundary.ts` → zero.
- Task 3: the `.kv` files a Deno-based release wrote are byte-identical after this build renders, and the release still renders.
- Parallel writers: `cd tests && for i in 1 2 3; do QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv-json.test.ts || break; done` → green three times (the cross-process case is timing-sensitive by nature; it must not flake).

## Review checklist

- [ ] The index is `<dir>/<name>.json`; nothing opens, rewrites or deletes `<name>.kv` or its side files; no cache version constant changed.
- [ ] Every write takes the lock directory, re-reads the file under it, changes one key, writes a pid-and-random temporary file and `rename`s it; the lock is released in `finally`; a lock older than 10 s is broken by rename; waiting is bounded (15 s).
- [ ] Windows `EPERM`/`EACCES`/`EBUSY` on `rename` is retried with backoff; other errors are not.
- [ ] Reads reload when the file signature changed; a second handle sees a committed set; a closed store throws on every method and `close()` is idempotent.
- [ ] `Uint8Array` values round-trip; functions are rejected with `TypeError`; `list` ordering matches the test.
- [ ] `--unstable-kv` removed from the 11 sites; `src/core/run/deno.ts` (user scripts) and `--unstable-ffi` untouched.
- [ ] The shim lost `openKv`; `known-failures.json` lost the `kv` entries and gained none.

## Risks and rollback

- **One cold cache per project and per Sass cache directory** the first time this build runs (a new `<name>.json` index next to the old `.kv`). No warning is printed; the caches re-validate by hash.
- **Blob files shared between the two indexes**: a `clear()` from one Quarto version removes blobs the other version's index still names; the other version then misses (Sass cache: file check; project cache: `_getAs` drops the key on NotFound) and recomputes. No error surfaces.
- **The residual stale-lock race** (Spec, decision on the lock): at worst one lost cache entry after a crashed writer, never a torn file.
- **Network file systems**: `mkdir` atomicity holds on NFSv3+ and SMB; mtime-based staleness needs clocks within 10 s of each other; a project cache on such a share between machines is not a supported setup today either.
- **Rollback:** `git revert` the kv commit (PR 18's `Deno.Kv` body returns) together with the flag-removal commit (the launchers need `--unstable-kv` again). The `<name>.json` files left behind are ignored by the reverted build.

## Decisions needed

None. JSON over `node:sqlite`, the lock directory over the `proper-lockfile` package, and one backend on both runtimes are decided in the Spec. Not changed because the review's concern is resolved by separate file names: the cache version bump and the "delete a foreign SQLite file" step of the earlier draft (both removed); `src/core/run/deno.ts`'s `--unstable-kv` (user scripts, PR 35).
