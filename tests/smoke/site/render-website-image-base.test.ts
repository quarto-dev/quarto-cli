/*
 * render-website-image-base.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { removeIfExists } from "../../../src/core/path.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import {
  ensureFileRegexMatches,
  fileExists,
  noErrorsOrWarnings,
} from "../../verify.ts";

// The site `image` is set in _quarto.yml, so it is relative to the project.
// A page `image` is set in the document, so it is relative to the document.
// Both must keep their base wherever the page or listing sits in the site.
const projectDir = docs("website-image-base");
const outputDir = join(projectDir, "_site");

// No URL may contain a doubled slash after the scheme (site-url ends with `/`).
const noDoubleSlash = [/https:\/\/example\.com\/site\/\//];

const verify: Verify[] = [
  noErrorsOrWarnings,
  // Site `image` fallback on a page in a subdirectory
  ensureFileRegexMatches(join(outputDir, "blog", "index.html"), [
    /<meta property="og:image" content="https:\/\/example\.com\/site\/site\.png">/,
    /<meta property="og:image:height" content="400">/,
  ], noDoubleSlash),
  // The site `image` is only used by subdirectory pages and still gets copied
  fileExists(join(outputDir, "site.png")),
  // Page `image` of a listing in a subdirectory, used as the feed image
  ensureFileRegexMatches(join(outputDir, "news", "index.xml"), [
    /<image>\s*<url>https:\/\/example\.com\/site\/news\/thumb\.png<\/url>/,
    /<height>96<\/height>\s*<width>144<\/width>\s*<\/image>/,
  ], noDoubleSlash),
];

testQuartoCmd("render", [projectDir], verify, {
  name: "Website and page images keep their base in subdirectories",
  teardown: () => {
    removeIfExists(outputDir);
    removeIfExists(join(projectDir, ".quarto"));
    return Promise.resolve();
  },
});
