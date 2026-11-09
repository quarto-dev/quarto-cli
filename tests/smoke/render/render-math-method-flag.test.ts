/*
 * render-math-method-flag.test.ts
 *
 * Pandoc 3.11 replaced --katex, --mathjax, ... with --math-method=METHOD[:URL].
 * Quarto must see the method chosen that way, as it does for the older flags.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { docs, outputForInput } from "../../utils.ts";
import { ensureFileRegexMatches, noErrorsOrWarnings } from "../../verify.ts";
import { testRender } from "./render.ts";

const input = docs("render/math-method-flag.qmd");
const output = outputForInput(input, "html");

// With embed-resources, Pandoc embeds the KaTeX library itself (its error
// strings are in the page); Quarto must not swap in its MathJax loader.
testRender(input, "html", true, [
  noErrorsOrWarnings,
  ensureFileRegexMatches(output.outputPath, [/KaTeX parse error/], [
    /mathjax@3\/es5\/tex-chtml-full\.js/,
  ]),
], {}, ["--math-method=katex", "--embed-resources"]);

// Without embed-resources, Quarto's KaTeX post-processor runs
testRender(input, "html", false, [
  noErrorsOrWarnings,
  ensureFileRegexMatches(output.outputPath, [
    /window\.backupDefine = window\.define/,
  ]),
], {}, ["--math-method", "katex"]);
