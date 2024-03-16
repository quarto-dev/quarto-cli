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
  { file: "commonmark-plain.qmd", python: false },
  { file: "commonmark-r.qmd", python: false },
  { file: "commonmark-python.qmd", python: true },
  { file: "commonmark-julia.qmd", python: false },
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
