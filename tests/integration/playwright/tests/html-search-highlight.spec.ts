import { test, expect } from "@playwright/test";

const BASE = './html/search-highlight/_site/index.html';

test('Search highlights not cleared by scroll events', async ({ page }) => {
  await page.goto(`${BASE}?q=special`);
  const marks = page.locator('mark');

  await expect(marks.first()).toBeVisible({ timeout: 5000 });
  const initialCount = await marks.count();
  expect(initialCount).toBeGreaterThanOrEqual(2);

  // Dispatch layout events immediately (previously cleared marks via quarto-hrChanged)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('quarto-hrChanged'));
    window.dispatchEvent(new CustomEvent('quarto-sectionChanged'));
  });
  await expect(marks).toHaveCount(initialCount);

  // Wait and dispatch again — marks should persist at any time
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('quarto-hrChanged'));
    window.dispatchEvent(new CustomEvent('quarto-sectionChanged'));
  });
  await expect(marks).toHaveCount(initialCount);
});

test('Search highlights cleared when query changes', async ({ page }) => {
  await page.goto(`${BASE}?q=special`);
  const marks = page.locator('mark');

  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // Open the detached search overlay
  await page.locator('.aa-DetachedSearchButton').click();
  const input = page.locator('.aa-Input');
  await expect(input).toBeVisible({ timeout: 2000 });

  // Type a different query — triggers onStateChange which clears marks
  await input.fill('different');
  await expect(page.locator('main mark')).toHaveCount(0, { timeout: 2000 });
});

test('No highlights without search query', async ({ page }) => {
  await page.goto(BASE);

  // Wait for page to fully load
  await expect(page.locator('main')).toBeVisible();

  // No marks should exist without ?q= parameter
  await expect(page.locator('mark')).toHaveCount(0);
});
