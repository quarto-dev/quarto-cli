/*
* check.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { testQuartoCmd } from "../../test.ts";
import { noErrorsOrWarnings, printsMessage } from "../../verify.ts";

testQuartoCmd(
  "check",
  [],
  [
    noErrorsOrWarnings,
    printsMessage("INFO", /Version: 99\.9\.9/),
  ],
);
