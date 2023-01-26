/*
* convert-empty-frontmatter.test.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";
import { testConvert } from "./convert.ts";

testConvert(docs("empty-frontmatter.qmd"));
testConvert(docs("empty-frontmatter-julia.qmd"));
