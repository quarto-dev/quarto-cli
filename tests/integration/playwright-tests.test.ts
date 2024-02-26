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

async function fullInit() {
  await initYamlIntelligenceResourcesFromFilesystem();
}

const globOutput = Deno.args.length
  ? expandGlobSync(Deno.args[0])
  : expandGlobSync(
    "docs/playwright/**/*.qmd",
  );

setInitializer(fullInit);
await initState();

// const promises = [];
const fileNames = [];

for (const { path: fileName } of globOutput) {
  const input = fileName;

  // sigh, we have a race condition somewhere in
  // mediabag inspection if we don't wait all renders
  // individually. This is very slow..
  await execProcess(quartoDevCmd(), {
    args: ["render", input, "--to", "html"],
  });
  fileNames.push(fileName);
}

// start a web server
// This is attempt #3
// attempt #1 through Deno.server causes hangs on repeated requests
// attempt #2 through http/server causes a deno vendor crash: https://github.com/denoland/deno/issues/16861

// we'll just use python :facepalm:

const proc = Deno.run({
  cmd: ["python", "-m", "http.server", "8080"],
  cwd: "docs/playwright",
});

try {
  // run playwright
  await execProcess(Deno.build.os == "windows" ? "npx.cmd" : "npx", {
    args: ["playwright", "test"],
    cwd: "integration/playwright",
  });
} finally {
  // cleanup
  proc.kill();
  proc.close();
  for (const fileName of fileNames) {
    cleanoutput(fileName, "html");
  }
}
