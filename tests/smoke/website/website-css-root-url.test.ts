/*
 * website-css-root-url.test.ts
 *
 * Root-relative url() and @import references in a stylesheet that lives in a
 * subdirectory are rewritten relative to the stylesheet with a slash after
 * the offset (`../assets/x.woff2`, not `..assets/x.woff2`), and the referenced
 * files are copied to the output directory. This holds for a `css:` stylesheet
 * and for a stylesheet two levels down that is copied as a project resource.
 * See https://github.com/quarto-dev/quarto-cli/issues/15362
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { ensureFileRegexMatches, fileExists, noErrors } from "../../verify.ts";

const renderDir = docs("websites/css-root-url");
const outDir = join(renderDir, "_site");

testQuartoCmd(
  "render",
  [renderDir],
  [
    noErrors,
    ensureFileRegexMatches(
      join(outDir, "styles", "fonts.css"),
      [
        /url\(\.\.\/assets\/x\.woff2\)/,
        /url\("\.\.\/assets\/bg\.png"\)/,
        /@import "\.\.\/assets\/base\.css"/,
      ],
      [/\.\.assets/],
    ),
    ensureFileRegexMatches(
      join(outDir, "styles", "sub", "other.css"),
      [/url\(\.\.\/\.\.\/assets\/sub-bg\.png\)/],
      [/\.\.assets/],
    ),
    fileExists(join(outDir, "assets", "x.woff2")),
    fileExists(join(outDir, "assets", "bg.png")),
    fileExists(join(outDir, "assets", "base.css")),
    fileExists(join(outDir, "assets", "sub-bg.png")),
  ],
  {
    teardown: () => {
      safeRemoveSync(outDir, { recursive: true });
      return Promise.resolve();
    },
  },
);
