import { expect, test } from "@playwright/test";
import assert from "node:assert";

import { getUrl, ojsRuns, ojsVal } from "../src/utils.js";

test("page without ojs cell has no ojs runtime", async ({ page }) => {
  await page.goto(getUrl("ojs/test-no-ojs.html"), { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    return (window._ojs === undefined);
  });
  assert(result === true, `Expected true, got false instead`);
});

test("page with ojs cell has ojs runtime", async ({ page }) => {
  await page.goto(getUrl("ojs/test-ojs.html"), { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    return (window._ojs !== undefined);
  });
  assert(result === true, `Expected true, got false instead`);
});
