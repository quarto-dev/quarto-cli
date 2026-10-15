/*
 * render-listing-feed-image.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { removeIfExists } from "../../../src/core/path.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import { ensureFileRegexMatches, noErrorsOrWarnings } from "../../verify.ts";

// The project is rendered from the test cwd, not from its own directory, so
// the feed image size must be read relative to the project, not the cwd.
const projectDir = docs("listings-feed-image");
const outputDir = join(projectDir, "_site");

// feed.png is 600x400, scaled down to fit the RSS 144px maximum width.
const feedImage = [
  /<image>\s*<url>https:\/\/example\.com\/feed\.png<\/url>/,
  /<height>96<\/height>\s*<width>144<\/width>\s*<\/image>/,
];

const verify: Verify[] = [
  noErrorsOrWarnings,
  // Listing `feed: image:` option
  ensureFileRegexMatches(join(outputDir, "index.xml"), feedImage),
  // The post image is document relative and scaled like the feed image
  ensureFileRegexMatches(join(outputDir, "index.xml"), [
    /<media:content url="https:\/\/example\.com\/feed\.png" medium="image" type="image\/png" height="96" width="144"\/>/,
  ]),
  // Site `image` fallback
  ensureFileRegexMatches(join(outputDir, "archive", "index.xml"), feedImage),
  // Project-relative path with a leading slash
  ensureFileRegexMatches(join(outputDir, "updates", "index.xml"), feedImage),
];

testQuartoCmd("render", [projectDir], verify, {
  name: "Listing feed image size is read relative to the project",
  teardown: () => {
    removeIfExists(outputDir);
    removeIfExists(join(projectDir, ".quarto"));
    return Promise.resolve();
  },
});
