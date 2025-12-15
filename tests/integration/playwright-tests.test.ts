/*
 * smoke-all.test.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 *
 */

import { expandGlobSync } from "../../src/core/deno/expand-glob.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../src/core/lib/yaml-validation/state.ts";
import { cleanoutput } from "../smoke/render/render.ts";
import { execProcess } from "../../src/core/process.ts";
import { quartoDevCmd } from "../utils.ts";
import { fail } from "testing/asserts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import { join } from "../../src/deno_ral/path.ts";
import { existsSync } from "../../src/deno_ral/fs.ts";
import * as gha from "../../src/tools/github.ts";

async function fullInit() {
  await initYamlIntelligenceResourcesFromFilesystem();
}

const globOutput = Deno.args.length
  ? expandGlobSync(Deno.args[0])
  : expandGlobSync(
    "docs/playwright/!(serve|shiny)/**/*.qmd",
  );

setInitializer(fullInit);
await initState();

// Install multiplex server dependencies if needed
const multiplexServerPath = "integration/playwright/multiplex-server";
const multiplexNodeModules = join(multiplexServerPath, "node_modules");
if (!existsSync(multiplexNodeModules)) {
  console.log("Installing multiplex server dependencies...");
  await execProcess({
    cmd: isWindows ? "npm.cmd" : "npm",
    args: ["install", "--loglevel=error"],
    cwd: multiplexServerPath,
  });
  console.log("Multiplex server dependencies installed.");
}

// const promises = [];
const fileNames: string[] = [];
const extraOpts = [
  {
    pathSuffix: "docs/playwright/embed-resources/issue-11860/main.qmd",
    options: ["--output-dir=inner"],
  }
]

for (const { path: fileName } of globOutput) {
  const input = fileName;
  const options: string[] = [];
  for (const extraOpt of extraOpts) {
    if (fileName.endsWith(extraOpt.pathSuffix)) {
      options.push(...extraOpt.options);
    }
  }

  // sigh, we have a race condition somewhere in
  // mediabag inspection if we don't wait all renders
  // individually. This is very slow..
  await execProcess({
    cmd: quartoDevCmd(),
    args: ["render", input, ...options],
  });
  fileNames.push(fileName);
}

Deno.test({
  name: "Playwright tests are passing", 
  // currently we run playwright tests only on Linux
  ignore: isWindows,
  fn: async () => {
    try {
      // run playwright
      const res = await execProcess({
        cmd: isWindows ? "npx.cmd" : "npx", 
        args: ["playwright", "test", "--ignore-snapshots"],
        cwd: "integration/playwright",
      });
      if (!res.success) {
        if (gha.isGitHubActions() && Deno.env.get("GITHUB_REPOSITORY") && Deno.env.get("GITHUB_RUN_ID")) {
          const runUrl = `https://github.com/${Deno.env.get("GITHUB_REPOSITORY")}/actions/runs/${Deno.env.get("GITHUB_RUN_ID")}`;
          gha.error(
            `Some tests failed. Download report uploaded as artifact at ${runUrl}`,
            {
              file: "playwright-tests.test.ts",
              title: "Playwright tests"
            }
          );
        }
        fail("Failed tests with playwright. Look at playwright report for more details.")
      }
      
    } finally {
      for (const fileName of fileNames) {
        cleanoutput(fileName, "html");
      }
    }
  }
});
