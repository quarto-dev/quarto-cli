import { expect, test } from "@playwright/test";
import { tabUntilFocused } from "../src/utils";

// The notebook preview "Back to Article" control must be a keyboard-operable
// link in both website and standalone renders (#15015).
const testCases = [
  {
    name: "website",
    dir: "./website/notebook-preview-back-link/_site",
  },
  {
    name: "standalone document",
    dir: "./html/notebook-preview-back-link",
  },
];

test.describe("Notebook preview back link", () => {
  for (const { name, dir } of testCases) {
    test(`${name} — Tab and Enter go back to the article`, async ({ page, browserName }) => {
      // Open the preview from the article so there is history to go back to.
      // The preview is opened without a cell hash so Tab starts at the top
      // of the page, where the back link is.
      await page.goto(`${dir}/index.html`);
      await page.goto(`${dir}/notebook-preview.html`);

      const backLink = page.getByRole("link", { name: "Back to Article" });
      await expect(backLink).toBeVisible();
      expect(await tabUntilFocused(page, browserName, backLink)).toBe(true);

      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/index\.html$/);
    });
  }
});
