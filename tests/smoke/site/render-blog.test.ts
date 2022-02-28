/*
* render-blog.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { docs } from "../../utils.ts";
import { testSite } from "./site.ts";

testSite(docs("blog/about.qmd"), [
  "div.jolla", // Correct type
  "img.about-image", // Image is present
  "div.about-links", // Links are present
  "main.content", // Main content is still there
], []);
testSite(docs("blog/index.qmd"), [
  "div#listing-listing", // the listing is rendered there
  "div.list.quarto-listing-default", // The correct type of listing
  ".quarto-listing-category-title", // Categories are present
], []);
