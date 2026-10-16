/*
* convert-issue-12042.test.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/
import { existsSync } from "../../../src/deno_ral/fs.ts";
import {
  ExecuteOutput,
  testQuartoCmd,
} from "../../test.ts";
import { assert } from "testing/asserts";

(() => {
  testQuartoCmd(
    "convert",
    ["docs/convert/issue-12042.ipynb"],
    [
      {
        name: "convert-markdown-after-yaml",
        verify: async (outputs: ExecuteOutput[]) => {
          const txt = Deno.readTextFileSync("docs/convert/issue-12042.qmd");
          assert(txt.includes("Here I place some text."), "Markdown text not found in output");
        }
      }
    ],
    {
      teardown: async () => {
        if (existsSync("docs/convert/issue-12042.qmd")) {
          Deno.removeSync("docs/convert/issue-12042.qmd");
        }
      }
    },
  );
})();
