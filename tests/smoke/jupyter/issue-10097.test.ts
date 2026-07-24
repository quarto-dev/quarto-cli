/*
 * parameter-label-duplication.test.ts
 *
 * https://github.com/quarto-dev/quarto-cli/issues/10097
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { testQuartoCmd } from "../../test.ts";
import { noErrors } from "../../verify.ts";

// https://github.com/quarto-dev/quarto-cli/issues/10097
testQuartoCmd(
  "render",
  [
    "docs/jupyter/parameters/issue-10097.qmd",
    "--execute-param",
    'datapath:"weird"',
    "--no-execute-daemon",
    "--execute",
  ],
  [noErrors],
  {},
  "jupyter:parameter:label-duplication",
);
