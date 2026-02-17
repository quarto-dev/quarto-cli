import { test, expect } from "@playwright/test";

test('Search highlights persist after page load', async ({ page }) => {
  await page.goto('./html/search-highlight/_site/index.html?q=special');
  const marks = page.locator('mark');

  // Marks should exist after page load
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // Simulate the layout-triggered quarto-hrChanged event that clears marks
  // prematurely without the fix (#14047). With the fix, the listener is
  // registered after a delay, so early events like this are ignored.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('quarto-hrChanged'));
  });

  // Marks should still be visible after the simulated layout event
  await expect(marks.first()).toBeVisible();
  await expect(marks.first()).toContainText(/special/i);
});

test('Search highlights are cleared by scroll after delay', async ({ page }) => {
  await page.goto('./html/search-highlight/_site/index.html?q=special');
  const marks = page.locator('mark');

  // Marks should exist after page load
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // Wait for the delayed listener registration (1000ms in quarto-search.js)
  await page.waitForTimeout(1500);

  // Now quarto-hrChanged should clear marks (listener is registered)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('quarto-hrChanged'));
  });

  await expect(marks).toHaveCount(0);
});
