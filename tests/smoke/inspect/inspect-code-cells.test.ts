/*
* inspect-code-cells.test.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/

import { assertObjectMatch } from "https://deno.land/std@0.93.0/assert/assert_object_match.ts";
import {  } from "../../../src/project/types.ts";
import { testQuartoCmdJson } from "../../test.ts";

(() => {
  const input = "docs/project/book/_include.qmd";
  const output = "docs/project/book/_include.json";
  testQuartoCmdJson(
    "inspect",
    [input, output],
    output,
    "inspect-code-cells",
    (json) => {
      const info = json.fileInformation["docs/project/book/_include.qmd"];
      const codeCells = info.codeCells;
      assertObjectMatch(info.codeCells[0], { 
        start: 0,
        end: 3,
        source: "print(\"Hello, world\")\n",
        language: "python",
        metadata: {
          "echo": true
        }
      });
    },
  );


  
})();

(() => {
  const input = "docs/inspect/10039.qmd";
  const output = "docs/inspect/_10039.json";
  testQuartoCmdJson(
    "inspect",
    [input, output],
    output,
    "inspect-tagged-metadata",
    (json) => {
      const info = json.fileInformation["docs/inspect/10039.qmd"];
      const codeCells = info.codeCells;
      assertObjectMatch(info.codeCells[1], {
        "start": 14,
        "end": 18,
        "file": "docs/inspect/10039.qmd",
        "source": "p[[1]]\n",
        "language": "r",
        "metadata": {
          "label": "plot",
          "fig-cap": {
            "value": "names(p)[[1]]",
            "tag": "!expr"
          }
        }
      });
    },
  );
})();
