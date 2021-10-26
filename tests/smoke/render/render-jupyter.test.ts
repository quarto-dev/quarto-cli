/*
* render.jupyter.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { docs } from "../../utils.ts";
import { testRender } from "./render.ts";

if (Deno.build.os !== "windows") {
  testRender(docs("test-jupyter.md"), "pdf", true);
  testRender(docs("unpaired.ipynb"), "html", false);
  testRender(docs("unpaired-md.md"), "html", false);
}
