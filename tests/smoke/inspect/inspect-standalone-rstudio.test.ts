/*
* inspect-standalone-rstudio.test.ts
*
* Copyright (C) 2020-2026 Posit Software, PBC
*
*/

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { _setIsRStudioForTest } from "../../../src/core/platform.ts";
import {
  ExecuteOutput,
  testQuartoCmd,
} from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";

// Test: standalone file inspect with RStudio override should NOT emit project.
// Uses _setIsRStudioForTest to avoid Deno.env.set() race conditions in
// parallel tests (see #14218, PR #12621).
(() => {
  const input = "docs/inspect/standalone-hello.qmd";
  const output = "docs/inspect/standalone-hello.json";
  testQuartoCmd(
    "inspect",
    [input, output],
    [
      {
        name: "inspect-standalone-no-project-in-rstudio",
        verify: async (_outputs: ExecuteOutput[]) => {
          assert(existsSync(output));
          const json = JSON.parse(Deno.readTextFileSync(output));
          assertEquals(json.project, undefined,
            "Standalone file inspect should not emit 'project' when in RStudio");
        }
      }
    ],
    {
      setup: async () => {
        _setIsRStudioForTest(true);
      },
      teardown: async () => {
        _setIsRStudioForTest(undefined);
        if (existsSync(output)) {
          Deno.removeSync(output);
        }
      }
    },
  );
})();

// Test: standalone file inspect WITHOUT RStudio should still emit project
(() => {
  const input = "docs/inspect/standalone-hello.qmd";
  const output = "docs/inspect/standalone-hello-nors.json";
  testQuartoCmd(
    "inspect",
    [input, output],
    [
      {
        name: "inspect-standalone-has-project-outside-rstudio",
        verify: async (_outputs: ExecuteOutput[]) => {
          assert(existsSync(output));
          const json = JSON.parse(Deno.readTextFileSync(output));
          assert(json.project !== undefined,
            "Standalone file inspect should emit 'project' when not in RStudio");
          assert(json.project.dir !== undefined,
            "project.dir should be set");
        }
      }
    ],
    {
      teardown: async () => {
        if (existsSync(output)) {
          Deno.removeSync(output);
        }
      }
    },
  );
})();
