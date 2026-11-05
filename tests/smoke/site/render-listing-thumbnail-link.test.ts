/*
 * render-listing-thumbnail-link.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { removeIfExists } from "../../../src/core/path.ts";
import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import { ensureHtmlElements, noErrorsOrWarnings } from "../../verify.ts";

// The default listing template wraps the thumbnail of every post in a link
// to the post. When a post has no preview image and the listing sets no
// image-placeholder, the thumbnail is an empty div, which left a link with
// no accessible name in the tab order (#15066). That link is now hidden
// from assistive technology and taken out of the tab order; thumbnails that
// show an image keep a plain link.
const projectDir = docs("listings-thumbnail-link");
const outputDir = join(projectDir, "_site");

testQuartoCmd("render", [projectDir], [
  noErrorsOrWarnings,
  ensureHtmlElements(join(outputDir, "index.html"), [
    // image from the front matter: a plain link
    'div.thumbnail a:not([aria-hidden]):not([tabindex]) img[src$="thumb.png"]',
    // image found in the rendered post: a plain link
    'div.thumbnail a:not([aria-hidden]):not([tabindex]) img[src$="figure.png"]',
    // no image: the empty placeholder link is hidden and not a tab stop
    'div.thumbnail a[aria-hidden="true"][tabindex="-1"] div.listing-item-img-placeholder',
  ], [
    'div.thumbnail a:not([tabindex="-1"]) div.listing-item-img-placeholder',
  ]),
  // with image-placeholder every post shows an image, so no link is hidden
  ensureHtmlElements(join(outputDir, "placeholder.html"), [
    'div.thumbnail a:not([aria-hidden]):not([tabindex]) img[src$="placeholder.png"]',
  ], [
    "div.listing-item-img-placeholder",
    "div.thumbnail a[aria-hidden]",
    "div.thumbnail a[tabindex]",
  ]),
], {
  name: "Listing thumbnail link of a post without an image is not a tab stop",
  teardown: () => {
    removeIfExists(outputDir);
    removeIfExists(join(projectDir, ".quarto"));
    return Promise.resolve();
  },
});
