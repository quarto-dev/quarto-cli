/*
* check-versions-no-mismatch.test.ts
*
* Copyright (C) 2020-2025 Posit Software, PBC
*
*/

import { testQuartoCmd, type Verify } from "../../test.ts";
import { printsMessage } from "../../verify.ts";

// For unexpected mismatches, compare versionConstraints in
// src/command/check/check.ts with configuration.

// QUARTO_TEST_EXPECTED_PANDOC records an intentional override. Accept either
// OK or a strict-mismatch note for that version, normalized as in check.ts.
const expectedPandocOverride = Deno.env.get("QUARTO_TEST_EXPECTED_PANDOC");

// Mirrors the padding/truncation check.ts applies before its strict
// comparison, so a requested "3.10" matches the reported "3.10.0".
const normalizePandocVersion = (version: string): string => {
  const parts = version.split(".");
  if (parts.length > 3) {
    return parts.slice(0, 3).join(".");
  }
  return parts.concat(Array(3 - parts.length).fill("0")).join(".");
};

// The Pandoc override does not change Dart Sass, Deno, or Typst.
const verifies: Verify[] = [
  printsMessage({
    level: "INFO",
    regex: "(Dart Sass|Deno|Typst) version .*does not strictly match",
    negate: true,
  }),
];

if (expectedPandocOverride) {
  // Require the requested version, normalized as in check.ts.
  // Accept OK or a strict-mismatch note.
  verifies.push(
    printsMessage({
      level: "INFO",
      regex: `Pandoc version ${
        normalizePandocVersion(expectedPandocOverride).replaceAll(".", "\\.")
      }(: OK| does not strictly match)`,
    }),
  );
} else {
  verifies.push(
    printsMessage({
      level: "INFO",
      regex: "Pandoc version .*does not strictly match",
      negate: true,
    }),
  );
}

testQuartoCmd(
  "check",
  ["versions"],
  verifies,
  undefined,
  "check versions should report expected dependency versions",
);
