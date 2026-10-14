# PR 18: `deno_ral/kv.ts`; project cache and Sass cache on it

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/deno_ral/kv.ts` (`KeyValueStore`, `openKeyValueStore`) wrapping `Deno.openKv`, and move `src/core/cache/cache.ts` and `src/core/sass/cache.ts` onto it so `Deno.Kv`/`Deno.openKv` appear only in the layer.
**Phase:** 1. **Depends on:** PR 09 (layer conventions), PR 02 (ratchet). **Unblocks:** PR 21, PR 30.
**Branch:** `rt/18-ral-kv`.
**Suggested executor:** Opus. Small, but the project cache's `clear()`/version handling and the Sass cache's closed-handle registry (#14594, #13955) are behaviour that must survive the interface change exactly.
**Size:** S. 1 new module, 1 new test, 2 modified sources, 1 adapted test, baseline, rules doc.
**Ships on:** Deno; the existing test suite must stay green. The `--unstable-kv` flag stays in every launcher until PR 30 (Node implementation) and PR 33 (launchers on Node) remove it.

## Spec

### Context

Assessment section 3.3: `Deno.openKv` (unstable) backs two small key → file-hash indexes, `src/core/cache/cache.ts` (project cache) and `src/core/sass/cache.ts` (Sass cache); a JSON index with atomic writes is sufficient on Node. Section 11 module plan row `kv.ts`: `openKeyValueStore(path)` with `get`, `set`, `delete`, `list(prefix)`, `close`; the Deno implementation wraps `Deno.Kv` today.

Verified usage (2026-10-14):

`src/core/cache/cache.ts` (242 lines): field `index: Deno.Kv | null` (line 32); `close()` calls `this.index.close()` (45); `clear()` iterates `this.index.list({ prefix: [] })`, removes the on-disk file for every entry whose `key[0] !== "version"` and deletes each key (50–62); `createOnDisk()` sets `["version"]` to `"1"` (64–67); `init()` opens `Deno.openKv(join(indexPath, "deno-kv-file"))`, reads `["version"]`, creates it when `null`, and clears the cache when the stored version is unknown or `satisfies(quartoConfig.version(), requiredQuartoVersions[version])` is false (69–91); `addBuffer`/`addString`/`addSmallBuffer`/`addSmallString` call `this.index.set(key, {...})` and `assert(result.ok)` (93–138); `get` reads `kvResult.value` (140–147); `_getAs` deletes the key on `Deno.errors.NotFound` from the getter (149–170).

`src/core/sass/cache.ts` (220 lines): `SassCache.kv: Deno.Kv` (20, 27); `getFromHash` reads `["entry", hash]` and inspects `result.value` (45–62); `setFromHash` writes `["entry", identifierHash]` (101); `cleanup()` calls `this.kv.close()` and deletes the registry entry (145–164); `checkVersion(kv, path)` reads/writes `["version"]` as a number (173–199); `sassCache()` opens `Deno.openKv(join(path, "sass.kv"))` (211).

`tests/unit/sass-cache.test.ts` goes through `sassCache()` only; it mentions `Deno.Kv` in comments, never calls it. It stays green with comment edits only.

### Scope

In: `kv.ts`, its unit test, the two caches, the Sass cache test comments, baseline, rules table.
Out: changing the on-disk format (the store is still `Deno.Kv`'s SQLite file at the same paths `project-cache/deno-kv-file` and `sass.kv`); removing `--unstable-kv` (PR 30/33); `Deno.removeSync`/`Deno.writeFileSync`/`Deno.readFileSync`/`Deno.readTextFileSync`/`Deno.writeTextFileSync` in `cache.ts` (PR 10) and `Deno.errors.NotFound` at `cache.ts:161` (PR 10's `errors` rule); `assert` from `testing/asserts` in `cache.ts:9` (PR 22).

### Interfaces

`src/deno_ral/kv.ts` (new):

```ts
/*
 * kv.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Small persistent key-value index. The only module that may call
 * Deno.openKv. PR 30 reimplements it on a JSON index or node:sqlite.
 */

export type KvKey = (string | number)[];

export interface KvEntry<T> {
  key: KvKey;
  value: T;
}

export interface KeyValueStore {
  /** Resolves to the stored value, or null when absent. */
  get<T>(key: KvKey): Promise<T | null>;
  /** Stores a structured-cloneable value (strings, numbers, plain objects, Uint8Array). */
  set<T>(key: KvKey, value: T): Promise<void>;
  delete(key: KvKey): Promise<void>;
  /** Entries whose key starts with `prefix` (`[]` lists everything), in key order. */
  list<T>(prefix: KvKey): AsyncIterable<KvEntry<T>>;
  /** Closes the store; later calls on it throw. Idempotent. */
  close(): void;
}

/** Opens (creating if needed) the store at `path`. The parent directory must exist. */
export function openKeyValueStore(path: string): Promise<KeyValueStore>;
```

Differences from `Deno.Kv` that the two callers must absorb: `get` returns the value directly (not `{ value, versionstamp }`); `set` returns `void` (no `{ ok }`); `list` takes a bare prefix (not `{ prefix }`); `KvEntry` has no `versionstamp`.

### Files

- Create: `src/deno_ral/kv.ts`.
- Create: `tests/unit/deno-ral/kv.test.ts`.
- Modify: `src/core/cache/cache.ts:9-15,32,43-48,50-62,64-67,69-91,93-138,140-147,167`.
- Modify: `src/core/sass/cache.ts:9-17,20,27,45-56,101-104,152,173-199,211-212`.
- Modify: `tests/unit/sass-cache.test.ts:32,44,50` (comments only).
- Modify: `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`.

### Acceptance criteria

- `grep -rn 'Deno\.openKv\|Deno\.Kv\b' src tests package --include=*.ts | grep -v '^src/deno_ral/'` prints nothing (comments included).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/kv.test.ts unit/sass-cache.test.ts` passes.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-project-config-only.test.ts smoke/render/render-html.test.ts` passes (project cache creation and Sass cache hits during HTML render).
- A project rendered twice with `--cache` dirs intact reuses its `.quarto/project-cache` and `sass.kv` (manual check in Task 3).
- Baseline for `src/` lower by 7 (`cache.ts`: 2, `sass/cache.ts`: 5 including the header comment line 4 `Deno.KV`), committed.

## Plan

### Task 1: `kv.ts` with its unit test

**Files:**
- Create: `src/deno_ral/kv.ts`
- Create: `tests/unit/deno-ral/kv.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * kv.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Compatibility contract for src/deno_ral/kv.ts (rerun by PR 30 on Node).
 */

import { assertEquals, assertRejects } from "testing/asserts";
import { unitTest } from "../../test.ts";
import { KvEntry, openKeyValueStore } from "../../../src/deno_ral/kv.ts";
import { join } from "../../../src/deno_ral/path.ts";

async function withStore(
  fn: (path: string) => Promise<void>,
): Promise<void> {
  const dir = Deno.makeTempDirSync({ prefix: "quarto-kv-test" });
  try {
    await fn(join(dir, "index.kv"));
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
}

unitTest("kv - get returns null for a missing key and the value after set", async () => {
  await withStore(async (path) => {
    const kv = await openKeyValueStore(path);
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

unitTest("kv - values persist across close and reopen", async () => {
  await withStore(async (path) => {
    const kv1 = await openKeyValueStore(path);
    await kv1.set(["a", 1], "one");
    kv1.close();
    const kv2 = await openKeyValueStore(path);
    try {
      assertEquals(await kv2.get<string>(["a", 1]), "one");
    } finally {
      kv2.close();
    }
  });
});

unitTest("kv - delete removes a key; list filters by prefix in key order", async () => {
  await withStore(async (path) => {
    const kv = await openKeyValueStore(path);
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
  await withStore(async (path) => {
    const kv = await openKeyValueStore(path);
    try {
      await kv.set(["buf"], new Uint8Array([1, 2, 3]));
      assertEquals(await kv.get<Uint8Array>(["buf"]), new Uint8Array([1, 2, 3]));
    } finally {
      kv.close();
    }
  });
});

unitTest("kv - close is idempotent and a closed store rejects", async () => {
  await withStore(async (path) => {
    const kv = await openKeyValueStore(path);
    kv.close();
    kv.close();
    await assertRejects(() => kv.get(["x"]));
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/kv.test.ts`
Expected: type-check error `Module not found "file:///.../src/deno_ral/kv.ts"`.

- [ ] **Step 3: Implement `kv.ts`**

```ts
/*
 * kv.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Small persistent key-value index used by the project cache and the Sass
 * cache. The only module that may call Deno.openKv (needs --unstable-kv,
 * which the launchers pass until PR 30 replaces this implementation).
 * tests/unit/deno-ral/kv.test.ts is the contract.
 */

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

export async function openKeyValueStore(path: string): Promise<KeyValueStore> {
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

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/kv.test.ts`
Expected: `.....` then `ok | 5 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/kv.ts tests/unit/deno-ral/kv.test.ts
git commit -m "deno_ral: add kv.ts (openKeyValueStore) with unit test"
```

### Task 2: Project cache on `KeyValueStore`

**Files:**
- Modify: `src/core/cache/cache.ts`

- [ ] **Step 1: Import and field**

After line 11 (`import { join } ...`):

```ts
import { KeyValueStore, openKeyValueStore } from "../../deno_ral/kv.ts";
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
        // entries live in the index. Pre-existing code removed
        // join(dir, entry.value) for every key, which for an object value
        // produced a "[object Object]" path and a NotFound throw on the first
        // non-version entry; keep the intent (remove disk files) and skip the
        // rest.
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

and add `safeRemoveSync` to the `fs.ts` import on line 10:

```ts
import { ensureDirSync, safeRemoveSync } from "../../deno_ral/fs.ts";
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
    this.index = await openKeyValueStore(join(indexPath, "deno-kv-file"));
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

Each `const result = await this.index.set(key, {...}); assert(result.ok);` becomes `await this.index.set(key, {...});` (the store throws when a set fails). For example `addBuffer`:

```ts
  async addBuffer(key: string[], value: Uint8Array): Promise<void> {
    assert(this.index);
    const hash = await md5HashBytes(value);
    Deno.writeFileSync(
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

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: exit 0.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-project-config-only.test.ts smoke/render/render-html.test.ts`
Expected: `ok | N passed | 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add src/core/cache/cache.ts
git commit -m "core/cache: project cache index on deno_ral/kv KeyValueStore"
```

### Task 3: Sass cache on `KeyValueStore`

**Files:**
- Modify: `src/core/sass/cache.ts`
- Modify: `tests/unit/sass-cache.test.ts` (comments)

- [ ] **Step 1: Header comment, import, field, constructor**

Line 4: `* A persistent cache for sass compilation based partly on a key-value index.`

After line 17 (`import { Cloneable } ...`):

```ts
import { KeyValueStore, openKeyValueStore } from "../../deno_ral/kv.ts";
```

Lines 20 and 27:

```ts
  kv: KeyValueStore;
```

```ts
  constructor(kv: KeyValueStore, path: string) {
```

- [ ] **Step 2: `getFromHash` (lines 45–62)**

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
```

`setFromHash` line 101 (`await this.kv.set(["entry", identifierHash], {...})`) and `cleanup` line 152 (`this.kv.close()`) compile unchanged.

- [ ] **Step 3: `checkVersion` (lines 173–199) and `sassCache` (211)**

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

Line 211:

```ts
    const kv = await openKeyValueStore(kvFile);
```

- [ ] **Step 4: Test comments in `tests/unit/sass-cache.test.ts`**

Line 32: `// First resolve creates the cache and opens its key-value store.`
Line 44: `// kv.get() rejects with "Key-value store ... is closed" (#14594, #13955).`
Line 50: unchanged text (no `Deno.` in it); leave.

- [ ] **Step 5: Type-check, run the Sass cache tests, manual reuse check**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: exit 0.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/sass-cache.test.ts smoke/render/render-html.test.ts`
Expected: `ok | N passed | 0 failed`.

Manual: `cd tests/docs/websites/search && ../../../../package/dist/bin/quarto render` twice. The second run logs `SassCache.getFromHash ... cache hit` lines with `QUARTO_LOG_LEVEL=DEBUG` and finishes faster; `ls .quarto/sass/` shows `sass.kv` and `<hash>.css` files from the first run, still present.

- [ ] **Step 6: Commit**

```bash
git add src/core/sass/cache.ts tests/unit/sass-cache.test.ts
git commit -m "core/sass/cache: Sass cache index on deno_ral/kv KeyValueStore"
```

### Task 4: Ratchet and docs

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → `src/` count lower by 7.
- [ ] **Step 2:** Add to `.claude/rules/typescript/deno-ral.md` module table:

```markdown
| `kv.ts` | Persistent key-value index (needs `--unstable-kv` until PR 30) | `openKeyValueStore`, `KeyValueStore` |
```

- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet baseline after kv.ts; document kv.ts"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/kv.test.ts unit/sass-cache.test.ts` → `ok | 6 passed | 0 failed`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-project-config-only.test.ts smoke/render/render-html.test.ts smoke/project/` → pass.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- `grep -rn 'Deno\.openKv\|Deno\.Kv\b\|Deno\.KV' src tests --include=*.ts | grep -v '^src/deno_ral/'` → empty.
- Manual Sass cache reuse (Task 3 step 5).

## Review checklist

- [ ] On-disk paths unchanged (`project-cache/deno-kv-file`, `sass.kv`); existing user caches keep working.
- [ ] `clear()` deletes every key including `["version"]` (as before) and only tries to remove files for disk-backed entries.
- [ ] `set` failures surface as thrown errors (replacing `assert(result.ok)`).
- [ ] `checkVersion` logic byte-for-byte equivalent (null → set 1; non-number → throw; <1 throw; >1 throw).
- [ ] Closed-store rejection still lets `tests/unit/sass-cache.test.ts` detect a reused closed handle.
- [ ] `--unstable-kv` not touched anywhere.

## Risks and rollback

- `Deno.Kv.list` yields in key order; `KeyValueStore.list` documents the same, and the unit test asserts it so PR 30 keeps it.
- The `clear()` change alters a code path that previously threw on the first object-valued entry (`Deno.removeSync` of a `[object Object]` path). If any test relied on that throw (none found with `grep -rn 'clear()' tests`), it would now pass; this is a fix, documented in the PR description, no changelog entry (internal cache).
- Rollback: revert the four commits; no on-disk migration.

## Decisions needed

None.
