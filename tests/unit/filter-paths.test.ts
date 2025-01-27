/*
* glob.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { assert } from "testing/asserts";
import { filterPaths } from "../../src/core/path.ts";
import { unitTest } from "../test.ts";

unitTest(
  "globs",
  //deno-lint-ignore require-await
  async () => {
    const paths = [
      "/test.qmd",
      "/test2.qmd",
      "/test3.qmd",
      "/folder/test.qmd",
      "/folder/test2.qmd",
      "/folder/test.txt",
    ];

    const globDescs = [
      { globs: ["*.qmd"], includes: 5, excludes: 0 },
      { globs: ["**"], includes: 6, excludes: 0 },
      { globs: ["*.qmd", "!folder"], includes: 5, excludes: 0 },
      { globs: ["*.qmd", "!folder/"], includes: 5, excludes: 3 },
      { globs: ["test*.*", "!folder/"], includes: 6, excludes: 3 },
      { globs: ["test*.*", "!*.txt"], includes: 6, excludes: 1 },
      { globs: ["folder/*.txt"], includes: 1, excludes: 0 },
      { globs: ["folder/*.*", "!*.txt"], includes: 3, excludes: 1 },
      { globs: ["folder/**"], includes: 3, excludes: 0 },
      { globs: ["test2.*", "!folder/"], includes: 2, excludes: 3 },
    ];
    for (const globDesc of globDescs) {
      const filtered = filterPaths("/", paths, globDesc.globs);
      assert(
        filtered.include.length === globDesc.includes,
        `Globs [${
          globDesc.globs.join(",")
        }] result in the wrong number of 'includes' matches.`,
      );
      assert(
        filtered.exclude.length === globDesc.excludes,
        `Globs [${
          globDesc.globs.join(",")
        }] result in the wrong number of 'excludes' matches.`,
      );
    }
  },
);
