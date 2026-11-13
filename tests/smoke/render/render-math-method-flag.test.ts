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

// The equation number must survive a method that ignores \tag. The number is
// matched in the rendered MathML, not in its TeX annotation.
const mathmlNumber = /<mo[^>]*>\(<\/mo><mn>1<\/mn>/;
testRender(input, "html", false, [
  noErrorsOrWarnings,
  ensureFileRegexMatches(output.outputPath, [mathmlNumber]),
], {}, ["--math-method=mathml"]);

// --mathml is deprecated since Pandoc 3.11 and warns, so no warning check
testRender(input, "html", false, [
  ensureFileRegexMatches(output.outputPath, [mathmlNumber]),
], {}, ["--mathml"]);

testRender(input, "html", false, [
  noErrorsOrWarnings,
  ensureFileRegexMatches(output.outputPath, [/<sup>2<\/sup>\s*\(1\)/]),
], {}, ["--math-method=plain"]);
