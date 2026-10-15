# PR 18: `deno_ral/kv.ts`; project cache and Sass cache on it

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/deno_ral/kv.ts` (`KeyValueStore`, `openKeyValueStore(dir, name)`, the backend choosing the file) wrapping `Deno.openKv`, pin cross-handle and cross-process semantics in its contract test, and move `src/core/cache/cache.ts` and `src/core/sass/cache.ts` onto it so that `Deno.Kv`/`Deno.openKv` appear only in the layer and Quarto versions on different runtimes never open each other's index file.
**Phase:** 1. **Depends on:** PR 09 (layer conventions; `temp.ts`, `fs.ts`), PR 08 (`exec`, `execPath`, `args`, `exit` for the two-process test), PR 02 (ratchet; `tests/asserts.ts`). **Unblocks:** PR 25, PR 30.
**Branch:** `rt/18-ral-kv`.
**Suggested executor:** Opus. Small, but the project cache's `clear()`/version handling, the Sass cache's closed-handle registry (#14594, #13955) and the user-global Sass cache shared by every installed Quarto must all survive the interface change.
**Size:** S. 1 new module, 1 new test with a child-process fixture, 2 modified sources, 1 extended test, baseline, rules doc.
**Ships on:** Deno; the existing test suite must stay green. The `--unstable-kv` flag stays in every launcher until PR 30 (Node implementation) and PR 33 (launchers on Node) remove it.

## Spec

### Context

Assessment section 3.3: `Deno.openKv` (unstable) backs two small key → file-hash indexes, `src/core/cache/cache.ts` (project cache) and `src/core/sass/cache.ts` (Sass cache). Section 11 module plan row `kv.ts`: `get`, `set`, `delete`, `list(prefix)`, `close`; the Deno implementation wraps `Deno.Kv` today.

`REVIEW-2026-10-15.md` S7 (blocker for PR 30): the Sass cache lives in the user-global, unversioned `quartoCacheDir("sass")` (`src/core/sass.ts:408-413`), shared by every installed Quarto (the RStudio-bundled copy and the CLI), and `.quarto/project-cache/` is shared by every Quarto that renders the project. If the store path were part of the interface, PR 30 would rewrite `sass.kv` as JSON and an older Deno-based Quarto would fail on `Deno.openKv` of a non-SQLite file or on `checkVersion` ("newer than supported", `sass/cache.ts:192-197`). Decision: `openKeyValueStore(dir, name)` and the backend chooses the file: `<dir>/<name>.kv` here (Deno KV, SQLite), `<dir>/<name>.json` in PR 30. Each runtime then has its own index file; old versions keep theirs.

That isolates the indexes but not the files they point at. The Sass cache stores compiled CSS next to the index as `<identifierHash>.css` and trusts it when its index entry's `hash` matches the input. Two Quarto versions with separate indexes in the same directory would overwrite each other's `<identifierHash>.css` for different inputs and each would serve the other's CSS. So the new Sass cache names outputs by both hashes (`<identifierHash>-<inputHash>.css`), removes the file its own previous entry pointed at when it replaces the entry, and uses a new index name (`sass-index`) so that it never shares an index with Quarto ≤ 1.10, which still reads `<identifierHash>.css` through `sass.kv`. The project cache's disk files are already content-addressed (`md5HashBytes(value)`, `cache.ts:95-118`), so only its index name changes (`index` instead of the file `deno-kv-file`).

Concurrency: SQLite gives today's caches cross-handle and cross-process safety, and the Sass cache is hit by parallel renders and by preview plus render at once. The contract test now pins "a second handle on the same store sees a committed set" and "two processes writing different keys both persist", which PR 30's JSON backend must satisfy (lock directory plus read-modify-rename, vocabulary).

Verified usage (`main` at `b86f98d`):

`src/core/cache/cache.ts` (242 lines): `import { assert } from "testing/asserts"` (line 9); field `index: Deno.Kv | null` (32); `close()` (43–48); `clear()` iterates `this.index.list({ prefix: [] })` and calls `Deno.removeSync(join(dir, entry.value))` for every non-version key; every value is an object, so `join` throws a `TypeError` on the first non-version entry (50–62); `createOnDisk()` sets `["version"]` to `"1"` without awaiting (64–67); `init()` opens `Deno.openKv(join(indexPath, "deno-kv-file"))` and handles the version (69–91); the four `add*` methods `assert(result.ok)` (93–138); `get` (140–147); `_getAs` deletes the key on `Deno.errors.NotFound` (149–170). The only reader is `memoizeStringFunction` (`cache.ts:232-242`, used by `src/core/sass.ts:359` for the vars block).

`src/core/sass/cache.ts` (220 lines): header comment `Deno.KV` (4); `class SassCache` (19, not exported) with `kv: Deno.Kv` (20, 27); `getFromHash` (32–79) reads `["entry", hash]` and returns `join(path, hash + ".css")`; `setFromHash` (81–105) writes it; `cleanup()` closes the store and deletes the registry entry (145–164); `checkVersion(kv: Deno.Kv, path)` (173–199); `sassCache()` opens `Deno.openKv(join(path, "sass.kv"))` (211).

`tests/unit/sass-cache.test.ts` goes through `sassCache()`; it mentions `Deno.Kv` only in a comment (line 32).

### Scope

In: `kv.ts`, its contract test and child fixture, the two caches (index names, Sass output naming, `cache.ts`'s `testing/asserts` import replaced by a local assertion), the Sass cache test, baseline, rules table.
Out: removing `--unstable-kv` (PR 30/33); `Deno.removeSync`/`writeFileSync`/`readFileSync`/`readTextFileSync`/`writeTextFileSync` in `cache.ts` and `Deno.errors.NotFound` at `cache.ts:161` (PR 10 codemod; keep whatever form the file has); deleting the old `deno-kv-file`, `sass.kv` and `<hash>.css` files (older Quarto versions still use them).

### Interfaces

`src/deno_ral/kv.ts` (new; vocabulary):

```ts
/*
 * kv.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Small persistent key-value index. The only module that may call
 * Deno.openKv. PR 30 reimplements it on a JSON file.
 */

export type KvKey = (string | number)[];

export interface KvEntry<T> {
  key: KvKey;
  value: T;
}

export interface KeyValueStore {
  /** Resolves to the stored value, or null when absent. */
  get<T>(key: KvKey): Promise<T | null>;
  /** Stores a structured-cloneable value (strings, numbers, plain objects,
   * Uint8Array). Visible to every other handle and process once resolved. */
  set<T>(key: KvKey, value: T): Promise<void>;
  delete(key: KvKey): Promise<void>;
  /** Entries whose key starts with `prefix` (`[]` lists everything), in key order. */
  list<T>(prefix: KvKey): AsyncIterable<KvEntry<T>>;
  /** Closes the store; later calls on it reject. Idempotent. */
  close(): void;
}

/** Opens (creating if needed) the store `name` in directory `dir` (which
 * must exist). The backend chooses the file: `<dir>/<name>.kv` (Deno KV,
 * SQLite) on Deno, `<dir>/<name>.json` on Node (PR 30), so Quarto versions
 * on different runtimes sharing `dir` never open each other's file. Several
 * handles and processes may use one store at once: a set resolved in one is
 * visible to the others, and concurrent sets of different keys all persist. */
export function openKeyValueStore(dir: string, name: string): Promise<KeyValueStore>;
```

Differences from `Deno.Kv` that the two callers absorb: `get` returns the value directly (not `{ value, versionstamp }`); `set` returns `void` and throws on failure (not `{ ok }`); `list` takes a bare prefix (not `{ prefix }`); `KvEntry` has no `versionstamp`.

`src/core/sass/cache.ts`: `SassCache` becomes `export class SassCache` (for the test); output file of an entry `{ key, hash }` for identifier `id` is `<path>/<id>-<hash>.css`; index name `sass-index`.

### Files

- Create: `src/deno_ral/kv.ts`.
- Create: `tests/unit/ral/kv.test.ts`, `tests/unit/ral/kv-writer.ts` (child-process fixture, not a test file).
- Modify: `src/core/cache/cache.ts:9-15,32,43-48,50-67,69-91,93-147`.
- Modify: `src/core/sass/cache.ts:1-30,45-105,145-164,173-215`.
- Modify: `tests/unit/sass-cache.test.ts:13,32` (+ one new test).
- Modify: `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`.

### Acceptance criteria

- `grep -rn 'Deno\.openKv\|Deno\.Kv\b\|Deno\.KV' src tests package --include=*.ts | grep -v '^src/deno_ral/'` prints nothing (comments included).
- `grep -n 'Deno\.' tests/unit/ral/kv.test.ts tests/unit/ral/kv-writer.ts` prints nothing.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts unit/sass-cache.test.ts` passes.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-project-config-only.test.ts smoke/render/render-html.test.ts $(find smoke/project/ -name '*.test.ts')` passes (project cache creation, Sass cache hits during HTML render).
- After two renders of `tests/docs/website-image-base`, its `.quarto/project-cache/` contains `index.kv`, and the user Sass cache directory (`quartoCacheDir("sass")`; per-OS paths in Task 3 step 6) contains `sass-index.kv` and `<32 hex>-<32 hex>.css` files, with any older `sass.kv`/`<32 hex>.css` untouched.
- Baseline for `src` lower by 7 (`cache.ts` 2: `Deno.Kv` field, `Deno.openKv`; `sass/cache.ts` 5: the header comment, `Deno.Kv` ×3 in the field, constructor and `checkVersion`, `Deno.openKv`); `tests` lower by 1 (`sass-cache.test.ts:32` comment); `src` std-import files lower by 1 (`cache.ts` no longer imports `testing/asserts`), committed.

## Plan

### Task 1: `kv.ts` with its contract test

**Files:**
- Create: `src/deno_ral/kv.ts`
- Create: `tests/unit/ral/kv.test.ts`, `tests/unit/ral/kv-writer.ts`

- [ ] **Step 1: Write the child-process fixture**

`tests/unit/ral/kv-writer.ts`:

```ts
/*
 * kv-writer.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Child process for tests/unit/ral/kv.test.ts: opens store <name> in <dir>,
 * sets [<prefix>, i] = i for i < <count>, closes, exits 0.
 */

import { openKeyValueStore } from "../../../src/deno_ral/kv.ts";
import { args, exit } from "../../../src/deno_ral/process.ts";

const [dir, name, prefix, count] = args();
const kv = await openKeyValueStore(dir, name);
for (let i = 0; i < Number(count); i++) {
  await kv.set([prefix, i], i);
}
kv.close();
exit(0);
```

- [ ] **Step 2: Write the failing test**

```ts
/*
 * kv.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Compatibility contract for src/deno_ral/kv.ts (rerun by PR 30 on Node).
 */

import { assert, assertEquals, assertRejects } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { KvEntry, openKeyValueStore } from "../../../src/deno_ral/kv.ts";
import { fromFileUrl } from "../../../src/deno_ral/path.ts";
import { readDirSync, removeSync } from "../../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { exec, execPath } from "../../../src/deno_ral/process.ts";

const kWriter = fromFileUrl(new URL("./kv-writer.ts", import.meta.url));
const kImportMap = fromFileUrl(
  new URL("../../../src/import_map.json", import.meta.url),
);

// Runs kv-writer.ts with the current runtime. Deno only: PR 30 adds the
// Node branch (the PR 31 loader) when it reimplements kv.ts.
function writerCommand(childArgs: string[]): { cmd: string; args: string[] } {
  return {
    cmd: execPath(),
    args: [
      "run",
      "--no-lock",
      "--unstable-kv",
      "--allow-all",
      `--import-map=${kImportMap}`,
      kWriter,
      ...childArgs,
    ],
  };
}

async function withDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = makeTempDirSync({ prefix: "quarto-kv-test" });
  try {
    await fn(dir);
  } finally {
    removeSync(dir, { recursive: true });
  }
}

unitTest("kv - get returns null for a missing key and the value after set", async () => {
  await withDir(async (dir) => {
    const kv = await openKeyValueStore(dir, "index");
    try {
      assertEquals(await kv.get(["version"]), null);
      await kv.set(["version"], "1");
      assertEquals(await kv.get<string>(["version"]), "1");
      await kv.set(["entry", "abc"], { key: "k", hash: "h" });
      assertEquals(await kv.get(["entry", "abc"]), { key: "k", hash: "h" });
      await kv.set(["n"], 42);
      assertEquals(await kv.get<number>(["n"]), 42);
    } finally {
      kv.close();
    }
  });
});

unitTest("kv - the backend keeps its file inside dir, named after the store", async () => {
  await withDir(async (dir) => {
    const kv = await openKeyValueStore(dir, "index");
    await kv.set(["a"], 1);
    kv.close();
    const names = readDirSync(dir).map((e) => e.name);
    assert(
      names.some((n) => n.startsWith("index.")),
      `no index.* file in ${JSON.stringify(names)}`,
    );
  });
});

unitTest("kv - values persist across close and reopen", async () => {
  await withDir(async (dir) => {
    const kv1 = await openKeyValueStore(dir, "index");
    await kv1.set(["a", 1], "one");
    kv1.close();
    const kv2 = await openKeyValueStore(dir, "index");
    try {
      assertEquals(await kv2.get<string>(["a", 1]), "one");
    } finally {
      kv2.close();
    }
  });
});

unitTest("kv - a second handle on the same store sees a committed set", async () => {
  await withDir(async (dir) => {
    const kv1 = await openKeyValueStore(dir, "index");
    const kv2 = await openKeyValueStore(dir, "index");
    try {
      await kv1.set(["shared"], "from kv1");
      assertEquals(await kv2.get<string>(["shared"]), "from kv1");
      await kv2.delete(["shared"]);
      assertEquals(await kv1.get(["shared"]), null);
    } finally {
      kv1.close();
      kv2.close();
    }
  });
});

unitTest("kv - two processes writing different keys both persist", async () => {
  await withDir(async (dir) => {
    (await openKeyValueStore(dir, "index")).close();
    const run = (prefix: string) => {
      const c = writerCommand([dir, "index", prefix, "50"]);
      return exec(c.cmd, { args: c.args });
    };
    const [a, b] = await Promise.all([run("a"), run("b")]);
    const decoder = new TextDecoder();
    assert(a.success, decoder.decode(a.stderr));
    assert(b.success, decoder.decode(b.stderr));
    const kv = await openKeyValueStore(dir, "index");
    try {
      const keys: string[] = [];
      for await (const e of kv.list([])) keys.push(e.key.join("/"));
      assertEquals(keys.length, 100, `keys: ${keys.join(", ")}`);
    } finally {
      kv.close();
    }
  });
});

unitTest("kv - delete removes a key; list filters by prefix in key order", async () => {
  await withDir(async (dir) => {
    const kv = await openKeyValueStore(dir, "index");
    try {
      await kv.set(["entry", "b"], 2);
      await kv.set(["entry", "a"], 1);
      await kv.set(["version"], "1");
      const entries: KvEntry<unknown>[] = [];
      for await (const e of kv.list(["entry"])) entries.push(e);
      assertEquals(entries, [
        { key: ["entry", "a"], value: 1 },
        { key: ["entry", "b"], value: 2 },
      ]);
      const all: KvEntry<unknown>[] = [];
      for await (const e of kv.list([])) all.push(e);
      assertEquals(all.length, 3);
      await kv.delete(["entry", "a"]);
      assertEquals(await kv.get(["entry", "a"]), null);
      await kv.delete(["entry", "never-set"]); // no throw
    } finally {
      kv.close();
    }
  });
});

unitTest("kv - Uint8Array values round-trip", async () => {
  await withDir(async (dir) => {
    const kv = await openKeyValueStore(dir, "index");
    try {
      await kv.set(["buf"], new Uint8Array([1, 2, 3]));
      assertEquals(await kv.get<Uint8Array>(["buf"]), new Uint8Array([1, 2, 3]));
    } finally {
      kv.close();
    }
  });
});

unitTest("kv - close is idempotent and a closed store rejects", async () => {
  await withDir(async (dir) => {
    const kv = await openKeyValueStore(dir, "index");
    kv.close();
    kv.close();
    await assertRejects(() => kv.get(["x"]));
  });
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts`
Expected: type-check error `Module not found "file:///.../src/deno_ral/kv.ts"`.

- [ ] **Step 4: Implement `kv.ts`**

```ts
/*
 * kv.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Small persistent key-value index used by the project cache and the Sass
 * cache. The only module that may call Deno.openKv (needs --unstable-kv,
 * which the launchers pass until PR 30 replaces this implementation).
 * tests/unit/ral/kv.test.ts is the contract.
 */

import { join } from "./path.ts";

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

export async function openKeyValueStore(
  dir: string,
  name: string,
): Promise<KeyValueStore> {
  // Deno KV keeps the store in SQLite; the .kv suffix keeps it apart from
  // the Node backend's <name>.json in the same directory.
  const path = join(dir, `${name}.kv`);
  const kv = await Deno.openKv(path);
  let closed = false;
  const assertOpen = () => {
    if (closed) {
      throw new Error(`Key-value store ${path} is closed`);
    }
  };
  return {
    async get<T>(key: KvKey): Promise<T | null> {
      assertOpen();
      const entry = await kv.get<T>(key);
      return entry.value;
    },
    async set<T>(key: KvKey, value: T): Promise<void> {
      assertOpen();
      const result = await kv.set(key, value);
      if (!result.ok) {
        throw new Error(`Key-value store ${path}: set failed for ${JSON.stringify(key)}`);
      }
    },
    async delete(key: KvKey): Promise<void> {
      assertOpen();
      await kv.delete(key);
    },
    async *list<T>(prefix: KvKey): AsyncIterable<KvEntry<T>> {
      assertOpen();
      for await (const entry of kv.list<T>({ prefix })) {
        yield { key: entry.key as KvKey, value: entry.value };
      }
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        kv.close();
      } catch {
        // already closed
      }
    },
  };
}
```

`assertOpen()` throws synchronously inside an `async` function, which turns into a rejection: that is what the last test asserts, and what the Sass cache registry fix (#14594) relied on noticing.

- [ ] **Step 5: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts`
Expected: `........` then `ok | 8 passed | 0 failed`. The two-process test takes a few seconds (two runtime start-ups).

- [ ] **Step 6: Commit**

```bash
git add src/deno_ral/kv.ts tests/unit/ral/kv.test.ts tests/unit/ral/kv-writer.ts
git commit -m "deno_ral: add kv.ts (openKeyValueStore(dir, name)) with cross-handle and cross-process contract"
```

### Task 2: Project cache on `KeyValueStore`

**Files:**
- Modify: `src/core/cache/cache.ts`

- [ ] **Step 1: Imports, local assertion, field**

Replace line 9 (`import { assert } from "testing/asserts";`) with:

```ts
import { InternalError } from "../lib/error.ts";
import { KeyValueStore, openKeyValueStore } from "../../deno_ral/kv.ts";
```

and add `safeRemoveSync` to the `fs.ts` import on line 10:

```ts
import { ensureDirSync, safeRemoveSync } from "../../deno_ral/fs.ts";
```

After the imports (before `const currentCacheVersion`), add the assertion this module used from the test library:

```ts
function assert(condition: unknown, msg = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new InternalError(msg);
  }
}
```

Line 32:

```ts
  index: KeyValueStore | null;
```

- [ ] **Step 2: `clear()` (lines 50–62)**

```ts
  async clear(): Promise<void> {
    assert(this.index);
    const entries = this.index.list<CacheIndexEntry | string>([]);
    for await (const entry of entries) {
      if (entry.key[0] !== "version") {
        const diskEntry = entry.value as DiskCacheEntry;
        // Only disk-backed entries ("buffer"/"string") have a file; immediate
        // entries live in the index. The previous code removed
        // join(dir, entry.value) for every key; every value is an object, so
        // join threw a TypeError on the first non-version entry. Keep the
        // intent (remove disk files) and skip the rest.
        if (diskEntry && typeof diskEntry === "object" && "hash" in diskEntry) {
          safeRemoveSync(
            join(this.projectScratchDir, "project-cache", diskEntry.hash),
          );
        }
      }
      await this.index.delete(entry.key);
    }
  }
```

- [ ] **Step 3: `createOnDisk()` and `init()` (lines 64–91)**

```ts
  async createOnDisk(): Promise<void> {
    assert(this.index);
    await this.index.set(["version"], currentCacheVersion);
  }

  async init(): Promise<void> {
    const indexPath = join(this.projectScratchDir, "project-cache");
    ensureDirSync(indexPath);
    // The index file name is the backend's (index.kv on Deno). Quarto 1.10
    // and earlier keep using their own "deno-kv-file" in the same directory;
    // the content files are md5-addressed, so both indexes can share them.
    this.index = await openKeyValueStore(indexPath, "index");
    let version = await this.index.get<string>(["version"]);
    if (version === null) {
      await this.createOnDisk();
      version = await this.index.get<string>(["version"]);
    }
    assert(typeof version === "string");
    const requiredVersion = requiredQuartoVersions[version];
    if (
      !requiredVersion || !satisfies(quartoConfig.version(), requiredVersion)
    ) {
      console.warn("Unknown project cache version.");
      console.warn(
        "Project cache was likely created by a newer version of Quarto.",
      );
      console.warn("Quarto will clear the project cache.");
      await this.clear();
      await this.createOnDisk();
    }
  }
```

- [ ] **Step 4: The four `add*` methods (lines 93–138)**

Each `const result = await this.index.set(key, {...}); assert(result.ok);` becomes `await this.index.set(key, {...});` (the store throws when a set fails). For example `addBuffer` (keep whatever form PR 10 gave the `writeFileSync` call):

```ts
  async addBuffer(key: string[], value: Uint8Array): Promise<void> {
    assert(this.index);
    const hash = await md5HashBytes(value);
    writeFileSync(
      join(this.projectScratchDir, "project-cache", hash),
      value,
    );
    await this.index.set(key, {
      hash,
      type: "buffer",
    });
  }
```

Apply the same two-line change to `addString`, `addSmallBuffer`, `addSmallString`.

- [ ] **Step 5: `get()` (lines 140–147)**

```ts
  async get(key: string[]): Promise<CacheIndexEntry | null> {
    assert(this.index);
    return await this.index.get<CacheIndexEntry>(key);
  }
```

`_getAs` (149–170) compiles unchanged (`this.index.delete(key)` has the same shape).

- [ ] **Step 6: Type-check and run the project cache consumers**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts`
Expected: exit 0.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-project-config-only.test.ts smoke/render/render-html.test.ts`
Expected: `ok | N passed | 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add src/core/cache/cache.ts
git commit -m "core/cache: project cache index on deno_ral/kv (store \"index\"); local assert instead of testing/asserts"
```

### Task 3: Sass cache on `KeyValueStore`, outputs named by both hashes

**Files:**
- Modify: `src/core/sass/cache.ts`
- Modify: `tests/unit/sass-cache.test.ts`

- [ ] **Step 1: Write the failing test (append to `tests/unit/sass-cache.test.ts`)**

Change the assertion import (line 13) to `import { assert, assertEquals } from "../asserts.ts";` and add `import { readTextFileSync, writeTextFileSync } from "../../src/deno_ral/fs.ts";`, `import { makeTempDirSync } from "../../src/deno_ral/temp.ts";`, `import { openKeyValueStore } from "../../src/deno_ral/kv.ts";`, and `SassCache` to the `sass/cache.ts` import. Line 32 becomes `// First resolve creates the cache and opens its key-value store.` Then append:

```ts
const ID = "a".repeat(32);
const H1 = "1".repeat(32);
const H2 = "2".repeat(32);

unitTest(
  "sassCache - two indexes sharing a directory never serve each other's CSS",
  async () => {
    // Two Quarto versions on different runtimes keep separate index files in
    // the shared user cache directory; the CSS files they point at must not
    // collide.
    const dir = makeTempDirSync({ prefix: "quarto-sass-cache-share" });
    const kvA = await openKeyValueStore(dir, "a");
    const kvB = await openKeyValueStore(dir, "b");
    try {
      const a = new SassCache(kvA, dir);
      const b = new SassCache(kvB, dir);
      const fileA = await a.setFromHash(ID, H1, "id", (out) => {
        writeTextFileSync(out, "/* A */");
        return Promise.resolve();
      });
      await b.setFromHash(ID, H2, "id", (out) => {
        writeTextFileSync(out, "/* B */");
        return Promise.resolve();
      });
      assertEquals(await a.getFromHash(ID, H1), fileA);
      assertEquals(readTextFileSync(fileA), "/* A */");
      // Replacing A's entry removes A's previous file only.
      const fileA2 = await a.setFromHash(ID, H2, "id", (out) => {
        writeTextFileSync(out, "/* A2 */");
        return Promise.resolve();
      });
      assertEquals(await a.getFromHash(ID, H1), null);
      assert(fileA2 !== fileA);
    } finally {
      kvA.close();
      kvB.close();
      safeRemoveIfExists(dir);
    }
  },
);
```

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/sass-cache.test.ts`
Expected: type-check error (`SassCache` is not exported; `openKeyValueStore` signature not yet used by `sass/cache.ts`).

- [ ] **Step 2: Header comment, import, class, constructor**

Line 4: `* A persistent cache for sass compilation based partly on a key-value index.`

After line 17 (`import { Cloneable } ...`):

```ts
import { KeyValueStore, openKeyValueStore } from "../../deno_ral/kv.ts";
```

Lines 19–30:

```ts
export class SassCache implements Cloneable<SassCache> {
  kv: KeyValueStore;
  path: string;

  clone() {
    return this;
  }

  constructor(kv: KeyValueStore, path: string) {
    this.kv = kv;
    this.path = path;
  }

  // Outputs are named by identifier and input hash: the directory is shared
  // by every installed Quarto, each runtime keeps its own index there, and a
  // file must never be served for an input it was not compiled from.
  outputPath(identifierHash: string, inputHash: string) {
    return join(this.path, `${identifierHash}-${inputHash}.css`);
  }
```

- [ ] **Step 3: `getFromHash` (lines 45–79)**

```ts
    const value = await this.kv.get<unknown>(["entry", hash]);
    if (value === null) {
      log.debug(`  cache miss`);
      return null;
    }
    if (typeof value !== "object") {
      throw new InternalError(
        `Unsupported SassCache entry type\nExpected SassCacheEntry, got ${typeof value}`,
      );
    }
    const v = value as Record<string, unknown>;
    if (typeof v.key !== "string" || typeof v.hash !== "string") {
      throw new InternalError(
        `Unsupported SassCache entry type\nExpected SassCacheEntry, got ${typeof value}`,
      );
    }
    // The file the entry was compiled to (equal to the input's when the hashes match).
    const outputFilePath = this.outputPath(hash, v.hash);

    // if the hash doesn't match the key, return null
    if ((v.hash !== inputHash && !force) || !existsSync(outputFilePath)) {
```

(the rest of the method, from the `if (v.hash !== inputHash)` debug lines to `return outputFilePath;`, is unchanged).

- [ ] **Step 4: `setFromHash` (lines 81–105)**

```ts
  async setFromHash(
    identifierHash: string,
    inputHash: string,
    cacheIdentifier: string,
    compilationThunk: (outputFilePath: string) => Promise<void>,
  ): Promise<string> {
    log.debug(`SassCache.setFromHash(${identifierHash}, ${inputHash}), ...`);
    const outputFilePath = this.outputPath(identifierHash, inputHash);
    try {
      await compilationThunk(outputFilePath);
    } catch (error) {
      // Compilation failed, so clear out the output file (if exists)
      // which will be invalid CSS
      try {
        safeRemoveIfExists(outputFilePath);
      } finally {
        // doesn't matter
      }
      throw error;
    }
    const previous = await this.kv.get<{ hash?: string }>([
      "entry",
      identifierHash,
    ]);
    await this.kv.set(["entry", identifierHash], {
      key: cacheIdentifier,
      hash: inputHash,
    });
    if (previous?.hash && previous.hash !== inputHash) {
      // Another index may still point at it; it then sees a missing file and
      // recompiles (a miss, never wrong CSS).
      safeRemoveIfExists(this.outputPath(identifierHash, previous.hash));
    }
    return outputFilePath;
  }
```

- [ ] **Step 5: `checkVersion` (lines 173–199) and `sassCache` (lines 202–219)**

```ts
async function checkVersion(kv: KeyValueStore, path: string) {
  const version = await kv.get<unknown>(["version"]);
  if (version === null) {
    await kv.set(["version"], 1);
  } else {
    if (typeof version !== "number") {
      throw new Error(
        `Unsupported SassCache version type in ${path}\nExpected number, got ${typeof version}`,
      );
    }
    if (version < currentSassCacheVersion) {
      // in the future we should clean this automatically, but this is v1 and there should be
      // no old data anywhere.
      throw new Error(
        `Found outdated SassCache version. Please clear ${path}.`,
      );
    }
    if (version > currentSassCacheVersion) {
      throw new Error(
        `Found a SassCache version that's newer than supported. Please clear ${path} or upgrade Quarto to ${
          requiredQuartoVersions[currentSassCacheVersion]
        } or later.`,
      );
    }
  }
}
```

In `sassCache()` replace lines 209–212:

```ts
    // "sass-index" (sass-index.kv on Deno), not the "sass.kv" that Quarto
    // 1.10 and earlier use in the same user-global directory: they name
    // outputs <identifierHash>.css and must not share an index with this
    // version's <identifierHash>-<inputHash>.css files.
    const kv = await openKeyValueStore(path, "sass-index");
    await checkVersion(kv, path);
    _sassCache[path] = new SassCache(kv, path);
```

`cleanup()` (line 152, `this.kv.close()`) compiles unchanged.

- [ ] **Step 6: Type-check, run the Sass cache tests, manual reuse check**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts`
Expected: exit 0.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/sass-cache.test.ts smoke/render/render-html.test.ts`
Expected: `ok | N passed | 0 failed` (the new test included).

Manual: `cd tests/docs/website-image-base && QUARTO_LOG_LEVEL=DEBUG ../../../package/dist/bin/quarto render 2>&1 | grep -c 'cache hit'` run twice: the second number is greater than 0. Then list the user cache (`~/.cache/quarto/sass` on Linux, `~/Library/Caches/quarto/sass` on macOS, `%LOCALAPPDATA%\quarto\sass` on Windows; `quartoCacheDir` in `src/core/appdirs.ts`, honouring `XDG_CACHE_HOME` on Linux): `sass-index.kv` and `<32 hex>-<32 hex>.css` files are present; an existing `sass.kv` and `<32 hex>.css` from an older Quarto are untouched. `ls tests/docs/website-image-base/.quarto/project-cache/` shows `index.kv`. Remove the website's `_site` and `.quarto` afterwards (`git status --short tests/docs/website-image-base` clean).

- [ ] **Step 7: Commit**

```bash
git add src/core/sass/cache.ts tests/unit/sass-cache.test.ts
git commit -m "core/sass/cache: index on deno_ral/kv (store \"sass-index\"); CSS outputs named by identifier and input hash"
```

### Task 4: Ratchet and docs

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → `src` `Deno.` count lower by 7, `src` std-import files lower by 1, `tests` lower by 1.
- [ ] **Step 2:** Add to `.claude/rules/typescript/deno-ral.md` module table:

```markdown
| `kv.ts` | Persistent key-value index; the backend picks the file (`<name>.kv` on Deno, needs `--unstable-kv` until PR 30) | `openKeyValueStore(dir, name)`, `KeyValueStore` |
```

- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet baseline after kv.ts; document kv.ts"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts unit/sass-cache.test.ts` → `ok | 10 passed | 0 failed` (8 + 2).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-project-config-only.test.ts smoke/render/render-html.test.ts $(find smoke/project/ -name '*.test.ts')` → pass.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- `grep -rn 'Deno\.openKv\|Deno\.Kv\b\|Deno\.KV' src tests --include=*.ts | grep -v '^src/deno_ral/'` → empty.
- Manual Sass cache reuse and file layout (Task 3 step 6).

## Review checklist

- [ ] `openKeyValueStore(dir, name)`: the Deno backend writes `<dir>/<name>.kv`; no caller builds a store file name.
- [ ] The contract test covers second-handle visibility and two concurrent processes, and uses only layer APIs (`exec`, `execPath`, `temp`, `fs`) and `tests/asserts.ts`; the Node branch of `writerCommand` is PR 30's.
- [ ] Sass outputs are `<identifierHash>-<inputHash>.css`; `setFromHash` removes only the file its own previous entry named; the index is `sass-index`, never `sass`.
- [ ] Project cache index is `index`; `clear()` deletes every key including `["version"]` and only removes files for disk-backed entries.
- [ ] `set` failures surface as thrown errors (replacing `assert(result.ok)`); `cache.ts` no longer imports `testing/asserts`.
- [ ] `checkVersion` logic equivalent (null → set 1; non-number → throw; <1 throw; >1 throw).
- [ ] Closed-store rejection still lets `tests/unit/sass-cache.test.ts` detect a reused closed handle.
- [ ] `--unstable-kv` not touched anywhere.

## Risks and rollback

- First run after upgrading: the project cache and the Sass cache start empty (new index names), so the first render of each theme recompiles Sass once. Old `deno-kv-file`, `sass.kv` and `<hash>.css` files remain for older Quarto versions and are never written by this one; mention it in the PR description (internal caches, no changelog entry).
- `Deno.Kv` over SQLite with two writer processes: Deno KV retries on a busy database internally. If the two-process test fails on some OS with `database is locked`, that is a pre-existing hazard of today's caches under parallel renders; fix it in `kv.ts` by retrying `kv.set` up to 5 times with a 50 ms pause when the error message contains `database is locked`, and keep the test.
- `Deno.Kv.list` yields in key order; `KeyValueStore.list` documents the same, and the unit test asserts it so PR 30 keeps it.
- The `clear()` change alters a code path that previously threw a `TypeError` on the first non-version entry. No test relied on that throw (`grep -rn 'clear()' tests`).
- Rollback: revert the four commits; the old index files were never touched, so older behaviour resumes with its caches intact.

## Decisions needed

None. Not changed because: the review's S7 fix (backend-specific file names) alone would let two runtimes share `<identifierHash>.css` files through separate indexes and serve each other's CSS; renaming the outputs and the Sass index is part of the same fix, decided here rather than deferred to PR 30.
