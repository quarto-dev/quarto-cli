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
import { removeIfExists } from "../../../src/core/path.ts";
import { testQuartoCmd } from "../../test.ts";
import { fileExists, pathDoNotExists, noErrors } from "../../verify.ts";

const projectDir = docs("project/ai-config-files");
const outputDir = join(projectDir, "_site");

// .local.md fixture files are created at runtime to avoid .gitignore conflicts
const localFiles = ["CLAUDE.local.md", "AGENTS.local.md"];

// Test that AI assistant config files are properly excluded
testQuartoCmd(
  "render",
  [projectDir],
  [
    noErrors,
    fileExists(join(outputDir, "index.html")),           // Control: regular file should be rendered
    pathDoNotExists(join(outputDir, "CLAUDE.html")),     // CLAUDE.md should be ignored
    pathDoNotExists(join(outputDir, "AGENTS.html")),     // AGENTS.md should be ignored
    pathDoNotExists(join(outputDir, "CLAUDE.local.html")), // CLAUDE.local.md should be ignored
    pathDoNotExists(join(outputDir, "AGENTS.local.html")), // AGENTS.local.md should be ignored
  ],
  {
    setup: async () => {
      for (const file of localFiles) {
        await Deno.writeTextFile(
          join(projectDir, file),
          "This is a local AI config file that should be ignored during project scanning.\n",
        );
      }
    },
    teardown: async () => {
      for (const file of localFiles) {
        removeIfExists(join(projectDir, file));
      }
      if (existsSync(outputDir)) {
        await Deno.remove(outputDir, { recursive: true });
      }
    },
  },
);
