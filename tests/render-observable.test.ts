/*
* render.observable.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { testRender } from "./render.ts";
import {
  hasSupportingFiles,
  noSupportingFiles,
  outputCreated,
} from "./verify.ts";

testRender("docs/test-observable.md", "html", [
  outputCreated,
  hasSupportingFiles,
]);
