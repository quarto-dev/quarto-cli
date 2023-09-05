/*
* project-render.test.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";

import { Metadata } from "../../../src/config/types.ts";

import { testQuartoCmd, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import {
  directoryEmptyButFor,
  fileExists,
  verifyYamlFile,
} from "../../verify.ts";

import {
  cleanWorking,
  kProjectWorkingDir,
  kQuartoProjectFile,
} from "./common.ts";

const outDir = "_site";
const siteProjDir = docs("project/site");
const siteOutDir = join(siteProjDir, outDir);

testQuartoCmd(
  "render",
  [siteProjDir, "-o", "-"],
  [],
  {
    teardown: async () => {
      if (existsSync(siteOutDir)) {
        await Deno.remove(siteOutDir, { recursive: true });
      }
    }
  },
);
