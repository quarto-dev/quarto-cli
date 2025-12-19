/*
* __temporary-failing-test.test.ts
*
* TEMPORARY FAILING TEST - FOR CI LOG TESTING ONLY
* This test is intentionally failing to verify grouping behavior in CI logs
*
*/

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";

unitTest("temporary failing test for CI verification", async () => {
  // This will always fail
  assert(false, "This is a temporary failing test to verify CI log grouping");
});
