/*
* extension-render-reveal.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testRender } from "../render/render.ts";

const input = docs("extensions/revealjs/simple/preso.qmd");
const htmlOutput = outputForInput(input, "html");
testRender(input, "revealjs", false, [
  ensureFileRegexMatches(htmlOutput.outputPath, [
    /pointer\.js/,
    /RevealPointer/,
    /'pointer'\: /,
  ]),
]);

const bundleInput = docs("extensions/revealjs/bundle/preso.qmd");
const bundleOutput = outputForInput(bundleInput, "html");
testRender(bundleInput, "revealjs", false, [
  ensureFileRegexMatches(bundleOutput.outputPath, [
    /pointer\.js/,
    /RevealPointer/,
    /'pointer'\: /,
  ]),
]);

const embedInput = docs("extensions/revealjs/embedded/preso.qmd");
const embedOutput = outputForInput(embedInput, "html");
testRender(embedInput, "cool-revealjs", false, [
  ensureFileRegexMatches(embedOutput.outputPath, [
    /pointer\.js/,
    /RevealPointer/,
    /'pointer'\: /,
  ]),
]);

testRender(embedInput, "revealjs", false, [
  ensureFileRegexMatches(embedOutput.outputPath, [], [
    /pointer\.js/,
    /RevealPointer/,
    /'pointer'\: /,
  ]),
]);
