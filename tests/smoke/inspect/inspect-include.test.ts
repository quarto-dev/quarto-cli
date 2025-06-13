/*
* inspect-include.test.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/
import { assertObjectMatch } from "https://deno.land/std@0.93.0/assert/assert_object_match.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import {
  ExecuteOutput,
  testQuartoCmd,
} from "../../test.ts";
import { assert } from "testing/asserts";
import { normalizePath } from "../../../src/core/path.ts";

(() => {
  const input = "docs/inspect/foo.qmd";
  const output = "docs/inspect/foo.json";
  testQuartoCmd(
    "inspect",
    [input, output],
    [
      {
        name: "inspect-include",
        verify: async (outputs: ExecuteOutput[]) => {
          assert(existsSync(output));
          const normalizedPath = normalizePath(input);
          const json = JSON.parse(Deno.readTextFileSync(output));
          assertObjectMatch(json.fileInformation[normalizedPath].includeMap[0],
          {
            source: normalizedPath,
            target: "_bar.qmd"
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
