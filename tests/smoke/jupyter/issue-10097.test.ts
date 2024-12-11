/*
 * parameter-label-duplication.test.ts
 * 
 * https://github.com/quarto-dev/quarto-cli/issues/10097
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { quarto } from "../../../src/quarto.ts";
import { test } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { noErrors } from "../../verify.ts";

test({
  name: "jupyter:parameter:label-duplication",
  context: {},
  execute: async () => {
    // https://github.com/quarto-dev/quarto-cli/issues/10097
    await quarto(["render", 
      "docs/jupyter/parameters/issue-10097.qmd",
      "--execute-param", 'datapath:"weird"', 
      "--no-execute-daemon", "--execute"]);
  },
  verify: [noErrors],
  type: "smoke",
});
