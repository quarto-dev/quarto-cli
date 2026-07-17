/*
* check.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { testQuartoCmd } from "../../test.ts";
import { isBinaryMode } from "../../quarto-cmd.ts";
import { noErrorsOrWarnings, printsMessage } from "../../verify.ts";

// Dev mode reports the 99.9.9 sentinel version; a built binary reports its
// real version, so only require a semver-shaped version line there.
const versionRegex = isBinaryMode()
  ? /Version: \d+\.\d+\.\d+/
  : /Version: 99\.9\.9/;

testQuartoCmd(
  "check",
  [],
  [
    noErrorsOrWarnings,
    printsMessage({level: "INFO", regex: versionRegex}),
  ],
);
