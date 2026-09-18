/*
* inspect-cleanup.test.ts
*
* Copyright (C) 2020-2025 Posit Software, PBC
*
*/

import { existsSync } from "../../../src/deno_ral/fs.ts";
import {  } from "../../../src/project/types.ts";
import {
  ExecuteOutput,
  testQuartoCmd,
} from "../../test.ts";
import { assert } from "testing/asserts";

(() => {
  const input = "docs/inspect/cleanup-issue-12336/cleanup-bug.qmd";
  const output = "docs/inspect/cleanup-issue-12336/cleanup-bug.json";
  testQuartoCmd(
    "inspect",
    [input, output],
    [
      {
        name: "inspect-code-cells",
        verify: async (outputs: ExecuteOutput[]) => {
          assert(existsSync(output));
          const json = JSON.parse(Deno.readTextFileSync(output));
          assert(json.fileInformation["docs/inspect/cleanup-issue-12336/cleanup-bug.qmd"].metadata.engine === "jupyter");
          assert(!existsSync("docs/inspect/cleanup-issue-12336/cleanup-bug.quarto_ipynb"));
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
)})();