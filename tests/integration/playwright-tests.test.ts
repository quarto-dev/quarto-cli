/*
 * smoke-all.test.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 *
 */

import { expandGlobSync } from "fs/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../src/core/lib/yaml-validation/state.ts";
import { cleanoutput } from "../smoke/render/render.ts";
import { execProcess } from "../../src/core/process.ts";
import { lookup } from "media_types/mod.ts";

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
  // mediabag inspection if we don't wait all renders. This
  // is very slow..
  await execProcess({
    cmd: ["quarto", "render", input, "--to", "html"],
  });
  fileNames.push(fileName);
}

const ac = new AbortController();
const basePath = "docs/playwright";
const handle = async (req: Request) => {
  if (req.url === "/stop") {
    ac.abort();
  }

  const filePath = basePath + new URL(req.url).pathname;
  let fileSize;
  try {
    fileSize = (await Deno.stat(filePath)).size;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return new Response(null, { status: 404 });
    }
    return new Response(null, { status: 500 });
  }
  const body = Deno.readFileSync(filePath);
  return new Response(body, {
    headers: {
      "content-length": fileSize.toString(),
      "content-type": lookup(filePath) || "application/octet-stream",
    },
  });
};

const serverPromise = Deno.serve(handle, {
  port: 8080, // FIXME: use random port
  signal: ac.signal,
});

try {
  // run playwright
  await execProcess({
    cmd: ["npx", "playwright", "test"],
    cwd: "integration/playwright",
  });
} finally {
  // cleanup
  ac.abort();
  await serverPromise;
  for (const fileName of fileNames) {
    cleanoutput(fileName, "html");
  }
}
