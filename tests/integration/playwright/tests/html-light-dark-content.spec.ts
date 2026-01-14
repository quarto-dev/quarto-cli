import { test, expect } from '@playwright/test';

async function check_light_content_visibility(page) {
  // In light mode, light-content should be visible, dark-content should be hidden
  const light_spans = page.locator('span.light-content');
  const dark_spans = page.locator('span.dark-content');

  // Check that light content spans exist and are visible
  await expect(light_spans.first()).toBeVisible();

  // Check that dark content spans are hidden
  await expect(dark_spans.first()).toBeHidden();

  const light_divs = page.locator('div.light-content');
  const dark_divs = page.locator('div.dark-content');

  await expect(light_divs.first()).toBeVisible();
  await expect(dark_divs.first()).toBeHidden();
}

test.describe('Light and dark content in light mode', () => {
  test.use({
    colorScheme: 'light'
  });

  test('HTML: light and dark content visibility in light mode', async ({ page }) => {
    await page.goto('./html/unified-brand/light-dark-content.html');
    await check_light_content_visibility(page);
  });
});


test.describe('Light and dark content in RevealJS', () => {
  test('RevealJS: light and dark content visibility', async ({ page }) => {
    await page.goto('./revealjs/light-dark-content.html');

    // Check that light-content and dark-content elements exist
    const light_spans = page.locator('span.light-content');
    const dark_spans = page.locator('span.dark-content');
    const light_divs = page.locator('div.light-content');
    const dark_divs = page.locator('div.dark-content');

    await expect(light_spans).not.toHaveCount(0);
    await expect(dark_spans).not.toHaveCount(0);
    await expect(light_divs).not.toHaveCount(0);
    await expect(dark_divs).not.toHaveCount(0);

    // Check that body has the correct theme class
    const body = page.locator('body');
    await expect(body).toHaveClass(/quarto-light/);

    // Verify visibility based on theme
    await expect(light_spans.first()).toBeVisible();
    await expect(dark_spans.first()).toBeHidden();

    await expect(light_divs.first()).toBeVisible();
    await expect(dark_divs.first()).toBeHidden();
  });
});
