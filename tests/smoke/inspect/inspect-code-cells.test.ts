/*
* inspect-code-cells.test.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/

import { assertObjectMatch } from "https://deno.land/std@0.93.0/assert/assert_object_match.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import {  } from "../../../src/project/types.ts";
import {
  ExecuteOutput,
  testQuartoCmd,
} from "../../test.ts";
import { assert } from "testing/asserts.ts";

(() => {
  const input = "docs/project/book/_include.qmd";
  const output = "docs/project/book/_include.json";
  testQuartoCmd(
    "inspect",
    [input, output],
    [
      {
        name: "inspect-code-cells",
        verify: async (outputs: ExecuteOutput[]) => {
          assert(existsSync(output));
          const json = JSON.parse(Deno.readTextFileSync(output));
          const info = json.fileInformation["docs/project/book/_include.qmd"];
          const codeCells = info.codeCells;
          assertObjectMatch(info.codeCells[0], { 
            start: 0,
            end: 3,
            source: "print(\"Hello, world\")\n",
            language: "python",
            metadata: {
              "echo": true
            }
          });
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
