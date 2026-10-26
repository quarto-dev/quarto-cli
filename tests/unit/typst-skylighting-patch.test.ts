/*
 * typst-skylighting-patch.test.ts
 *
 * Unit tests for patching Pandoc's generated Skylighting function.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import {
  applyPatch,
  patchSkylightingFunction,
} from "../../src/format/typst/format-typst.ts";

const skylightingFn = `#let Skylighting(fill: none, number: false, start: 1, sourcelines) = {
   let blocks = []
   let lnum = start - 1
   let bgcolor = rgb("#f1f3f5")
   for ln in sourcelines {
     if number {
       lnum = lnum + 1
       blocks = blocks + box(text(fill: rgb("#aaaaaa"), [ #lnum ]))
     }
     blocks = blocks + ln + EndLine()
   }
   block(fill: bgcolor, blocks)
}`;

unitTest("typst-skylighting-patch - applyPatch reports a miss", async () => {
  const miss = applyPatch("abc", "xyz", "q");
  assertEquals(miss.applied, false);
  assertEquals(miss.source, "abc");
  const hit = applyPatch("abc", "b", "q");
  assertEquals(hit.applied, true);
  assertEquals(hit.source, "aqc");
});

unitTest("typst-skylighting-patch - all patches apply", async () => {
  const result = patchSkylightingFunction(skylightingFn);
  assertEquals(result.failedPatch, undefined);
  assert(result.fn.includes("annotations: (:)"));
});

unitTest(
  "typst-skylighting-patch - a missing target keeps the unannotated function",
  async () => {
    const source = skylightingFn.replace("let lnum = start - 1\n", "");
    const result = patchSkylightingFunction(source);
    assert(result.failedPatch !== undefined);
    assert(!result.fn.includes("annotations:"));
    assert(result.fn.includes("width: 100%, inset: 8pt"));
  },
);
