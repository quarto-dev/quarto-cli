/*
* check-versions-no-mismatch.test.ts
*
* Copyright (C) 2020-2025 Posit Software, PBC
*
*/

import { testQuartoCmd, type Verify } from "../../test.ts";
import { printsMessage } from "../../verify.ts";

// If this test fails, it indicates that there is a version mismatch
// Check 'src\command\check\check.ts' for the recorded versions, and compare to 'configuration' file

// A test-smokes.yml dispatch can intentionally run against a Pandoc newer than
// the bundled one (pandoc-override-version input, via QUARTO_PANDOC). The
// pandoc-override action records the requested version in
// QUARTO_TEST_EXPECTED_PANDOC; the strict-mismatch note is then expected for
// Pandoc, and only for exactly that version.
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

// Dart Sass, Deno and Typst are never overridden: no mismatch note for them.
const verifies: Verify[] = [
  printsMessage({
    level: "INFO",
    regex: "(Dart Sass|Deno|Typst) version .*does not strictly match",
    negate: true,
  }),
];

if (expectedPandocOverride) {
  // The override differs from the bundled version on purpose: the note must
  // appear, naming exactly the requested version (anything else means the
  // override resolved to the wrong binary).
  verifies.push(
    printsMessage({
      level: "INFO",
      regex: `Pandoc version ${
        normalizePandocVersion(expectedPandocOverride).replaceAll(".", "\\.")
      } does not strictly match`,
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
  "check versions --strict should not show version mismatches",
);
