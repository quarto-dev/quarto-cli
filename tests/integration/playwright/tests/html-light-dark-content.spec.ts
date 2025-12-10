import { test, expect } from '@playwright/test';

async function check_light_content_visibility(page) {
  // In light mode, light-content should be visible, dark-content should be hidden
  const light_spans = await page.locator('span.light-content');
  const dark_spans = await page.locator('span.dark-content');

  // Check that light content spans exist and are visible
  await expect(light_spans.first()).toHaveCSS('display', /(block|inline)/);

  // Check that dark content spans are hidden
  await expect(dark_spans.first()).toHaveCSS('display', 'none');

  // Check block elements
  const light_blocks = await page.locator('div.light-content').filter({ has: page.locator('blockquote, p, :not(div)') });
  const dark_blocks = await page.locator('div.dark-content').filter({ has: page.locator('blockquote, p, :not(div)') });

  // At least check the overall divs with light-content class
  const light_divs = await page.locator('div.light-content');
  const dark_divs = await page.locator('div.dark-content');

  if (await light_divs.count() > 0) {
    await expect(light_divs.first()).toHaveCSS('display', /(block|inline)/);
  }

  if (await dark_divs.count() > 0) {
    await expect(dark_divs.first()).toHaveCSS('display', 'none');
  }
}

async function check_dark_content_visibility(page) {
  // In dark mode, dark-content should be visible, light-content should be hidden
  const light_spans = await page.locator('span.light-content');
  const dark_spans = await page.locator('span.dark-content');

  // Check that dark content spans exist and are visible
  await expect(dark_spans.first()).toHaveCSS('display', /(block|inline)/);

  // Check that light content spans are hidden
  await expect(light_spans.first()).toHaveCSS('display', 'none');

  // Check block elements
  const light_divs = await page.locator('div.light-content');
  const dark_divs = await page.locator('div.dark-content');

  if (await light_divs.count() > 0) {
    await expect(light_divs.first()).toHaveCSS('display', 'none');
  }

  if (await dark_divs.count() > 0) {
    await expect(dark_divs.first()).toHaveCSS('display', /(block|inline)/);
  }
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

test.describe('Light and dark content in dark mode', () => {
  test.use({
    colorScheme: 'dark'
  });

  test('HTML: light and dark content visibility in dark mode', async ({ page }) => {
    await page.goto('./html/unified-brand/light-dark-content.html');
    await check_dark_content_visibility(page);
  });
});

test.describe('Light and dark content theme toggle', () => {
  test.use({
    colorScheme: 'light'
  });

  test('HTML: toggle between light and dark modes', async ({ page }) => {
    await page.goto('./html/unified-brand/light-dark-content.html');

    // Start in light mode
    await check_light_content_visibility(page);

    // Click the theme toggle
    const toggle = await page.locator('a.quarto-color-scheme-toggle');
    if (await toggle.count() > 0) {
      await toggle.click();

      // Wait for the page to update
      await page.waitForTimeout(500);

      // Now check dark mode visibility
      await check_dark_content_visibility(page);
    }
  });
});

test.describe('Light and dark content in RevealJS', () => {
  test('RevealJS: light and dark content visibility', async ({ page }) => {
    await page.goto('./revealjs/light-dark-content.html');

    // Check that light-content and dark-content elements exist
    const light_spans = await page.locator('span.light-content');
    const dark_spans = await page.locator('span.dark-content');
    const light_divs = await page.locator('div.light-content');
    const dark_divs = await page.locator('div.dark-content');

    // Verify elements exist
    await expect(light_spans).not.toHaveCount(0);
    await expect(dark_spans).not.toHaveCount(0);
    await expect(light_divs).not.toHaveCount(0);
    await expect(dark_divs).not.toHaveCount(0);

    // Check that body has the correct theme class
    const body = await page.locator('body').first();
    const bodyClasses = await body.getAttribute('class');
    expect(bodyClasses).toContain('quarto-light');

    // Verify visibility based on theme
    await expect(light_spans.first()).toHaveCSS('display', /(block|inline)/);
    await expect(dark_spans.first()).toHaveCSS('display', 'none');

    if (await light_divs.count() > 0) {
      await expect(light_divs.first()).toHaveCSS('display', /(block|inline)/);
    }

    if (await dark_divs.count() > 0) {
      await expect(dark_divs.first()).toHaveCSS('display', 'none');
    }
  });
});
