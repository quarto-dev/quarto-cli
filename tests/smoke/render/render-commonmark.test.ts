/*
* render.jupyter.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { join } from "../../../src/deno_ral/path.ts";
import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "./render.ts";

const tests = [
  { file: "commonmark-plain.qmd" },
  { file: "commonmark-r.qmd" },
  { file: "commonmark-python.qmd"},
  { file: "commonmark-julia.qmd" },
  { file: "commonmark-julianative.qmd" },
];
tests.forEach((test) => {
  const input = docs(join("markdown", test.file));
  const output = outputForInput(input, "commonmark");
  testRender(
    input,
    "commonmark",
    true,
    [ensureFileRegexMatches(output.outputPath, [
      /^# test$/gm,
    ])],
  );
});
