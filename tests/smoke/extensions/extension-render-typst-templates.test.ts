/*
 * extension-render-typst-templates.test.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { join } from "../../../src/deno_ral/path.ts";
import { quarto } from "../../../src/quarto.ts";
import { ensureDirSync, existsSync } from "../../../src/deno_ral/fs.ts";
import { testRender } from "../render/render.ts";
import { removeIfEmptyDir } from "../../../src/core/path.ts";

// Set to a local path for development, or null to use GitHub
// Example: "/Users/gordon/src/tt-work/typst-templates"
const LOCAL_TEMPLATES_PATH: string | null = null;

// GitHub repo where templates are published (templates are subdirectories)
const GITHUB_REPO = "quarto-ext/typst-templates";
const GITHUB_BRANCH = "@import-and-gather"

// Template definitions - single source of truth
// Templates with `skip: true` require local typst packages (@local/...) that need
// `quarto typst gather` to bundle. They're skipped until packages are bundled.
const typstTemplates = [
  { name: "ams" },
  { name: "dept-news", skip: false }, // needs @local/dashing-dept-news
  { name: "fiction" },
  { name: "ieee" },
  { name: "letter" },
  { name: "poster" }, // needs @local/typst-poster
];

// Helper to get the template source for `quarto use template`
function getTemplateSource(name: string): string {
  if (LOCAL_TEMPLATES_PATH) {
    return join(LOCAL_TEMPLATES_PATH, name);
  }
  return `${GITHUB_REPO}/${name}${GITHUB_BRANCH}`;
}

for (const template of typstTemplates.filter((t) => !t.skip)) {
  const format = `${template.name}-typst`;
  const baseDir = join("docs", "_temp-test-artifacts");
  const dirName = `typst-${template.name}`;
  const workingDir = join(baseDir, dirName);
  // quarto use template creates a qmd file named after the working directory
  const input = join(workingDir, `${dirName}.qmd`);

  testRender(input, format, true, [], {
    prereq: () => {
      if (existsSync(workingDir)) {
        Deno.removeSync(workingDir, { recursive: true });
      }
      ensureDirSync(workingDir);
      return Promise.resolve(true);
    },

    setup: async () => {
      const source = getTemplateSource(template.name);
      console.log(`using template: ${source}`);
      const wd = Deno.cwd();
      Deno.chdir(workingDir);
      await quarto([
        "use",
        "template",
        source,
        "--no-prompt",
      ]);
      Deno.chdir(wd);
    },

    teardown: async () => {
      await Deno.remove(workingDir, { recursive: true });
      removeIfEmptyDir(baseDir);
    },
  });
}
