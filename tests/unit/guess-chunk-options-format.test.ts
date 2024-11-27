/*
* guess-chunk-option-format.test.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { guessChunkOptionsFormat } from "../../src/core/lib/guess-chunk-options-format.ts";

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";

// deno-lint-ignore require-await
unitTest("guess-chunk-options-format-test", async () => {
  const knitrOptionsChunk = `rmdworkflow,
echo = FALSE,
fig.cap = "A diagram illustrating how an R Markdown document
  is converted to the final output document.",
out.width = "100%"`;
  const yamlOptionsChunk = `foo: "echo = FALSE"`;
  assert(guessChunkOptionsFormat(knitrOptionsChunk) === "knitr");
  assert(guessChunkOptionsFormat(yamlOptionsChunk) === "yaml");
});
