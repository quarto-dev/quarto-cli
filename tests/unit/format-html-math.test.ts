/*
 * format-html-math.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { resolveHtmlMathMethod } from "../../src/format/html/format-html-math.ts";
import { MathMethods } from "../../src/resources/types/schema-types.ts";
import { createMockFormat } from "./format-utils.ts";
import { unitTest } from "../test.ts";

unitTest("resolveHtmlMathMethod - string form", //deno-lint-ignore require-await
async () => {
  const format = createMockFormat({ pandoc: { "html-math-method": "katex" } });
  assertEquals(resolveHtmlMathMethod(format), {
    method: "katex",
    fromFlag: false,
  });
});

unitTest("resolveHtmlMathMethod - object form with url", //deno-lint-ignore require-await
async () => {
  const format = createMockFormat({
    pandoc: {
      "html-math-method": {
        method: "katex",
        url: "https://example.com/katex/",
      },
    },
  });
  assertEquals(resolveHtmlMathMethod(format), {
    method: "katex",
    url: "https://example.com/katex/",
    fromFlag: false,
  });
});

unitTest("resolveHtmlMathMethod - command line flag overrides html-math-method", //deno-lint-ignore require-await
async () => {
  const format = createMockFormat({
    pandoc: { "html-math-method": "mathjax" },
  });
  const methods: MathMethods[] = [
    "mathjax",
    "katex",
    "mathml",
    "webtex",
    "gladtex",
  ];
  for (const method of methods) {
    assertEquals(resolveHtmlMathMethod(format, { [method]: true }), {
      method,
      fromFlag: true,
    });
  }
});

unitTest("resolveHtmlMathMethod - nothing set", //deno-lint-ignore require-await
async () => {
  assertEquals(resolveHtmlMathMethod(createMockFormat()), undefined);
  assertEquals(resolveHtmlMathMethod(createMockFormat(), {}), undefined);
});
