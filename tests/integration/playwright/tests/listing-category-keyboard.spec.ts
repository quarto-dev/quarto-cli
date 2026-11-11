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

      test("reset is named and shows all items", async ({ page }) => {
        await entry(page, "alpha").click();
        await expect(items(page)).toHaveCount(2);

        // Tab reach is tested above; the reset sits before the entry that the
        // click focused, and Firefox does not wrap Tab back into the page
        await reset(page).focus();
        await page.keyboard.press("Enter");
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
        - heading "Post 1" [level=3]:
          - link "Post 1"
        - link "alpha"
        - link "data science"
        - link "First post."
        - link "Jan 1, 2026 Ada"
      `);

    await page.goto(`${base}/grid.html`);
    await expect(page.locator("#listing-posts .list > *").first())
      .toMatchAriaSnapshot(`
        - heading "Post 1" [level=5]:
          - link "Post 1"
        - link "alpha"
        - link "data science"
        - paragraph: First post.
        - text: Ada Jan 1, 2026
        - table:
          - rowgroup:
            - row "venue Lab A":
              - cell "venue"
              - cell "Lab A":
                - link "Lab A"
      `);
  });
});

test.describe("Grid card", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${base}/grid.html`);
    await expect(items(page)).toHaveCount(3);
  });

  test("no empty or nested links", async ({ page }) => {
    // Nested anchors are split by the HTML parser into empty links
    const bad = await page.locator("#listing-posts").evaluate((root) =>
      [...root.querySelectorAll("a")].filter((a) =>
        a.textContent!.trim() === "" && !a.querySelector("img") ||
        a.querySelector("a, button") !== null
      ).length
    );
    expect(bad).toBe(0);
  });

  test("one named item link per card", async ({ page }) => {
    for (const title of ["Post 1", "Post 2", "Post 3"]) {
      const card = page.locator(".quarto-grid-item", { hasText: title });
      await expect(card.locator("a.stretched-link")).toHaveCount(1);
      await expect(card.locator("a.stretched-link")).toHaveAccessibleName(title);
    }
  });

  test("a click on the card body opens the item", async ({ page }) => {
    // The stretched link covers the description, so click by position
    const box = await page.locator(".quarto-grid-item", { hasText: "Post 2" })
      .locator(".listing-description").boundingBox();
    await page.mouse.click(box!.x + 5, box!.y + 5);
    await expect(page).toHaveURL(/\/posts\/post-2\.html$/);
  });

  test("a tag and a field link take their own clicks", async ({ page }) => {
    const card = page.locator(".quarto-grid-item", { hasText: "Post 2" });
    await card.locator(".listing-category", { hasText: "café" }).click();
    await expect(page).toHaveURL(/\/grid\.html#category=caf%C3%A9$/);
    await expect(items(page)).toHaveCount(1);

    const venue = card.locator("a.venue");
    await expect(venue).toHaveAttribute("href", /posts\/post-2\.html$/);
    const onTop = await venue.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit === el || el.contains(hit);
    });
    expect(onTop).toBe(true);
  });
});

const status = (page: Page) => page.getByRole("status");

test.describe("Result announcement", () => {
  for (const pageName of ["default.html", "grid.html", "cloud.html", "index.html"]) {
    test(`region exists and is empty after load on ${pageName}`, async ({ page }) => {
      await page.goto(`${base}/${pageName}`);
      await expect(items(page)).toHaveCount(3);
      await expect(status(page)).toHaveCount(1);
      await expect(status(page)).toHaveText("");
    });
  }

  test("a category hash on load filters but does not announce", async ({ page }) => {
    await page.goto(`${base}/default.html#category=alpha`);
    await expect(items(page)).toHaveCount(2);
    await expectOnlyCurrent(page, "alpha");
    await expect(status(page)).toHaveText("");
  });

  test("sidebar, reset and tag announce the count", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    await entry(page, "alpha").click();
    await expect(status(page)).toHaveText("2 matching items");
    await entry(page, "café").click();
    await expect(status(page)).toHaveText("1 matching item");
    await reset(page).click();
    await expect(status(page)).toHaveText("3 matching items");

    await page.goto(`${base}/index.html`);
    await tag(page, "alpha").first().click();
    await expect(status(page)).toHaveText("2 matching items");
  });

  test("Back announces the restored filter", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    await entry(page, "alpha").click();
    await entry(page, "café").click();
    await expect(status(page)).toHaveText("1 matching item");

    await page.goBack();
    await expect(items(page)).toHaveCount(2);
    await expectOnlyCurrent(page, "alpha");
    await expect(status(page)).toHaveText("2 matching items");
  });

  test("the count sums every listing on the page", async ({ page }) => {
    // Two listings with one item per page; cat1 matches one post in each
    await page.goto("/listings/interactions/_site/index.html");
    await page.locator(".quarto-listing-category .category", { hasText: "cat1" })
      .click();
    await expect(status(page)).toHaveText("2 matching items");
  });
});

async function axeViolations(page: Page) {
  await page.waitForFunction(() => (window as any).axe);
  return await page.evaluate(async () => {
    const axe = (window as any).axe;
    const result = await axe.run(
      {
        include: [
          ["#listing-posts"],
          ["#quarto-margin-sidebar"],
        ].filter(([selector]) => document.querySelector(selector)),
      },
      // #14384 (heading level of the filter title) is out of scope here
      { rules: { "heading-order": { enabled: false } } },
    );
    return result.violations.map(
      (v: { id: string; nodes: { target: string[] }[] }) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      }),
    );
  });
}

test.describe("Focus and axe", () => {
  test("focus is visible on every category control", async ({ page, browserName }) => {
    await page.goto(`${base}/default.html`);
    for (const target of [reset(page), entry(page, "alpha"), tag(page, "café")]) {
      expect(await tabUntilFocused(page, browserName, target, 40)).toBe(true);
      await expect(target).not.toHaveCSS("outline-style", "none");
    }
  });

  test("focus on a grid item link rings the whole card", async ({ page, browserName }) => {
    await page.goto(`${base}/grid.html`);
    const card = page.locator(".quarto-grid-item", { hasText: "Post 2" });
    const link = card.locator("a.stretched-link");
    expect(await tabUntilFocused(page, browserName, link, 40)).toBe(true);
    await expect(card).not.toHaveCSS("outline-style", "none");
    await expect(link).toHaveCSS("outline-style", "none");
  });

  for (const pageName of ["default.html", "grid.html", "cloud.html", "index.html"]) {
    test(`no axe violations on ${pageName}, before and after a selection`, async ({ page }) => {
      await page.goto(`${base}/${pageName}`);
      await expect(items(page)).toHaveCount(3);
      expect(await axeViolations(page)).toEqual([]);

      await tag(page, "alpha").first().click();
      await expect(items(page)).toHaveCount(2);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});

test.describe("Announcement edge cases", () => {
  test("the same count is announced again for a new filter", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    await entry(page, "data science").click();
    await expect(status(page)).toHaveText("1 matching item");

    // Screen readers skip a live region whose text does not change, so the
    // region must be emptied and filled again
    await status(page).evaluate((el) => {
      (window as any).__statusTexts = [];
      new MutationObserver(() =>
        (window as any).__statusTexts.push(el.textContent)
      ).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await entry(page, "café").click();
    await expect(status(page)).toHaveText("1 matching item");
    await expect.poll(() => page.evaluate(() => (window as any).__statusTexts))
      .toEqual(["", "1 matching item"]);
  });

  test("focus stays on a matching tag when its item moves to another page", async ({ page, browserName }) => {
    await page.goto(`${base}/paged.html`);
    await page.locator("#posts-pagination .page-link", { hasText: "3" }).click();
    await expect(items(page)).toHaveText([/Post 3/]);

    await press(page, browserName, tag(page, "alpha"), "Enter");
    await expect(items(page)).toHaveText([/Post 1/]);
    await expect(tag(page, "alpha")).toBeFocused();
  });
});
