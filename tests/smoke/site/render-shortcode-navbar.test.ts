/*
* render-shortcode-navbar.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs, projectOutputForInput } from "../../utils.ts";
import { ensureFileRegexMatches } from "../../verify.ts";
import { testSite } from "./site.ts";

testSite(
  docs("websites/issue-3686/index.qmd"),
  docs("websites/issue-3686/index.qmd"),
  [],
  [],
  ensureFileRegexMatches(
    projectOutputForInput(docs("websites/issue-3686/index.qmd"))
      .outputPath,
    [],
    [/\{\{\&lt\;/, /\&gt\;\}\}/],
  ),
);
