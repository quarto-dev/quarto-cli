/*
 * cache.test.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */
import { quarto } from "../../../src/quarto.ts";
import { test } from "../../test.ts";
import { assertEquals } from "testing/asserts";

test({
  name: "jupyter:cache:test-1",
  context: {},
  execute: async () => {
    // return await new Promise((_resolve, reject) => {
    //   setTimeout(reject, 10000, "timed out after 10 seconds");
    // })
    // https://github.com/quarto-dev/quarto-cli/issues/9618
    // repeated executions to trigger jupyter cache
    await quarto(["render", "docs/jupyter/cache/test.qmd", "--no-execute-daemon"]);
    await quarto(["render", "docs/jupyter/cache/test.qmd", "--no-execute-daemon"]);
  },
  verify: [],
  type: "smoke",
});
