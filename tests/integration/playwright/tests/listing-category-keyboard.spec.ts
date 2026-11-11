/*
 * listing-category-keyboard.spec.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { expect, Locator, Page, test } from "@playwright/test";
import { tabUntilFocused } from "../src/utils";

const base = "/listings/category-keyboard/_site";

const items = (page: Page) => page.locator("#listing-posts .list > *");

const group = (page: Page) =>
  page.getByRole("group", { name: "Categories", exact: true });

const entry = (page: Page, name: string) =>
  group(page).getByRole("button", { name: new RegExp(`^${name}( \\(\\d+\\))?$`) });

const reset = (page: Page) =>
  page.getByRole("button", { name: "Show all categories" });

async function press(
  page: Page,
  browserName: string,
  target: Locator,
  key: string,
) {
  expect(await tabUntilFocused(page, browserName, target, 40)).toBe(true);
  await page.keyboard.press(key);
}

async function expectOnlyCurrent(page: Page, name: string | undefined) {
  const current = page.locator(
    ".quarto-listing-category .category[aria-current='true']",
  );
  if (name === undefined) {
    await expect(current).toHaveCount(0);
  } else {
    await expect(current).toHaveCount(1);
    await expect(entry(page, name)).toHaveAttribute("aria-current", "true");
  }
}

const sidebarPages = [
  { page: "default.html", style: "numbered", entries: ["All", "alpha", "café", "data science"] },
  { page: "cloud.html", style: "cloud", entries: ["alpha", "café", "data science"] },
  { page: "grid.html", style: "unnumbered", entries: ["alpha", "café", "data science"] },
];

test.describe("Category sidebar", () => {
  for (const { page: pageName, style, entries } of sidebarPages) {
    test.describe(`${style} style`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(`${base}/${pageName}`);
        await expect(items(page)).toHaveCount(3);
      });

      test("sidebar entries are buttons in a named group", async ({ page }) => {
        await expect(group(page)).toBeVisible();
        await expect(group(page).getByRole("button")).toHaveCount(entries.length);
        for (const name of entries) {
          await expect(entry(page, name)).toBeVisible();
        }
      });

      test("Tab reaches the reset and each entry", async ({ page, browserName }) => {
        expect(await tabUntilFocused(page, browserName, reset(page), 40)).toBe(true);
        for (const name of entries) {
          expect(await tabUntilFocused(page, browserName, entry(page, name), 10))
            .toBe(true);
        }
      });

      test("Enter and Space filter the listing", async ({ page, browserName }) => {
        await press(page, browserName, entry(page, "alpha"), "Enter");
        await expect(page).toHaveURL(/#category=alpha$/);
        await expect(items(page)).toHaveCount(2);
        await expectOnlyCurrent(page, "alpha");

        await press(page, browserName, entry(page, "café"), "Space");
        await expect(page).toHaveURL(/#category=caf%C3%A9$/);
        await expect(items(page)).toHaveCount(1);
        await expectOnlyCurrent(page, "café");
      });

      test("reset is named and shows all items", async ({ page, browserName }) => {
        await entry(page, "alpha").click();
        await expect(items(page)).toHaveCount(2);

        await press(page, browserName, reset(page), "Enter");
        await expect(items(page)).toHaveCount(3);
        await expectOnlyCurrent(page, style === "numbered" ? "All" : undefined);
      });

      test("current entry on load", async ({ page }) => {
        await expectOnlyCurrent(page, style === "numbered" ? "All" : undefined);
      });
    });
  }

  test("ARIA snapshot before and after a selection", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    const sidebar = page.locator("#quarto-margin-sidebar");
    await expect(sidebar).toMatchAriaSnapshot(`
      - heading "Categories" [level=5]:
        - button "Show all categories"
      - group "Categories":
        - button "All (3)"
        - button "alpha (2)"
        - button "café (1)"
        - button "data science (1)"
    `);

    await entry(page, "alpha").click();
    await expect(sidebar).toMatchAriaSnapshot(`
      - heading "Categories" [level=5]:
        - button "Show all categories"
      - group "Categories":
        - button "All (3)"
        - button "alpha (2)"
        - button "café (1)"
        - button "data science (1)"
    `);
    await expectOnlyCurrent(page, "alpha");
  });
});

const tag = (page: Page, name: string) =>
  page.locator("#listing-posts").getByRole("link", { name, exact: true });

test.describe("Item category tags", () => {
  for (const pageName of ["default.html", "grid.html", "index.html"]) {
    const hasSidebar = pageName !== "index.html";

    test.describe(pageName, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(`${base}/${pageName}`);
        await expect(items(page)).toHaveCount(3);
      });

      test("tags are links to the category hash", async ({ page }) => {
        await expect(tag(page, "data science")).toHaveAttribute(
          "href",
          /#category=data%20science$/,
        );
        await expect(tag(page, "café")).toHaveAttribute(
          "href",
          /#category=caf%C3%A9$/,
        );
        await expect(tag(page, "alpha")).toHaveCount(2);
      });

      for (const { name, count } of [
        { name: "alpha", count: 2 },
        { name: "data science", count: 1 },
        { name: "café", count: 1 },
      ]) {
        test(`Tab reaches the "${name}" tag and Enter filters`, async ({ page, browserName }) => {
          // A reload would reset this marker and move focus to the top
          await page.evaluate(() => ((window as any).__noReload = true));
          await press(page, browserName, tag(page, name).first(), "Enter");
          await expect(page).toHaveURL(
            new RegExp(`#category=${encodeURIComponent(name)}$`),
          );
          await expect(items(page)).toHaveCount(count);
          expect(await page.evaluate(() => (window as any).__noReload)).toBe(true);
          await expect(tag(page, name).first()).toBeFocused();
          if (hasSidebar) {
            await expectOnlyCurrent(page, name);
          }
        });
      }
    });
  }

  test("ARIA snapshot of a default item and a grid item", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    await expect(page.locator("#listing-posts .list > *").first())
      .toMatchAriaSnapshot(`
        - link "Post 1"
        - link "alpha"
        - link "data science"
      `);

    await page.goto(`${base}/grid.html`);
    await expect(page.locator("#listing-posts .list > *").first())
      .toMatchAriaSnapshot(`
        - link "Post 1"
        - link "alpha"
        - link "data science"
      `);
  });
});
