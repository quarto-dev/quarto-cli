/*
 * sass-cache.test.ts
 *
 * Tests for the persistent/session Sass compilation cache.
 * Validates fixes for:
 *   https://github.com/quarto-dev/quarto-cli/issues/13955 (closed KV reuse)
 *   https://github.com/quarto-dev/quarto-cli/issues/14594 (book/website preview)
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { test, unitTest, Verify } from "../test.ts";
import {
  assert,
  assertEquals,
  assertMatch,
  assertRejects,
  assertStringIncludes,
} from "../asserts.ts";
import { dirname, join } from "../../src/deno_ral/path.ts";
import { ensureDirSync, existsSync } from "../../src/deno_ral/fs.ts";
import { v8Branch } from "../../src/deno_ral/platform.ts";
import { safeRemoveIfExists } from "../../src/core/path.ts";
import { createTempContext, TempContext } from "../../src/core/temp.ts";
import { sassCache } from "../../src/core/sass/cache.ts";
import { withTempDir } from "../utils.ts";
import { noErrors, printsMessage } from "../verify.ts";
import { md5HashAsync } from "../../src/core/hash.ts";
import {
  damageKvRow,
  damageKvTableRoot,
  kZeroValue,
  truncateKvFile,
  writeNonDatabase,
} from "./kv-damage-fixtures.ts";

// A syntactically valid md5 hash that will never be present in a fresh cache,
// so getFromHash exercises kv.get() and returns a clean cache miss (null).
const ABSENT_HASH = "0".repeat(32);

unitTest(
  "sassCache - reusing a cache path after cleanup returns a live KV handle (#14594)",
  async () => {
    const root = Deno.makeTempDirSync({ prefix: "quarto-sass-cache-test" });
    const cachePath = join(root, "sass");

    const temp1 = createTempContext();
    let temp2: TempContext | undefined;
    try {
      // First resolve creates the cache and opens its Deno.Kv handle.
      const cache1 = await sassCache(cachePath, temp1);
      // A read works while the handle is open (clean cache miss).
      assertEquals(await cache1.getFromHash(ABSENT_HASH, "ignored"), null);

      // Cleanup closes the KV handle and removes the cache dir. This is what
      // project.cleanup() -> temp.cleanup() does on the serve/watch re-render
      // path that book and website preview go through.
      temp1.cleanup();

      // A later render resolves the SAME cache path again. The registry must
      // not hand back the instance whose KV handle was just closed, otherwise
      // kv.get() throws "BadResource: Bad resource ID" (#14594, #13955).
      temp2 = createTempContext();
      const cache2 = await sassCache(cachePath, temp2);
      assertEquals(
        await cache2.getFromHash(ABSENT_HASH, "ignored"),
        null,
        "Reused cache path must return a live KV handle, not a closed one",
      );
    } finally {
      temp1.cleanup();
      temp2?.cleanup();
      safeRemoveIfExists(root);
    }
  },
);

// Bytes an older Quarto's store could hold; not a SQLite file, so opening it
// with Deno.openKv throws "file is not a database".
const LEGACY_SENTINEL = "legacy sass.kv owned by another Quarto version";
const ID_HASH = "a".repeat(32);
const INPUT_HASH = "1".repeat(32);

unitTest(
  "sassCache - stores index and outputs under v8-<branch> and never opens a legacy sass.kv",
  async () => {
    await withTempDir(async (root) => {
      const cachePath = join(root, "sass");
      ensureDirSync(cachePath);
      const legacy = join(cachePath, "sass.kv");
      Deno.writeTextFileSync(legacy, LEGACY_SENTINEL);

      const temp = createTempContext();
      try {
        const cache = await sassCache(cachePath, temp);
        const out = await cache.setFromHash(ID_HASH, INPUT_HASH, "id", (p) => {
          Deno.writeTextFileSync(p, "/* css */");
          return Promise.resolve();
        });
        assertMatch(v8Branch, /^\d+\.\d+$/);
        const storeDir = join(cachePath, `v8-${v8Branch}`);
        assertEquals(dirname(out), storeDir);
        assert(existsSync(join(storeDir, "sass.kv")));
        assertEquals(await cache.getFromHash(ID_HASH, INPUT_HASH), out);
        assertEquals(Deno.readTextFileSync(legacy), LEGACY_SENTINEL);
      } finally {
        temp.cleanup();
      }
    }, "quarto-sass-cache-v8");
  },
);

// Damaged-store tests (#15119). Each test owns a scratch dir created in setup
// and removed in teardown, so a handle leaked by a failed init cannot replace
// the primary failure.
const kStoreWarn = /Ignoring a damaged entry in the Quarto cache .*sass\.kv/;
const H1 = "b".repeat(32);
const H2 = "c".repeat(32);

function sassDamageTest(
  name: string,
  body: (scratch: string) => Promise<void>,
  verify: Verify[] = [noErrors],
) {
  let scratch = "";
  test({
    name,
    type: "unit",
    context: {
      setup: () => {
        scratch = Deno.makeTempDirSync({ prefix: "quarto-sass-damage" });
        return Promise.resolve();
      },
      teardown: () => {
        Deno.removeSync(scratch, { recursive: true });
        return Promise.resolve();
      },
    },
    execute: () => body(scratch),
    verify,
  });
}

function storePaths(scratch: string) {
  const cachePath = join(scratch, "sass");
  const storeDir = join(cachePath, `v8-${v8Branch}`);
  return { cachePath, storeDir, file: join(storeDir, "sass.kv") };
}

// Writes a healthy store directly, so no sassCache() registry entry or
// process-global cleanup is involved.
async function seedStore(file: string, hashes: string[] = []) {
  ensureDirSync(dirname(file));
  const kv = await Deno.openKv(file);
  try {
    await kv.set(["version"], 1);
    for (const h of hashes) {
      await kv.set(["entry", h], { key: "id", hash: INPUT_HASH });
      Deno.writeTextFileSync(join(dirname(file), `${h}.css`), "");
    }
  } finally {
    kv.close();
  }
}

const writeCss = (p: string) => {
  Deno.writeTextFileSync(p, "/* css */");
  return Promise.resolve();
};

sassDamageTest(
  "sassCache - a damaged version row warns once and is repaired (#15119)",
  async (scratch) => {
    const { cachePath, file } = storePaths(scratch);
    await seedStore(file);
    damageKvRow(file, ["version"], kZeroValue);
    const temp = createTempContext();
    try {
      const cache = await sassCache(cachePath, temp);
      const second = await Deno.openKv(file);
      try {
        assertEquals((await second.get(["version"])).value, 1);
      } finally {
        second.close();
      }
      const out = await cache.setFromHash(H1, INPUT_HASH, "id", writeCss);
      assertEquals(await cache.getFromHash(H1, INPUT_HASH), out);
    } finally {
      temp.cleanup();
    }
  },
  [noErrors, printsMessage({ level: "WARN", regex: kStoreWarn, count: 1 })],
);

sassDamageTest(
  "sassCache - a damaged entry is a miss and the next set overwrites it",
  async (scratch) => {
    const { cachePath, storeDir, file } = storePaths(scratch);
    await seedStore(file, [H1, H2]);
    damageKvRow(file, ["entry", H2], kZeroValue);
    const temp = createTempContext();
    try {
      const cache = await sassCache(cachePath, temp);
      assertEquals(
        await cache.getFromHash(H1, INPUT_HASH),
        join(storeDir, `${H1}.css`),
      );
      assertEquals(await cache.getFromHash(H2, INPUT_HASH), null);
      const out = await cache.setFromHash(H2, INPUT_HASH, "id", writeCss);
      assertEquals(await cache.getFromHash(H2, INPUT_HASH), out);
    } finally {
      temp.cleanup();
    }
  },
  [noErrors, printsMessage({ level: "WARN", regex: kStoreWarn, count: 1 })],
);

sassDamageTest(
  "sassCache - compile failure after a damaged entry surfaces the compile error",
  async (scratch) => {
    const { cachePath, file } = storePaths(scratch);
    const identifier = "id2";
    const h = await md5HashAsync(identifier);
    await seedStore(file, [h]);
    damageKvRow(file, ["entry", h], kZeroValue);
    const temp = createTempContext();
    try {
      const cache = await sassCache(cachePath, temp);
      const e = await assertRejects(
        () =>
          cache.getOrSet("input", identifier, () => {
            throw new Error("sass boom");
          }),
        Error,
      );
      assertEquals(e.message, "sass boom");
      // The row must still be damaged: a failed compile never overwrites it.
      const second = await Deno.openKv(file);
      try {
        const r = await assertRejects(
          () => second.get(["entry", h]),
          RangeError,
        );
        assertStringIncludes(r.message, "could not deserialize value");
      } finally {
        second.close();
      }
    } finally {
      temp.cleanup();
    }
  },
  [noErrors, printsMessage({ level: "WARN", regex: kStoreWarn, count: 1 })],
);

async function assertStoreRejected(
  scratch: string,
  damage: (file: string) => void,
) {
  const { cachePath, storeDir, file } = storePaths(scratch);
  await seedStore(file, [H1]);
  damage(file);
  const before = Deno.readFileSync(file);
  const temp = createTempContext();
  try {
    const e = await assertRejects(() => sassCache(cachePath, temp), Error);
    assertStringIncludes(e.message, file);
    assertStringIncludes(e.message, storeDir);
    assertStringIncludes(e.message, "Delete the folder");
    assertEquals(Deno.readFileSync(file), before);
  } finally {
    temp.cleanup();
  }
}

sassDamageTest(
  "sassCache - a truncated store fails with the folder to delete and is left as is",
  (scratch) => assertStoreRejected(scratch, truncateKvFile),
);

sassDamageTest(
  "sassCache - a non-database store fails the same way",
  (scratch) => assertStoreRejected(scratch, writeNonDatabase),
);

sassDamageTest(
  "sassCache - a damaged store rejects again on the next resolve and stays deletable",
  async (scratch) => {
    const { cachePath, storeDir, file } = storePaths(scratch);
    await seedStore(file, [H1]);
    damageKvTableRoot(file);
    const temp = createTempContext();
    try {
      for (let i = 0; i < 2; i++) {
        const e = await assertRejects(() => sassCache(cachePath, temp), Error);
        assertStringIncludes(e.message, "Delete the folder");
      }
      // Fails with os error 32 on Windows if a handle leaked.
      Deno.removeSync(storeDir, { recursive: true });
    } finally {
      temp.cleanup();
    }
  },
);

sassDamageTest(
  "sassCache - a damaged untagged legacy store is never opened",
  async (scratch) => {
    const { cachePath } = storePaths(scratch);
    const legacy = join(cachePath, "sass.kv");
    await seedStore(legacy);
    damageKvRow(legacy, ["version"], kZeroValue);
    const before = Deno.readFileSync(legacy);
    const temp = createTempContext();
    try {
      const cache = await sassCache(cachePath, temp);
      const out = await cache.setFromHash(H1, INPUT_HASH, "id", writeCss);
      assertEquals(await cache.getFromHash(H1, INPUT_HASH), out);
    } finally {
      temp.cleanup();
    }
    assertEquals(Deno.readFileSync(legacy), before);
  },
  [noErrors, printsMessage({ level: "WARN", regex: /damaged/, negate: true })],
);

sassDamageTest(
  "sassCache - a repaired cache path still returns a live handle after cleanup (#14594)",
  async (scratch) => {
    const { cachePath, file } = storePaths(scratch);
    await seedStore(file);
    damageKvRow(file, ["version"], kZeroValue);
    const temp1 = createTempContext();
    let temp2: TempContext | undefined;
    try {
      await sassCache(cachePath, temp1);
      temp1.cleanup();
      temp2 = createTempContext();
      const cache = await sassCache(cachePath, temp2);
      assertEquals(await cache.getFromHash(ABSENT_HASH, "ignored"), null);
    } finally {
      temp1.cleanup();
      temp2?.cleanup();
    }
  },
);
