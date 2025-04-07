/*
* check.test.ts
*
* Copyright (C) 2020-2025 Posit Software, PBC
*
*/

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { ExecuteOutput, testQuartoCmd } from "../../test.ts";

(() => {
  const output = "docs/check.json";
  testQuartoCmd(
    "check",
    ["--output", output],
    [
      {
        name: "check-json",
        verify: async (_outputs: ExecuteOutput[]) => {
          const txt = Deno.readTextFileSync(output);
          const json = JSON.parse(txt);
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
