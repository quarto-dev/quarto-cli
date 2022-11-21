/*
* equations.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const equationsQmd = crossref("equations.qmd", "html");
testRender(equationsQmd.input, "html", false, [
  ensureHtmlElements(equationsQmd.output.outputPath, [
    "span#eq-black-scholes > span.math",
  ]),
  ensureFileRegexMatches(equationsQmd.output.outputPath, [
    /Equation&nbsp;1/,
  ], [
    /\?@eq-/,
  ]),
]);
