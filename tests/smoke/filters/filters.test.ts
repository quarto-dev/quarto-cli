import { ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { docs, outputForInput } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";

const verifySmallCaps = ["main.content span.smallcaps"];
const verifyBehead = ["main.content em"];
const verifyBeheadExclude = ["h2"];

// Test that the small cap filter properly runs
const luaInput = docs(join("filters", "lua-filter.qmd"));
const luaOutput = outputForInput(luaInput, "html");
testRender(luaInput, "html", false, [
  ensureHtmlElements(luaOutput.outputPath, [
    ...verifySmallCaps,
  ]),
]);

// Test that the python behead filter is working
const pythonInput = docs(join("filters", "python-filter.qmd"));
const pythonOutput = outputForInput(pythonInput, "html");
testRender(pythonInput, "html", false, [
  ensureHtmlElements(pythonOutput.outputPath, [
    ...verifyBehead,
  ], [
    ...verifyBeheadExclude,
  ]),
]);

// Test that the python behead filter is working
const bothInput = docs(join("filters", "both.qmd"));
const bothOutput = outputForInput(bothInput, "html");
testRender(bothInput, "html", false, [
  ensureHtmlElements(bothOutput.outputPath, [
    ...verifySmallCaps,
    ...verifyBehead,
  ], [
    ...verifyBeheadExclude,
  ]),
]);

// Test that filter order works
const orderInput = docs(join("filters", "filter-order.qmd"));
testRender(orderInput, "html", false);
