import { expect, Locator, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Every Quarto control must show a visible indicator on keyboard focus
// (WCAG 2.2 SC 2.4.7). Quarto's convention is to use the browser's own
// ring and never author one, so these tests assert only that an outline
// is drawn — not which outline. See `.claude/rules/formats/sass-theming.md`.
//
// Three buttons carry the Bootstrap `btn` class with no `btn-*` variant
// class: the code tools button, the sidebar toggle, and the sidebar search
// button. Bootstrap's .btn:focus-visible removes the native ring
// (outline: 0) and substitutes a box-shadow that only the variant classes
// define, so these took keyboard focus with no indicator at all. Quarto
// restores the browser's ring with `outline: revert` (#14774).
//
// The sidebar section toggles are bare `<button>` elements with no `btn`
// class, so nothing suppresses their ring and Quarto writes no rule for
// them (#14826).

// Move focus with real Tab presses so the button matches :focus-visible —
// the fix only applies to keyboard focus, and programmatic locator.focus()
// does not reliably match :focus-visible. WebKit follows Safari's default
// of skipping buttons on Tab; Option+Tab visits every focusable element.
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

test("code tools button shows a focus indicator on keyboard focus", async ({
  page,
  browserName,
}) => {
  await page.goto(getUrl("html/code-tools-focus-indicator.html"), {
    waitUntil: "load",
  });

  const button = page.locator("button.code-tools-button");
  await expect(button).toBeVisible();
  expect(await tabUntilFocused(page, browserName, button)).toBe(true);

  // outline: revert restores the user-agent ring (outline-style: auto in
  // every engine); any non-none outline is a visible indicator.
  await expect(button).not.toHaveCSS("outline-style", "none");
});

test.describe("website secondary nav buttons", () => {
  // The secondary nav holding the sidebar toggle and sidebar search
  // buttons only appears when the sidebar collapses, below the lg
  // breakpoint (992px).
  test.use({ viewport: { width: 500, height: 800 } });

  const buttons = [
    { name: "sidebar toggle", selector: "button.quarto-btn-toggle" },
    { name: "sidebar search", selector: "button.quarto-search-button" },
  ];

  for (const { name, selector } of buttons) {
    test(`${name} button shows a focus indicator on keyboard focus`, async ({
      page,
      browserName,
    }) => {
      await page.goto(getUrl("website/bare-btn-focus/_site/index.html"), {
        waitUntil: "load",
      });

      const button = page.locator(`.quarto-secondary-nav ${selector}`);
      await expect(button).toBeVisible();
      expect(await tabUntilFocused(page, browserName, button)).toBe(true);

      await expect(button).not.toHaveCSS("outline-style", "none");
    });
  }
});

test.describe("website sidebar section toggle", () => {
  // The left sidebar is display: none below the lg breakpoint (992px), so
  // its section toggles are only focusable at full width.
  test.use({ viewport: { width: 1400, height: 900 } });

  test("shows a focus indicator on keyboard focus", async ({
    page,
    browserName,
  }) => {
    await page.goto(getUrl("website/bare-btn-focus/_site/index.html"), {
      waitUntil: "load",
    });

    const button = page.locator(
      "#quarto-sidebar button.sidebar-item-toggle",
    ).first();
    await expect(button).toBeVisible();
    expect(await tabUntilFocused(page, browserName, button)).toBe(true);

    await expect(button).not.toHaveCSS("outline-style", "none");
  });
});
