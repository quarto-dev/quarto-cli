import { test, expect } from '@playwright/test';

test('Markdown tables are styled correct', async ({ page }) => {
await page.goto('html/markdown-tables.html');
await expect(page.getByRole('figure', { name: 'Table 1: My Caption' })).toBeVisible();
await expect(page.getByRole('figure', { name: 'Table 1: My Caption' }).locator('table')).toHaveCSS('border-top-style', 'solid')
await expect(page.getByRole('figure', { name: 'Table 1: My Caption' }).locator('table')).toHaveCSS('border-top-width', '1px')
await expect(page.getByRole('figure', { name: 'Table 1: My Caption' }).locator('table')).toHaveCSS('border-bottom-style', 'solid')
await expect(page.getByRole('figure', { name: 'Table 1: My Caption' }).locator('table')).toHaveCSS('border-bottom-width', '1px')
await expect(page.getByRole('figure', { name: 'Table 1: My Caption' }).locator('table tr').nth(1)).toHaveCSS('border-style', 'solid')
await expect(page.locator('a.quarto-xref[href="#tbl-letters"]')).toContainText('Table 1');

await expect(page.locator('#computational-table table')).toBeVisible();
await expect(page.locator('#computational-table table')).toHaveCSS('border-top-style', 'solid')
await expect(page.locator('#computational-table table')).toHaveCSS('border-top-width', '1px')
await expect(page.locator('#computational-table table')).toHaveCSS('border-bottom-style', 'solid')
await expect(page.locator('#computational-table table')).toHaveCSS('border-bottom-width', '1px')
await expect(page.locator('#computational-table table')).toHaveCSS('border-style', /solid/)
await expect(page.locator('#computational-table table').locator('td').nth(1)).toHaveCSS('box-shadow', /rgba\(0, 0, 0, 0\.05/)

});