/*
* check-versions-no-mismatch.test.ts
*
* Copyright (C) 2020-2025 Posit Software, PBC
*
*/

import { testQuartoCmd } from "../../test.ts";
import { printsMessage } from "../../verify.ts";

// If this test fails, it indicates that there is a version mismatch 
// Check 'src\command\check\check.ts' for the recorded versions, and compare to 'configuration' file
testQuartoCmd(
  "check",
  ["versions"],
  [
    printsMessage({
      level: "INFO",
      regex: "does not strictly match",
      negate: true  // Verify this message does NOT appear
    })
  ],
  undefined,
  "check versions --strict should not show version mismatches"
);
