import { expect, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression test for #13583. With code-copy enabled (the default), each code
// block is wrapped in div.code-copy-outer-scaffold, which used to break the
// direct-child selectors the code-tools "Show All Code" / "Hide All Code"
// handler relied on. The toggle must still open/close every folded <details>
// and swap the hidden<->unhidden class on the echo:false cell's source.
test("code-tools Show/Hide All Code toggles folded and hidden code with code-copy", async ({
  page,
}) => {
  await page.goto(getUrl("html/code-tools-toggle.html"), {
    waitUntil: "load",
  });

  const details = page.locator(".cell details.code-fold");
  const hiddenCode = page.locator("div.sourceCode.cell-code.hidden");
  const unhiddenCode = page.locator("div.sourceCode.cell-code.unhidden");

  // Baseline: two folded cells, both collapsed; the echo:false cell's source
  // is emitted hidden (keep-hidden).
  await expect(details).toHaveCount(2);
  await expect(details.nth(0)).toHaveJSProperty("open", false);
  await expect(details.nth(1)).toHaveJSProperty("open", false);
  await expect(hiddenCode).toHaveCount(1);
  await expect(unhiddenCode).toHaveCount(0);

  // Show All Code: every <details> opens, the hidden source becomes unhidden.
  await page.locator("#quarto-code-tools-menu").click();
  await page.locator("#quarto-show-all-code").click();

  await expect(details.nth(0)).toHaveJSProperty("open", true);
  await expect(details.nth(1)).toHaveJSProperty("open", true);
  await expect(hiddenCode).toHaveCount(0);
  await expect(unhiddenCode).toHaveCount(1);

  // Hide All Code: every <details> closes, the source goes back to hidden.
  await page.locator("#quarto-code-tools-menu").click();
  await page.locator("#quarto-hide-all-code").click();

  await expect(details.nth(0)).toHaveJSProperty("open", false);
  await expect(details.nth(1)).toHaveJSProperty("open", false);
  await expect(hiddenCode).toHaveCount(1);
  await expect(unhiddenCode).toHaveCount(0);
});
