/*
* render-navigation.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { exists } from "fs/exists.ts";
import { dirname } from "path/mod.ts";
import { testQuartoCmd } from "../../test.ts";
import { docs, siteOutputForInput } from "../../utils.ts";
import { ensureHtmlElements, noErrorsOrWarnings } from "../../verify.ts";

const testSite = (
  input: string,
  includeSelectors: string[],
  excludeSelectors: string[],
) => {
  const output = siteOutputForInput(input);

  const verifySel = ensureHtmlElements(
    output.outputPath,
    includeSelectors,
    excludeSelectors,
  );

  // Run the command
  testQuartoCmd(
    "render",
    [input],
    [noErrorsOrWarnings, verifySel],
    {
      teardown: async () => {
        const siteDir = dirname(output.outputPath);
        if (await exists(siteDir)) {
          await Deno.remove(siteDir, { recursive: true });
        }
      },
    },
  );
};

// Test a page with page navigation
testSite(docs("site-navigation/page2.qmd"), [
  ".page-navigation .nav-page-next a .nav-page-text", // Next page target and text
  ".page-navigation .nav-page-previous a .nav-page-text", // Prev page target and text
], []);

// Test a page with only previous nav
testSite(docs("site-navigation/page3.qmd"), [
  ".page-navigation .nav-page-previous a .nav-page-text", // Prev page target and text
], [
  ".page-navigation .nav-page-next a .nav-page-text", // Next page target and text
]);

testSite(docs("site-navigation/index.qmd"), [
  ".navbar .nav-item", // Navbar with nav item
  ".navbar #quarto-search", // Search is present on navbar
  "#quarto-sidebar .sidebar-item a", // The sidebar with items is present
], [
  ".page-navigation .nav-page-next a .nav-page-text", // Shouldn't have page navigation
  ".page-navigation .nav-page-previous a .nav-page-text", // Shouldn't have page navigation
]);
