import { dirname, join } from "path";
import { ensureSnapshotMatches, noErrors, printsMessage } from "../../verify.ts";
import { fileLoader } from "../../utils.ts";
import { safeRemoveIfExists } from "../../../src/core/path.ts";
import { testRender } from "../render/render.ts";

// Define engines to test
const engines = [
  { name: "knitr" },
  { name: "jupyter" },
  { name: "julia" }
];

// Run tests for each engine
engines.forEach(engine => {
  // Test for engine
  const inputQmd = fileLoader(engine.name, "intermediate-markdown-output")("output-cell-div.qmd", "markdown");
  const md = join(dirname(inputQmd.input), "output-cell-div.markdown.md");
  testRender(inputQmd.input, "markdown", true, [
    noErrors,
    // Lua Warning are in INFO
    printsMessage({ level: "INFO", regex: /WARNING \(.*\)\s+The following string was found in the document: :::/, negate: true}),
    ensureSnapshotMatches(md)
  ], { 
    teardown: async () => { 
      safeRemoveIfExists(md); 
    } });
});

