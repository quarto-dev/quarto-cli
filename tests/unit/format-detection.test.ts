import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import {
  isHtmlOutput,
  isJatsOutput,
  isPdfOutput,
  isRevealjsOutput,
  isTypstOutput,
} from "../../src/config/format.ts";

unitTest(
  "isPdfOutput - direct formats",
  // deno-lint-ignore require-await
  async () => {
    assert(isPdfOutput("pdf"));
    assert(isPdfOutput("beamer"));
    assert(!isPdfOutput("html"));
    assert(!isPdfOutput("typst"));
    assert(!isPdfOutput("docx"));
  },
);

unitTest(
  "isPdfOutput - extension formats",
  // deno-lint-ignore require-await
  async () => {
    assert(isPdfOutput("acm-pdf"));
    assert(isPdfOutput("dummy-extension-pdf"));
    assert(isPdfOutput("acm-2023-pdf"));
    assert(isPdfOutput("journal-beamer"));
    assert(!isPdfOutput("acm-html"));
    assert(!isPdfOutput("my-ext-typst"));
  },
);

unitTest(
  "isPdfOutput - modifiers and edge cases",
  // deno-lint-ignore require-await
  async () => {
    assert(!isPdfOutput("default"));
    assert(!isPdfOutput(""));
    assert(isPdfOutput("pdf+draft"));
    assert(isPdfOutput("acm-pdf+draft"));
  },
);

unitTest(
  "isHtmlOutput - extension formats",
  // deno-lint-ignore require-await
  async () => {
    assert(isHtmlOutput("html"));
    assert(isHtmlOutput("acm-html"));
    assert(isHtmlOutput("nature-html"));
    assert(!isHtmlOutput("acm-pdf"));
  },
);

unitTest(
  "isTypstOutput - extension formats",
  // deno-lint-ignore require-await
  async () => {
    assert(isTypstOutput("typst"));
    assert(isTypstOutput("orange-book-typst"));
    assert(!isTypstOutput("acm-pdf"));
  },
);

unitTest(
  "isRevealjsOutput - extension formats",
  // deno-lint-ignore require-await
  async () => {
    assert(isRevealjsOutput("revealjs"));
    assert(isRevealjsOutput("clean-revealjs"));
    assert(isRevealjsOutput("my-theme-revealjs"));
    assert(!isRevealjsOutput("html"));
    assert(!isRevealjsOutput("acm-pdf"));
  },
);

unitTest(
  "isJatsOutput - extension formats",
  // deno-lint-ignore require-await
  async () => {
    assert(isJatsOutput("jats"));
    assert(isJatsOutput("jats_archiving"));
    assert(isJatsOutput("plos-jats"));
    assert(isJatsOutput("my-journal-jats_archiving"));
    assert(!isJatsOutput("html"));
    assert(!isJatsOutput("acm-pdf"));
  },
);

unitTest(
  "format detection - malformed inputs",
  // deno-lint-ignore require-await
  async () => {
    assert(!isPdfOutput("---"));
    assert(!isPdfOutput("123"));
    assert(isHtmlOutput(""));  // empty defaults to "html" internally
    assert(!isRevealjsOutput(""));
    assert(!isJatsOutput(""));
  },
);
