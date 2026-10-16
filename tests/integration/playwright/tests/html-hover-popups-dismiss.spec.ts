import { expect, test } from "@playwright/test";
import { getUrl, tabKey, tabUntilFocused } from "../src/utils";

// Regression tests for #15080. Hover popups for footnotes, citations,
// cross-references, and code annotations (code-annotations: hover) must
// close on Esc (WCAG 1.4.13, dismissible), and an interactive popup must
// close once focus leaves both its trigger and the popup (WCAG 2.4.11).

const url = "html/hover-popups-dismiss.html";

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

    await page.keyboard.press(tabKey(browserName, true));
    await expect(trigger).toBeFocused();
    await expect(popup).toBeVisible();
  });
});

test.describe("code-annotations: select", () => {
  const selectUrl = "html/hover-popups-dismiss-select.html";
  const selector = "button.code-annotation-anchor";

  test("Esc closes a popup opened by click", async ({ page }) => {
    await page.goto(getUrl(selectUrl), { waitUntil: "load" });
    const trigger = page.locator(selector);
    const popup = page.locator(".tippy-box", { hasText: "annotation text" });

    await trigger.click();
    await expect(popup).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
  });

  test("Esc closes a popup opened from the keyboard", async ({ page, browserName }) => {
    await page.goto(getUrl(selectUrl), { waitUntil: "load" });
    const trigger = page.locator(selector);
    const popup = page.locator(".tippy-box", { hasText: "annotation text" });

    expect(await tabUntilFocused(page, browserName, trigger)).toBe(true);
    await page.keyboard.press("Enter");
    await expect(popup).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("popup closes when Tab moves focus from the trigger to the next link", async ({ page, browserName }) => {
    await page.goto(getUrl(selectUrl), { waitUntil: "load" });
    const trigger = page.locator(selector);
    const popup = page.locator(".tippy-box", { hasText: "annotation text" });
    const next = page.getByRole("link", { name: "Next link" });

    expect(await tabUntilFocused(page, browserName, trigger)).toBe(true);
    await page.keyboard.press("Enter");
    await expect(popup).toBeVisible();

    expect(await tabUntilFocused(page, browserName, next, 5)).toBe(true);
    await expect(popup).toBeHidden();
  });
});

test("revealjs: Esc closes a citation popup without opening the overview", async ({ page }) => {
  await page.goto(getUrl("revealjs/hover-popups-dismiss.html#/citation"), { waitUntil: "load" });
  const trigger = page.locator('a[role="doc-biblioref"]');
  const popup = page.locator(".tippy-box", { hasText: "TeXbook" });

  await trigger.hover();
  await expect(popup).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
  await expect(page.locator(".reveal")).not.toHaveClass(/\boverview\b/);
});

test("revealjs: Esc closes the slide menu opened over a citation popup", async ({ page, browserName }) => {
  await page.goto(getUrl("revealjs/hover-popups-dismiss.html#/citation"), { waitUntil: "load" });
  const menu = page.locator("nav.slide-menu");
  const popup = page.locator(".tippy-box", { hasText: "TeXbook" });
  const trigger = page.locator('a[role="doc-biblioref"]');

  // Keyboard focus keeps the popup open while the menu covers the trigger
  expect(await tabUntilFocused(page, browserName, trigger)).toBe(true);
  await expect(popup).toBeVisible();
  await page.keyboard.press("m");
  await expect(menu).not.toHaveAttribute("inert");
  await expect(popup).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("inert");
  await expect(page.locator(".reveal")).not.toHaveClass(/\boverview\b/);
});

test("revealjs: Esc closes a citation popup without opening the overview when the open menu ignores the keyboard", async ({ page, browserName }) => {
  await page.goto(getUrl("revealjs/hover-popups-dismiss-menu-no-keyboard.html#/citation"), { waitUntil: "load" });
  const menu = page.locator("nav.slide-menu");
  const popup = page.locator(".tippy-box", { hasText: "TeXbook" });
  const trigger = page.locator('a[role="doc-biblioref"]');

  await expect(menu).not.toHaveAttribute("inert");
  expect(await tabUntilFocused(page, browserName, trigger)).toBe(true);
  await expect(popup).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
  await expect(page.locator(".reveal")).not.toHaveClass(/\boverview\b/);
});
