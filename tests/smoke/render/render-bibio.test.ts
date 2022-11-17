/*
* render-biblio.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "./render.ts";

const input = docs("biblio/author.qmd");

["bibtex", "biblatex", "csljson"].forEach((format) => {
  const output = outputForInput(input, format);
  testRender(input, format, true, [
    ensureFileRegexMatches(output.outputPath, [/.*2009.*/]),
  ]);
});
