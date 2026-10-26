/*
 * axe-overlay-scroll.test.ts
 *
 * Tests the scroll-target computation the axe document reporter uses to keep a
 * highlighted element from landing underneath the fixed report overlay.
 *
 * `overlayAwareScrollTop` is a pure function of viewport-relative rects and
 * scroll state, so these tests need no DOM: each case hand-constructs the rects
 * and asserts either the returned scrollTop or null (which tells the caller to
 * keep the default `scrollIntoView({block: "center"})` behavior).
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { overlayAwareScrollTop } from "../../src/resources/formats/html/axe/axe-check.js";

// A bottom-right overlay in a 1280x720 viewport: top edge at y=400, left edge
// at x=800. The unobscured band above it is [0, 400], centered at y=200.
const overlay = { top: 400, left: 800 };
const viewportHeight = 720;

unitTest(
  "overlayAwareScrollTop - no horizontal overlap returns null",
  // deno-lint-ignore require-await
  async () => {
    // Element's right edge (700) is left of the overlay's left edge (800), so
    // default centering can't put it under the overlay.
    assertEquals(
      overlayAwareScrollTop(
        { top: 600, right: 700, height: 100 },
        overlay,
        viewportHeight,
        1000,
      ),
      null,
    );
  },
);

unitTest(
  "overlayAwareScrollTop - overlapping element is centered in the band above the overlay",
  // deno-lint-ignore require-await
  async () => {
    // Element at viewport y=600, height 100. Centering it at the band's center
    // (y=200) means its top must land at y=150, i.e. scroll down 450 more:
    // 1000 + 600 - (400/2 - 100/2) = 1450.
    assertEquals(
      overlayAwareScrollTop(
        { top: 600, right: 1100, height: 100 },
        overlay,
        viewportHeight,
        1000,
      ),
      1450,
    );
  },
);

unitTest(
  "overlayAwareScrollTop - element taller than the band is top-aligned with a margin",
  // deno-lint-ignore require-await
  async () => {
    // Height 500 exceeds the 400px band, so align its start just inside the
    // viewport top instead of centering: 1000 + 600 - 16 = 1584.
    assertEquals(
      overlayAwareScrollTop(
        { top: 600, right: 1100, height: 500 },
        overlay,
        viewportHeight,
        1000,
      ),
      1584,
    );
  },
);

unitTest(
  "overlayAwareScrollTop - scrollTop is clamped at the document top",
  // deno-lint-ignore require-await
  async () => {
    // Centering would need scrollTop 0 + 50 - 150 = -100; clamp to 0.
    assertEquals(
      overlayAwareScrollTop(
        { top: 50, right: 1100, height: 100 },
        overlay,
        viewportHeight,
        0,
      ),
      0,
    );
  },
);

unitTest(
  "overlayAwareScrollTop - degenerate band (overlay covers the viewport) returns null",
  // deno-lint-ignore require-await
  async () => {
    // Overlay top edge nearly at the viewport top leaves no usable band to
    // scroll the element into; fall back to default centering.
    assertEquals(
      overlayAwareScrollTop(
        { top: 600, right: 1100, height: 100 },
        { top: 20, left: 100 },
        viewportHeight,
        1000,
      ),
      null,
    );
  },
);
