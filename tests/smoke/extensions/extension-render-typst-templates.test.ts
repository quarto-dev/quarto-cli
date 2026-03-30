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

const GITHUB_REPO = "quarto-ext/typst-templates";

const typstTemplates = [
  "ams",
  "dept-news",
  "fiction",
  "ieee",
  "letter",
  "poster",
];

for (const name of typstTemplates) {
  const format = `${name}-typst`;
  const baseDir = join("docs", "_temp-test-artifacts");
  const dirName = `typst-${name}`;
  const workingDir = join(baseDir, dirName);
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
      const source = `${GITHUB_REPO}/${name}`;
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
