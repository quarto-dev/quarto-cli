import { expect, Locator, test } from "@playwright/test";
import { getUrl, tabUntilFocused } from "../src/utils";

// Quarto draws one keyboard focus ring for every focusable element, from a
// global `:focus-visible` rule: an outline in the outer color, with
// the inner color as a box-shadow in the outline offset (W3C technique
// C40). Bootstrap's box-shadow halos are turned off at the source.
//
// The website fixture sets `$focus-ring-outer-color: #123456`, so an
// outline in that color shows that the global rule won the cascade on that
// control; a component rule that wins instead shows up as a wrong color.
//
// Focus moves with real Tab presses (tabUntilFocused) because the ring
// only applies to keyboard focus, i.e. to :focus-visible.

const outerColor = "rgb(18, 52, 86)"; // #123456, set in focus-ring.scss
const innerShadow = /^rgb\(255, 255, 255\) 0px 0px 0px 2px/; // default $white

async function expectFocusRing(control: Locator) {
  await expect(control).toHaveCSS("outline-style", "solid");
  await expect(control).toHaveCSS("outline-color", outerColor);
  await expect(control).toHaveCSS("outline-width", "2px");
  await expect(control).toHaveCSS("outline-offset", "2px");
  await expect(control).toHaveCSS("box-shadow", innerShadow);
}

test.describe("website controls show the focus ring", () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  const controls = [
    { name: "navbar link", page: "index", selector: "#navbarCollapse a.nav-link:not(.active)" },
    { name: "sidebar section toggle", page: "index", selector: "#quarto-sidebar button.sidebar-item-toggle" },
    { name: "inline link", page: "index", selector: "main a:not([class])" },
    { name: "TOC link", page: "index", selector: "#TOC a.nav-link:not(.active)" },
    { name: "tabset tab", page: "index", selector: ".panel-tabset a.nav-link.active" },
    { name: "listing sort", page: "listing", selector: ".quarto-listing-sort select" },
    { name: "listing filter", page: "listing", selector: ".quarto-listing-filter input" },
    { name: "listing pagination", page: "listing", selector: ".pagination li.active a.page-link" },
  ];

  for (const { name, page: pageName, selector } of controls) {
    test(name, async ({ page, browserName }) => {
      await page.goto(getUrl(`website/focus-indicator/_site/${pageName}.html`), {
        waitUntil: "load",
      });
      const control = page.locator(selector).first();
      await expect(control).toBeVisible();
      expect(await tabUntilFocused(page, browserName, control, 40)).toBe(true);
      await expectFocusRing(control);
    });
  }
});

// The search box draws the ring on the form, which is the visible field,
// instead of on the borderless input inside it.
test("sidebar search input shows the focus ring on its form", async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(getUrl("website/focus-indicator/_site/index.html"), {
    waitUntil: "load",
  });
  const input = page.locator("#quarto-sidebar .aa-Input");
  await expect(input).toBeVisible();
  expect(await tabUntilFocused(page, browserName, input)).toBe(true);
  await expectFocusRing(page.locator("#quarto-sidebar .aa-Form"));
  await expect(input).toHaveCSS("outline-style", "none");
});

// Regression tests for #14774: these buttons carry Bootstrap's `btn` class
// with no `btn-*` variant, so Bootstrap's own .btn:focus-visible left them
// with no indicator.
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
    test(`${name} button shows the focus ring`, async ({
      page,
      browserName,
    }) => {
      await page.goto(getUrl("website/focus-indicator/_site/index.html"), {
        waitUntil: "load",
      });

      const button = page.locator(`.quarto-secondary-nav ${selector}`);
      await expect(button).toBeVisible();
      expect(await tabUntilFocused(page, browserName, button)).toBe(true);
      await expectFocusRing(button);
    });
  }
});

test("code tools button shows the focus ring", async ({
  page,
  browserName,
}) => {
  await page.goto(getUrl("html/code-tools-focus-indicator.html"), {
    waitUntil: "load",
  });

  const button = page.locator("button.code-tools-button");
  await expect(button).toBeVisible();
  expect(await tabUntilFocused(page, browserName, button)).toBe(true);

  // Default theme, so no fixed outer color to compare against.
  await expect(button).toHaveCSS("outline-style", "solid");
  await expect(button).toHaveCSS("outline-offset", "2px");
  await expect(button).toHaveCSS("box-shadow", innerShadow);
});

// Forced-colors mode drops every box-shadow, so Bootstrap's halo left
// `.nav-link` with no indicator there. The ring's outline survives.
test.describe("forced colors", () => {
  test.use({ viewport: { width: 1400, height: 900 }, forcedColors: "active" });

  test("navbar link keeps an outline", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "forced colors emulation is Chromium-only");
    await page.goto(getUrl("website/focus-indicator/_site/index.html"), {
      waitUntil: "load",
    });
    const link = page.locator("#navbarCollapse a.nav-link:not(.active)").first();
    expect(await tabUntilFocused(page, browserName, link)).toBe(true);
    await expect(link).toHaveCSS("outline-style", "solid");
    await expect(link).toHaveCSS("outline-width", "2px");
  });
});

// Author focus rules must win over the global ring. The fixture's theme
// sets `a:focus-visible { outline: 3px solid #b5361f }`, a (0,1,1)
// selector, and removes the inner tone with one custom property.
test("author a:focus-visible rule replaces the focus ring", async ({
  page,
  browserName,
}) => {
  await page.goto(getUrl("html/focus-ring-author-override.html"), {
    waitUntil: "load",
  });
  const link = page.getByRole("link", { name: "inline link" });
  await expect(link).toBeVisible();
  expect(await tabUntilFocused(page, browserName, link)).toBe(true);
  await expect(link).toHaveCSS("outline-color", "rgb(181, 54, 31)");
  await expect(link).toHaveCSS("outline-width", "3px");
  await expect(link).toHaveCSS("box-shadow", "none");
});

// The ring's width and offset are public Sass variables. The fixture sets
// a 3px outline with a 1px offset; the inner tone fills the 1px gap.
test("Sass variables set the focus ring size", async ({
  page,
  browserName,
}) => {
  await page.goto(getUrl("html/focus-ring-size.html"), { waitUntil: "load" });
  const link = page.getByRole("link", { name: "inline link" });
  await expect(link).toBeVisible();
  expect(await tabUntilFocused(page, browserName, link)).toBe(true);
  await expect(link).toHaveCSS("outline-style", "solid");
  await expect(link).toHaveCSS("outline-width", "3px");
  await expect(link).toHaveCSS("outline-offset", "1px");
  await expect(link).toHaveCSS("box-shadow", /^rgb\(255, 255, 255\) 0px 0px 0px 1px/);
});
