/*
* docs/convert/issue-12440.test.ts
*
* Copyright (C) 2025 Posit Software, PBC
*
*/
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { quarto } from "../../../src/quarto.ts";
import {
  ExecuteOutput,
  testQuartoCmd,
  removeFilesTeardown,
} from "../../test.ts";
import { assert } from "testing/asserts";

(() => {
  const input = "docs/convert/issue-12440.qmd";
  testQuartoCmd(
    "convert",
    ["docs/convert/issue-12440.qmd"],
    [
      {
        name: "convert-mixed-yaml-markdown-cell",
        verify: async (outputs: ExecuteOutput[]) => {
          await quarto([
            "convert",
            "docs/convert/issue-12440.ipynb",
            "--output",
            "docs/convert/issue-12440-out.qmd",
          ]);
          const txt = Deno.readTextFileSync("docs/convert/issue-12440-out.qmd");
          assert(txt.includes("title: This is what happens when I don't set the title"), "Markdown text not found in output");
        }
      }
    ],
    removeFilesTeardown([
      "docs/convert/issue-12440-out.qmd",
      "docs/convert/issue-12440.ipynb"
    ]),
  );
})();
