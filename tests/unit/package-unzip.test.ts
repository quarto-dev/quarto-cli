/*
 * package-unzip.test.ts
 *
 * Tests for the build-time unzip helper used by configure
 * (package/src/util/utils.ts).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertRejects } from "../asserts.ts";
import { existsSync } from "../../src/deno_ral/fs.ts";
import { join } from "../../src/deno_ral/path.ts";
import { zip } from "../../src/core/zip.ts";
import { withTempDir, writeFixture } from "../utils.ts";
import { unzip } from "../../package/src/util/utils.ts";

unitTest(
  "package unzip - extracts a zip into a destination that does not exist yet",
  async () => {
    await withTempDir(async (dir) => {
      writeFixture(dir, "src/pandoc-x/pandoc.exe", "binary");
      const archive = join(dir, "pandoc.zip");
      const created = await zip("pandoc-x", archive, {
        cwd: join(dir, "src"),
      });
      assert(created.success, `fixture zip failed: ${created.stderr}`);

      const dest = join(dir, "out");
      await unzip(archive, dest);

      assert(
        existsSync(join(dest, "pandoc-x", "pandoc.exe")),
        "pandoc-x/pandoc.exe was not extracted",
      );
    }, "quarto-package-unzip-test");
  },
);

unitTest(
  "package unzip - throws naming the archive when extraction fails",
  async () => {
    await withTempDir(async (dir) => {
      writeFixture(dir, "corrupt.zip", "this is not a zip archive");
      const archive = join(dir, "corrupt.zip");
      await assertRejects(
        () => unzip(archive, join(dir, "out")),
        Error,
        "corrupt.zip",
      );
    }, "quarto-package-unzip-test");
  },
);
