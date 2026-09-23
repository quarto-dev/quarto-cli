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

test('Plotly figures in initially hidden tabs fill the tab when shown', async ({ page }) => {
  await page.goto('/html/tabsets/plotly-tabsets.html');
  await page.getByRole('tab', { name: 'Tab 2' }).click();
  const tab2Content = page.locator('div.tab-content div.tab-pane').nth(1);
  await expect(tab2Content).toHaveClass(/active/);
  const plot = tab2Content.locator('.js-plotly-plot');
  // Plotly adds a second .main-svg for hover labels; the first one holds the figure
  const figure = plot.locator('.main-svg').first();
  await expect(figure).toBeVisible();
  // Figures drawn while their tab is hidden fall back to Plotly's default 700px width
  await expect.poll(async () => {
    const plotBox = await plot.boundingBox();
    const figureBox = await figure.boundingBox();
    return Math.abs(figureBox!.width - plotBox!.width);
  }).toBeLessThanOrEqual(1);
});
