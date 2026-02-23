import { test, expect } from '@playwright/test';

// Tests for https://github.com/quarto-dev/quarto-cli/issues/14084
// RevealJS: brand colour overrides with perceptually-dark but low-HWB-blackness
// colours (like blue #0000FF) should still produce the correct dark sentinel,
// resulting in body.quarto-dark and dark syntax highlighting.

test.describe('Issue 14084: RevealJS blue background dark mode sentinel', () => {

  test('Dark theme with blue brand background: body has quarto-dark', async ({ page }) => {
    await page.goto('./revealjs/dark-brand/issue-14084-dark-blue.html');

    // Body should have quarto-dark class
    const body = page.locator('body');
    await expect(body).toHaveClass(/quarto-dark/);

    // Dark content should be visible, light content hidden
    await expect(page.locator('span.dark-content').first()).toBeVisible();
    await expect(page.locator('span.light-content').first()).toBeHidden();

    // Syntax highlighting should use the dark stylesheet
    const highlightLink = page.locator('link#quarto-text-highlighting-styles');
    await expect(highlightLink).toHaveAttribute('href', /quarto-syntax-highlighting-dark/);
  });

  test('Dark theme baseline: body has quarto-dark', async ({ page }) => {
    await page.goto('./revealjs/dark-brand/issue-14084-dark-default.html');

    // Body should have quarto-dark class
    const body = page.locator('body');
    await expect(body).toHaveClass(/quarto-dark/);

    // Dark content should be visible, light content hidden
    await expect(page.locator('span.dark-content').first()).toBeVisible();
    await expect(page.locator('span.light-content').first()).toBeHidden();

    // Syntax highlighting should use the dark stylesheet
    const highlightLink = page.locator('link#quarto-text-highlighting-styles');
    await expect(highlightLink).toHaveAttribute('href', /quarto-syntax-highlighting-dark/);
  });
});
