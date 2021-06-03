/*
* render-plain.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { testRender } from "./render.ts";
import { hasSupportingFiles, outputCreated } from "./verify.ts";

testRender("docs/test-plain.md", "html", [
  outputCreated,
  hasSupportingFiles,
]);
