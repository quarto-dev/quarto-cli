/*
* drafts.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";
import { testSite } from "../site/site.ts";

await testSite(docs("search/issue-9905/navbar/index.qmd"), docs("search/issue-9905/navbar"), [], ["div#quarto-search"])
await testSite(docs("search/issue-9905/sidebar/index.qmd"), docs("search/issue-9905/sidebar"), [], ["div.sidebar-search"]);

