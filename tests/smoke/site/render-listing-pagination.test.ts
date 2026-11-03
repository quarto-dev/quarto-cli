/*
 * render-listing-pagination.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { removeIfExists } from "../../../src/core/path.ts";
import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import { ensureHtmlElements, printsMessage } from "../../verify.ts";

const projectDir = docs("playwright/listings/pagination");
const outputDir = join(projectDir, "_site");

testQuartoCmd("render", [projectDir], [
  printsMessage({
    level: "WARN",
    regex: /Listing 'invalid': pagination option 'inner-window'/,
  }),
  ensureHtmlElements(join(outputDir, "index.html"), [
    "nav#absent-pagination.listing-pagination",
    "nav#left-pagination.listing-pagination",
    "nav#outer-pagination.listing-pagination",
    "nav#mixed-pagination.listing-pagination",
    "nav#invalid-pagination.listing-pagination",
  ]),
], {
  name: "Listing pagination options are checked at render time",
  teardown: () => {
    removeIfExists(outputDir);
    removeIfExists(join(projectDir, ".quarto"));
    return Promise.resolve();
  },
});
