/*
 * issue-11990.test.ts
 * 
 * https://github.com/quarto-dev/quarto-cli/issues/11990
 * 
 * Copyright (C) 2025 Posit Software, PBC
 */

import { join } from "../../../src/deno_ral/path.ts";
import { docs, outputForInput } from "../../utils.ts";
import { noErrorsOrWarnings, ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "../render/render.ts";

const format = "html";
const input = docs(join("jupyter", "parameters", "issue-11990.qmd"));
const output = outputForInput(input, format);

testRender(input, format, false, [
  noErrorsOrWarnings,
  ensureFileRegexMatches(output.outputPath, [], [
    "Injected Parameters"
  ]),
], {}, ["--no-execute-daemon", "--execute-param", "username:John"]);
