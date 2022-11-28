/*
* install-tools.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { testQuartoCmd } from "../../test.ts";
import { noErrorsOrWarnings, printsMessage } from "../../verify.ts";

testQuartoCmd(
  "tools",
  ["list"],
  [
    noErrorsOrWarnings,
    printsMessage("INFO", /tinytex\s+/),
    // printsMessage("INFO", /chromium\s+/),
    // temporarily disabled until we get puppeteer back
  ],
);
