/*
* render-navigation.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";
import { testSite } from "./site.ts";

// single-id profile 
// On reference page should havea side bar
testSite(docs("sidebar/single-id/reference.qmd"), docs("sidebar/single-id"), 
  ["nav#quarto-sidebar"], 
  [],
);

testSite(docs("sidebar/single-id/index.qmd"), docs("sidebar/single-id"), 
  [],
  ["nav#quarto-sidebar"]
);

