/*
 * fail-07.test.ts
 *
 * TRIAL ONLY — seeded failure for the GitHub Actions log-grouping trial
 * matrix (dev-docs/ci-test-log-grouping-design.md, verification item 3).
 * Lives only on the throwaway trial branch. DO NOT MERGE.
 */
import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";

unitTest("trial seeded failure 07", async () => {
  assert(false, "seeded failure 07 for the GHA log-grouping trial %::,\nhostile-chars-line");
});
