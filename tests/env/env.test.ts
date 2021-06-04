/*
* env.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { testQuartoCmd } from "../test.ts";
import { noErrorsOrWarnings, printsMessage } from "../verify.ts";

testQuartoCmd(
  "env",
  [],
  [
    noErrorsOrWarnings,
    printsMessage("INFO", /^Quarto$/),
    printsMessage("INFO", /^Deno$/),
    printsMessage("INFO", /^Pandoc$/),
  ],
);

testQuartoCmd(
  "env",
  ["r"],
  [
    noErrorsOrWarnings,
    printsMessage("INFO", /^R$/),
  ],
);

testQuartoCmd(
  "env",
  ["python"],
  [
    noErrorsOrWarnings,
    printsMessage("INFO", /^python$/),
  ],
);
