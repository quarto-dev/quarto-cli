/*
* extension-render-journals.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { quarto } from "../../../src/quarto.ts";
import { ensureDirSync } from "fs/mod.ts";
import { testRender } from "../render/render.ts";

const journalRepos = [
  { repo: "acm", noSupporting: true },
  { repo: "acs", noSupporting: true },
  { repo: "biophysical-journal", format: "bj", noSupporting: true },
  { repo: "elsevier", noSupporting: false },
  { repo: "jasa", noSupporting: true },
  { repo: "jss", noSupporting: true },
  // { repo: "plos", noSupporting: true },
];

const baseWorkingDir = Deno.makeTempDirSync();

for (const journalRepo of journalRepos) {
  const format = journalRepo.format || journalRepo.repo;
  const workingDir = join(baseWorkingDir, format);
  ensureDirSync(workingDir);
  const input = `${format}.qmd`;
  testRender(input, format + "-pdf", journalRepo.noSupporting, [], {
    // Sets up the test
    setup: async () => {
      await quarto([
        "use",
        "template",
        `quarto-journals/${journalRepo.repo}`,
        "--no-prompt",
      ]);
    },

    // Cleans up the test
    teardown: async () => {
      // await Deno.remove(workingDir, { recursive: true });
    },

    cwd: () => {
      return workingDir;
    },
  });
}
