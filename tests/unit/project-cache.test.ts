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
