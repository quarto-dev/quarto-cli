/*
 * render-navbar-tools-rel.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { docs, siteOutputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testSite } from "./site.ts";

testSite(
  docs("websites/issue-5756/index.qmd"),
  docs("websites/issue-5756/index.qmd"),
  [],
  [],
  ensureFileRegexMatches(
    siteOutputForInput(docs("websites/issue-5756/index.qmd"))
      .outputPath,
    ['rel="me"'],
    [],
  ),
);
