/*
 * issue-12374.test.ts
 *
 * https://github.com/quarto-dev/quarto-cli/issues/12374
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { testQuartoCmd } from "../../test.ts";
import { noErrors } from "../../verify.ts";

// https://github.com/quarto-dev/quarto-cli/issues/12374
testQuartoCmd(
  "render",
  [
    "docs/jupyter/issue-12374.ipynb",
    "--no-execute-daemon",
    "--execute",
  ],
  [noErrors],
  {},
  "jupyter:issue-12374.test.ts",
);
