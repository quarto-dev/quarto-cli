/*
 * project-prepost-space-in-path.test.ts
 *
 * Regression test for issue #13751: Error when running post-render script
 * from extension in project with space in path
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrors} from "../../verify.ts";
import { safeRemoveIfExists } from "../../../src/core/path.ts";

// Test rendering a project with spaces in its path
// The extension's post-render script should execute successfully and create a marker file
const projectDir = docs("project/prepost/space in path");
const markerPath = join(projectDir, "extension-post-render-executed.txt");
const siteDir = join(projectDir, "_site");
testQuartoCmd(
  "render",
  [projectDir],
  [noErrors, fileExists(markerPath)],
  {
    teardown: async () => {
      safeRemoveIfExists(markerPath);
      safeRemoveIfExists(siteDir);
    },
  },
);
