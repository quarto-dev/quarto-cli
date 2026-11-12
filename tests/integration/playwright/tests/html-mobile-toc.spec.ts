import { expect, test } from "@playwright/test";
import { getUrl } from "../src/utils";

const NARROW = { width: 375, height: 740 };
const WIDE = { width: 1200, height: 900 };

test.describe("Body TOC below md", () => {
  for (const location of ["body", "left-body", "right-body"]) {
    test(`${location}: body TOC shows at narrow width`, async ({ page }) => {
      await page.setViewportSize(NARROW);
      await page.goto(getUrl(`html/mobile-toc/${location}.html`));
      const mainToc = page.locator("main nav[role=doc-toc]");
      await expect(mainToc).toBeVisible();
      expect(await mainToc.getByRole("link").count()).toBeGreaterThanOrEqual(2);
      await expect(page.locator(".sidebar nav[role=doc-toc]")).toBeHidden();
    });

    test(`${location}: body TOC shows at wide width`, async ({ page }) => {
      await page.setViewportSize(WIDE);
      await page.goto(getUrl(`html/mobile-toc/${location}.html`));
      await expect(page.locator("main nav[role=doc-toc]")).toBeVisible();
    });
  }
});
