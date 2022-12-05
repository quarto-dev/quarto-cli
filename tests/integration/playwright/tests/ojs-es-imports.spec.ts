import { expect, test } from "@playwright/test";
import assert from "node:assert";
import { checkClick } from "../src/utils.js";

import { getUrl, ojsRuns, ojsVal } from "../src/utils.js";

test("code tools behave well under echo=false", async ({ page }) => {
  const url = "ojs/test-ojs-es-modules.html";

  await page.goto(getUrl(url), {
    waitUntil: "networkidle",
  });

  assert(await ojsRuns(page));
  assert(await ojsVal(page, "x", 35));
});
