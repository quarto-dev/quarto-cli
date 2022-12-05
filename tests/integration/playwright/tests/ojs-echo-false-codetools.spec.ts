import { expect, test } from "@playwright/test";
import assert from "node:assert";
import { checkClick } from "../src/utils.js";

import { getUrl, ojsRuns } from "../src/utils.js";

test("code tools behave well under echo=false", async ({ page }) => {
  const sel = "#quarto-code-tools-source, #quarto-code-tools-menu";

  await page.goto(getUrl("ojs/test-ojs-echo-false-codetools-dropdown.html"), {
    waitUntil: "networkidle",
  });

  assert(await ojsRuns(page));

  assert(await checkClick(page, await page.locator(sel)));

  await page.goto(getUrl("ojs/test-ojs-echo-false-codetools-dropdown-2.html"), {
    waitUntil: "networkidle",
  });

  assert(await ojsRuns(page));

  assert(await checkClick(page, await page.locator(sel)));
});
