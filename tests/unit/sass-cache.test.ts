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

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { safeRemoveIfExists } from "../../src/core/path.ts";
import { createTempContext, TempContext } from "../../src/core/temp.ts";
import { sassCache } from "../../src/core/sass/cache.ts";

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
