/*
 * project-cache.test.ts
 *
 * Tests that the project cache keeps its store per V8 release branch.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { test, unitTest, Verify } from "../test.ts";
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { ensureDirSync, existsSync } from "../../src/deno_ral/fs.ts";
import { v8Branch } from "../../src/deno_ral/platform.ts";
import { md5HashBytes } from "../../src/core/hash.ts";
import { createProjectCache } from "../../src/core/cache/cache.ts";
import { withTempDir } from "../utils.ts";
import { noErrors, printsMessage } from "../verify.ts";
import {
  damageKvRow,
  damageKvTableRoot,
  holdKvLock,
  kZeroValue,
  truncateKvFile,
} from "./kv-damage-fixtures.ts";

const LEGACY_SENTINEL = "legacy deno-kv-file owned by another Quarto version";

unitTest(
  "projectCache - stores index and content under v8-<branch> and never opens a legacy deno-kv-file",
  async () => {
    await withTempDir(async (scratch) => {
      const legacyDir = join(scratch, "project-cache");
      ensureDirSync(legacyDir);
      const legacy = join(legacyDir, "deno-kv-file");
      Deno.writeTextFileSync(legacy, LEGACY_SENTINEL);

      const cache = await createProjectCache(scratch);
      try {
        await cache.addString(["k"], "cached value");
        assertEquals(await cache.getString(["k"]), "cached value");
        const storeDir = join(legacyDir, `v8-${v8Branch}`);
        const hash = await md5HashBytes(
          new TextEncoder().encode("cached value"),
        );
        assert(existsSync(join(storeDir, "deno-kv-file")));
        assert(existsSync(join(storeDir, hash)));
        assert(!existsSync(join(legacyDir, hash)));
      } finally {
        cache.close();
      }
      assertEquals(Deno.readTextFileSync(legacy), LEGACY_SENTINEL);
    }, "quarto-project-cache-v8");
  },
);

unitTest(
  "projectCache - clear() removes disk and immediate entries of a populated cache",
  async () => {
    await withTempDir(async (scratch) => {
      const cache = await createProjectCache(scratch);
      try {
        await cache.addString(["string"], "shared content");
        await cache.addString(["same-content"], "shared content");
        await cache.addBuffer(["buffer"], new Uint8Array([1, 2, 3]));
        await cache.addSmallString(["small-string"], "small");
        await cache.addSmallBuffer(["small-buffer"], new Uint8Array([4]));
        const storeDir = join(scratch, "project-cache", `v8-${v8Branch}`);
        const stringHash = await md5HashBytes(
          new TextEncoder().encode("shared content"),
        );
        const bufferHash = await md5HashBytes(new Uint8Array([1, 2, 3]));

        await cache.clear();

        assertEquals(await cache.get(["string"]), null);
        assertEquals(await cache.get(["same-content"]), null);
        assertEquals(await cache.get(["buffer"]), null);
        assertEquals(await cache.get(["small-string"]), null);
        assertEquals(await cache.get(["small-buffer"]), null);
        assert(!existsSync(join(storeDir, stringHash)));
        assert(!existsSync(join(storeDir, bufferHash)));
      } finally {
        cache.close();
      }
    }, "quarto-project-cache-clear");
  },
);

// Damaged-store tests (#15119). Each test owns a scratch dir created in setup
// and removed in teardown, so a handle leaked by a failed init cannot replace
// the primary failure.
const kStoreWarn =
  /Ignoring a damaged entry in the Quarto cache .*deno-kv-file/;

function projectDamageTest(
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
        scratch = Deno.makeTempDirSync({ prefix: "quarto-project-damage" });
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
  const storeDir = join(scratch, "project-cache", `v8-${v8Branch}`);
  return { storeDir, file: join(storeDir, "deno-kv-file") };
}

async function seedStore(scratch: string) {
  const cache = await createProjectCache(scratch);
  try {
    await cache.addString(["k"], "v");
  } finally {
    cache.close();
  }
}

projectDamageTest(
  "projectCache - a damaged version row and entry warn once and are repaired",
  async (scratch) => {
    const { file } = storePaths(scratch);
    await seedStore(scratch);
    damageKvRow(file, ["version"], kZeroValue);
    damageKvRow(file, ["k"], kZeroValue);
    const cache = await createProjectCache(scratch);
    try {
      const second = await Deno.openKv(file);
      try {
        assertEquals((await second.get(["version"])).value, "1");
      } finally {
        second.close();
      }
      assertEquals(await cache.getString(["k"]), null);
      await cache.addString(["k"], "w");
      assertEquals(await cache.getString(["k"]), "w");
    } finally {
      cache.close();
    }
  },
  [noErrors, printsMessage({ level: "WARN", regex: kStoreWarn, count: 1 })],
);

projectDamageTest(
  "projectCache - a truncated index fails with the folder to delete and is left as is",
  async (scratch) => {
    const { storeDir, file } = storePaths(scratch);
    await seedStore(scratch);
    truncateKvFile(file);
    const before = Deno.readFileSync(file);
    const e = await assertRejects(() => createProjectCache(scratch), Error);
    assertStringIncludes(e.message, file);
    assertStringIncludes(e.message, storeDir);
    assertStringIncludes(e.message, "Delete the folder");
    assertEquals(Deno.readFileSync(file), before);
  },
);

projectDamageTest(
  "projectCache - a damaged index rejects again and stays deletable",
  async (scratch) => {
    const { storeDir, file } = storePaths(scratch);
    await seedStore(scratch);
    damageKvTableRoot(file);
    for (let i = 0; i < 2; i++) {
      const e = await assertRejects(() => createProjectCache(scratch), Error);
      assertStringIncludes(e.message, "Delete the folder");
    }
    // Fails with os error 32 on Windows if a handle leaked.
    Deno.removeSync(storeDir, { recursive: true });
  },
);

projectDamageTest(
  "projectCache - a locked index is not damage",
  async (scratch) => {
    const { file } = storePaths(scratch);
    await seedStore(scratch);
    const before = Deno.readFileSync(file);
    const lock = await holdKvLock(file);
    try {
      const e = await assertRejects(() => createProjectCache(scratch), Error);
      assertStringIncludes(e.message, "database is locked");
      assertStringIncludes(e.message, `(Quarto cache: ${file})`);
      assert(!e.message.includes("Delete the folder"));
    } finally {
      await lock.release();
    }
    assertEquals(Deno.readFileSync(file), before);
  },
);
