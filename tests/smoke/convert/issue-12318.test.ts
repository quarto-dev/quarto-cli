/*
* convert-backticks.test.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/

import { existsSync } from "../../../src/deno_ral/fs.ts";
import {
  ExecuteOutput,
  test,
} from "../../test.ts";
import { assert } from "testing/asserts";
import { runQuarto } from "../../quarto-cmd.ts";

(() => {
  const input = "docs/convert/issue-12318";
  test({
    // The name of the test
    name: "issue-12318",
  
    // Sets up the test
    context: {
      teardown: async () => {
        if (existsSync(input + '.ipynb')) {
          Deno.removeSync(input + '.ipynb');
        }
      }
    },
  
    // Executes the test
    execute: async (logFile?: string) => {
      await runQuarto(["convert", "docs/convert/issue-12318.qmd"], {
        logFile,
        throwOnFailure: false,
      });
      await runQuarto(["convert", "docs/convert/issue-12318.ipynb", "--output", "issue-12318-2.qmd"], {
        logFile,
        throwOnFailure: false,
      });
      const txt = Deno.readTextFileSync("issue-12318-2.qmd");
      assert(!txt.includes('}```'), "Triple backticks found not at beginning of line");
    },
  
    verify: [],
    type: "unit"
  });
})();
