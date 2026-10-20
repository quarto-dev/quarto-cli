/*
 * render-listing-metadata-link.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { removeIfExists } from "../../../src/core/path.ts";
import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import {
  ensureHtmlElementCount,
  ensureHtmlElements,
  noErrorsOrWarnings,
} from "../../verify.ts";

// The default listing template wraps the metadata block of every post in a
// link to the post. When nothing in that block shows text, the link is empty:
// a tab stop with no accessible name. The link is only written when the
// block has visible content. Cases covered: no date or author, fields that
// exclude every metadata field, a listed custom field that is missing, empty,
// blank or an empty list on the post. Every post keeps its metadata column to preserve the
// row layout.
const projectDir = docs("listings-metadata-link");
const outputDir = join(projectDir, "_site");
const metadataColumn = "div.quarto-post > div.metadata";

testQuartoCmd("render", [projectDir], [
  noErrorsOrWarnings,
  ...["index", "fields", "reading-time", "custom-field"].map((page) =>
    ensureHtmlElementCount(join(outputDir, `${page}.html`), {
      selectors: metadataColumn,
      counts: 5,
    })
  ),
  // default fields
  ensureHtmlElements(join(outputDir, "index.html"), [
    'div.metadata a[href$="/dated/index.html"] div.listing-date',
    'div.metadata a[href$="/dated/index.html"] div.listing-author',
  ], [
    'div.metadata a[href$="/undated/index.html"]',
    'div.metadata a[href$="/empty-version/index.html"]',
  ]),
  // fields exclude every metadata field
  ensureHtmlElements(join(outputDir, "fields.html"), [], [
    "div.metadata a",
  ]),
  // every post has a reading time, so every post keeps its link
  ensureHtmlElements(join(outputDir, "reading-time.html"), [
    'div.metadata a[href$="/dated/index.html"] div.listing-reading-time',
    'div.metadata a[href$="/undated/index.html"] div.listing-reading-time',
    'div.metadata a[href$="/empty-version/index.html"] div.listing-reading-time',
    'div.metadata a[href$="/blank-version/index.html"] div.listing-reading-time',
    'div.metadata a[href$="/empty-list-version/index.html"] div.listing-reading-time',
  ], []),
  // the link is only written where version has a value
  ensureHtmlElements(join(outputDir, "custom-field.html"), [
    'div.metadata a[href$="/dated/index.html"] div.listing-version',
  ], [
    'div.metadata a[href$="/undated/index.html"]',
    'div.metadata a[href$="/empty-version/index.html"]',
    'div.metadata a[href$="/blank-version/index.html"]',
    'div.metadata a[href$="/empty-list-version/index.html"]',
  ]),
  // every post but undated keeps its listing-version div
  ensureHtmlElementCount(join(outputDir, "custom-field.html"), {
    selectors: "div.metadata div.listing-version",
    counts: 4,
  }),
], {
  name: "Listing metadata link is only written when it has content",
  teardown: () => {
    removeIfExists(outputDir);
    removeIfExists(join(projectDir, ".quarto"));
    return Promise.resolve();
  },
});
