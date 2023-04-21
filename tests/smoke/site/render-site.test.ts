/*
* render-site.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";
import { testSite } from "./site.ts";

testSite(docs("site/index.qmd"), docs("site/index.qmd"), [
  ".quarto-embed-nb-cell", // Embed is present
], []);
