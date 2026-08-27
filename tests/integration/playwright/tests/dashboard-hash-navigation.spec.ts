import { test, expect } from '@playwright/test';

const dashboard = '/dashboard/hash-navigation.html';

const heatPane = (page) => page.locator('#heat.dashboard-page');
const coolPane = (page) => page.locator('#cool.dashboard-page');

// https://github.com/quarto-dev/quarto-cli/issues/14818
test.describe('a hash that names no page leaves the pages alone', () => {
  test('on load', async ({ page }) => {
    await page.goto(`${dashboard}#no-such-thing`);
    await expect(heatPane(page)).toHaveClass(/active/);
    await expect(coolPane(page)).not.toHaveClass(/active/);
    await expect(page.locator('html')).not.toHaveClass(/hidden/);
  });

  test('on a hash change', async ({ page }) => {
    await page.goto(dashboard);
    await expect(heatPane(page)).toHaveClass(/active/);
    // an in-page anchor that exists but is not a page, such as a footnote
    await page.evaluate(() => { window.location.hash = '#fn1'; });
    await expect(heatPane(page)).toHaveClass(/active/);
  });

  // isPage used to build a selector from the hash, which throws for a hash
  // that is not a valid CSS selector and left the whole dashboard hidden
  test('when the hash is not a valid CSS selector', async ({ page }) => {
    await page.goto(`${dashboard}#1foo`);
    await expect(page.locator('html')).not.toHaveClass(/hidden/);
    await expect(heatPane(page)).toHaveClass(/active/);
  });
});

test('page navigation and history still work', async ({ page }) => {
  await page.goto(dashboard);
  await expect(heatPane(page)).toHaveClass(/active/);

  await page.locator('.navbar .nav-link[data-bs-target="#cool"]').click();
  await expect(coolPane(page)).toHaveClass(/active/);
  await expect(heatPane(page)).not.toHaveClass(/active/);

  await page.goBack();
  await expect(heatPane(page)).toHaveClass(/active/);

  await page.goForward();
  await expect(coolPane(page)).toHaveClass(/active/);
});
