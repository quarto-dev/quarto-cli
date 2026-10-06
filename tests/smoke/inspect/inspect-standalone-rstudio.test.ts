/*
* inspect-standalone-rstudio.test.ts
*
* Copyright (C) 2020-2026 Posit Software, PBC
*
*/

import { _setIsRStudioForTest } from "../../../src/core/platform.ts";
import { isBinaryMode } from "../../quarto-cmd.ts";
import { testQuartoCmdJson } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";

// Dev mode uses the test hook to avoid process-global environment races.
// Binary mode passes RSTUDIO=1 to the spawned Quarto.
(() => {
  const input = "docs/inspect/standalone-hello.qmd";
  const output = "docs/inspect/standalone-hello.json";
  testQuartoCmdJson(
    "inspect",
    [input, output],
    output,
    "inspect-standalone-no-project-in-rstudio",
    (json) => {
      assertEquals(json.project, undefined,
        "Standalone file inspect should not emit 'project' when in RStudio");
    },
    {
      env: isBinaryMode() ? { RSTUDIO: "1" } : undefined,
      setup: async () => {
        if (!isBinaryMode()) {
          _setIsRStudioForTest(true);
        }
      },
      teardown: async () => {
        if (!isBinaryMode()) {
          _setIsRStudioForTest(undefined);
        }
      }
    },
  );
})();

// Test: standalone file inspect WITHOUT RStudio should still emit project
(() => {
  const input = "docs/inspect/standalone-hello.qmd";
  const output = "docs/inspect/standalone-hello-nors.json";
  testQuartoCmdJson(
    "inspect",
    [input, output],
    output,
    "inspect-standalone-has-project-outside-rstudio",
    (json) => {
      assert(json.project !== undefined,
        "Standalone file inspect should emit 'project' when not in RStudio");
      assert(json.project.dir !== undefined,
        "project.dir should be set");
    },
  );
})();
