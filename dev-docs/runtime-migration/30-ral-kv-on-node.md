# PR 30: `kv.ts` as a JSON index with atomic writes; cache version bumps; drop `--unstable-kv`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Deno.Kv`-backed `src/deno_ral/kv.ts` with a JSON index file written atomically, bump the project-cache and Sass-cache versions so existing Deno KV files are discarded cleanly, and remove every `--unstable-kv` flag.
**Phase:** 2. **Depends on:** PR 25 (both caches use `openKeyValueStore` from PR 18). **Unblocks:** PR 32.
**Branch:** `rt/30-ral-kv-on-node`.
**Suggested executor:** Sonnet. The store is small and fully specified; the flag removal is a grep.
**Size:** S (1 source file rewritten, 2 cache files touched, 1 test file added, 12 flag sites).
**Ships on:** Deno; the existing suite, in particular `unit/sass-cache.test.ts` and `smoke/render/`, must stay green. The PR 26 Node job renders the spike documents with the JSON store (its shim loses `openKv`).

## Spec

### Context

Assessment section 3.3: `Deno.openKv` (unstable) backs two small key → file-hash indexes, the project cache (`src/core/cache/cache.ts`) and the Sass cache (`src/core/sass/cache.ts`); "a JSON index file with atomic writes is sufficient; `node:sqlite` … if a real store is wanted". Section 11 module row `kv.ts`: "Deno implementation wraps `Deno.Kv` today; the Node one is a JSON index or `node:sqlite`."

**Decision: JSON index, not `node:sqlite`.** Both stores hold a few hundred entries at most (one per memoized parameter hash; one per compiled theme), values are a hash string plus a type tag or a small Uint8Array/string, and the access pattern is read-mostly with occasional single-key writes. A JSON file re-written atomically on each write (write temp, `rename` over the index) satisfies that with no native dependency, and reads cost one `JSON.parse` at open. `node:sqlite` would give multi-process consistency and transactions that nothing needs; it is unflagged only from Node 22.13/23.4, and its availability on Deno 2.7's compat layer was not verified in the assessment. Revisit only if a cache grows past tens of thousands of entries.

What changes for existing installations: the old index files (`<scratch>/project-cache/deno-kv-file`, `<sass cache>/sass.kv`) are SQLite databases. `openKeyValueStore` detects a non-JSON file at its path, deletes it together with SQLite side files (`-wal`, `-shm`, `-journal`) and starts empty; the cache version constants are bumped so the two caches record that they were created by this format. Entries referenced by the old index are simply orphaned blobs that the next `clear()` or manual cache clear removes (the Sass cache validates every hit by file existence, the project cache by its index only, so orphans are never served).

### Scope

In:
- Rewrite `src/deno_ral/kv.ts`; no `Deno.*` remains.
- `src/core/cache/cache.ts`: `currentCacheVersion = "2"`, `requiredQuartoVersions["2"]`.
- `src/core/sass/cache.ts`: `currentSassCacheVersion = 2`, `checkVersion` clears an older store instead of throwing.
- Remove `--unstable-kv` from: `package/src/util/deno.ts` (2), `package/src/quarto-bld`, `package/src/quarto-bld.cmd`, `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs`, `tests/run-tests.sh` (2), `tests/run-tests.ps1`, `tests/unit/smoke-all-prerender-isolation.test.ts`, `tests/unit/harness-failure-reporting.test.ts`, `src/core/run/deno.ts`.
- Unit test for the JSON store semantics; shim shrink (`openKv`, `Kv`, `freeze`, `revive`).

Out:
- `--unstable-ffi` (PR 20 removes it with the deno_dom plugin).
- Changing cache keys, blob layout or the `ProjectCache` interface.
- `node:sqlite`.

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
export function openKeyValueStore(path: string): Promise<KeyValueStore>;
```

Behaviour made precise:

- **File format:** `{ "format": 1, "entries": { "<JSON key>": <encoded value>, ... } }`. The key string is `JSON.stringify(key)`. Values are JSON with `Uint8Array` encoded as `{ "$bytes": "<base64>" }` (recursively inside plain objects and arrays). Any other non-JSON value (functions, `Map`) throws `TypeError` at `set`.
- **Atomic write:** every `set`/`delete` re-reads the file (so a write from another process is merged rather than clobbered at file granularity), applies the change, writes `<path>.<pid>.tmp`, then `rename`s over `<path>`. `rename` replaces atomically on POSIX and on Windows (Node uses `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING`).
- **Reads** (`get`, `list`) use the in-memory map loaded at open and updated by this process's writes; they do not see other processes' writes until reopened. Documented limitation; both callers open once per process.
- **`list(prefix)` ordering:** keys sorted element-wise; at each position strings sort before numbers (Deno KV order), strings by code unit, numbers numerically; a key that is a strict prefix of another sorts first. `list([])` lists everything.
- **Foreign file:** if the file exists and its first non-whitespace byte is not `{`, it is removed along with `<path>-wal`, `<path>-shm`, `<path>-journal`, and the store starts empty. A file that is JSON but lacks `"format": 1` is treated the same way.
- **`close()`** flushes nothing (every write already reached the disk) but marks the store closed: later `get`/`set`/`delete`/`list` calls throw `Error("Key-value store <path> is closed")`; `close()` is idempotent (PR 18 contract, test `kv - close is idempotent and a closed store rejects`).

### Files

- Modify: `src/deno_ral/kv.ts` (entire body)
- Modify: `src/core/cache/cache.ts:25-28` (version constants)
- Modify: `src/core/sass/cache.ts:172-199` (`currentSassCacheVersion`, `checkVersion`)
- Modify: the 12 flag sites listed in Scope
- Modify: `tools/node-bundle/deno-shim.js` (delete `openKv` and helpers)
- Test: `tests/unit/deno-ral/kv-json.test.ts` (new)
- Test: `tests/unit/deno-ral/kv.test.ts` (PR 18 contract; unchanged, must pass; assumes that name), `tests/unit/sass-cache.test.ts` (existing)

### Acceptance criteria

- `grep -rn "unstable-kv" package/ tests/ src/ --include=* | grep -v node_modules` → no output.
- `grep -c "Deno\." src/deno_ral/kv.ts` → `0`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/kv.test.ts unit/deno-ral/kv-json.test.ts unit/sass-cache.test.ts` passes.
- Rendering a project whose `.quarto/project-cache/deno-kv-file` is an old SQLite index succeeds, replaces the file with JSON, and prints nothing about the cache (no "Unknown project cache version" warning).
- `package/dist/bin/quarto render <doc>` and `package/dist/bin/quarto preview` work without `--unstable-kv` in the launcher.

## Plan

### Task 1: JSON store with tests

**Files:**
- Create: `tests/unit/deno-ral/kv-json.test.ts`
- Modify: `src/deno_ral/kv.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * kv-json.test.ts
 *
 * JSON-index semantics of src/deno_ral/kv.ts: on-disk format, atomic writes,
 * Uint8Array values, list ordering, foreign (Deno KV SQLite) file replacement.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { existsSync, readDirSync, readTextFileSync, removeSync, writeFileSync, writeTextFileSync } from "../../../src/deno_ral/fs.ts";
import { openKeyValueStore } from "../../../src/deno_ral/kv.ts";

unitTest("kv - the index is a JSON file and survives reopen", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-" });
  const file = join(dir, "index");
  const kv = await openKeyValueStore(file);
  await kv.set(["entry", "abc"], { key: "k", hash: "h" });
  await kv.set(["version"], 2);
  kv.close();
  const raw = JSON.parse(readTextFileSync(file));
  assertEquals(raw.format, 1);
  assertEquals(raw.entries['["version"]'], 2);
  const again = await openKeyValueStore(file);
  assertEquals(await again.get(["entry", "abc"]), { key: "k", hash: "h" });
  assertEquals(await again.get(["missing"]), null);
  await again.delete(["version"]);
  assertEquals(await again.get(["version"]), null);
  assertEquals([...readDirSync(dir)].map((e) => e.name), ["index"], "no temp file left behind");
  removeSync(dir, { recursive: true });
});

unitTest("kv - Uint8Array nested in objects round-trips through JSON; functions are rejected", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-" });
  const kv = await openKeyValueStore(join(dir, "index"));
  const bytes = new Uint8Array([0, 1, 2, 250, 255]);
  await kv.set(["b"], { value: bytes, type: "buffer-immediate" });
  const reopened = await openKeyValueStore(join(dir, "index"));
  const got = await reopened.get<{ value: Uint8Array; type: string }>(["b"]);
  assert(got !== null && got.value instanceof Uint8Array);
  assertEquals([...got!.value], [0, 1, 2, 250, 255]);
  assertEquals(got!.type, "buffer-immediate");
  await assertRejects(() => kv.set(["fn"], { f: () => 1 } as unknown as object), TypeError);
  removeSync(dir, { recursive: true });
});

unitTest("kv - list(prefix) is ordered: strings before numbers, prefixes first", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-" });
  const kv = await openKeyValueStore(join(dir, "index"));
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

unitTest("kv - a foreign (SQLite) index file is replaced, side files removed", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-" });
  const file = join(dir, "deno-kv-file");
  writeFileSync(file, new TextEncoder().encode("SQLite format 3\u0000garbage"));
  writeTextFileSync(file + "-wal", "");
  writeTextFileSync(file + "-shm", "");
  const kv = await openKeyValueStore(file);
  assertEquals(await kv.get(["version"]), null);
  await kv.set(["version"], "2");
  assert(!existsSync(file + "-wal") && !existsSync(file + "-shm"));
  assertEquals(JSON.parse(readTextFileSync(file)).entries['["version"]'], "2");
  removeSync(dir, { recursive: true });
});

unitTest("kv - two stores on one file merge their writes", async () => {
  const dir = makeTempDirSync({ prefix: "rt30-kv-" });
  const file = join(dir, "index");
  const a = await openKeyValueStore(file);
  const b = await openKeyValueStore(file);
  await a.set(["from"], "a");
  await b.set(["and"], "b");
  const c = await openKeyValueStore(file);
  assertEquals(await c.get(["from"]), "a");
  assertEquals(await c.get(["and"]), "b");
  removeSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/kv-json.test.ts`
Expected: `the index is a JSON file` fails (`JSON.parse` of a SQLite file throws) on the PR 18 `Deno.Kv` body.

- [ ] **Step 3: Implement**

```ts
/*
 * kv.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Key-value index as a JSON file with atomic writes. Users: core/cache/cache.ts
 * (project cache) and core/sass/cache.ts (Sass cache), each a few hundred
 * key -> hash entries. Decision record: dev-docs/runtime-migration/30-ral-kv-on-node.md.
 */

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Buffer } from "node:buffer";
import nodeProcess from "node:process";
import { isNotFound } from "./errors.ts";

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

function readIndex(path: string): IndexFile {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if (isNotFound(e)) return { format: kFormat, entries: {} };
    throw e;
  }
  const parsed = text.trimStart().startsWith("{") ? tryParse(text) : undefined;
  if (parsed && parsed.format === kFormat && parsed.entries && typeof parsed.entries === "object") {
    return parsed;
  }
  // Not our format (a Deno KV SQLite file, or a corrupt index): start over.
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    rmSync(path + suffix, { force: true });
  }
  return { format: kFormat, entries: {} };
}

function tryParse(text: string): IndexFile | undefined {
  try {
    return JSON.parse(text) as IndexFile;
  } catch {
    return undefined;
  }
}

function writeIndex(path: string, index: IndexFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${nodeProcess.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(index));
  renameSync(tmp, path);
}

class JsonKeyValueStore implements KeyValueStore {
  #path: string;
  #index: IndexFile;
  #closed = false;

  constructor(path: string) {
    this.#path = path;
    this.#index = readIndex(path);
  }

  async get<T>(key: KvKey): Promise<T | null> {
    this.#check();
    const raw = this.#index.entries[keyString(key)];
    return raw === undefined ? null : (decode(raw) as T);
  }

  async set<T>(key: KvKey, value: T): Promise<void> {
    this.#check();
    const encoded = encode(value);
    this.#mutate((entries) => {
      entries[keyString(key)] = encoded;
    });
  }

  async delete(key: KvKey): Promise<void> {
    this.#check();
    this.#mutate((entries) => {
      delete entries[keyString(key)];
    });
  }

  async *list<T>(prefix: KvKey): AsyncIterable<KvEntry<T>> {
    this.#check();
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

  // Re-read before writing so another process's entries are merged, then
  // replace the file atomically.
  #mutate(change: (entries: Record<string, unknown>) => void): void {
    const fresh = readIndex(this.#path);
    change(fresh.entries);
    writeIndex(this.#path, fresh);
    this.#index = fresh;
  }
}

export function openKeyValueStore(path: string): Promise<KeyValueStore> {
  return Promise.resolve(new JsonKeyValueStore(path));
}
```

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/kv.test.ts unit/deno-ral/kv-json.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/kv.ts tests/unit/deno-ral/kv-json.test.ts
git commit -m "deno_ral/kv: JSON index with atomic writes instead of Deno.Kv"
```

### Task 2: Cache version bumps

**Files:**
- Modify: `src/core/cache/cache.ts`
- Modify: `src/core/sass/cache.ts`

- [ ] **Step 1: Project cache**

In `src/core/cache/cache.ts` replace:

```ts
const currentCacheVersion = "1";
const requiredQuartoVersions: Record<string, string> = {
  "1": ">1.7.0",
};
```

with:

```ts
// "2": the index moved from Deno KV to the JSON store in deno_ral/kv.ts
// (dev-docs/runtime-migration/30-ral-kv-on-node.md). A "1" index can only
// come from a Deno KV file, which openKeyValueStore replaces before this
// code runs; the entry is kept so an old version string is still understood.
const currentCacheVersion = "2";
const requiredQuartoVersions: Record<string, string> = {
  "1": ">1.7.0",
  "2": ">=1.11.0",
};
```

(`quartoConfig.version()` returns `99.9.9` in dev mode, which satisfies `>=1.11.0`; `src/core/quarto.ts` already handles the dev version in `satisfies` calls elsewhere, verify with the render in Step 3.)

- [ ] **Step 2: Sass cache**

In `src/core/sass/cache.ts` replace the version block:

```ts
const currentSassCacheVersion = 1;

const requiredQuartoVersions: Record<number, string> = {
  1: "1.6.0",
};
```

with:

```ts
// 2: JSON index (deno_ral/kv.ts) instead of Deno KV; see
// dev-docs/runtime-migration/30-ral-kv-on-node.md.
const currentSassCacheVersion = 2;

const requiredQuartoVersions: Record<number, string> = {
  1: "1.6.0",
  2: "1.11.0",
};
```

and in `checkVersion`, replace the `version.value < currentSassCacheVersion` branch body (the `throw new Error("Found outdated SassCache version. Please clear ...")`) with:

```ts
      // An older index is discarded: every entry is re-validated by
      // content hash on the next compile, so clearing is safe.
      log.debug(`SassCache ${path}: version ${version.value} < ${currentSassCacheVersion}, clearing`);
      for await (const entry of kv.list([])) {
        await kv.delete(entry.key);
      }
      await kv.set(["version"], currentSassCacheVersion);
```

and change the initial `await kv.set(["version"], 1);` to `await kv.set(["version"], currentSassCacheVersion);`.

- [ ] **Step 3: Run the cache tests and a render with a stale index**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/sass-cache.test.ts smoke/render/render.test.ts
cd .. && rm -rf /tmp/rt30 && cp -r dev-docs/runtime-migration/spike/tests/website /tmp/rt30 && mkdir -p /tmp/rt30/.quarto/project-cache && printf 'SQLite format 3\0junk' > /tmp/rt30/.quarto/project-cache/deno-kv-file
package/dist/bin/quarto render /tmp/rt30 2>&1 | tee /tmp/rt30.log
grep -c "cache" /tmp/rt30.log; head -c 1 /tmp/rt30/.quarto/project-cache/deno-kv-file
```
Expected: tests green; the render succeeds; `grep -c` prints `0` (no cache warnings); `head -c 1` prints `{` (the file is now JSON).

- [ ] **Step 4: Commit**

```bash
git add src/core/cache/cache.ts src/core/sass/cache.ts
git commit -m "caches: bump index versions for the JSON key-value store"
```

### Task 3: Remove `--unstable-kv` everywhere

**Files:** the 12 sites in Scope.

- [ ] **Step 1: Edit the shell, cmd and Rust sites**

Run: `grep -rn "unstable-kv" package/ tests/ src/ --include=* | grep -v node_modules`
Expected: 12 lines. For each, delete the flag token only:

- `package/src/util/deno.ts`: delete the two lines `denoBundleCmd.push("--unstable-kv");`.
- `package/src/quarto-bld` and `package/src/quarto-bld.cmd`: remove ` --unstable-kv` from the `deno run` line.
- `package/scripts/common/quarto` line 186: `QUARTO_DENO_OPTIONS="--unstable-ffi --no-config --no-lock ${QUARTO_CACHE_OPTIONS} --allow-all ${QUARTO_DENO_OPTIONS}"`.
- `package/scripts/windows/quarto.cmd` line 131: `SET "QUARTO_DENO_OPTIONS=--unstable-ffi --no-config --no-lock --allow-all !QUARTO_DENO_OPTIONS!"`.
- `package/launcher/src/main.rs` line 85: delete `String::from("--unstable-kv"),`.
- `tests/run-tests.sh` line 72 and line 268, `tests/run-tests.ps1` line 130: remove ` --unstable-kv`.
- `tests/unit/smoke-all-prerender-isolation.test.ts` line 169 and `tests/unit/harness-failure-reporting.test.ts` line 60: delete the `"--unstable-kv",` array element.
- `src/core/run/deno.ts` line 63: delete `"--unstable-kv",`.

- [ ] **Step 2: Verify**

Run:
```bash
grep -rn "unstable-kv" package/ tests/ src/ --include=* | grep -v node_modules | wc -l
package/dist/bin/quarto render dev-docs/runtime-migration/spike/tests/simple.qmd
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts unit/deno-ral/kv.test.ts
cd .. && package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts
```
Expected: `0`; the render succeeds (launcher without the flag); tests green; ratchet at zero.

The Rust launcher is rebuilt by `.github/workflows/create-release.yml` (`cargo build --release --manifest-path package/launcher/Cargo.toml`); nothing to do locally beyond `cargo check --manifest-path package/launcher/Cargo.toml` if `cargo` is installed.

- [ ] **Step 3: Commit**

```bash
git add package/src/util/deno.ts package/src/quarto-bld package/src/quarto-bld.cmd package/scripts/common/quarto package/scripts/windows/quarto.cmd package/launcher/src/main.rs tests/run-tests.sh tests/run-tests.ps1 tests/unit/smoke-all-prerender-isolation.test.ts tests/unit/harness-failure-reporting.test.ts src/core/run/deno.ts
git commit -m "Drop --unstable-kv: Deno KV is no longer used"
```

### Task 4: Shim shrink

**Files:**
- Modify: `tools/node-bundle/deno-shim.js`

- [ ] **Step 1: Rebuild, delete `openKv`**

Run: `node tools/node-bundle/build.mjs --check-shim`
Expected: `openKv` reported unused. Delete `Deno.openKv = ...`, the `Kv` class and the `freeze`/`revive` helpers; rebuild; `0 missing`.

- [ ] **Step 2: Render on Node with a warm cache twice**

Run:
```bash
rm -rf /tmp/rt30n && cp -r dev-docs/runtime-migration/spike/tests/website /tmp/rt30n
tools/node-bundle/quarto-node render /tmp/rt30n && tools/node-bundle/quarto-node render /tmp/rt30n
ls /tmp/rt30n/.quarto/project-cache/ && head -c 40 /tmp/rt30n/.quarto/project-cache/deno-kv-file; echo
```
Expected: both renders succeed; the index file starts with `{"format":1,"entries":{`.

- [ ] **Step 3: Commit**

```bash
git add tools/node-bundle/deno-shim.js
git commit -m "node-bundle: drop the openKv shim"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/ unit/sass-cache.test.ts` → green.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/ smoke/project/` → green (project cache and Sass cache in use).
- `grep -rn "unstable-kv" package/ tests/ src/ | grep -v node_modules` → nothing; `grep -c "Deno\." src/deno_ral/kv.ts` → `0`.
- `quarto run --dev tools/check-runtime-boundary.ts` → zero.
- The stale-index render in Task 2 step 3 prints no cache warning and leaves a JSON index.
- Node: Task 4 step 2 renders twice with a warm cache.

## Review checklist

- [ ] Writes go through temp + `rename`; no `.tmp` file remains after a successful write; the temp name includes the pid.
- [ ] `set` re-reads the file before applying the change; a closed store throws on every method and `close()` is idempotent.
- [ ] A non-JSON or wrong-format file is deleted with `-wal`/`-shm`/`-journal` side files; no exception escapes.
- [ ] `Uint8Array` values round-trip; functions are rejected with `TypeError`.
- [ ] `list` ordering matches the test (strings before numbers, prefix first).
- [ ] Version constants bumped in both caches; the Sass `checkVersion` older-version branch clears instead of throwing; the newer-version branch still throws.
- [ ] All 12 `--unstable-kv` sites removed; `--unstable-ffi` untouched.
- [ ] The shim lost `openKv`.

## Risks and rollback

- **A user's stale SQLite index** is deleted on first use; nothing else references it, and both caches re-validate by hash, so the only effect is one cold render. Rollback: `git revert` the kv commit (PR 18's `Deno.Kv` body) and the flag-removal commit together; the version constants can stay.
- **Concurrent writers** (preview and render on one project): last writer wins per key, never a torn file, thanks to `rename`. Stale in-memory reads cause at worst a recompute.
- **Windows `rename` over an open file** fails with `EPERM` if another process holds the index open; this store never keeps the file open, so only an external process (antivirus) can trigger it; the error propagates as before any cache write failure would.

## Decisions needed

None (JSON over `node:sqlite` is decided above).
