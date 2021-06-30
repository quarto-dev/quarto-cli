/*
* render.observable.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { testRender } from "./smoke/render/render.ts";

testRender("docs/test-observable.md", "html", false);
