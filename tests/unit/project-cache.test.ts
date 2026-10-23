/*
 * project-cache.test.ts
 *
 * Tests that the project cache keeps its store per V8 release branch.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { ensureDirSync, existsSync } from "../../src/deno_ral/fs.ts";
import { v8Branch } from "../../src/deno_ral/platform.ts";
import { md5HashBytes } from "../../src/core/hash.ts";
import { createProjectCache } from "../../src/core/cache/cache.ts";
import { withTempDir } from "../utils.ts";

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
