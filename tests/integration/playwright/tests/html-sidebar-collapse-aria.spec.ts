import { expect, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// On a narrow screen only the sidebar toggle button is a collapse control.
// The click area in the secondary bar and the backdrop behind the open
// sidebar forward their clicks to that button, so Bootstrap must not write
// aria-expanded on them (axe aria-allowed-attr).

test.use({ viewport: { width: 500, height: 800 } });

const url = "website/sidebar-collapse-aria/_site/index.html";

test("only the toggle button carries aria-expanded", async ({ page }) => {
  await page.goto(getUrl(url), { waitUntil: "load" });
  const toggle = page.locator(".quarto-secondary-nav .quarto-btn-toggle");
  const clickArea = page.locator(".quarto-secondary-nav a.flex-grow-1");
  const glass = page.locator("#quarto-sidebar-glass");
  const sidebar = page.locator("#quarto-sidebar");

  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(sidebar).toHaveClass(/\bshow\b/);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(clickArea).not.toHaveAttribute("aria-expanded");
  await expect(glass).not.toHaveAttribute("aria-expanded");

  // Tapping the backdrop closes the sidebar through the button.
  await glass.click({ position: { x: 480, y: 400 } });
  await expect(sidebar).not.toHaveClass(/\bshow\b/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(clickArea).not.toHaveAttribute("aria-expanded");
  await expect(glass).not.toHaveAttribute("aria-expanded");
});

test("the secondary bar click area opens the sidebar", async ({ page }) => {
  await page.goto(getUrl(url), { waitUntil: "load" });
  const toggle = page.locator(".quarto-secondary-nav .quarto-btn-toggle");
  const clickArea = page.locator(".quarto-secondary-nav a.flex-grow-1");

  await clickArea.click();
  await expect(page.locator("#quarto-sidebar")).toHaveClass(/\bshow\b/);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(clickArea).not.toHaveAttribute("aria-expanded");
});
