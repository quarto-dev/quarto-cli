/*
* render.latex-output.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { docs } from "../../utils.ts";
import { renderVerifyLatexOutput } from "./render.ts";

renderVerifyLatexOutput(docs("latex-output/captionless-margin-image.qmd"), [
  /\\begin{marginfigure}/,
]);
renderVerifyLatexOutput(docs("latex-output/figure-div.qmd"), [
  /{\\centering/,
  /\\caption{\\label{fig-foo}This is the figure}/,
  /See Figure~\\ref{fig-foo} for more\./,
]);
