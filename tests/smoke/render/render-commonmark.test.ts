/*
* render.jupyter.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "./render.ts";

const tests = [
  { file: "commonmark-plain.qmd", python: false },
  { file: "commonmark-r.qmd", python: false },
  { file: "commonmark-python.qmd", python: true },
];
tests.forEach((test) => {
  const input = docs(join("markdown", test.file));
  const output = outputForInput(input, "commonmark");
  testRender(
    input,
    "commonmark",
    true,
    [ensureFileRegexMatches(output.outputPath, [
      /test\n================/,
    ])],
  );
});
