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
          assert(existsSync("docs/inspect/foo.json"));
          const json = JSON.parse(Deno.readTextFileSync("docs/inspect/foo.json"));
          assertObjectMatch(json.fileInformation["docs/inspect/foo.qmd"].includeMap[0],
          {
            source: input,
            target: "_bar.qmd"
          });
        }
      }
    ],
    {
      teardown: async () => {
        if (existsSync("docs/inspect/foo.json")) {
          Deno.removeSync("docs/inspect/foo.json");
        }
      }
    },
  );
})();
