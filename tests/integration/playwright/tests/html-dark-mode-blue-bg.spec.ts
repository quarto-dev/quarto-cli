import { test, expect } from '@playwright/test';

// Tests for https://github.com/quarto-dev/quarto-cli/issues/14084
// Brand colour overrides with perceptually-dark but low-HWB-blackness
// colours (like blue #0000FF) break the dark mode sentinel, causing
// data-mode="light" on the dark stylesheet and preventing the
// quarto-dark body class from being applied.

test.describe('Issue 14084: blue background dark mode sentinel', () => {

  test('Dual theme with explicit light/dark: toggle applies quarto-dark', async ({ page }) => {
    await page.goto('./html/dark-brand/issue-14084-dual.html');

    // Should start in light mode
    const body = page.locator('body').first();
    await expect(body).toHaveClass(/quarto-light/);

    // Light content should be visible, dark content hidden
    await expect(page.locator('span.light-content').first()).toBeVisible();
    await expect(page.locator('span.dark-content').first()).toBeHidden();

    // The dark stylesheet link should have data-mode="dark"
    const darkLink = page.locator('link#quarto-bootstrap.quarto-color-alternate');
    await expect(darkLink).toHaveAttribute('data-mode', 'dark');

    // Toggle to dark mode
    await page.locator('a.quarto-color-scheme-toggle').click();

    // Body should now have quarto-dark
    await expect(body).toHaveClass(/quarto-dark/);

    // Dark content should be visible, light content hidden
    await expect(page.locator('span.dark-content').first()).toBeVisible();
    await expect(page.locator('span.light-content').first()).toBeHidden();
  });

  test('Single dark theme with brand: dark stylesheet has correct data-mode', async ({ page }) => {
    // theme: [darkly, brand] with brand background: blue
    // Brand auto-creates a light+dark pair (no toggle button, but dual stylesheets).
    // The key test: the dark stylesheet link must have data-mode="dark"
    // despite blue having 0% HWB blackness.
    await page.goto('./html/dark-brand/issue-14084-single.html');

    // The dark stylesheet link should have data-mode="dark"
    const darkLink = page.locator('link#quarto-bootstrap.quarto-color-alternate');
    await expect(darkLink).toHaveAttribute('data-mode', 'dark');

    // The light stylesheet link should have data-mode="light"
    const lightLink = page.locator('link#quarto-bootstrap.quarto-color-scheme:not(.quarto-color-alternate):not(.quarto-color-scheme-extra)');
    await expect(lightLink).toHaveAttribute('data-mode', 'light');
  });
});
