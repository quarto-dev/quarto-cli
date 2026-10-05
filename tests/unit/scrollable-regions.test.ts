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
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import {
  hasFocusableContent,
  hasUsableSize,
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
  "hasUsableSize - a laid-out region has a usable size",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(hasUsableSize({ clientWidth: 337, clientHeight: 40 }), true);
  },
);

unitTest(
  "hasUsableSize - a hidden region reports zero",
  // deno-lint-ignore require-await
  async () => {
    // Closed <details> and inactive tab panes.
    assertEquals(hasUsableSize({ clientWidth: 0, clientHeight: 0 }), false);
  },
);

unitTest(
  "hasUsableSize - a visually-hidden region clipped to 1px is not usable",
  // deno-lint-ignore require-await
  async () => {
    // `.visually-hidden` clips to 1px and sets overflow hidden on one axis;
    // CSS computes the other to auto, so the full content height reads as
    // overflow. Marking it would add an invisible tab stop.
    assertEquals(hasUsableSize({ clientWidth: 1, clientHeight: 1 }), false);
  },
);

// Minimal stand-ins for the two DOM methods hasFocusableContent uses: the
// element yields its focusable descendants, and each descendant reports
// whether it is a Pandoc line-number anchor.
const fakeRegion = (...isLineAnchor: boolean[]) => ({
  querySelectorAll: () => isLineAnchor.map((v) => ({ matches: () => v })),
});

unitTest(
  "hasFocusableContent - a region with no focusable descendants has none",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(hasFocusableContent(fakeRegion()), false);
  },
);

unitTest(
  "hasFocusableContent - line-number anchors alone do not count",
  // deno-lint-ignore require-await
  async () => {
    // They are focusable, but each sits at the start of its line and cannot
    // scroll the region, so a numbered block still needs its own tab stop.
    assertEquals(hasFocusableContent(fakeRegion(true, true, true)), false);
  },
);

unitTest(
  "hasFocusableContent - a real focusable descendant counts",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(hasFocusableContent(fakeRegion(true, false, true)), true);
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
