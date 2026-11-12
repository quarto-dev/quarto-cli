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

// `names` lists the pressed toggles; "All" is never a toggle and is the
// current entry only when nothing is pressed
async function expectPressed(page: Page, names: string[]) {
  const pressed = group(page).locator(".category[aria-pressed='true']");
  await expect(pressed).toHaveCount(names.length);
  for (const name of names) {
    await expect(entry(page, name)).toHaveAttribute("aria-pressed", "true");
  }
  const all = group(page).locator(".category[data-category='']");
  await expect(all.and(page.locator("[aria-pressed]"))).toHaveCount(0);
  const current = group(page).locator(".category[aria-current]");
  if (names.length === 0 && await all.count() > 0) {
    await expect(current).toHaveCount(1);
    await expect(all).toHaveAttribute("aria-current", "true");
  } else {
    await expect(current).toHaveCount(0);
  }
}

async function expectEmptyState(page: Page) {
  await expectPressed(page, []);
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
      const toggles = container.locator(
        "button.category:not([data-category=''])",
      );
      expect(await toggles.count()).toBeGreaterThan(0);
      for (const toggle of await toggles.all()) {
        await expect(toggle).toHaveAttribute("aria-pressed", /^(true|false)$/);
      }
      await expect(
        container.locator(".category[data-category=''][aria-pressed]"),
      ).toHaveCount(0);
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

  test.describe("before scripts run", () => {
    test.use({ javaScriptEnabled: false });

    test("the served markup makes All current and presses nothing", async ({ page }) => {
      await page.goto(`${base}/default.html`);
      const container = page.locator(".quarto-listing-category");
      await expect(container.locator(".category[aria-pressed='true']"))
        .toHaveCount(0);
      const all = container.locator(".category[data-category='']");
      await expect(all).toHaveAttribute("aria-current", "true");
      await expect(all).not.toHaveAttribute("aria-pressed", /.*/);
    });
  });

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
    });
  }

  test("clear keeps the focus for keyboard users", async ({ page, browserName }) => {
    await page.goto(`${base}/default.html#category=alpha,caf%C3%A9`);
    await expectPressed(page, ["alpha", "café"]);
    await press(page, browserName, clearButton(page), "Enter");
    await expectEmptyState(page);
    await expect(clearButton(page)).toBeFocused();
  });

  test("clear with nothing selected adds no history entry", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    const before = await page.evaluate(() => history.length);
    await clearButton(page).click();
    await clearButton(page).click();
    expect(await page.evaluate(() => history.length)).toBe(before);
  });

  test("an in-page anchor keeps the selection", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    await entry(page, "alpha").click();
    await entry(page, "café").click();
    await expect(status(page)).toHaveText("3 matching items");
    await page.evaluate(() => {
      document.querySelector(".quarto-listing-category-status")!.textContent =
        "";
      location.hash = "quarto-document-content";
    });
    await expect(page).toHaveURL(/#quarto-document-content$/);
    await expectPressed(page, ["alpha", "café"]);
    await expect(items(page)).toHaveCount(3);
    await page.waitForTimeout(300);
    await expect(status(page)).toHaveText("");

    await entry(page, "data science").click();
    await expectPressed(page, ["alpha", "café", "data science"]);
    await expect(page).toHaveURL(/#category=alpha,caf%C3%A9,data%20science$/);
  });

  for (
    const { names, hash } of [
      { names: ["alpha"], hash: "category=alpha" },
      {
        names: ["alpha", "R & Python"],
        hash: "category=alpha,R%20%26%20Python",
      },
    ]
  ) {
    test(`a page click keeps ${names.join(" and ")} in the hash`, async ({ page }) => {
      await page.goto(`${base}/paged.html`);
      for (const name of names) {
        await entry(page, name).click();
      }
      await page.locator("#listing-posts .pagination .page-link", {
        hasText: /^2$/,
      }).click();
      await expect(page).toHaveURL(
        new RegExp(`#${hash}&listing-posts-page=2$`),
      );
      await page.reload();
      await expectPressed(page, names);
    });
  }

  test("a page click after an anchor keeps the selection", async ({ page }) => {
    await page.goto(`${base}/paged.html`);
    await entry(page, "alpha").click();
    await page.evaluate(() => {
      location.hash = "quarto-document-content";
    });
    await page.locator("#listing-posts .pagination .page-link", {
      hasText: /^2$/,
    }).click();
    await expect(page).toHaveURL(/#category=alpha&listing-posts-page=2$/);
    await expectPressed(page, ["alpha"]);
  });

  test("Back to a page-only hash clears the selection", async ({ page }) => {
    await page.goto(`${base}/paged.html#listing-posts-page=2`);
    await expect(items(page).first()).toContainText("Post 2");
    await entry(page, "café").click();
    await expectPressed(page, ["café"]);
    await page.goBack();
    await expect(page).toHaveURL(/#listing-posts-page=2$/);
    await expectPressed(page, []);
    await expect(items(page).first()).toContainText("Post 2");
  });

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
      await expectPressed(page, []);
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

  test("Back between pages with no selection announces nothing", async ({ page }) => {
    await page.goto(`${base}/paged.html`);
    await page.locator("#listing-posts .pagination .page-link", {
      hasText: /^2$/,
    }).click();
    await expect(page).toHaveURL(/#listing-posts-page=2$/);
    await page.goBack();
    await page.goForward();
    await expect(items(page).first()).toContainText("Post 2");
    await page.waitForTimeout(300);
    await expect(status(page)).toHaveText("");
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

test.describe("Two listings", () => {
  const listItems = (page: Page, id: string) =>
    page.locator(`#listing-${id} .list > *`);
  const noMatching = (page: Page, id: string) =>
    page.locator(`#listing-${id} .listing-no-matching`);

  test("the second listing turns on multiple mode for the shared sidebar", async ({ page }) => {
    await page.goto(`${base}/two.html`);
    await expect(page.locator(".quarto-listing-category")).toHaveAttribute(
      "data-category-selection",
      "multiple",
    );
    await expect(listItems(page, "alpha-posts")).toHaveCount(2);
    await expect(listItems(page, "cafe-posts")).toHaveCount(1);
  });

  test("a selection filters both listings by union", async ({ page }) => {
    await page.goto(`${base}/two.html`);
    await entry(page, "alpha").click();
    await expect(listItems(page, "alpha-posts")).toHaveCount(2);
    await expect(listItems(page, "cafe-posts")).toHaveCount(0);
    await expect(noMatching(page, "cafe-posts")).toBeVisible();
    await expect(status(page)).toHaveText("2 matching items");

    await entry(page, "café").click();
    await expect(listItems(page, "cafe-posts")).toHaveCount(1);
    await expect(noMatching(page, "cafe-posts")).toBeHidden();
    await expect(status(page)).toHaveText("3 matching items");
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

test.describe("Accessibility", () => {
  test("ARIA snapshot with none, one and two selected", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    const sidebar = page.locator("#quarto-margin-sidebar");
    await expect(sidebar).toMatchAriaSnapshot(`
      - heading "Categories" [level=5]:
        - button "Show all categories"
      - group "Categories":
        - button "Clear selection"
        - button "All (3)"
        - button "alpha (2)"
        - button "café (1)"
        - button "data science (1)"
        - button "R & Python (1)"
    `);

    await entry(page, "alpha").click();
    await expect(sidebar).toMatchAriaSnapshot(`
      - heading "Categories" [level=5]:
        - button "Show all categories"
      - group "Categories":
        - button "Clear selection"
        - button "All (3)"
        - button "alpha (2)" [pressed]
        - button "café (1)"
        - button "data science (1)"
        - button "R & Python (1)"
    `);

    await entry(page, "café").click();
    await expect(sidebar).toMatchAriaSnapshot(`
      - heading "Categories" [level=5]:
        - button "Show all categories"
      - group "Categories":
        - button "Clear selection"
        - button "All (3)"
        - button "alpha (2)" [pressed]
        - button "café (1)" [pressed]
        - button "data science (1)"
        - button "R & Python (1)"
    `);
  });

  test("ARIA snapshot of the cloud style with two selected", async ({ page }) => {
    await page.goto(`${base}/cloud.html#category=alpha,caf%C3%A9`);
    await expect(page.locator("#quarto-margin-sidebar")).toMatchAriaSnapshot(`
      - heading "Categories" [level=5]:
        - button "Show all categories"
      - group "Categories":
        - button "Clear selection"
        - button "alpha" [pressed]
        - button "café" [pressed]
        - button "data science"
        - button "R & Python"
    `);
  });

  test("the clear button shows a visible focus ring", async ({ page, browserName }) => {
    await page.goto(`${base}/default.html`);
    const target = clearButton(page);
    expect(await tabUntilFocused(page, browserName, target, 40)).toBe(true);
    await expect(target).not.toHaveCSS("outline-style", "none");
  });

  test("the clear button is a text control in the link colour", async ({ page }) => {
    await page.goto(`${base}/default.html`);
    // A plain link in the main column carries the theme's link colour
    const linkColor = await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "#";
      document.querySelector("main")!.appendChild(link);
      const color = getComputedStyle(link).color;
      link.remove();
      return color;
    });
    const clear = clearButton(page);
    await expect(clear).toHaveCSS("border-top-width", "0px");
    await expect(clear).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(clear).toHaveCSS("color", linkColor);
  });

  test("the clear button sits on its own line in the cloud style", async ({ page }) => {
    await page.goto(`${base}/cloud.html`);
    const clearBox = await clearButton(page).boundingBox();
    const firstBox = await entry(page, "alpha").boundingBox();
    expect(clearBox).not.toBeNull();
    expect(firstBox).not.toBeNull();
    expect(clearBox!.y + clearBox!.height).toBeLessThanOrEqual(firstBox!.y);
  });

  for (const pageName of ["default.html", "cloud.html", "unnumbered.html"]) {
    test(`no axe violations on ${pageName}, before and after a multi-select`, async ({ page }) => {
      await page.goto(`${base}/${pageName}`);
      await expect(items(page)).toHaveCount(3);
      expect(await axeViolations(page)).toEqual([]);

      await entry(page, "alpha").click();
      await entry(page, "café").click();
      await expect(items(page)).toHaveCount(3);
      await expect(entry(page, "café")).toHaveAttribute("aria-pressed", "true");
      expect(await axeViolations(page)).toEqual([]);
    });
  }
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
