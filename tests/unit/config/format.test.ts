/*
 * format.test.ts
 *
 * Unit tests for format detection functions in src/config/format.ts
 */

import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";

import {
  isTypstOutput,
  isLatexOutput,
  isPdfOutput,
  isHtmlDocOutput,
  isBeamerOutput,
  isEpubOutput,
  isDocxOutput,
  isHtmlSlideOutput,
  isHtmlDashboardOutput,
} from "../../../src/config/format.ts";


unitTest("format-detection - isTypstOutput with base format", async () => {
  assert(isTypstOutput("typst") === true);
  assert(isTypstOutput({ to: "typst" }) === true);
});

unitTest("format-detection - isTypstOutput with variants (CURRENTLY FAILS)", async () => {
  assert(isTypstOutput("typst-citations") === true);
  assert(isTypstOutput("typst+custom") === true); 
  assert(isTypstOutput({ to: "typst-citations" }) === true);
});

unitTest("format-detection - isTypstOutput negative cases", async () => {
  assert(isTypstOutput("pdf") === false);
  assert(isTypstOutput("latex") === false);
  assert(isTypstOutput({ to: "html" }) === false);
});

unitTest("format-detection - isLatexOutput with base formats", async () => {
  assert(isLatexOutput({ to: "latex" }) === true);
  assert(isLatexOutput({ to: "pdf" }) === true);
  assert(isLatexOutput({ to: "beamer" }) === true);
});

unitTest("format-detection - isLatexOutput with variants", async () => {
  assert(isLatexOutput({ to: "latex-citations" }) === true); 
  assert(isLatexOutput({ to: "pdf+smart" }) === true);
  assert(isLatexOutput({ to: "beamer-citations" }) === true);
});

unitTest("format-detection - isLatexOutput negative cases", async () => {
  assert(isLatexOutput({ to: "html" }) === false);
  assert(isLatexOutput({ to: "typst" }) === false);
});

unitTest("format-detection - isHtmlDocOutput with base formats", async () => {
  assert(isHtmlDocOutput("html") === true);
  assert(isHtmlDocOutput("html4") === true);
  assert(isHtmlDocOutput("html5") === true);
  assert(isHtmlDocOutput({ to: "html" }) === true);
});

unitTest("format-detection - isHtmlDocOutput with variants", async () => {
  assert(isHtmlDocOutput("html-citations") === true);
  assert(isHtmlDocOutput("html5+smart") === true);
  assert(isHtmlDocOutput({ to: "html+citations" }) === true);
});

unitTest("format-detection - isHtmlDocOutput negative cases", async () => {
  assert(isHtmlDocOutput("revealjs") === false);
  assert(isHtmlDocOutput("pdf") === false);
  assert(isHtmlDocOutput({ to: "typst" }) === false);
});

unitTest("format-detection - isPdfOutput with base formats", async () => {
  assert(isPdfOutput("pdf") === true);
  assert(isPdfOutput("beamer") === true);
  assert(isPdfOutput({ to: "pdf" }) === true);
  assert(isPdfOutput({ to: "beamer" }) === true);
});

unitTest("format-detection - isPdfOutput with variants", async () => {
  assert(isPdfOutput("pdf-citations") === true);
  assert(isPdfOutput("beamer+smart") === true);
  assert(isPdfOutput({ to: "pdf+variant" }) === true);
});

unitTest("format-detection - isPdfOutput negative cases", async () => {
  assert(isPdfOutput("html") === false);
  assert(isPdfOutput("typst") === false);
  assert(isPdfOutput({ to: "latex" }) === false);
});

unitTest("format-detection - isBeamerOutput with base format", async () => {
  assert(isBeamerOutput({ to: "beamer" }) === true);
});

unitTest("format-detection - isBeamerOutput with variants", async () => {
  assert(isBeamerOutput({ to: "beamer-citations" }) === true);
  assert(isBeamerOutput({ to: "beamer+smart" }) === true);
});

unitTest("format-detection - isEpubOutput with base formats", async () => {
  assert(isEpubOutput("epub") === true);
  assert(isEpubOutput("epub2") === true);
  assert(isEpubOutput("epub3") === true);
});

unitTest("format-detection - isEpubOutput with variants", async () => {
  assert(isEpubOutput("epub+citations") === true);
  assert(isEpubOutput({ to: "epub3+smart" }) === true);
});

unitTest("format-detection - isDocxOutput with base format", async () => {
  assert(isDocxOutput("docx") === true);
  assert(isDocxOutput({ to: "docx" }) === true);
});

unitTest("format-detection - isDocxOutput with variants", async () => {
  assert(isDocxOutput("docx+citations") === true);
  assert(isDocxOutput({ to: "docx+smart" }) === true);
});

unitTest("format-detection - isHtmlSlideOutput with base formats", async () => {
  assert(isHtmlSlideOutput("revealjs") === true);
  assert(isHtmlSlideOutput("slidy") === true);
  assert(isHtmlSlideOutput({ to: "revealjs" }) === true);
});

unitTest("format-detection - isHtmlSlideOutput with variants", async () => {
  assert(isHtmlSlideOutput("revealjs-citations") === true);
  assert(isHtmlSlideOutput({ to: "slidy+smart" }) === true);
});

unitTest("format-detection - isHtmlDashboardOutput with base format", async () => {
  assert(isHtmlDashboardOutput("dashboard") === true);
});

unitTest("format-detection - isHtmlDashboardOutput with custom suffix", async () => {
  assert(isHtmlDashboardOutput("my-dashboard") === true);
  assert(isHtmlDashboardOutput("custom-dashboard") === true);
});
