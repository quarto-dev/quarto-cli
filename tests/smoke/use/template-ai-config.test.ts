/*
 * template-ai-config.test.ts
 *
 * Verifies that AI assistant configuration files (CLAUDE.md, AGENTS.md)
 * are properly excluded from extension templates when using "quarto use template".
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrorsOrWarnings, pathDoNotExists } from "../../verify.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";

const tempDir = Deno.makeTempDirSync();

// Create a mock template source with AI config files
const templateSourceDir = join(tempDir, "template-source");
ensureDirSync(templateSourceDir);
Deno.writeTextFileSync(
  join(templateSourceDir, "template.qmd"),
  "---\ntitle: Template Document\n---\n\nThis is a template document."
);
Deno.writeTextFileSync(
  join(templateSourceDir, "CLAUDE.md"),
  "# Claude Configuration\n\nThis should be excluded."
);
Deno.writeTextFileSync(
  join(templateSourceDir, "AGENTS.md"),
  "# Agents Configuration\n\nThis should be excluded."
);
Deno.writeTextFileSync(
  join(templateSourceDir, "README.md"),
  "# Template README\n\nThis should also be excluded."
);

const templateFolder = "test-ai-config-template";
const workingDir = join(tempDir, templateFolder);
ensureDirSync(workingDir);

testQuartoCmd(
  "use",
  ["template", templateSourceDir, "--no-prompt"],
  [
    noErrorsOrWarnings,
    fileExists(`${templateFolder}.qmd`),             // Template file should be copied and renamed
    pathDoNotExists(join(workingDir, "CLAUDE.md")), // CLAUDE.md should be excluded
    pathDoNotExists(join(workingDir, "AGENTS.md")), // AGENTS.md should be excluded
    pathDoNotExists(join(workingDir, "README.md")), // README.md should also be excluded (sanity check)
  ],
  {
    cwd: () => {
      return workingDir;
    },
    teardown: () => {
      try {
        Deno.removeSync(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      return Promise.resolve();
    }
  }
);
