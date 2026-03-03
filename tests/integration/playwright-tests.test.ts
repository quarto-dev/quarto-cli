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
import { join, relative } from "../../src/deno_ral/path.ts";
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
  await execProcess({
    cmd: isWindows ? "npm.cmd" : "npm",
    args: ["install", "--loglevel=error"],
    cwd: multiplexServerPath,
  });
  console.log("Multiplex server dependencies installed.");
}

// const promises = [];
const fileNames: string[] = [];

// To avoid re-rendering, see QUARTO_PLAYWRIGHT_SKIP_RENDER env var
if (Deno.env.get("QUARTO_PLAYWRIGHT_TESTS_SKIP_RENDER") === "true") {
  console.log("Skipping render of test documents.");
} else {
  const extraOpts = [
    {
      pathSuffix: "docs/playwright/embed-resources/issue-11860/main.qmd",
      options: ["--output-dir=inner"],
    }
  ]

  for (const { path: fileName } of globOutput) {
    const input = relative(Deno.cwd(), fileName);
    const options: string[] = [];
    for (const extraOpt of extraOpts) {
      if (fileName.endsWith(extraOpt.pathSuffix)) {
        options.push(...extraOpt.options);
      }
    }

    // sigh, we have a race condition somewhere in
    // mediabag inspection if we don't wait all renders
    // individually. This is very slow..
    console.log(`Rendering ${input}...`);
    const result = await execProcess({
      cmd: quartoDevCmd(),
      args: ["render", input, ...options],
      stdout: "piped",
      stderr: "piped",
    });

    if (!result.success) {
      gha.error(`Failed to render ${input}`)
      if (result.stdout) console.log(result.stdout);
      if (result.stderr) console.error(result.stderr);
      throw new Error(`Render failed with code ${result.code}`);
    }

    fileNames.push(fileName);
  }
}

Deno.test({
  name: "Playwright tests are passing", 
  // currently we run playwright tests only on Linux
  ignore: gha.isGitHubActions() && isWindows,
  fn: async () => {
    try {
      // run playwright
      const res = await execProcess({
        cmd: isWindows ? "npx.cmd" : "npx",
        args: ["playwright", "test", "--ignore-snapshots"],
        cwd: "integration/playwright",
      },
      undefined, // stdin
      undefined, // mergeOutput
      undefined, // stderrFilter
      true       // respectStreams - write directly to stderr/stdout
      );
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
      // skip cleanoutput if requested
      if (Deno.env.get("QUARTO_PLAYWRIGHT_TESTS_SKIP_CLEANOUTPUT") === "true" || Deno.env.get("QUARTO_PLAYWRIGHT_TESTS_SKIP_RENDER") === "true") {
        console.log("Skipping cleanoutput of test documents.");
      } else 
        for (const fileName of fileNames) {
          cleanoutput(fileName, "html");
        }
    }
  }
});
