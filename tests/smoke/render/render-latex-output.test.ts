/*
 * render.latex-output.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { renderVerifyLatexOutput } from "./render.ts";

renderVerifyLatexOutput(docs("latex-output/captionless-margin-image.qmd"), [
  /{\\marginnote{\\begin{footnotesize}\\pandocbounded{\\includegraphics\[keepaspectratio\]{/,
  // /{\\marginnote{\\begin{footnotesize}\\pandocbounded{\\includegraphics{/,
]);
renderVerifyLatexOutput(docs("latex-output/figure-div.qmd"), [
  /\\centering{/,
  /\\caption{\\label{fig-foo}This is the figure}/,
  /See Figure~\\ref{fig-foo} for more\./,
]);
