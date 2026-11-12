import { expect, Page, test } from "@playwright/test";
import { getUrl, tabKey, tabUntilFocused } from "../src/utils";

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

const pillOf = (page: Page) => page.locator(".quarto-toc-pill");
const sheetOf = (page: Page) => page.locator("dialog#quarto-toc-sheet");

async function openPage(page: Page, name: string, size = NARROW) {
  await page.setViewportSize(size);
  await page.goto(getUrl(`html/mobile-toc/${name}.html`));
}

async function openSheet(page: Page) {
  await pillOf(page).click();
  await expect(page.locator("dialog#quarto-toc-sheet[open]")).toBeVisible();
}

// Check the colours of the current link too, not only of the plain links.
async function scrollToActiveSection(page: Page) {
  await page.locator("#sec-2").scrollIntoViewIfNeeded();
  await expect(page.locator("nav.toc-active a.active").first()).toBeAttached();
}

async function waitForAxe(page: Page) {
  await page.locator("[data-quarto-axe-complete]").waitFor({ timeout: 15000 });
}

async function axeViolations(page: Page): Promise<string[]> {
  await waitForAxe(page);
  // Colours are only final once the sheet slide-in and theme transitions end.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished))
  );
  const result = await page.evaluate(() => (window as any).axe.run(document));
  return result.violations.map((v: { id: string }) => v.id);
}

async function expectClosedWithFocusOnPill(page: Page) {
  await expect(page.locator("dialog#quarto-toc-sheet[open]")).toHaveCount(0);
  await expect(pillOf(page)).toHaveAttribute("aria-expanded", "false");
  await expect(pillOf(page)).toBeFocused();
}

test.describe("Mobile TOC pill", () => {
  for (const name of ["right", "left"]) {
    test(`${name}: pill shows at narrow width and not at wide width`, async ({ page }) => {
      await openPage(page, name);
      await expect(pillOf(page)).toBeVisible();
      await expect(pillOf(page)).toHaveText("Table of contents");
      await page.setViewportSize(WIDE);
      await expect(pillOf(page)).toHaveCount(0);
    });
  }

  for (const name of ["body", "left-body", "right-body", "single-link", "no-toc"]) {
    test(`${name}: no pill at narrow width`, async ({ page }) => {
      await openPage(page, name);
      await expect(page.locator("main")).toBeVisible();
      await expect(pillOf(page)).toHaveCount(0);
    });
  }

  test("opening moves focus into the sheet and sets aria-expanded", async ({ page }) => {
    await openPage(page, "right");
    await expect(pillOf(page)).toHaveAttribute("aria-expanded", "false");
    await openSheet(page);
    await expect(pillOf(page)).toHaveAttribute("aria-expanded", "true");
    await expect(sheetOf(page).locator("a:focus")).toHaveCount(1);
  });

  test("opening focuses the current link", async ({ page }) => {
    await openPage(page, "right");
    await page.evaluate(() => window.scrollTo(0, document.getElementById("sec-2-1")!.offsetTop));
    await expect(page.locator("nav#TOC a.active[href$='#sec-2-1']")).toHaveCount(1);
    await openSheet(page);
    await expect(sheetOf(page).locator("a[aria-current=location]")).toBeFocused();
  });

  test("the close button closes and returns focus to the pill", async ({ page }) => {
    await openPage(page, "right");
    await openSheet(page);
    await sheetOf(page).getByRole("button", { name: "Close table of contents" }).click();
    await expectClosedWithFocusOnPill(page);
  });

  test("Escape closes and returns focus to the pill", async ({ page }) => {
    await openPage(page, "right");
    await openSheet(page);
    await page.keyboard.press("Escape");
    await expectClosedWithFocusOnPill(page);
  });

  test("a click on the backdrop closes and returns focus to the pill", async ({ page }) => {
    await openPage(page, "right");
    await openSheet(page);
    await page.mouse.click(10, 10);
    await expectClosedWithFocusOnPill(page);
  });

  test("Tab stays inside the open sheet", async ({ page, browserName }) => {
    await openPage(page, "right");
    await openSheet(page);
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press(tabKey(browserName));
      // A modal dialog may pass focus to the browser, which leaves the body active.
      const contained = await page.evaluate(
        () =>
          !!document.activeElement?.closest("dialog#quarto-toc-sheet") ||
          document.activeElement === document.body,
      );
      expect(contained).toBe(true);
    }
  });

  test("a link near the end of the page focuses its heading above the pill", async ({ page }) => {
    await openPage(page, "right");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator("nav#TOC a.active[href$='#sec-3-2']")).toHaveCount(1);
    await openSheet(page);
    await sheetOf(page).locator("a[href$='#sec-3-2']").click();
    await expect(page.locator("dialog#quarto-toc-sheet[open]")).toHaveCount(0);
    await expect(page.locator("#sec-3-2 > h3")).toBeFocused();
    await expect(page.locator("html")).not.toHaveClass(/quarto-toc-sheet-open/);
    await expect.poll(async () => {
      const heading = await page.locator("#sec-3-2 > h3").boundingBox();
      const pill = await pillOf(page).boundingBox();
      return heading!.y + heading!.height <= pill!.y || heading!.y >= pill!.y + pill!.height;
    }).toBe(true);
  });

  test("the current section is marked in the sheet", async ({ page }) => {
    await openPage(page, "right");
    await page.evaluate(() => window.scrollTo(0, document.getElementById("sec-2-1")!.offsetTop));
    await expect(page.locator("nav#TOC a.active[href$='#sec-2-1']")).toHaveCount(1);
    await openSheet(page);
    const current = sheetOf(page).locator("a[aria-current=location]");
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("href", /#sec-2-1$/);
  });

  test("resizing back and forth leaves one pill, one sheet, and no leftovers", async ({ page }) => {
    await openPage(page, "right");
    await openSheet(page);
    const html = page.locator("html");
    for (let i = 0; i < 2; i++) {
      await page.setViewportSize(WIDE);
      await expect(pillOf(page)).toHaveCount(0);
      await expect(page.locator("dialog#quarto-toc-sheet")).toHaveCount(0);
      await expect(html).not.toHaveClass(/quarto-toc-sheet-open/);
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom),
      ).toMatch(/^(auto|0px)$/);
      await page.setViewportSize(NARROW);
      await expect(pillOf(page)).toHaveCount(1);
      await expect(page.locator("dialog#quarto-toc-sheet")).toHaveCount(1);
    }
  });

  test("keyboard only: Tab reaches the pill before the content, Enter opens, Escape closes", async ({
    page,
    browserName,
  }) => {
    await openPage(page, "right");
    const pill = pillOf(page);
    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) {
      await page.keyboard.press(tabKey(browserName));
      expect(await page.evaluate(() => !!document.activeElement?.closest("main"))).toBe(false);
      reached = await pill.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.locator("dialog#quarto-toc-sheet[open]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expectClosedWithFocusOnPill(page);
    expect(await tabUntilFocused(page, browserName, pill, 1)).toBe(false);
  });

  test("the pill shows a focus ring when reached with Tab", async ({ page, browserName }) => {
    await openPage(page, "right");
    expect(await tabUntilFocused(page, browserName, pillOf(page))).toBe(true);
    expect(
      await pillOf(page).evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe("none");
  });

  test("the pill and the open sheet expose the expected roles", async ({ page }) => {
    await openPage(page, "right");
    await expect(page.getByRole("button", { name: "Table of contents", exact: true })).toHaveCount(1);
    await openSheet(page);
    const dialog = page.getByRole("dialog", { name: "Table of contents" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close table of contents" })).toBeVisible();
    const nav = dialog.getByRole("navigation", { name: "Table of contents" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("list").first()).toBeVisible();
    for (const name of ["Section 1", "Section 2", "Section 3"]) {
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    }
  });

  test("a link to an id with a stray percent sign focuses its heading", async ({ page }) => {
    await openPage(page, "percent-id");
    await openSheet(page);
    await sheetOf(page).getByRole("link", { name: "Half off" }).click();
    await expect(sheetOf(page)).not.toHaveAttribute("open");
    await expect(page.getByRole("heading", { name: "Half off" })).toBeFocused();
  });

  test("the sheet lists the subsections of every section", async ({ page }) => {
    await openPage(page, "right");
    await openSheet(page);
    const nav = sheetOf(page).getByRole("navigation");
    for (const name of ["Subsection 1.1", "Subsection 2.1", "Subsection 3.2"]) {
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    }
  });

  test("axe finds no violation with the sheet closed and open", async ({ page }) => {
    await openPage(page, "right");
    expect(await axeViolations(page)).toEqual([]);
    await scrollToActiveSection(page);
    await openSheet(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test("axe finds no violation with the sheet open in dark mode", async ({ page }) => {
    await openPage(page, "dark");
    await page.evaluate(() => (window as any).quartoToggleColorScheme());
    await expect(page.locator("body")).toHaveClass(/quarto-dark/);
    await scrollToActiveSection(page);
    await openSheet(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test("a localised TOC title names the pill and the dialog", async ({ page }) => {
    await openPage(page, "french");
    await expect(pillOf(page)).toHaveText("Sur cette page");
    await expect(pillOf(page)).toHaveAccessibleName("Sur cette page");
    await openSheet(page);
    await expect(sheetOf(page)).toHaveAccessibleName("Sur cette page");
  });

  test("with margin content over the TOC, the sheet follows the scroll-spied TOC", async ({
    page,
  }) => {
    await openPage(page, "overlap", WIDE);
    await expect(page.locator("#quarto-toc-toggle")).toBeAttached();
    await page.setViewportSize(NARROW);
    await expect(pillOf(page)).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await openSheet(page);
    const current = sheetOf(page).locator("a[aria-current=location]");
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("href", /#sec-3-2$/);
  });

  test("back-to-top sits above the pill on a website", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto(getUrl("website/mobile-toc/_site/index.html"));
    await expect(pillOf(page)).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.evaluate(() => window.scrollTo(0, 1000));
    const backToTop = page.locator("#quarto-back-to-top");
    await expect(backToTop).toBeVisible();
    await expect.poll(async () => {
      const a = await backToTop.boundingBox();
      const b = await pillOf(page).boundingBox();
      return a!.y + a!.height <= b!.y || b!.y + b!.height <= a!.y ||
        a!.x + a!.width <= b!.x || b!.x + b!.width <= a!.x;
    }).toBe(true);
  });

  test("forced colours keep the pill and the current link visible", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "forced colours emulation is Chromium only");
    await page.emulateMedia({ forcedColors: "active" });
    await openPage(page, "right");
    const pillBorder = await pillOf(page).evaluate(
      (el) => parseFloat(getComputedStyle(el).borderTopWidth),
    );
    expect(pillBorder).toBeGreaterThan(0);
    await openSheet(page);
    const active = sheetOf(page).locator("a.active");
    const widths = await active.evaluate((el) => {
      const style = getComputedStyle(el);
      return [parseFloat(style.outlineWidth), parseFloat(style.borderInlineStartWidth)];
    });
    expect(Math.max(...widths)).toBeGreaterThan(0);
  });
});
