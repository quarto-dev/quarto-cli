import { expect, test } from "@playwright/test";
import assert from "node:assert";
import { getUrl, ojsRuns, ojsVal } from "../src/utils.js";

test("ojs-define in R works", async ({ page }) => {
  await page.goto(getUrl("ojs/test-ojs-define-1.html"), {
    waitUntil: "networkidle",
  });

  assert(await ojsRuns(page));

  assert(await ojsVal(page, "b", "a"));
});

test("import ojs-define from .qmd works", async ({ page }) => {
  await page.goto(getUrl("ojs/test-ojs-define-2.html"), {
    waitUntil: "networkidle",
  });

  assert(await ojsRuns(page));

  assert(await ojsVal(page, "b", "a"));
});
