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

test('Plotly figures in initially hidden tabs fill the tab as soon as it is shown', async ({ page }) => {
  await page.goto('/html/tabsets/plotly-tabsets.html');
  const tab2 = page.getByRole('tab', { name: 'Tab 2' });
  const tab2Content = page.locator('div.tab-content div.tab-pane').nth(1);
  // Plotly adds a second .main-svg for hover labels; the first one holds the figure
  await expect(tab2Content.locator('.js-plotly-plot .main-svg').first()).toBeAttached();
  // Figures drawn while their tab is hidden fall back to Plotly's default 700px width.
  // Measure in the first animation frame after the click, which runs before the
  // browser paints the tab, so a figure that is only resized later fails the test.
  const widths = await tab2.evaluate((tab) => new Promise<{ figure: number; container: number }>((resolve) => {
    tab.click();
    requestAnimationFrame(() => {
      const pane = document.getElementById(tab.getAttribute('data-bs-target')!.slice(1))!;
      const plot = pane.querySelector('.js-plotly-plot')!;
      resolve({
        figure: plot.querySelector('.main-svg')!.getBoundingClientRect().width,
        container: plot.getBoundingClientRect().width,
      });
    });
  }));
  await expect(tab2Content).toHaveClass(/active/);
  expect(Math.abs(widths.figure - widths.container)).toBeLessThanOrEqual(1);
});
