/*
* drafts.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";
import { testSiteWithProfile } from "../site/site.ts";

// Chain the tests sequentially
testSiteWithProfile("navbar-search")(docs("search/issue-9905/index.qmd"), docs("search/issue-9905/"), ["div#quarto-search"], [])
testSiteWithProfile("sidebar-search")(docs("search/issue-9905/index.qmd"), docs("search/issue-9905/"), ["div#quarto-search"], [])
testSiteWithProfile("navbar-no-search")(docs("search/issue-9905/index.qmd"), docs("search/issue-9905/"), [], ["div#quarto-search"])
testSiteWithProfile("sidebar-no-search")(docs("search/issue-9905/index.qmd"), docs("search/issue-9905/"), [], ["div.sidebar-search"]);


