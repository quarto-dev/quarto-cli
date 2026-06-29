/*
* render-title-block.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { docs, outputForInput } from "../../utils.ts";
import {
  ensureFileRegexMatches,
  ensureHtmlElements,
  ensureIpynbCellMatches,
} from "../../verify.ts";
import { testRender } from "./render.ts";

const input = docs("doc-layout/title-block.qmd");
const htmlOutput = outputForInput(input, "html");
testRender(input, "html", false, [
  ensureHtmlElements(htmlOutput.outputPath, [
    "div.quarto-title",
    "p.subtitle",
    "div.quarto-categories",
    "div.quarto-title-meta",
  ], []),
]);

const noneInput = docs("doc-layout/title-block-none.qmd");
const noneOutput = outputForInput(noneInput, "html");
testRender(noneInput, "html", false, [
  ensureHtmlElements(noneOutput.outputPath, [
    "p.author",
    "p.date",
    "#title-block-header",
  ], ["div.quarto-title"]),
  ensureFileRegexMatches(noneOutput.outputPath, [/Nora Jones/], [/Published/]),
]);

const bannerInput = docs("doc-layout/title-block-banner.qmd");
const bannerOutput = outputForInput(bannerInput, "html");
testRender(bannerInput, "html", false, [
  ensureHtmlElements(bannerOutput.outputPath, [
    "main.quarto-banner-title-block",
    ".quarto-title-banner .quarto-title.column-body",
    "header#title-block-header",
    ".title",
    ".quarto-categories",
  ]),
  ensureFileRegexMatches(bannerOutput.outputPath, [/Nora Jones/], [/\[true\]/]),
]);

// The ipynb title-block renders the ORCID icon as a link wrapping the icon
// image. The link must carry an accessible name so screen readers announce the
// author's ORCID profile instead of falling back to the base64 image data.
// \s+ between words tolerates pandoc's soft line wrapping of the cell source.
// Table-form author rows (authors without structured affiliations).
const orcidIpynbInput = docs("doc-layout/title-block-orcid-ipynb.qmd");
const orcidIpynbOutput = outputForInput(orcidIpynbInput, "ipynb");
testRender(orcidIpynbInput, "ipynb", true, [
  ensureIpynbCellMatches(orcidIpynbOutput.outputPath, {
    cellType: "markdown",
    matches: [
      /ORCID\s+profile\s+for\s+Norah\s+Jones/,
      /ORCID\s+profile\s+for\s+Jane\s+Doe/,
    ],
  }),
]);

// By-author block (authors with structured affiliations) — a separate template
// site from the table-form rows above.
const orcidIpynbAffilInput = docs(
  "doc-layout/title-block-orcid-ipynb-affiliation.qmd",
);
const orcidIpynbAffilOutput = outputForInput(orcidIpynbAffilInput, "ipynb");
testRender(orcidIpynbAffilInput, "ipynb", true, [
  ensureIpynbCellMatches(orcidIpynbAffilOutput.outputPath, {
    cellType: "markdown",
    matches: [/ORCID\s+profile\s+for\s+Norah\s+Jones/],
  }),
]);
