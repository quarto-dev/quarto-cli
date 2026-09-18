import { test, expect } from '@playwright/test';

test('Jupyter - Creates working tabsets from for loops', async ({ page }) => {
  await page.goto('/html/tabsets/jupyter-tabsets.html');
  const tab1 = page.getByRole('tab', { name: 'tab1 inside for loop:' });
  await expect(tab1).toHaveClass(/active/);
  const tabContent = page.locator('div.tab-content')
  await expect(tabContent).toBeVisible();
  const tab1Content = tabContent.locator('div.tab-pane').first(); 
  await expect(tab1Content).toHaveClass(/active/);
  await expect(tab1Content.locator('img')).toBeVisible();
  const tab2 = page.getByRole('tab', { name: 'tab2 inside for loop:' })
  await tab2.click();
  await expect(tab1).not.toHaveClass(/active/);
  await expect(tab1Content).not.toHaveClass(/active/);
  await expect(tab2).toHaveClass(/active/);
  const tab2Content = tabContent.locator('div.tab-pane').nth(1); 
  await expect(tab2Content).toHaveClass(/active/);
  await expect(tab2Content.locator('img')).toBeVisible();
});