import { expect, Locator, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression tests for #15080. Hover popups for footnotes, citations,
// cross-references, and code annotations (code-annotations: hover) must
// close on Esc (WCAG 1.4.13, dismissible), and an interactive popup must
// close once focus leaves both its trigger and the popup (WCAG 2.4.11).

const url = "html/hover-popups-dismiss.html";

// WebKit follows Safari's default of skipping links and buttons on Tab;
// Option+Tab visits every focusable element.
function tabKey(browserName: string) {
  return browserName === "webkit" ? "Alt+Tab" : "Tab";
}

async function tabUntilFocused(
  page: Page,
  browserName: string,
  target: Locator,
  maxTabs = 25,
): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press(tabKey(browserName));
    if (await target.evaluate((el) => el === document.activeElement)) {
      return true;
    }
  }
  return false;
}

const triggers = [
  { name: "footnote", selector: 'a[role="doc-noteref"]', text: "footnote text" },
  { name: "citation", selector: 'a[role="doc-biblioref"]', text: "TeXbook" },
  { name: "figure cross-reference", selector: 'a.quarto-xref[href="#fig-square"]', text: "caption" },
  { name: "section cross-reference", selector: 'a.quarto-xref[href="#sec-target"]', text: "link inside" },
  { name: "code annotation", selector: "button.code-annotation-anchor", text: "annotation text" },
];

test.describe("Esc closes hover popups", () => {
  for (const { name, selector, text } of triggers) {
    test(`${name} popup opened by keyboard focus`, async ({ page, browserName }) => {
      await page.goto(getUrl(url), { waitUntil: "load" });
      const trigger = page.locator(selector);
      const popup = page.locator(".tippy-box", { hasText: text });

      expect(await tabUntilFocused(page, browserName, trigger)).toBe(true);
      await expect(popup).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(popup).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test(`${name} popup opened by pointer hover`, async ({ page }) => {
      await page.goto(getUrl(url), { waitUntil: "load" });
      const trigger = page.locator(selector);
      const popup = page.locator(".tippy-box", { hasText: text });

      await trigger.hover();
      await expect(popup).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(popup).toBeHidden();
    });
  }
});

test.describe("interactive popup and focus", () => {
  const xref = 'a.quarto-xref[href="#sec-target"]';

  test("Esc inside the popup closes it and returns focus to the trigger", async ({ page, browserName }) => {
    await page.goto(getUrl(url), { waitUntil: "load" });
    const trigger = page.locator(xref);
    const popup = page.locator(".tippy-box", { hasText: "link inside" });
    const inner = popup.getByRole("link", { name: "a link inside the popup" });

    expect(await tabUntilFocused(page, browserName, trigger)).toBe(true);
    await expect(popup).toBeVisible();
    expect(await tabUntilFocused(page, browserName, inner, 5)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("popup closes when focus leaves trigger and popup", async ({ page, browserName }) => {
    // Narrow viewport: the open popup would otherwise cover the next link.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(getUrl(url), { waitUntil: "load" });
    const trigger = page.locator(xref);
    const popup = page.locator(".tippy-box", { hasText: "link inside" });
    const next = page.getByRole("link", { name: "Next link" });

    expect(await tabUntilFocused(page, browserName, trigger)).toBe(true);
    await expect(popup).toBeVisible();
    expect(await tabUntilFocused(page, browserName, next, 10)).toBe(true);

    await expect(popup).toBeHidden();
  });

  test("popup stays open when focus moves from the popup back to the trigger", async ({ page, browserName }) => {
    await page.goto(getUrl(url), { waitUntil: "load" });
    const trigger = page.locator(xref);
    const popup = page.locator(".tippy-box", { hasText: "link inside" });

    expect(await tabUntilFocused(page, browserName, trigger)).toBe(true);
    await expect(popup).toBeVisible();
    await page.keyboard.press(tabKey(browserName));
    await expect(popup.locator(":focus")).toHaveCount(1);

    await page.keyboard.press(browserName === "webkit" ? "Alt+Shift+Tab" : "Shift+Tab");
    await expect(trigger).toBeFocused();
    await expect(popup).toBeVisible();
  });
});
