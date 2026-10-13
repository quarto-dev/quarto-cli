/*
 * render-listing-contents-file.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { removeIfExists } from "../../../src/core/path.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { docs } from "../../utils.ts";
import { ensureFileRegexMatches, noErrorsOrWarnings } from "../../verify.ts";

// The project is rendered from the test cwd, not from its own directory, so
// a file named in listing contents next to a folder must be found relative
// to the listing document, not the cwd.
const projectDir = docs("listings-contents-file");
const outputDir = join(projectDir, "_site");

const verify: Verify[] = [
  noErrorsOrWarnings,
  ensureFileRegexMatches(join(outputDir, "archive", "index.html"), [
    /Post from folder/,
    /Item from YAML/,
  ]),
];

testQuartoCmd("render", [projectDir], verify, {
  name: "Listing contents file next to a folder is read relative to the document",
  teardown: () => {
    removeIfExists(outputDir);
    removeIfExists(join(projectDir, ".quarto"));
    return Promise.resolve();
  },
});
