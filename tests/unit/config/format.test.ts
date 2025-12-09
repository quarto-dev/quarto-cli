/*
 * format.test.ts
 *
 * Unit tests for format detection functions in src/config/format.ts
 *
 * Tests use TDD approach - tests written before implementation changes
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

import { FormatPandoc } from "../../../src/config/types.ts";

// ============================================================================
// Phase 1: Tests for isFormatTo() helper (indirectly tested via functions)
// ============================================================================

// These tests will initially pass for base formats but fail for variants
// Once we fix isFormatTo(), all these should pass

// ============================================================================
// Phase 2: Critical Functions - isTypstOutput()
// ============================================================================

// deno-lint-ignore require-await
unitTest("format-detection - isTypstOutput with base format", async () => {
  assert(isTypstOutput("typst") === true);
  assert(isTypstOutput({ to: "typst" }) === true);
});

// deno-lint-ignore require-await
unitTest("format-detection - isTypstOutput with variants (CURRENTLY FAILS)", async () => {
  // These tests document the bug - they will fail until we fix isTypstOutput()
  assert(isTypstOutput("typst-citations") === true); // Bug: currently returns false
  assert(isTypstOutput("typst+custom") === true); // Bug: currently returns false
  assert(isTypstOutput({ to: "typst-citations" }) === true); // Bug: currently returns false
});

// deno-lint-ignore require-await
unitTest("format-detection - isTypstOutput negative cases", async () => {
  assert(isTypstOutput("pdf") === false);
  assert(isTypstOutput("latex") === false);
  assert(isTypstOutput({ to: "html" }) === false);
});

// ============================================================================
// Phase 2: Critical Functions - isLatexOutput()
// ============================================================================

// deno-lint-ignore require-await
unitTest("format-detection - isLatexOutput with base formats", async () => {
  assert(isLatexOutput({ to: "latex" }) === true);
  assert(isLatexOutput({ to: "pdf" }) === true);
  assert(isLatexOutput({ to: "beamer" }) === true);
});

// deno-lint-ignore require-await
unitTest("format-detection - isLatexOutput with variants (CURRENTLY FAILS)", async () => {
  assert(isLatexOutput({ to: "latex-citations" }) === true); // Bug: currently returns false
  assert(isLatexOutput({ to: "pdf+smart" }) === true); // Bug: currently returns false
  assert(isLatexOutput({ to: "beamer-citations" }) === true); // Bug: currently returns false
});

// deno-lint-ignore require-await
unitTest("format-detection - isLatexOutput negative cases", async () => {
  assert(isLatexOutput({ to: "html" }) === false);
  assert(isLatexOutput({ to: "typst" }) === false);
});

// ============================================================================
// Phase 2: Critical Functions - isHtmlDocOutput()
// ============================================================================

// deno-lint-ignore require-await
unitTest("format-detection - isHtmlDocOutput with base formats", async () => {
  assert(isHtmlDocOutput("html") === true);
  assert(isHtmlDocOutput("html4") === true);
  assert(isHtmlDocOutput("html5") === true);
  assert(isHtmlDocOutput({ to: "html" }) === true);
});

// deno-lint-ignore require-await
unitTest("format-detection - isHtmlDocOutput with variants (CURRENTLY FAILS)", async () => {
  assert(isHtmlDocOutput("html-citations") === true); // Bug: currently returns false
  assert(isHtmlDocOutput("html5+smart") === true); // Bug: currently returns false
  assert(isHtmlDocOutput({ to: "html+citations" }) === true); // Bug: currently returns false
});

// deno-lint-ignore require-await
unitTest("format-detection - isHtmlDocOutput negative cases", async () => {
  assert(isHtmlDocOutput("revealjs") === false);
  assert(isHtmlDocOutput("pdf") === false);
  assert(isHtmlDocOutput({ to: "typst" }) === false);
});

// ============================================================================
// Phase 3: High Priority - isPdfOutput()
// ============================================================================

// deno-lint-ignore require-await
unitTest("format-detection - isPdfOutput with base formats", async () => {
  assert(isPdfOutput("pdf") === true);
  assert(isPdfOutput("beamer") === true);
  assert(isPdfOutput({ to: "pdf" }) === true);
  assert(isPdfOutput({ to: "beamer" }) === true);
});

// deno-lint-ignore require-await
unitTest("format-detection - isPdfOutput with variants (CURRENTLY FAILS)", async () => {
  assert(isPdfOutput("pdf-citations") === true); // Bug: currently returns false
  assert(isPdfOutput("beamer+smart") === true); // Bug: currently returns false
  assert(isPdfOutput({ to: "pdf+variant" }) === true); // Bug: currently returns false
});

// deno-lint-ignore require-await
unitTest("format-detection - isPdfOutput negative cases", async () => {
  assert(isPdfOutput("html") === false);
  assert(isPdfOutput("typst") === false);
  assert(isPdfOutput({ to: "latex" }) === false);
});

// ============================================================================
// Phase 4: Medium/Low Priority Functions
// ============================================================================

// deno-lint-ignore require-await
unitTest("format-detection - isBeamerOutput with base format", async () => {
  assert(isBeamerOutput({ to: "beamer" }) === true);
});

// deno-lint-ignore require-await
unitTest("format-detection - isBeamerOutput with variants (CURRENTLY FAILS)", async () => {
  assert(isBeamerOutput({ to: "beamer-citations" }) === true); // Bug: currently returns false
  assert(isBeamerOutput({ to: "beamer+smart" }) === true); // Bug: currently returns false
});

// deno-lint-ignore require-await
unitTest("format-detection - isEpubOutput with base formats", async () => {
  assert(isEpubOutput("epub") === true);
  assert(isEpubOutput("epub2") === true);
  assert(isEpubOutput("epub3") === true);
});

// deno-lint-ignore require-await
unitTest("format-detection - isEpubOutput with variants (CURRENTLY FAILS)", async () => {
  assert(isEpubOutput("epub+citations") === true); // Bug: currently returns false
  assert(isEpubOutput({ to: "epub3+smart" }) === true); // Bug: currently returns false
});

// deno-lint-ignore require-await
unitTest("format-detection - isDocxOutput with base format", async () => {
  assert(isDocxOutput("docx") === true);
  assert(isDocxOutput({ to: "docx" }) === true);
});

// deno-lint-ignore require-await
unitTest("format-detection - isDocxOutput with variants (CURRENTLY FAILS)", async () => {
  assert(isDocxOutput("docx+citations") === true); // Bug: currently returns false
  assert(isDocxOutput({ to: "docx+smart" }) === true); // Bug: currently returns false
});

// deno-lint-ignore require-await
unitTest("format-detection - isHtmlSlideOutput with base formats", async () => {
  assert(isHtmlSlideOutput("revealjs") === true);
  assert(isHtmlSlideOutput("slidy") === true);
  assert(isHtmlSlideOutput({ to: "revealjs" }) === true);
});

// deno-lint-ignore require-await
unitTest("format-detection - isHtmlSlideOutput with variants (CURRENTLY FAILS)", async () => {
  assert(isHtmlSlideOutput("revealjs-citations") === true); // Bug: currently returns false
  assert(isHtmlSlideOutput({ to: "slidy+smart" }) === true); // Bug: currently returns false
});

// deno-lint-ignore require-await
unitTest("format-detection - isHtmlDashboardOutput with base format", async () => {
  assert(isHtmlDashboardOutput("dashboard") === true);
});

// deno-lint-ignore require-await
unitTest("format-detection - isHtmlDashboardOutput with custom suffix", async () => {
  // This function already uses endsWith() so it should work
  assert(isHtmlDashboardOutput("my-dashboard") === true);
  assert(isHtmlDashboardOutput("custom-dashboard") === true);
});
