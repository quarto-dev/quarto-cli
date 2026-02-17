/*
 * project-ai-config.test.ts
 *
 * Verifies that AI assistant configuration files (CLAUDE.md, AGENTS.md)
 * are properly excluded from project file discovery and rendering.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { fileExists, pathDoNotExists, noErrors } from "../../verify.ts";

const projectDir = docs("project/ai-config-files");
const outputDir = join(projectDir, "_site");

// Test that AI assistant config files are properly excluded
testQuartoCmd(
  "render",
  [projectDir],
  [
    noErrors,
    fileExists(join(outputDir, "index.html")),           // Control: regular file should be rendered
    pathDoNotExists(join(outputDir, "CLAUDE.html")),     // CLAUDE.md should be ignored
    pathDoNotExists(join(outputDir, "AGENTS.html")),     // AGENTS.md should be ignored
  ],
  {
    teardown: async () => {
      // Clean up _site directory
      if (existsSync(outputDir)) {
        await Deno.remove(outputDir, { recursive: true });
      }
    },
  },
);
