/*
* render.jupyter.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { tryRender } from "./render.ts";

tryRender("docs/test-jupyter.md", "pdf");
tryRender("docs/unpaired.ipynb", "html", ["--quiet"]);
tryRender("docs/unpaired-md.md", "html");
