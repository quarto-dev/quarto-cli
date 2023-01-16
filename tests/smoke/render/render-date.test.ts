/*
* render-date.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "./render.ts";

const tests = [
  { input: docs("date/today.qmd"), noMatch: />today</ },
  { input: docs("date/lastmodified.qmd"), noMatch: />last-modified</ },
  { input: docs("date/fr.qmd"), match: /octobre/, noMatch: /October/ },
  { input: docs("date/fr-FR.qmd"), match: /octobre/, noMatch: /October/ },
  { input: docs("date/fr-CA.qmd"), match: /octobre/, noMatch: /October/ },
];

tests.forEach((test) => {
  const to = "html";
  const output = outputForInput(test.input, "html");

  const noMatch = test.noMatch ? [test.noMatch] : [];
  const match = test.match ? [test.match] : [];

  testRender(test.input, to, false, [
    ensureFileRegexMatches(output.outputPath, match, noMatch),
  ]);
});
