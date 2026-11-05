/*
 * document-csl-title.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { documentCSL } from "../../src/quarto-core/attribution/document.ts";

const cslTitle = (converted?: string) =>
  documentCSL(
    "doc.qmd",
    { title: "Raw *t*" },
    "webpage",
    undefined,
    undefined,
    converted,
  ).csl.title;

unitTest("documentCSL - raw title without a converted title", async () => {
  assertEquals(cslTitle(undefined), "Raw *t*");
});

unitTest("documentCSL - converted title replaces the raw title", async () => {
  assertEquals(cslTitle("Conv <i>t</i>"), "Conv <i>t</i>");
});

unitTest("documentCSL - empty converted title means no title", async () => {
  assertEquals(!!cslTitle(""), false);
});
