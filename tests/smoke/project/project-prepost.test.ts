/*
* project-prepost.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";

import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrors, printsMessage } from "../../verify.ts";

const renderDir = docs("project/prepost/mutate-render-list");
const dir = join(Deno.cwd(), renderDir);
const outDir = join(dir, "_site");

const sidebarContents = ["sidebar/test1.html", "sidebar/test2.html"]
const sidebarContentsExists = sidebarContents.map((path) => {
  return fileExists(join(outDir, path))
});

testQuartoCmd(
  "render",
  [renderDir],
  [noErrors, ...sidebarContentsExists],
  {
    teardown: async () => {
      if (existsSync(outDir)) {
        await Deno.remove(outDir, { recursive: true });
      }
    },
  },
);



// Tests that if the pre-renderf script mutates the output directory
// we throw an error that complains about this.
const mutateRenderDir = docs("project/prepost/invalid-mutate");
const mutateRenderDirAbs = join(Deno.cwd(), mutateRenderDir);
const mutateRenderOutDir = join(mutateRenderDirAbs, "_site");

testQuartoCmd(
  "render",
  [mutateRenderDir],
  [printsMessage("ERROR", /output-dir may not be mutated/gm)],
  {
    teardown: async () => {
      const mdClean = join(mutateRenderDirAbs, "_metadata.yml");
      console.log({mdClean});
      if (existsSync(mdClean)) {
        await Deno.remove(mdClean);
      }
      if (existsSync(mutateRenderOutDir)) {
        await Deno.remove(mutateRenderOutDir, { recursive: true });
      }
    },
  },
);
