/*
* render-text-highlighting.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "./render.ts";

const codeblockBg = (color: string) => {
  return new RegExp(
    `div.sourceCode pre.sourceCode {[\r\n]+\s*color: ${color};`,
    "gm",
  );
};

const tests = [
  {
    to: "html",
    input: docs("text-highlighting/default.qmd"),
    match: codeblockBg("#00769E"),
  },
  {
    to: "html",
    input: docs("text-highlighting/dark.qmd"),
    match: codeblockBg("#f8f8f2"),
  },
  {
    to: "html",
    input: docs("text-highlighting/github-dark.qmd"),
    match: codeblockBg("#e1e4e8"),
  },
  {
    to: "html",
    input: docs("text-highlighting/user-simple.qmd"),
    nomatch: codeblockBg("#f8f8f8"),
  },
  {
    to: "html",
    input: docs("text-highlighting/user-complex.qmd"),
    nomatch: codeblockBg("#2a211c"),
  },
  {
    to: "latex",
    input: docs("text-highlighting/github-pdf.qmd"),
    match: /begin{tcolorbox}/,
  },
  {
    to: "latex",
    input: docs("text-highlighting/vimdark-pdf.qmd"),
    match: /definecolor{shadecolor}{RGB}{0,0,0}/,
  },
];

tests.forEach((test) => {
  const output = outputForInput(test.input, test.to);
  testRender(test.input, test.to, test.to !== "html", [
    ensureFileRegexMatches(
      output.outputPath,
      test.match ? [test.match] : [],
      test.nomatch ? [test.nomatch] : [],
    ),
  ]);
});
