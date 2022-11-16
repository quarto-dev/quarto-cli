/*
* guess-chunk-options-format-document.test.ts
*
* test that guess-chunk-options-format correctly controls YAML
* validation in knitr chunks
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { testRender } from "../smoke/render/render.ts";


const computesKnitr = "docs/yaml/guess-chunk-options-format-knitr.qmd";
testRender(computesKnitr, "html", false, [
  
]);

