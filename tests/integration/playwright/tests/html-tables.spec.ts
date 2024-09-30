import { test, expect } from '@playwright/test';

test('Markdown tables are styled correctly', async ({ page }) => {
await page.goto('html/markdown-tables.html');
await expect(page.getByRole('figure', { name: 'Table 1: My Caption' }).locator('table')).toHaveScreenshot()
await expect(page.locator('a.quarto-xref[href="#tbl-letters"]')).toContainText('Table 1');

await expect(page.locator('#computational-table table')).toHaveScreenshot()

});