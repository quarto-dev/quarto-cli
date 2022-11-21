/*
* render-navigation.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";
import { testSite } from "./site.ts";

// Test a page with page navigation
testSite(docs("site-navigation/page2.qmd"), docs("site-navigation/page2.qmd"), [
  ".page-navigation .nav-page-next a .nav-page-text", // Next page target and text
  ".page-navigation .nav-page-previous a .nav-page-text", // Prev page target and text
], []);

// Test a page with only previous nav
testSite(docs("site-navigation/page3.qmd"), docs("site-navigation/page3.qmd"), [
  ".page-navigation .nav-page-previous a .nav-page-text", // Prev page target and text
], [
  ".page-navigation .nav-page-next a .nav-page-text", // Next page target and text
]);

testSite(docs("site-navigation/index.qmd"), docs("site-navigation/index.qmd"), [
  ".navbar .nav-item", // Navbar with nav item
  ".navbar #quarto-search", // Search is present on navbar
  "#quarto-sidebar .sidebar-item a", // The sidebar with items is present
], [
  ".page-navigation .nav-page-next a .nav-page-text", // Shouldn't have page navigation
  ".page-navigation .nav-page-previous a .nav-page-text", // Shouldn't have page navigation
]);
