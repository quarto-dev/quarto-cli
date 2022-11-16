/*
* include-engine-detection.test.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { fileLoader } from "../../utils.ts";
import { ensureHtmlSelectorSatisfies } from "../../verify.ts";
import { testRender } from "../render/render.ts";

const qmd = fileLoader("engine")("test-include-engine-detection.qmd", "html");
testRender(qmd.input, "html", false, [
  ensureHtmlSelectorSatisfies(
    qmd.output.outputPath,
    "p",
    (nodelist) => {
      return Array.from(nodelist).map((x) => x.textContent).some((x) =>
        x.indexOf("1001") !== -1
      );
    },
  ),
]);
