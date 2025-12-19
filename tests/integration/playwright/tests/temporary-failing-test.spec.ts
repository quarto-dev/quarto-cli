import { expect, test } from "@playwright/test";

// TEMPORARY FAILING TEST - FOR CI LOG TESTING ONLY
// This test is intentionally failing to verify grouping behavior in CI logs
test("temporary failing test for CI verification", async ({ page }) => {
  // This will always fail
  expect(true).toBe(false);
});
