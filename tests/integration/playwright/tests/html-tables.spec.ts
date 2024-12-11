import { test, expect } from '@playwright/test';

async function testTables(page, path: string) {
  await page.goto(`html/tables/${path}`);
  await expect(page.locator('#labelled table')).toHaveScreenshot();
  await expect(page.locator('a.quarto-xref[href="#tbl-letters"]')).toContainText('Table 1');
  await expect(page.locator('#non-labelled table')).toHaveScreenshot();
  await expect(page.locator('#computation table')).toHaveScreenshot();
}

test('Markdown tables are styled correctly', async ({ page }) => {
  // Test with default caption position
  await testTables(page, 'markdown-tables.html');

  // Test with bottom caption
  await testTables(page, 'markdown-tables-cap-bottom.html');
});
