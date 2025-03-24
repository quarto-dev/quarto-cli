import { test, expect } from '@playwright/test';

test('Dark and light brand after user themes', async ({ page }) => {
  // This document use a custom theme file that change the background color of the title banner
  // Same user defined color should be used in both dark and light theme
  await page.goto('./html/dark-brand/brand-after-theme.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-dark');
  await expect(locatr).toHaveCSS('background-color', 'rgb(66, 7, 11)');
  await page.locator("a.quarto-color-scheme-toggle").click();
  const locatr2 = await page.locator('body').first();
  await expect(locatr2).toHaveCSS('background-color', 'rgb(204, 221, 255)');
});


test('Dark and light brand before user themes', async ({ page }) => {
  // This document use a custom theme file that change the background color of the title banner
  // Same user defined color should be used in both dark and light theme
  await page.goto('./html/dark-brand/brand-before-theme.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-light');
  await expect(locatr).toHaveCSS('background-color', 'rgb(252, 252, 252)');
  await page.locator("a.quarto-color-scheme-toggle").click();
  const locatr2 = await page.locator('body').first();
  await expect(locatr2).toHaveCSS('background-color', 'rgb(6, 6, 6)');
});
