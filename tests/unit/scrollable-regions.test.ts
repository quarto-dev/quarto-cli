/*
 * scrollable-regions.test.ts
 *
 * Tests the pure helpers of the scrollable-regions module (#14378), which
 * makes overflowing code blocks and cell output keyboard-focusable.
 *
 * `isScrollable` is a pure predicate over the four scroll/client metrics plus
 * the computed overflow values, and `resolveLabels` a pure merge over the
 * label config, so these tests need no DOM: each case hand-constructs the
 * geometry, style, or config and asserts the result.
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import {
  isScrollable,
  resolveLabels,
} from "../../src/resources/formats/html/scrollable-regions/scrollable-regions.js";

unitTest(
  "isScrollable - content that fits is not scrollable",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      isScrollable(
        {
          scrollWidth: 400,
          clientWidth: 400,
          scrollHeight: 100,
          clientHeight: 100,
        },
        { overflowX: "auto", overflowY: "auto" },
      ),
      false,
    );
  },
);

unitTest(
  "isScrollable - 1px overflow is subpixel rounding, not scrolling",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      isScrollable(
        {
          scrollWidth: 401,
          clientWidth: 400,
          scrollHeight: 101,
          clientHeight: 100,
        },
        { overflowX: "auto", overflowY: "auto" },
      ),
      false,
    );
  },
);

unitTest(
  "isScrollable - horizontal overflow alone is scrollable",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      isScrollable(
        {
          scrollWidth: 402,
          clientWidth: 400,
          scrollHeight: 100,
          clientHeight: 100,
        },
        { overflowX: "auto", overflowY: "visible" },
      ),
      true,
    );
  },
);

unitTest(
  "isScrollable - vertical overflow alone is scrollable",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      isScrollable(
        {
          scrollWidth: 400,
          clientWidth: 400,
          scrollHeight: 300,
          clientHeight: 100,
        },
        { overflowX: "visible", overflowY: "scroll" },
      ),
      true,
    );
  },
);

unitTest(
  "isScrollable - overflowing content that merely bleeds (overflow visible) is not scrollable",
  // deno-lint-ignore require-await
  async () => {
    // pre.sourceCode inside div.sourceCode reports the same scrollWidth as
    // its scrolling parent but is not itself a scroll container.
    assertEquals(
      isScrollable(
        {
          scrollWidth: 628,
          clientWidth: 337,
          scrollHeight: 100,
          clientHeight: 100,
        },
        { overflowX: "visible", overflowY: "visible" },
      ),
      false,
    );
  },
);

unitTest(
  "resolveLabels - no config returns the English defaults",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(resolveLabels(undefined), {
      code: "Scrollable code",
      output: "Scrollable output",
    });
  },
);

unitTest(
  "resolveLabels - configured labels override the defaults per key",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(resolveLabels({ code: "Code défilant" }), {
      code: "Code défilant",
      output: "Scrollable output",
    });
  },
);

unitTest(
  "resolveLabels - empty or non-string values fall back to the defaults",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(resolveLabels({ code: "", output: 42 }), {
      code: "Scrollable code",
      output: "Scrollable output",
    });
  },
);

unitTest(
  "resolveLabels - unknown keys are dropped",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(resolveLabels({ banner: "Nope", output: "Sortie" }), {
      code: "Scrollable code",
      output: "Sortie",
    });
  },
);
