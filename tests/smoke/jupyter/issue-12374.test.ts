/*
 * issue-12374.test.ts
 * 
 * https://github.com/quarto-dev/quarto-cli/issues/12374
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { quarto } from "../../../src/quarto.ts";
import { test } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { noErrors } from "../../verify.ts";

test({
  name: "jupyter:issue-12374.test.ts",
  context: {},
  execute: async () => {
    // https://github.com/quarto-dev/quarto-cli/issues/12374
    await quarto(["render", 
      "docs/jupyter/issue-12374.ipynb",
      "--no-execute-daemon", "--execute"]);
  },
  verify: [noErrors],
  type: "smoke",
});
