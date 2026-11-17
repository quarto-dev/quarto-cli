/*
 * deno-std-cache.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { ensureDirSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { directoryListingsMatch } from "../../../src/core/run/deno.ts";
import { unitTest } from "../../test.ts";
import { assertEquals } from "../../asserts.ts";
import { withTempDir, writeFixture } from "../../utils.ts";

const touch = (root: string, rel: string) => writeFixture(root, rel, "");

const populate = (root: string, rels: string[]) => {
  ensureDirSync(root);
  rels.forEach((rel) => touch(root, rel));
};

const compare = (seedFiles: string[], userFiles: string[]) =>
  withTempDir((dir) => {
    const seed = join(dir, "seed");
    const user = join(dir, "user");
    populate(seed, seedFiles);
    populate(user, userFiles);
    return directoryListingsMatch(seed, user);
  });

// Deno can exit `deno cache` without closing its SQLite cache databases, so the
// bundled seed may hold -shm/-wal files that a later clean close deletes from
// the user copy. Those must not count as a missing seed file.
unitTest(
  "directoryListingsMatch - ignores SQLite cache sidecars missing from the user copy",
  async () => {
    const result = await compare(
      [
        "cache/dep_analysis_cache_v2",
        "cache/dep_analysis_cache_v2-shm",
        "cache/dep_analysis_cache_v2-wal",
        "cache/v8_code_cache_v2",
        "cache/v8_code_cache_v2-wal",
        "cache/npm/x/y.json",
      ],
      [
        "cache/dep_analysis_cache_v2",
        "cache/v8_code_cache_v2",
        "cache/npm/x/y.json",
      ],
    );
    assertEquals(result, true);
  },
);

unitTest(
  "directoryListingsMatch - reports a missing ordinary file",
  async () => {
    const result = await compare(
      [
        "cache/dep_analysis_cache_v2",
        "cache/dep_analysis_cache_v2-shm",
        "cache/dep_analysis_cache_v2-wal",
        "cache/v8_code_cache_v2",
        "cache/v8_code_cache_v2-wal",
        "cache/npm/x/y.json",
        "cache/npm/x/z.json",
      ],
      [
        "cache/dep_analysis_cache_v2",
        "cache/v8_code_cache_v2",
        "cache/npm/x/z.json",
      ],
    );
    assertEquals(result, false);
  },
);

unitTest(
  "directoryListingsMatch - does not ignore package files with sidecar-like names",
  async () => {
    const result = await compare(
      [
        "cache/dep_analysis_cache_v2",
        "cache/npm/x/y.json",
        "cache/npm/x/foo-wal",
      ],
      ["cache/dep_analysis_cache_v2", "cache/npm/x/y.json"],
    );
    assertEquals(result, false);
  },
);

// `deno cache` writes transpiled local modules under gen/file/<absolute path of
// the checkout that built the seed>, so each checkout or build machine has its
// own entry. Every Quarto shares the user copy, so a missing gen/ file must not
// count as a stale cache.
unitTest(
  "directoryListingsMatch - ignores Deno's gen/ output missing from the user copy",
  async () => {
    const result = await compare(
      [
        "cache/dep_analysis_cache_v2",
        "cache/gen/file/C/build/package/scripts/deno_std/deno_std.ts.js",
        "cache/gen/https/deno.land/abc.js",
        "cache/npm/x/y.json",
      ],
      [
        "cache/dep_analysis_cache_v2",
        "cache/gen/file/D/a/package/scripts/deno_std/deno_std.ts.js",
        "cache/npm/x/y.json",
      ],
    );
    assertEquals(result, true);
  },
);

unitTest(
  "directoryListingsMatch - does not ignore a gen directory outside the cache root",
  async () => {
    const result = await compare(
      ["cache/dep_analysis_cache_v2", "cache/npm/x/gen/y.js"],
      ["cache/dep_analysis_cache_v2"],
    );
    assertEquals(result, false);
  },
);

unitTest(
  "directoryListingsMatch - reports a missing cache database",
  async () => {
    const result = await compare(
      [
        "cache/dep_analysis_cache_v2",
        "cache/dep_analysis_cache_v2-wal",
        "cache/npm/x/y.json",
      ],
      ["cache/npm/x/y.json"],
    );
    assertEquals(result, false);
  },
);
