/*
 * listing-category-multiselect.spec.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { expect, Page, test } from "@playwright/test";

const base = "/listings/category-multiselect/_site";

const group = (page: Page) =>
  page.getByRole("group", { name: "Categories", exact: true });

const clearButton = (page: Page) =>
  group(page).getByRole("button", { name: "Clear selection", exact: true });

test.describe("Markup", () => {
  for (const pageName of ["default.html", "cloud.html", "unnumbered.html"]) {
    test(`multiple mode marks the group and renders toggles on ${pageName}`, async ({ page }) => {
      await page.goto(`${base}/${pageName}`);
      const container = page.locator(".quarto-listing-category");
      await expect(container).toHaveAttribute(
        "data-category-selection",
        "multiple",
      );
      const entries = container.locator("button.category");
      expect(await entries.count()).toBeGreaterThan(0);
      for (const entry of await entries.all()) {
        await expect(entry).toHaveAttribute("aria-pressed", /^(true|false)$/);
      }
      await expect(clearButton(page)).toBeVisible();
      const clearFirst = await container.evaluate((el) => {
        const clear = el.querySelector(".quarto-listing-category-clear");
        const first = el.querySelector(".category");
        return !!clear && !!first &&
          !!(clear.compareDocumentPosition(first) &
            Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(clearFirst).toBe(true);
    });
  }

  test("single mode has no toggles", async ({ page }) => {
    await page.goto(`${base}/single.html`);
    await expect(page.locator(".quarto-listing-category")).toHaveCount(1);
    await expect(page.locator("[data-category-selection]")).toHaveCount(0);
    await expect(page.locator("[aria-pressed]")).toHaveCount(0);
    await expect(page.locator(".quarto-listing-category-clear")).toHaveCount(0);
  });

  test("no sidebar, no marker", async ({ page }) => {
    await page.goto(`${base}/nosidebar.html`);
    await expect(page.locator("#listing-posts .list > *")).toHaveCount(3);
    await expect(page.locator(".quarto-listing-category")).toHaveCount(0);
  });
});
