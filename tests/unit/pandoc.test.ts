/*
* pandoc.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { assert, assertEquals } from "testing/asserts";
import { getenv } from "../../src/core/env.ts";
import { parsePandocTitle } from "../../src/core/pandoc/pandoc-partition.ts";
import { pandocBinaryPath, resourcePath } from "../../src/core/resources.ts";
import { unitTest } from "../test.ts";

// RStudio Workbench {{< var buildType >}} {{< var version >}}
// ### Prerequisites
// Administrative Dashboard [PRO]{.pro-header}
// Customizing the Sign-In Page
// # /etc/rstudio/rserver.conf
// ## R Versions {.pro-header}

unitTest(
  "pandoc",
  //deno-lint-ignore require-await
  async () => {
    const title = parsePandocTitle("# RStudio Server [PRO]{.cool-item}");
    assert(title.heading === "RStudio Server [PRO]{.cool-item}");

    const title2 = parsePandocTitle(
      "# RStudio Server [PRO]{.cool-item} {.foobar}",
    );
    assert(title2.heading === "RStudio Server [PRO]{.cool-item}");
    assert(title2.attr?.classes.includes("foobar"));

    const title3 = parsePandocTitle(
      "# What is up dog?",
    );
    assert(title3.heading === "What is up dog?");

    const title4 = parsePandocTitle(
      "# What is up dog? {.section-heading}",
    );
    assert(title4.heading === "What is up dog?");
    assert(
      title4.attr?.classes.length === 1 &&
        title4.attr.classes.includes("section-heading"),
    );
  },
);
