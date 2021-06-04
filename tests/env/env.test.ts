/*
* env.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { testQuartoCmd } from "../test.ts";
import { noErrorsOrWarnings, printsMessage } from "../verify.ts";

// test all, empty
["", "all"].forEach((arg) => {
  testQuartoCmd(
    "env",
    [arg],
    [
      noErrorsOrWarnings,
      printsMessage("INFO", /^Quarto$/),
      printsMessage("INFO", /^Deno$/),
      printsMessage("INFO", /^Pandoc$/),
    ],
  );
});

// test R specific
testQuartoCmd(
  "env",
  ["r"],
  [
    noErrorsOrWarnings,
    printsMessage("INFO", /^R$/),
  ],
);

// test python specific
testQuartoCmd(
  "env",
  ["python"],
  [
    noErrorsOrWarnings,
    printsMessage("INFO", /^python$/),
  ],
);
