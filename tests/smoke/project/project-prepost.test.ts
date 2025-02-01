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
import { fileExists, noErrors, printsMessage, verifyNoPath, verifyPath } from "../../verify.ts";
import { normalizePath, safeRemoveIfExists } from "../../../src/core/path.ts";

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

testQuartoCmd(
  "render",
  [docs("project/prepost/extension")],
  [{
    name: "i-exist.txt exists",
    verify: async () => {
      const path = join(docs("project/prepost/extension"), "i-exist.txt");
      verifyNoPath(path);
    }
  }],
  {
    teardown: async () => {
      const path = join(docs("project/prepost/extension"), "i-was-created.txt");
      verifyPath(path);
      safeRemoveIfExists(path);
    }
  });

  testQuartoCmd(
    "render",
    [docs("project/prepost/issue-10828")],
    [],
    {
      env: {
        "QUARTO_USE_FILE_FOR_PROJECT_INPUT_FILES": normalizePath(docs("project/prepost/issue-10828/input-files.txt")),
        "QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES": normalizePath(docs("project/prepost/issue-10828/output-files.txt"))
      },
      teardown: async () => {
        const inputPath = normalizePath(docs("project/prepost/issue-10828/input-files.txt"));
        const outputPath = normalizePath(docs("project/prepost/issue-10828/output-files.txt"));
        verifyPath(inputPath);
        safeRemoveIfExists(inputPath);
        verifyPath(outputPath);
        safeRemoveIfExists(outputPath);
      }
    }
  )