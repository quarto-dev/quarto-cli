/*
* syntax.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const syntaxQmd = crossref("syntax.qmd", "html");
testRender(syntaxQmd.input, "html", false, [
  ensureFileRegexMatches(syntaxQmd.output.outputPath, [
    /<div class="figtest-default">[^]*?>fig.&nbsp;1<[^]*?<\/div>/,
    /<div class="figtest-capitalized">[^]*?>Fig.&nbsp;1<[^]*?<\/div>/,
    /<div class="figtest-prefix">[^]*?>Figure&nbsp;1<[^]*?<\/div>/,
    /<div class="figtest-noprefix">[^]*?>1<[^]*?<\/div>/,
  ], [
    /\?@fig-/,
  ]),
]);
