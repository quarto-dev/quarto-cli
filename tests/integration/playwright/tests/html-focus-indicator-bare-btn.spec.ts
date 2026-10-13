import { expect, Locator, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression tests for #14774. Quarto emits three buttons that carry the
// Bootstrap `btn` class with no `btn-*` variant class: the code tools
// button, the sidebar toggle, and the sidebar search button. Bootstrap's
// .btn:focus-visible removes the native focus ring (outline: 0) and
// substitutes a box-shadow that only the variant classes define, so these
// buttons took keyboard focus with no visible indicator. Quarto restores
// the browser's native ring with `outline: revert`.

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
