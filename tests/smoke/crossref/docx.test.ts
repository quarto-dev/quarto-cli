/*
* latex.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { assert } from "../../asserts.ts";
import {
  docxBookmarkName,
  ensureDocxRegexMatches,
  verifyDocXDocument,
} from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const allQmd = crossref("all-docx.qmd", "docx");

function ensureLinksResolveToBookmarks(
  file: string,
  refs: { id: string; linkText: string }[],
) {
  return verifyDocXDocument(async (xml) => {
    const bookmarks = [
      ...xml.matchAll(/<w:bookmarkStart[^>]*w:name="([^"]+)"/g),
    ].map((m) => m[1]);
    for (const { id, linkText } of refs) {
      const name = await docxBookmarkName(id);
      assert(
        bookmarks.includes(name),
        `No bookmark named '${name}' for crossref id '${id}'.`,
      );
      const link = RegExp(
        `<w:hyperlink w:anchor="([^"]+)">(?:(?!</w:hyperlink>).)*?>${linkText}<`,
        "s",
      ).exec(xml);
      assert(link, `No internal link with text '${linkText}' (id '${id}').`);
      assert(
        link[1] === name,
        `Link '${linkText}' for crossref id '${id}' has anchor '${link[1]}', expected '${name}'.`,
      );
    }
  }, "Inspecting Docx for crossref links resolving to their bookmarks")(file);
}

function text(text: string) {
  return RegExp(
    `>${text}<`,
  );
}

const simpleFigRegexes = [
  // These tests no longer pass after we started introducing non-breaking
  // spaces between 'Figure' and '1' (although upon cracking the file
  // it seems like there are no non-breaking spaces and these strings
  // are in fact in the file)
  text("Figure\\u00A01: Elephant"),
  text("Figure\\u00A01"),
];

const tableRegexes = [
  // (see comment above re: non-breaking spaces)
  text("Table\\u00A01: My Caption"),
];

const mathRegexes = [
  text("Theorem 1 \\(Line\\)"),
];

const _subTableRegexes = [
  text("Table 2: Main Caption"),
  text("(a) First Table"),
  text("(b) Second Table"),
];

const _subFigRegexes = [
  text("Figure 2: Famous Elephants"),
  text("Figure 2"),
  text("Figure 2 (b)"),
];

testRender(allQmd.input, "docx", true, [
  ensureDocxRegexMatches(allQmd.output.outputPath, [
    ...simpleFigRegexes,
    ...tableRegexes,
    ...mathRegexes,
    //    ...subFigRegexes,
    //    ...subTableRegexes,
  ]),
  ensureLinksResolveToBookmarks(allQmd.output.outputPath, [
    { id: "fig-elephant", linkText: "Figure 1" },
    { id: "tbl-letters", linkText: "Table 1" },
    { id: "thm-line", linkText: "Theorem 1" },
  ]),
]);
