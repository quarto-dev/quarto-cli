/*
 * render-listing-pagination.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { removeIfExists } from "../../../src/core/path.ts";
import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import { ensureFileRegexMatches, printsMessage } from "../../verify.ts";

const projectDir = docs("listings/pagination-warning");
const outputDir = join(projectDir, "_site");

testQuartoCmd("render", [projectDir], [
  printsMessage({
    level: "WARN",
    regex: /Listing 'warned': pagination option 'inner-window'/,
  }),
  ensureFileRegexMatches(join(outputDir, "index.html"), [
    /pagination: \{ left: 1, right: 1, item:/,
  ], [
    /innerWindow/,
  ]),
], {
  name: "Listing pagination options are checked at render time",
  teardown: () => {
    removeIfExists(outputDir);
    removeIfExists(join(projectDir, ".quarto"));
    return Promise.resolve();
  },
});
