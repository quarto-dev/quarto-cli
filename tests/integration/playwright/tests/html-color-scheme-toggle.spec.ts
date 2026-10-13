import { expect, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression tests for #13463. On a plain document (no navbar to hold it) the
// dark/light mode toggle is created by the after-body script at
// DOMContentLoaded and floated in the top right. It has to land inside a
// landmark, so that landmark navigation can reach it, without changing where
// it is drawn: the toggle is positioned against the page, so its container
// must stay a direct child of body and must not be positioned or a grid.

test("fallback color-scheme toggle sits in a header landmark", async ({
  page,
}) => {
  await page.goto(getUrl("html/color-scheme-toggle-plain.html"), {
    waitUntil: "load",
  });

  // No page level banner in this document, so the toggle gets a header of its own.
  const container = page.locator(
    "body > header.quarto-color-scheme-toggle-container",
  );
  await expect(container).toHaveCount(1);
  await expect(
    container.locator("button.quarto-color-scheme-toggle"),
  ).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCount(1);
});

test("fallback color-scheme toggle uses a named region when the page already has a banner", async ({
  page,
}) => {
  await page.goto(getUrl("html/color-scheme-toggle-banner.html"), {
    waitUntil: "load",
  });

  // title-block-banner already puts a banner at the top level of the document.
  await expect(page.locator("body > header#title-block-header")).toHaveCount(1);

  const container = page.locator(
    'body > div.quarto-color-scheme-toggle-container[role="region"]',
  );
  await expect(container).toHaveCount(1);
  await expect(container).toHaveAttribute("aria-label", /\S/);
  await expect(
    container.locator("button.quarto-color-scheme-toggle"),
  ).toHaveCount(1);

  // The document must not end up with a second banner. Assert this through the
  // computed role, not through the selector the implementation uses to probe
  // for a banner, otherwise the test cannot catch a fault in that probe.
  await expect(page.getByRole("banner")).toHaveCount(1);

  // The container must not become the toggle's containing block:
  // #title-block-header is both positioned and a grid, so reparenting the
  // toggle into it would move the toggle out of the corner.
  const box = await page
    .locator("button.quarto-color-scheme-toggle")
    .boundingBox();
  const viewport = page.viewportSize();
  expect(box.y).toBeLessThan(60);
  expect(viewport.width - (box.x + box.width)).toBeLessThan(60);
});

test("fallback color-scheme toggle sees a banner that is not a child of body", async ({
  page,
}) => {
  await page.goto(getUrl("html/color-scheme-toggle-custom-layout.html"), {
    waitUntil: "load",
  });

  // page-layout: custom puts the title block header inside a div. A div does
  // not strip the implicit banner role, so the page already has a banner and
  // the toggle must not add a second one.
  await expect(
    page.locator("body > div > header#title-block-header"),
  ).toHaveCount(1);
  await expect(
    page.locator('body > div.quarto-color-scheme-toggle-container[role="region"]'),
  ).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCount(1);
});
