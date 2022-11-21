/*
* render-r.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { fileLoader } from "../../utils.ts";
import { ensureHtmlElements } from "../../verify.ts";
import { testRender } from "./render.ts";

const doc = fileLoader("code-highlighting")(
  "code-line-number-knitr.qmd",
  "html",
);
testRender(doc.input, "html", false, [
  ensureHtmlElements(
    doc.output.outputPath,
    ["#with-numbering div.cell-code > pre.number-lines"],
    ["#no-numbering div.cell-code > pre.number-lines"],
  ),
]);
