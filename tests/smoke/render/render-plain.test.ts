/*
* render-plain.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";
import { testRender } from "./render.ts";

testRender(docs("test-plain.md"), "html", false);
testRender(docs("test-singleformat-docx.qmd"), "docx", true);
testRender(docs("test-singleformat-context.qmd"), "context", true);
testRender(docs("test-singleformat-html.qmd"), "html", false);
