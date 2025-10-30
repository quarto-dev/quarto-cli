/*
* inspect-extensions.test.ts
*
* Copyright (C) 2025 Posit Software, PBC
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
  const input = "docs/inspect/website-with-extensions/extension-test";
  const output = "docs/inspect/website-with-extensions.json";
  testQuartoCmd(
    "inspect",
    [input, output],
    [
      {
        name: "inspect-extensions",
        verify: async (outputs: ExecuteOutput[]) => {
          assert(existsSync(output));
          const json = JSON.parse(Deno.readTextFileSync(output));
          assert(json.extensions.length === 2);
          // 0 is julia-engine
          assertEquals(json.extensions[1].title, "Auto Dark Mode");
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
