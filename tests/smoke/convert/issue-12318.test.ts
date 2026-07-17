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
import { noErrors } from "../../verify.ts";

(() => {
  const input = "docs/convert/issue-12318";
  const roundtrip = "issue-12318-2.qmd";
  test({
    // The name of the test
    name: "issue-12318",

    // Sets up the test
    context: {
      teardown: async () => {
        if (existsSync(input + '.ipynb')) {
          Deno.removeSync(input + '.ipynb');
        }
        if (existsSync(roundtrip)) {
          Deno.removeSync(roundtrip);
        }
      }
    },

    // Executes the test
    execute: async (logFile?: string) => {
      await runQuarto(["convert", input + ".qmd"], {
        logFile,
        throwOnFailure: false,
      });
      await runQuarto(["convert", input + ".ipynb", "--output", roundtrip], {
        logFile,
        throwOnFailure: false,
      });
    },

    // The harness catches execute() errors and turns them into log records,
    // so assertions must live in verifiers (an empty verify list would pass
    // silently on failure) - noErrors surfaces convert failures first.
    verify: [
      noErrors,
      {
        name: "no triple backticks mid-line after roundtrip",
        verify: (_outputs: ExecuteOutput[]) => {
          const txt = Deno.readTextFileSync(roundtrip);
          assert(!txt.includes('}```'), "Triple backticks found not at beginning of line");
          return Promise.resolve();
        },
      },
    ],
    type: "unit"
  });
})();
