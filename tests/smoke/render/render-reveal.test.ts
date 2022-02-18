/*
* render-reveal.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { docs } from "../../utils.ts";
import { testRender } from "./render.ts";

testRender(docs("reveal/index.qmd"), "revealjs", false);
