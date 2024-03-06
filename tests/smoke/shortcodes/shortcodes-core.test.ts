import { join } from "../../../src/deno_ral/path.ts";

import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches, noErrorsOrWarnings } from "../../verify.ts";
import { testRender } from "../render/render.ts";

const input = docs(join("shortcodes", "metadata.qmd"));
const output = outputForInput(input, "html");
testRender(input, "html", false, [
  ensureFileRegexMatches(output.outputPath, [
    /Subkey Value/,
    /Hello World/,
  ], [
    /\?meta/,
  ]),
]);

const inputCustom = docs(join("shortcodes", "custom.qmd"));
const outputCustom = outputForInput(inputCustom, "html");
testRender(inputCustom, "html", false, [
  ensureFileRegexMatches(outputCustom.outputPath, [
    /<strong>_bringit_<\/strong>/,
  ], [
    /\?shorty/,
  ]),
]);

const inputError = docs(join("shortcodes", "metadata-error.qmd"));
const outputError = outputForInput(inputError, "html");
testRender(inputError, "html", false, [
  ensureFileRegexMatches(outputError.outputPath, [
    /\?meta:equation/,
    /\?invalid meta type:weird-type/,
  ]),
]);

const inputVars = docs(join("shortcodes", "vars-simple.qmd"));
const outputVars = outputForInput(inputVars, "html");
testRender(inputVars, "html", false, [
  ensureFileRegexMatches(outputVars.outputPath, [
    /bar/,
    /Variable 2 Sub Sub VALUE/,
  ], [
    /\?var/,
  ]),
]);

const inputVarsLinks = docs(join("shortcodes", "vars-links.qmd"));
const outputVarsLinks = outputForInput(inputVarsLinks, "html");
testRender(inputVarsLinks, "html", false, [
  ensureFileRegexMatches(outputVarsLinks.outputPath, [
    /http\:\/\/www\.test\.com\/bar/,
    /images\/beach\.jpg\?bar/,
  ], []),
]);

const inputVarsErr = docs(join("shortcodes", "vars-error.qmd"));
const outputVarsErr = outputForInput(inputVarsErr, "html");
testRender(inputVarsErr, "html", false, [
  ensureFileRegexMatches(outputVarsErr.outputPath, [
    /\?var:foobar123/,
  ]),
]);

const inputNoVars = docs(join("shortcodes", "vars-simple.qmd"));
testRender(inputNoVars, "html", false, [
  noErrorsOrWarnings,
], {
  setup: async () => {
    await Deno.rename(
      docs(join("shortcodes", "_variables.yml")),
      docs(join("shortcodes", "_variables.yml,bak")),
    );
  },
  teardown: async () => {
    await Deno.rename(
      docs(join("shortcodes", "_variables.yml,bak")),
      docs(join("shortcodes", "_variables.yml")),
    );
  },
});
