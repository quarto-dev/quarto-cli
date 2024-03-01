/*
* inspect-include.test.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/
import { existsSync } from "../../../src/deno_ral/fs.ts";
import {
  ExecuteOutput,
  testQuartoCmd,
} from "../../test.ts";
import { assert } from "testing/asserts.ts";

(() => {
  const input = "docs/inspect/foo.qmd";
  const output = "docs/inspect/foo.json";
  testQuartoCmd(
    "convert",
    [input, output],
    [
      {
        name: "inspect-include",
        verify: async (outputs: ExecuteOutput[]) => {
          assert(existsSync("docs/inspect/foo.json"));
          const json = JSON.parse(Deno.readTextFileSync("docs/inspect/foo.json"));
          assert(json.fileInformation["docs/inspect/foo.qmd"].includeMap["docs/inspect/foo.qmd"] === "_bar.qmd");
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
