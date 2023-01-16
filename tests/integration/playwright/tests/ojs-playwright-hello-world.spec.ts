import { expect, test } from "@playwright/test";
import assert from "node:assert";

import { getUrl, ojsRuns, ojsVal } from "../src/utils.js";

test("homepage has title and links to intro page", async ({ page }) => {
  await page.goto(getUrl("ojs/test-ojs.html"), { waitUntil: "networkidle" });

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Hello Quarto OJS/);

  assert(await ojsRuns(page));

  // // create a locator
  // const getStarted = page.getByRole("link", { name: "Get started" });

  // // Expect an attribute "to be strictly equal" to the value.
  // await expect(getStarted).toHaveAttribute("href", "/docs/intro");

  // // Click the get started link.
  // await getStarted.click();

  // Expects the URL to contain intro.
  // await expect(page).toHaveURL(/.*intro/);
});
