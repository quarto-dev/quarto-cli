/*
* render-blog.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";
import { testSite } from "./site.ts";

testSite(docs("blog/about.qmd"), docs("blog/about.qmd"), [
  "div.quarto-about-jolla", // Correct type
  "img.about-image", // Image is present
  "div.about-links", // Links are present
  "main.content", // Main content is still there
], []);
testSite(docs("blog/index.qmd"), docs("blog"), [
  "div#listing-listing", // the listing is rendered there
  "div.list.quarto-listing-default", // The correct type of listing
  ".quarto-listing-category-title", // Categories are present
], []);

testSite(docs("blog-grid/index.qmd"), docs("blog-grid"), [
  "div.list.grid.quarto-listing-cols-3 > div:nth-child(1) div.listing-item-img-placeholder.card-img-top", // Placeholder structure correct
  "div.list.grid.quarto-listing-cols-3 > div:nth-child(2) p.card-img-top > img", // The grid image structure is correct
  "div.list.grid.quarto-listing-cols-3 > div:nth-child(3) p.card-img-top > img", // The grid image structure is correct
], []);
