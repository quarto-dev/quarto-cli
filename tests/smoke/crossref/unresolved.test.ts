/*
* unresolved.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const simplunresolvedQmd = crossref("unresolved.qmd", "html");
testRender(simplunresolvedQmd.input, "html", false, [
  ensureFileRegexMatches(simplunresolvedQmd.output.outputPath, [
    /Figure&nbsp;1: Elephant/,
    /\?@fig-/,
  ]),
]);
