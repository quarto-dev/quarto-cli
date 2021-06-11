import { join } from "path/mod.ts";

import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "../render/render.ts";

const input = docs(join("shortcodes", "metadata.qmd"));
const output = outputForInput(input, "html");
testRender(input, "html", false, [
  ensureFileRegexMatches(output.outputPath, [
    /Subkey Value/,
    /Hello World/,
  ], [
    /\?/,
  ]),
]);

const inputError = docs(join("shortcodes", "metadata-error.qmd"));
const outputError = outputForInput(inputError, "html");
testRender(inputError, "html", false, [
  ensureFileRegexMatches(outputError.outputPath, [
    /\?metadata:equation/,
    /\?invalid metadata type:weird-type/,
  ]),
]);
