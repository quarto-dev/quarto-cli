/*
* extension-render-journals.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { quarto } from "../../../src/quarto.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { testRender } from "../render/render.ts";
import { removeIfEmptyDir } from "../../../src/core/path.ts";

const journalRepos = [
  { repo: "acm", noSupporting: true },
  { repo: "acs", noSupporting: true },
  { repo: "agu", noSupporting: true },
  { repo: "biophysical-journal", format: "bj", noSupporting: true },
  { repo: "elsevier", noSupporting: false },
  { repo: "jasa", noSupporting: true },
  { repo: "jss", noSupporting: true },
  { repo: "plos", noSupporting: true },
];

for (const journalRepo of journalRepos) {
  const format = journalRepo.format || journalRepo.repo;
  const baseDir = join(
    "docs",
    "_temp-test-artifacts",
  );
  const workingDir = join(baseDir, format);
  const input = join(workingDir, `${format}.qmd`);

  testRender(input, format + "-pdf", journalRepo.noSupporting, [], {
    prereq: () => {
      if (existsSync(workingDir)) {
        Deno.removeSync(workingDir, { recursive: true });
      }
      ensureDirSync(workingDir);
      return Promise.resolve(true);
    },

    // Sets up the test
    setup: async () => {
      console.log(`using quarto-journals/${journalRepo.repo}`);
      const wd = Deno.cwd();
      Deno.chdir(workingDir);
      await quarto([
        "use",
        "template",
        `quarto-journals/${journalRepo.repo}`,
        "--no-prompt",
      ]);
      Deno.chdir(wd);
    },

    // Cleans up the test
    teardown: async () => {
      await Deno.remove(workingDir, { recursive: true });
      removeIfEmptyDir(baseDir);
    },
  });
}
