/*
 * zip.test.ts
 *
 * Tests for zip extraction on Windows.
 * Validates fix for:
 *   https://github.com/quarto-dev/quarto-cli/issues/15198 (enterprise .bat blocking)
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals, assertStringIncludes } from "../asserts.ts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import { join } from "../../src/deno_ral/path.ts";
import { unzip } from "../../src/core/zip.ts";
import { docs, withTempDir } from "../utils.ts";

// Directory name with every character that has broken Windows extraction:
// space and & (cmd), ' and ’ (PowerShell string), accent and CJK (code pages)
const hostileDirName = "O'Brien & D’Arcy é 日本";

unitTest(
  "unzip - extracts non-ASCII entries into a path with quote, ampersand, accent and CJK on Windows (#15198)",
  async () => {
    await withTempDir(async (tempBase) => {
      const dir = join(tempBase, hostileDirName);
      Deno.mkdirSync(dir);
      const archive = join(dir, "arch é.zip");
      Deno.copyFileSync(docs("zip/unicode-entries.zip"), archive);

      const result = await unzip(archive);

      assert(result.success, `unzip failed: ${result.stderr}`);
      assertEquals(
        Deno.readTextFileSync(join(dir, "café 日本", "naïve 文件.txt")),
        "contenu été",
      );
    });
  },
  { ignore: !isWindows },
);

unitTest(
  "unzip - failure message keeps non-ASCII path characters on Windows (#15198)",
  async () => {
    await withTempDir(async (tempBase) => {
      const dir = join(tempBase, hostileDirName);
      Deno.mkdirSync(dir);
      const archive = join(dir, "absent é 日本.zip");

      const result = await unzip(archive);

      assert(!result.success, "unzip of a missing archive should fail");
      assertStringIncludes(result.stderr ?? "", "absent é 日本.zip");
    });
  },
  { ignore: !isWindows },
);
