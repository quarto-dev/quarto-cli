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
import { fileExists, noErrors, printsMessage, validJsonWithFields, verifyNoPath, verifyPath } from "../../verify.ts";
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



// Tests that if the pre-render script mutates the output directory
// we throw an error that complains about this.
const mutateRenderDir = docs("project/prepost/invalid-mutate");
const mutateRenderDirAbs = join(Deno.cwd(), mutateRenderDir);
const mutateRenderOutDir = join(mutateRenderDirAbs, "_site");

testQuartoCmd(
  "render",
  [mutateRenderDir],
  [printsMessage({level: "ERROR", regex: /output-dir may not be mutated/gm})],
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
  // assertions live in verify (teardown assertions skip cleanup on failure);
  // noErrors keeps the purely-negative i-exist check from passing vacuously
  // on a failed render
  [noErrors, {
    name: "prepost extension file effects",
    verify: async () => {
      verifyNoPath(join(docs("project/prepost/extension"), "i-exist.txt"));
      verifyPath(join(docs("project/prepost/extension"), "i-was-created.txt"));
    }
  }],
  {
    teardown: async () => {
      safeRemoveIfExists(join(docs("project/prepost/extension"), "i-was-created.txt"));
      const siteDir = join(docs("project/prepost/extension"), "_site");
      if (existsSync(siteDir)) {
        await Deno.remove(siteDir, { recursive: true });
      }
    }
  });

  testQuartoCmd(
    "render",
    [docs("project/prepost/issue-10828")],
    // assertions live in verify, not teardown (an empty verify list
    // asserted nothing about the render itself)
    [noErrors, {
      name: "project input/output files written",
      verify: async () => {
        verifyPath(normalizePath(docs("project/prepost/issue-10828/input-files.txt")));
        verifyPath(normalizePath(docs("project/prepost/issue-10828/output-files.txt")));
      }
    }],
    {
      env: {
        "QUARTO_USE_FILE_FOR_PROJECT_INPUT_FILES": normalizePath(docs("project/prepost/issue-10828/input-files.txt")),
        "QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES": normalizePath(docs("project/prepost/issue-10828/output-files.txt"))
      },
      teardown: async () => {
        safeRemoveIfExists(normalizePath(docs("project/prepost/issue-10828/input-files.txt")));
        safeRemoveIfExists(normalizePath(docs("project/prepost/issue-10828/output-files.txt")));
        const siteDir = join(docs("project/prepost/issue-10828"), "_site");
        if (existsSync(siteDir)) {
          await Deno.remove(siteDir, { recursive: true });
        }
      }
    }
  )

// Verify that pre-render scripts receive QUARTO_PROJECT_SCRIPT_PROGRESS
// and QUARTO_PROJECT_SCRIPT_QUIET environment variables
const scriptEnvDir = docs("project/prepost/script-env-vars");
const scriptEnvDirAbs = join(Deno.cwd(), scriptEnvDir);
const envDumpPath = join(scriptEnvDirAbs, "env-dump.json");
const scriptEnvOutDir = join(scriptEnvDirAbs, "_site");

testQuartoCmd(
  "render",
  [scriptEnvDir],
  [
    noErrors,
    validJsonWithFields(envDumpPath, {
      progress: "1",
      quiet: "0",
    }),
  ],
  {
    teardown: async () => {
      safeRemoveIfExists(envDumpPath);
      if (existsSync(scriptEnvOutDir)) {
        await Deno.remove(scriptEnvOutDir, { recursive: true });
      }
    },
  },
);
