/*
* render-pdf.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { docs } from "../../utils.ts";

import { testRender } from "./render.ts";

// Simple rendering tests
testRender(docs("templates/custom-template.qmd"), "pdf", true);
testRender(docs("templates/template-partial.qmd"), "pdf", true);
testRender(docs("templates/title-partial-html.qmd"), "html", false);
