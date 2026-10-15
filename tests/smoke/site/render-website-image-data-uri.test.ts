/*
 * render-website-image-data-uri.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { removeIfExists } from "../../../src/core/path.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import {
  ensureFileRegexMatches,
  noErrors,
  printsMessage,
} from "../../verify.ts";

// Crawlers and feed readers fetch images by URL, so a data URI is never used
// as a social or feed image. Listing cards are shown by the browser, so they
// keep it.
const projectDir = docs("website-image-data-uri");
const outputDir = join(projectDir, "_site");

const siteImage = (name: string) =>
  new RegExp(`<meta ${name} content="https://example\\.com/site\\.png">`);
const ogSiteImage = siteImage('property="og:image"');
const twitterSiteImage = siteImage('name="twitter:image"');
const noDataUri = [/data:image/];
const noMetaDataUri = [/content="[^"]*data:image/];

const verify: Verify[] = [
  noErrors,
  // The ORCID badge is the only image, so the site `image` is used
  ensureFileRegexMatches(
    join(outputDir, "orcid.html"),
    [ogSiteImage, twitterSiteImage],
    noMetaDataUri,
  ),
  // The ORCID badge is skipped and the figure after it is used
  ensureFileRegexMatches(join(outputDir, "orcid-figure.html"), [
    /<meta property="og:image" content="https:\/\/example\.com\/figure\.png">/,
  ], noMetaDataUri),
  // A data URI marked as preview image is skipped for the next marked one
  ensureFileRegexMatches(join(outputDir, "preview-class.html"), [
    /<meta property="og:image" content="https:\/\/example\.com\/figure\.png">/,
  ], noMetaDataUri),
  // A data URI page `image` is ignored with a warning
  ensureFileRegexMatches(
    join(outputDir, "explicit.html"),
    [ogSiteImage, twitterSiteImage],
    noMetaDataUri,
  ),
  printsMessage({
    level: "WARN",
    regex: /data URI.*explicit\.qmd/,
  }),
  // The listing card keeps the data URI image
  ensureFileRegexMatches(join(outputDir, "posts.html"), [
    /<img [^>]*src="data:image\/png;base64,iVBORw0KGgo/,
  ]),
  // The feed item ignores it with a warning
  ensureFileRegexMatches(join(outputDir, "posts.xml"), [
    /<title>Post with a data URI image<\/title>/,
  ], noDataUri),
  printsMessage({
    level: "WARN",
    regex: /data URI image of posts[\\/]post\.qmd in the listing feed/,
  }),
];

testQuartoCmd("render", [projectDir], verify, {
  name: "Website social and feed images skip data URIs",
  teardown: () => {
    removeIfExists(outputDir);
    removeIfExists(join(projectDir, ".quarto"));
    return Promise.resolve();
  },
});
