/*
* inspect-recursive-include.test.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/
import { assertObjectMatch } from "https://deno.land/std@0.93.0/assert/assert_object_match.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { FileInclusion } from "../../../src/project/types.ts";
import {
  ExecuteOutput,
  testQuartoCmd,
} from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";

(() => {
  const input = "docs/websites/issue-9253/index.qmd";
  const output = "docs/websites/issue-9253/index.json";
  testQuartoCmd(
    "inspect",
    [input, output],
    [
      {
        name: "inspect-include",
        verify: async (outputs: ExecuteOutput[]) => {
          assert(existsSync(output));
          const json = JSON.parse(Deno.readTextFileSync(output));
          const info = json.fileInformation["docs/websites/issue-9253/index.qmd"];
          const includeMap: FileInclusion[] = info.includeMap;
          assertObjectMatch(info.includeMap[0], { target: "_include.qmd" });
          assertObjectMatch(info.includeMap[1], { source: "_include.qmd", target: "_include2.qmd" });
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
