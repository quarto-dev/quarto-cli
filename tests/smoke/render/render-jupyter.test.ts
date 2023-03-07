/*
* render.jupyter.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";
import { testRender } from "./render.ts";

testRender(docs("test-jupyter.md"), "pdf", true);
testRender(docs("unpaired.ipynb"), "html", false);
testRender(docs("unpaired-md.md"), "html", false);
