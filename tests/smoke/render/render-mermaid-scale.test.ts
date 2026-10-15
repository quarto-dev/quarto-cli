/*
 * render-mermaid-scale.test.ts
 *
 * `mermaid-scale` resizes Mermaid images by a percentage of their natural
 * size. The natural size depends on the fonts headless Chrome uses, so the
 * test compares a scaled diagram against the same diagram at 100% rather
 * than pinning absolute sizes.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertAlmostEquals, assertEquals } from "testing/asserts";
import { safeExistsSync, safeRemoveSync } from "../../../src/core/path.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";
import { noErrorsOrWarnings } from "../../verify.ts";
import { testRender } from "./render.ts";

const input = docs("mermaid-scale/mermaid-scale.qmd");
const typ = join(docs("mermaid-scale"), "mermaid-scale.typ");

const imageSizes = (text: string) =>
  [...text.matchAll(
    /image\("[^"]*mermaid-figure-\d+\.png", height: ([\d.]+)in, width: ([\d.]+)in\)/g,
  )].map((m) => ({ height: Number(m[1]), width: Number(m[2]) }));

testRender(input, "typst", false, [
  noErrorsOrWarnings,
  {
    name:
      "mermaid-scale resizes the natural size and fig-width takes precedence",
    verify: () => {
      const [natural, scaled, explicit] = imageSizes(
        Deno.readTextFileSync(typ),
      );
      // sizes are rounded to 0.01in before they reach the .typ
      assertAlmostEquals(scaled.width, natural.width * 0.5, 0.01);
      assertAlmostEquals(scaled.height, natural.height * 0.5, 0.01);
      assertEquals(explicit.width, 3);
      assertAlmostEquals(
        explicit.height,
        3 * natural.height / natural.width,
        0.02,
      );
      return Promise.resolve();
    },
  },
], {
  teardown: () => {
    if (safeExistsSync(typ)) {
      safeRemoveSync(typ);
    }
    return Promise.resolve();
  },
});
