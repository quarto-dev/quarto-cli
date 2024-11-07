/*
 * cache.test.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */
import { fileLoader, setEnvVar, restoreEnvVar } from "../../utils.ts";
import { testRender } from "../render/render.ts";
import { ensureFileRegexMatches, noErrorsOrWarnings } from "../../verify.ts";

// Default case should not error
const rscriptArgsDoc = fileLoader()("knitr/rscript-args.qmd", "markdown_strict");
testRender(rscriptArgsDoc.input, "markdown_strict", true, [
  noErrorsOrWarnings,
]);

// Set special flag through env var
let rscriptArgs: string | undefined;
testRender(rscriptArgsDoc.input, "markdown_strict", true, [
  noErrorsOrWarnings,
  ensureFileRegexMatches(rscriptArgsDoc.output.outputPath, [
    /"--vanilla"/, /"--max-connection=258"/]
  ),
],
{
  setup: async () => {
    rscriptArgs = setEnvVar("QUARTO_KNITR_RSCRIPT_ARGS", "--vanilla,--max-connections=258");
  },
  teardown: async () => {
    restoreEnvVar("QUARTO_KNITR_RSCRIPT_ARGS", rscriptArgs);
  },
});