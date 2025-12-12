/*
 * test-failure-marker.test.ts
 *
 * Temporary test to verify CI failure annotations and markers work correctly.
 * This test intentionally fails to verify the ━━━ TEST FAILURE: marker appears
 * in CI logs and annotations can be used to navigate to failures.
 *
 * TODO: Remove this test file after verifying CI behavior
 */

import { testQuartoCmd } from "../test.ts";
import { docs } from "../utils.ts";
import { noErrors } from "../verify.ts";

// Test intentional failure - render will fail because file doesn't exist
// This should show the distinctive ━━━ TEST FAILURE: marker in CI logs
testQuartoCmd(
  "render",
  [docs("nonexistent-file.qmd"), "--to", "html"],
  [noErrors],
);
