/*
* render.latext-output.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "./render.ts";

const renderVerifyLatexOutput = (input: string, regexes: RegExp[]) => {
  const teXOutput = outputForInput(input, "latex");
  testRender(input, "latex", true, [
    ensureFileRegexMatches(teXOutput.outputPath, regexes),
  ]);
};

renderVerifyLatexOutput(docs("latex-output/captionless-margin-image.qmd"), [
  /\\begin{marginfigure}/,
]);
renderVerifyLatexOutput(docs("latex-output/figure-div.qmd"), [
  /{\\centering/,
  /\\caption{\\label{fig-foo}This is the figure}/,
  /See Figure~\\ref{fig-foo} for more\./,
]);
