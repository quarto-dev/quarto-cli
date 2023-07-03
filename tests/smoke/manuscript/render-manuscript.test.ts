/*
* render-embed.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { dirname, join } from "path/mod.ts";
import { docs, outputForInput } from "../../utils.ts";
import {
  ensureFileRegexMatches,
  ensureHtmlElements,
  fileExists,
  noErrorsOrWarnings,
} from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { testManuscriptRender } from "./manuscript.ts";

const article = docs("manuscript/base/index.qmd");
testManuscriptRender(
  article,
  "all",
  ["html", "jats", "docx"],
  [],
);
