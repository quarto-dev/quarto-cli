import { expect, Locator, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Tests for #14378. The scrollable-regions runtime makes code blocks and
// cell output keyboard-focusable (tabindex="0", role="group", localized
// aria-label, data-quarto-scrollable marker) only while they actually
// overflow, and removes the attributes when they stop. The fixture's wide
// elements overflow a 390px viewport and fit a 1440px one.

// Move focus with real Tab presses — programmatic locator.focus() does not
// reliably match :focus-visible in any engine. WebKit follows Safari's
// default of skipping most elements on Tab; Option+Tab visits every
// focusable element.
async function tabUntilFocused(
  page: Page,
  browserName: string,
  target: Locator,
  maxTabs = 25,
): Promise<boolean> {
  const tabKey = browserName === "webkit" ? "Alt+Tab" : "Tab";
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press(tabKey);
    if (await target.evaluate((el) => el === document.activeElement)) {
      return true;
    }
  }
  return false;
}

test.describe("scrollable regions at a mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl("html/scrollable-regions.html"), {
      waitUntil: "networkidle",
    });
  });

  test("overflowing code block is a single labeled, focusable group", async ({
    page,
  }) => {
    const block = page.locator("#wide-code div.sourceCode");
    await expect(block).toHaveAttribute("tabindex", "0");
    await expect(block).toHaveAttribute("role", "group");
    await expect(block).toHaveAttribute("aria-label", "Scrollable code");
    await expect(block).toHaveAttribute("data-quarto-scrollable", "");

    // The inner pre bleeds outside the scrolling div but is not itself a
    // scroll container; marking it too would create a double tab stop.
    await expect(
      page.locator("#wide-code pre[data-quarto-scrollable]"),
    ).toHaveCount(0);
  });

  test("overflowing cell output display is labeled as output", async ({
    page,
  }) => {
    const output = page.locator("#wide-table .cell-output-display");
    await expect(output).toHaveAttribute("tabindex", "0");
    await expect(output).toHaveAttribute("role", "group");
    await expect(output).toHaveAttribute("aria-label", "Scrollable output");
  });

  test("content in a hidden tab pane is left alone", async ({ page }) => {
    // The inactive pane has no geometry (display: none), so its code block
    // must not become a (useless) tab stop.
    await expect(
      page.locator("#tabset .tab-pane:not(.active) [data-quarto-scrollable]"),
    ).toHaveCount(0);
  });

  test("Tab reaches the code block, arrows scroll it, and the focus ring is visible", async ({
    page,
    browserName,
  }) => {
    const block = page.locator("#wide-code div.sourceCode");
    await expect(block).toHaveAttribute("tabindex", "0");

    expect(await tabUntilFocused(page, browserName, block)).toBe(true);

    // Themes sometimes reset outlines; the focus indicator must survive.
    await expect(block).not.toHaveCSS("outline-style", "none");

    // The whole point: arrow keys scroll the focused region. Playwright's
    // WebKit routes arrow keys to the page scroll even when a scrollable
    // element has focus — a UA scrolling behavior outside this fix's scope
    // (the runtime only makes the region focusable) — so the scroll
    // assertion runs on chromium and firefox.
    if (browserName !== "webkit") {
      expect(await block.evaluate((el) => el.scrollLeft)).toBe(0);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(async () => await block.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(0);
    }
  });

  test("attributes are removed when the region stops overflowing", async ({
    page,
  }) => {
    await expect(
      page.locator("#wide-code div.sourceCode[data-quarto-scrollable]"),
    ).toHaveCount(1);

    // At 1440px everything fits, so the body ResizeObserver re-sync must
    // strip every attribute the runtime added.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator("[data-quarto-scrollable]")).toHaveCount(0);
    await expect(page.locator("#wide-code div.sourceCode")).not.toHaveAttribute(
      "tabindex",
    );
    await expect(page.locator("#wide-code div.sourceCode")).not.toHaveAttribute(
      "aria-label",
    );
  });

  test("code block inside <details> is focusable once opened", async ({
    page,
    browserName,
  }) => {
    await page.locator("#folded summary").click();

    const block = page.locator("#folded div.sourceCode");
    await expect(block).toBeVisible();
    await expect(block).toHaveAttribute("tabindex", "0");
    await expect(block).toHaveAttribute("aria-label", "Scrollable code");

    expect(await tabUntilFocused(page, browserName, block)).toBe(true);
  });
});

test.describe("scrollable regions at a desktop viewport", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("nothing overflows, so nothing is marked", async ({ page }) => {
    await page.goto(getUrl("html/scrollable-regions.html"), {
      waitUntil: "networkidle",
    });

    // Rendered HTML never carries the attributes; the runtime adds them only
    // while a region overflows, which nothing does at this width.
    await expect(page.locator("[data-quarto-scrollable]")).toHaveCount(0);
    await expect(page.locator("div.sourceCode[tabindex]")).toHaveCount(0);
  });
});
