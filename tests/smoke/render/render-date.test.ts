/*
* render-date.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "./render.ts";

const tests = [
  { input: docs("date/today.qmd"), noMatch: />today</ },
  { input: docs("date/lastmodified.qmd"), noMatch: />last-modified</ },
];

tests.forEach((test) => {
  const to = "html";
  const output = outputForInput(test.input, "html");
  testRender(test.input, to, false, [
    ensureFileRegexMatches(output.outputPath, [], [
      test.noMatch,
    ]),
  ]);
});
