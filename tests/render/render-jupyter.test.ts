/*
* render.jupyter.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { testRender } from "../render.ts";
import {
  hasSupportingFiles,
  noSupportingFiles,
  outputCreated,
} from "../verify.ts";

testRender("docs/test-jupyter.md", "pdf", [
  outputCreated,
  noSupportingFiles,
]);
testRender("docs/unpaired.ipynb", "html", [
  outputCreated,
  hasSupportingFiles,
]);
testRender("docs/unpaired-md.md", "html", [
  outputCreated,
  hasSupportingFiles,
]);
