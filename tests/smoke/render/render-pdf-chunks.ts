/*
* render-pdf-chunks.test.ts
*
* Copyright (C) 2020-2023 Posit, PBC
*
*/
import { docs } from "../../utils.ts";

import { testRender } from "./render.ts";

// Simple rendering tests
testRender(docs("latexmk/chunks.qmd"), "pdf", true);
