/*
 * issue-10575.test.ts
 * 
 * https://github.com/quarto-dev/quarto-cli/issues/10575
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { quarto } from "../../../src/quarto.ts";
import { testQuartoCmd } from "../../test.ts";
import { printsMessage } from "../../verify.ts";

testQuartoCmd("render",
  ["docs/jupyter/issue-10575.ipynb"],
  [
    printsMessage({level: "WARN", regex: /contains unexecuted code cells/}),
  ],
    {
      teardown: async () => {
        if (existsSync("docs/jupyter/issue-10575_files")) {
          await Deno.remove("docs/jupyter/issue-10575_files", { recursive: true });
        }
        if (existsSync("docs/jupyter/issue-10575.html")) {
          await Deno.remove("docs/jupyter/issue-10575.html");
        }
      },
    },
  );
