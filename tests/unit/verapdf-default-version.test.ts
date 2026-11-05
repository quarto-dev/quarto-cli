/*
 * verapdf-default-version.test.ts
 *
 * Packaged installs don't ship `configuration`, so `quarto install verapdf`
 * falls back to kDefaultVersion. It must match VERAPDF in `configuration`,
 * the version the build uploads.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "../asserts.ts";
import { dirname, fromFileUrl, join } from "../../src/deno_ral/path.ts";
import { readTextFileSync } from "../../src/deno_ral/fs.ts";
import { kDefaultVersion } from "../../src/tools/impl/verapdf.ts";

const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..", "..");

// deno-lint-ignore require-await
unitTest("verapdf - kDefaultVersion matches VERAPDF in configuration", async () => {
  const match = readTextFileSync(join(repoRoot, "configuration")).match(
    /^export VERAPDF=(.+)$/m,
  );
  assert(match, "export VERAPDF=... not found in configuration");
  assertEquals(
    kDefaultVersion,
    match[1].trim(),
    "kDefaultVersion in src/tools/impl/verapdf.ts must equal VERAPDF in configuration",
  );
});
