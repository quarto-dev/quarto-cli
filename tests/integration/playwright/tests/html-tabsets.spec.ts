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

test.describe('Tabby tabsets (theme: none) keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/html/tabsets/tabby-keyboard.html');
    await expect(page.getByRole('tablist')).toBeAttached();
  });

  test('Tab moves from the selected tab into its panel (#730)', async ({ page }) => {
    await page.getByRole('button', { name: 'Button before the tabset' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('tab', { name: 'Tab A' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Button in tab A' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Tab A' })).toHaveAttribute('aria-selected', 'true');
  });

  test('Shift+Tab from the panel returns to the selected tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'Tab B' }).click();
    await page.getByRole('button', { name: 'Button in tab B' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('tab', { name: 'Tab B' })).toBeFocused();
  });

  test('Arrow keys move to and select the adjacent tab, wrapping around', async ({ page }) => {
    await page.getByRole('tab', { name: 'Tab A' }).focus();
    await page.keyboard.press('ArrowRight');
    const tabB = page.getByRole('tab', { name: 'Tab B' });
    await expect(tabB).toBeFocused();
    await expect(tabB).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Button in tab B' })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    const tabC = page.getByRole('tab', { name: 'Tab C' });
    await expect(tabC).toBeFocused();
    await expect(tabC).toHaveAttribute('aria-selected', 'true');
  });

  test('Home and End select the first and last tab without scrolling the page', async ({ page }) => {
    await page.getByRole('tab', { name: 'Tab A' }).focus();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Tab C' })).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: 'Tab A' })).toHaveAttribute('aria-selected', 'true');
  });
});