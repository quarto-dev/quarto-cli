/*
* listings.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ensureFileRegexMatches, ensureHtmlElements } from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { crossref } from "./utils.ts";

const listingsQmd = crossref("listings.qmd", "html");
testRender(listingsQmd.input, "html", false, [
  ensureHtmlElements(listingsQmd.output.outputPath, [
    "div#lst-customers.listing",
  ]),
  ensureFileRegexMatches(listingsQmd.output.outputPath, [
    /Listing&nbsp;1/,
    /Listing&nbsp;1: Customers Query/,
  ], [
    /\?@sec-/,
  ]),
]);
