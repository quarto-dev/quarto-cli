import { test, expect } from "@playwright/test";

const BASE = './html/search-highlight/_site/index.html';

test('Search highlights persist after scrolling', async ({ page }) => {
  await page.goto(`${BASE}?q=special`);
  const marks = page.locator('mark');

  await expect(marks.first()).toBeVisible({ timeout: 5000 });
  const initialCount = await marks.count();
  expect(initialCount).toBeGreaterThanOrEqual(2);

  // Scroll the page — marks should not be cleared
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);
  await expect(marks).toHaveCount(initialCount);
});

test('Search highlights cleared when query changes', async ({ page }) => {
  await page.goto(`${BASE}?q=special`);
  const marks = page.locator('mark');

  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // Open the search overlay and type a different query
  await page.locator('#quarto-search').getByRole('button').click();
  const input = page.getByRole('searchbox');
  await expect(input).toBeVisible({ timeout: 2000 });

  // Typing a different query triggers onStateChange which clears marks
  await input.fill('different');
  await expect(page.locator('main mark')).toHaveCount(0, { timeout: 2000 });
});

test('TOC links do not retain search query parameter', async ({ page }) => {
  await page.goto(`${BASE}?q=special`);
  await page.waitForSelector('mark');

  // Check that sidebar/TOC links don't contain ?q=
  const tocLinks = page.locator('#TOC a[href], .sidebar-navigation a[href]');
  const count = await tocLinks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const href = await tocLinks.nth(i).getAttribute('href');
    if (href) {
      expect(href).not.toContain('q=special');
    }
  }
});

test('No highlights without search query', async ({ page }) => {
  await page.goto(BASE);

  // Wait for page to fully load
  await expect(page.locator('main')).toBeVisible();

  // No marks should exist without ?q= parameter
  await expect(page.locator('mark')).toHaveCount(0);
});
