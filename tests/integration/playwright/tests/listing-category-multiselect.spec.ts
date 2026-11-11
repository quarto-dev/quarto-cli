/*
 * listing-category-multiselect.spec.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { expect, Locator, Page, test } from "@playwright/test";
import { tabUntilFocused } from "../src/utils";

const base = "/listings/category-multiselect/_site";

const group = (page: Page) =>
  page.getByRole("group", { name: "Categories", exact: true });

const clearButton = (page: Page) =>
  group(page).getByRole("button", { name: "Clear selection", exact: true });

const items = (page: Page) => page.locator("#listing-posts .list > *");

const status = (page: Page) => page.locator(".quarto-listing-category-status");

const entry = (page: Page, name: string) =>
  group(page).getByRole("button", {
    name: new RegExp(`^${name}( \\(\\d+\\))?$`),
  });

const reset = (page: Page) =>
  page.getByRole("button", { name: "Show all categories" });

const tag = (page: Page, name: string) =>
  page.locator(".listing-categories a.listing-category", { hasText: name })
    .first();

async function expectPressed(page: Page, names: string[]) {
  const pressed = group(page).locator(".category[aria-pressed='true']");
  await expect(pressed).toHaveCount(names.length);
  for (const name of names) {
    await expect(entry(page, name)).toHaveAttribute("aria-pressed", "true");
  }
  await expect(group(page).locator(".category[aria-current]")).toHaveCount(0);
}

async function expectEmptyState(page: Page) {
  await expectPressed(page, ["All"]);
  await expect(items(page)).toHaveCount(3);
  expect(new URL(page.url()).hash).not.toContain("category");
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function press(
  page: Page,
  browserName: string,
  target: Locator,
  key: string,
) {
  expect(await tabUntilFocused(page, browserName, target, 40)).toBe(true);
  await page.keyboard.press(key);
}

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

test.describe("Selection", () => {
  test("Enter and Space press and unpress an entry", async ({ page, browserName }) => {
    await page.goto(`${base}/default.html`);
    await press(page, browserName, entry(page, "alpha"), "Enter");
    await expectPressed(page, ["alpha"]);
    await expect(items(page)).toHaveCount(2);
    await page.keyboard.press(" ");
    await expectEmptyState(page);
  });

  test("two categories show items in either", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    await entry(page, "alpha").click();
    await entry(page, "café").click();
    await expectPressed(page, ["alpha", "café"]);
    await expect(entry(page, "All")).toHaveAttribute("aria-pressed", "false");
    await expect(items(page)).toHaveCount(3);
    await expect(page).toHaveURL(/#category=alpha,caf%C3%A9$/);
  });

  for (const control of ["clear", "All", "heading reset"]) {
    test(`${control} gives the empty state`, async ({ page }) => {
      await page.goto(`${base}/default.html`);
      await entry(page, "alpha").click();
      await entry(page, "data science").click();
      await expect(items(page)).toHaveCount(2);
      const target = control === "clear"
        ? clearButton(page)
        : control === "All"
        ? entry(page, "All")
        : reset(page);
      await target.click();
      await expectEmptyState(page);
      if (control === "clear") {
        await expect(clearButton(page)).toBeFocused();
      }
    });
  }

  test("the last toggle off equals clear", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    await entry(page, "café").click();
    await expectPressed(page, ["café"]);
    await entry(page, "café").click();
    await expectEmptyState(page);
  });

  test("clear with nothing selected keeps the empty state", async ({ page }) => {
    await page.goto(`${base}/cloud.html`);
    await clearButton(page).click();
    await expect(items(page)).toHaveCount(3);
    await expect(group(page).locator("[aria-pressed='true']")).toHaveCount(0);
  });
});

test.describe("Hash", () => {
  for (
    const { hash, names, count } of [
      { hash: "alpha,caf%C3%A9", names: ["alpha", "café"], count: 3 },
      {
        hash: "caf%C3%A9,data%20science",
        names: ["café", "data science"],
        count: 2,
      },
    ]
  ) {
    test(`loading #category=${hash} restores every entry`, async ({ page }) => {
      await page.goto(`${base}/default.html#category=${hash}`);
      await expectPressed(page, names);
      await expect(items(page)).toHaveCount(count);
    });
  }

  for (const hash of ["category=", "category=,,", "category=nope"]) {
    test(`#${hash} gives the empty state`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(`${base}/default.html#${hash}`);
      await expectPressed(page, ["All"]);
      await expect(items(page)).toHaveCount(3);
      expect(errors).toEqual([]);
    });
  }

  test("a category and a page key apply together", async ({ page }) => {
    await page.goto(`${base}/paged.html#category=alpha&listing-posts-page=2`);
    await expectPressed(page, ["alpha"]);
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first()).toContainText("Post 3");
  });

  test("Back after a multi-select restores the exact state", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    await entry(page, "alpha").click();
    await entry(page, "café").click();
    await expect(items(page)).toHaveCount(3);
    await page.goBack();
    await expect(page).toHaveURL(/#category=alpha$/);
    await expectPressed(page, ["alpha"]);
    await expect(items(page)).toHaveCount(2);
    await page.goBack();
    await expectEmptyState(page);
  });

  test("single mode reads #category=a,b as one category", async ({ page }) => {
    await page.goto(`${base}/single.html#category=alpha,caf%C3%A9`);
    await expect(items(page)).toHaveCount(0);
    await expect(group(page).locator("[aria-current]")).toHaveCount(0);
  });
});

test.describe("Item tags", () => {
  test("a tag replaces the selection", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    await entry(page, "alpha").click();
    await entry(page, "café").click();
    await tag(page, "data science").click();
    await expectPressed(page, ["data science"]);
    await expect(items(page)).toHaveCount(1);
    await expect(page).toHaveURL(/#category=data%20science$/);
  });

  test("without a sidebar, tags keep the single-mode filter", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${base}/nosidebar.html`);
    await tag(page, "alpha").click();
    await expect(items(page)).toHaveCount(2);
    expect(errors).toEqual([]);
  });
});

test.describe("Announcement", () => {
  test("a change announces the count, a load does not", async ({ page }) => {
    await page.goto(`${base}/default.html#category=alpha`);
    await expect(items(page)).toHaveCount(2);
    await expect(status(page)).toHaveText("");
    await entry(page, "café").click();
    await expect(status(page)).toHaveText("3 matching items");
    await entry(page, "alpha").click();
    await expect(status(page)).toHaveText("1 matching item");
  });

  test("the count covers every page of a paged listing", async ({ page }) => {
    await page.goto(`${base}/paged.html`);
    await entry(page, "alpha").click();
    await expect(items(page)).toHaveCount(1);
    await expect(status(page)).toHaveText("2 matching items");
  });

  test("Back announces the restored selection", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    await entry(page, "alpha").click();
    await entry(page, "café").click();
    await expect(status(page)).toHaveText("3 matching items");
    await page.goBack();
    await expect(status(page)).toHaveText("2 matching items");
  });
});

test.describe("Readiness", () => {
  test("a call before the listing is ready does not throw", async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      document.addEventListener("readystatechange", () => {
        if (document.readyState === "interactive") {
          (window as any).quartoListingCategory?.(btoa("alpha"));
          (document.querySelector(
            ".quarto-listing-category .category",
          ) as HTMLElement | null)?.click();
        }
      });
    });
    await page.goto(`${base}/default.html`);
    await expect(items(page)).toHaveCount(3);
    expect(errors).toEqual([]);
  });
});
