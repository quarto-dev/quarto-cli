/*
 * project-detect-denied-config.test.ts
 *
 * A parent folder with `content/` and a `config/` that can be listed but not
 * searched is not a Hugo project: `quarto render --output doc.html` writes
 * HTML, not hugo-md, and creates no `.quarto` in that folder.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "../../../src/deno_ral/path.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { originalRealPathSync } from "../../../src/deno_ral/original-real-path.ts";
import { testQuartoCmd } from "../../test.ts";
import {
  ensureFileRegexMatches,
  noErrors,
  pathDoNotExists,
} from "../../verify.ts";
import { removeProject } from "../../utils.ts";

// Not registered where mode bits don't apply (Windows, root): an ignored test
// never runs its teardown, so its fixture would be left behind.
if (!isWindows && Deno.uid() !== 0) {
  // The tree must exist at registration: the harness enters `cwd` before setup.
  const root = originalRealPathSync(
    Deno.makeTempDirSync({ prefix: "quarto-detect-denied" }),
  );
  const config = join(root, "config");
  const work = join(root, "work");
  Deno.mkdirSync(join(config, "_default"), { recursive: true });
  Deno.mkdirSync(join(root, "content"));
  Deno.mkdirSync(work);
  Deno.writeTextFileSync(join(work, "doc.qmd"), "---\ntitle: t\n---\nhi\n");

  testQuartoCmd(
    "render",
    ["doc.qmd", "--output", "doc.html"],
    [
      noErrors,
      ensureFileRegexMatches(join(work, "doc.html"), [/^<!DOCTYPE html>/]),
      pathDoNotExists(join(root, ".quarto")),
    ],
    {
      cwd: () => work,
      setup: () => {
        Deno.chmodSync(config, 0o644);
        return Promise.resolve();
      },
      teardown: () => {
        Deno.chmodSync(config, 0o755);
        return removeProject(root);
      },
    },
    "render-below-unsearchable-hugo-config",
  );
}
