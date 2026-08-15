/*
* project-metadata-files-exec.test.ts
*
* Copyright (C) 2026 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";

import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { ensureFileRegexMatches, noErrors } from "../../verify.ts";

// Verify that `metadata-files` supports both a plain YAML file entry and a
// `!exec` command entry side by side, and that both get merged into the
// project metadata.
const renderDir = docs("project/metadata-files-exec");
const dirAbs = join(Deno.cwd(), renderDir);
const outputFile = join(dirAbs, "index.html");
const supportDir = join(dirAbs, "index_files");

testQuartoCmd(
  "render",
  [renderDir],
  [
    noErrors,
    ensureFileRegexMatches(outputFile, [
      /exec-metadata-marker-8f3c21/,
      /plain-metadata-file-marker-1a2b3c/,
    ]),
  ],
  {
    teardown: async () => {
      if (existsSync(outputFile)) {
        await Deno.remove(outputFile);
      }
      if (existsSync(supportDir)) {
        await Deno.remove(supportDir, { recursive: true });
      }
    },
  },
);
