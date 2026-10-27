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
  injectMissingAnnotationHelpers,
  patchSkylightingFunction,
} from "../../src/format/typst/format-typst.ts";

const skylightingFn =
  `#let Skylighting(fill: none, number: false, start: 1, sourcelines) = {
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

const definitionsSource = Deno.readTextFileSync(
  "../src/resources/formats/typst/pandoc/quarto/definitions.typ",
);

const usingDocument =
  `#let Skylighting(fill: none, number: false, start: 1, cell-id: "", annotations: (:), sourcelines) = {
  quarto-annote-link(lbl)[#quarto-circled-number(1, color: quarto-annote-color(bgcolor))]
}
#quarto-code-filename("a.py")[
#Skylighting(([x],));
]
#quarto-code-annotation(("1": 1), cell-id: "c")[x]
#quarto-annotation-item("c", 1, [Item])
#show: doc => doc
`;

unitTest("typst-skylighting-patch - helpers: nothing used", async () => {
  const content = "#show: doc => doc\nplain\n";
  const result = injectMissingAnnotationHelpers(content, definitionsSource);
  assertEquals(result.content, content);
  assertEquals(result.injected, []);
});

unitTest("typst-skylighting-patch - helpers: all missing", async () => {
  const result = injectMissingAnnotationHelpers(
    usingDocument,
    definitionsSource,
  );
  assertEquals(result.injected.length, 6);
  assert(
    result.content.indexOf("#let quarto-code-filename(") <
      result.content.indexOf("#let Skylighting("),
  );
  assert(
    result.content.indexOf("#let quarto-annote-link(") <
      result.content.indexOf("#let quarto-code-annotation("),
  );
});

unitTest("typst-skylighting-patch - helpers: one missing", async () => {
  const link = definitionsSource.search(/^#let quarto-annote-link\(/m);
  const afterLink = definitionsSource.slice(link + 1).search(/^(#let |#show)/m);
  const withoutLink = definitionsSource.slice(0, link) +
    definitionsSource.slice(link + 1 + afterLink);
  const result = injectMissingAnnotationHelpers(
    withoutLink + usingDocument,
    definitionsSource,
  );
  assertEquals(result.injected, ["quarto-annote-link"]);
  assert(
    result.content.indexOf("#let quarto-annote-link(") <
      result.content.indexOf("#let quarto-code-annotation("),
  );
});

unitTest("typst-skylighting-patch - helpers: all present", async () => {
  const content = definitionsSource + usingDocument;
  const result = injectMissingAnnotationHelpers(content, definitionsSource);
  assertEquals(result.content, content);
  assertEquals(result.injected, []);
});
