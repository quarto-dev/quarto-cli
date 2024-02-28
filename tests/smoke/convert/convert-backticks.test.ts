/*
* convert-backticks.test.ts
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
  const input = "docs/convert/backticks.ipynb";
  testQuartoCmd(
    "convert",
    ["docs/convert/backticks.ipynb"],
    [
      {
        name: "convert-enough-backticks",
        verify: async (outputs: ExecuteOutput[]) => {
          const txt = Deno.readTextFileSync("docs/convert/backticks.qmd");
          assert(txt.includes("````"), "Not enough backticks in output");
        }
      }
    ],
    {
      teardown: async () => {
        if (existsSync("docs/convert/backticks.qmd")) {
          Deno.removeSync("docs/convert/backticks.qmd");
        }
      }
    },
  );
})();
