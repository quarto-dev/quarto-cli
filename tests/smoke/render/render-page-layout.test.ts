/*
* render-page-layout.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";

import { testRender } from "./render.ts";

// Simple rendering tests
// TODO: 10/11/2025 - SKIPPED FOR NOW DUE TO LATEX UPDATE PROBLEMS
// See https://github.com/quarto-dev/quarto-cli/issues/13647
// testRender(docs("page-layout/tufte-pdf.qmd"), "pdf", true);
testRender(docs("page-layout/tufte-html.qmd"), "html", false);
