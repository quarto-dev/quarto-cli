/*
* check-versions-no-mismatch.test.ts
*
* Copyright (C) 2020-2025 Posit Software, PBC
*
*/

import { testQuartoCmd } from "../../test.ts";
import { printsMessage } from "../../verify.ts";

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
