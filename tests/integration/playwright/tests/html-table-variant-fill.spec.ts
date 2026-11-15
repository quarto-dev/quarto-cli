import { test, expect } from '@playwright/test';

const url = './html/table-variant-fill.html';

const expected = {
  light: {
    primary: 'rgb(212, 230, 249)',
    success: 'rgb(217, 240, 209)',
    danger: 'rgb(255, 204, 215)',
  },
  dark: {
    primary: 'rgb(55, 90, 127)',
    success: 'rgb(0, 188, 140)',
    danger: 'rgb(231, 76, 60)',
  },
};

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Table variant fill in ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test('table-primary fills its cells', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#variant-table tbody td')).toHaveCSS('background-color', expected[scheme].primary);
      await expect(page.locator('#variant-table thead th')).toHaveCSS('background-color', expected[scheme].primary);
    });

    test('table-success and table-danger rows fill their cells', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#variant-rows tr.table-success td')).toHaveCSS('background-color', expected[scheme].success);
      await expect(page.locator('#variant-rows tr.table-danger td')).toHaveCSS('background-color', expected[scheme].danger);
    });

    test('plain row cells stay transparent', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#variant-rows tr.plain td')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    });

    test('self-styled table keeps its own fill and text colour (#7566)', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#self-styled')).toHaveCSS('background-color', 'rgb(128, 128, 128)');
      await expect(page.locator('#self-styled tbody td')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('#self-styled tbody td')).toHaveCSS('color', 'rgb(0, 0, 0)');
    });
  });
}
