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
  await execProcess({
    cmd: [quartoDevCmd(), "render", input, "--to", "html"],
  });
  fileNames.push(fileName);
}


try {
  // run playwright
  await execProcess({
    cmd: [Deno.build.os == "windows" ? "npx.cmd" : "npx", "playwright", "test"],
    cwd: "integration/playwright",
  });
} finally {
  for (const fileName of fileNames) {
    cleanoutput(fileName, "html");
  }
}
