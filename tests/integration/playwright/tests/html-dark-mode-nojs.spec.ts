import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('Dark brand default, no JS', async ({ page }) => {
  // This document use a custom theme file that change the background color of the title banner
  // Same user defined color should be used in both dark and light theme
  await page.goto('./html/dark-brand/brand-after-theme.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-dark');
  await expect(locatr).toHaveCSS('background-color', 'rgb(66, 7, 11)');
});


test('Light brand default, no JS', async ({ page }) => {
  // This document use a custom theme file that change the background color of the title banner
  // Same user defined color should be used in both dark and light theme
  await page.goto('./html/dark-brand/brand-before-theme.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-light');
  await expect(locatr).toHaveCSS('background-color', 'rgb(252, 252, 252)');
});


test('Syntax highlighting, no JS', async ({ page }) => {
  // This document use a custom theme file that change the background color of the title banner
  // Same user defined color should be used in both dark and light theme
  await page.goto('./html/dark-brand/syntax-highlighting/syntax-highlighting.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-light');
  await expect(locatr).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const importKeyword = await page.locator('span.im').first();
  await expect(importKeyword).toHaveCSS('color', 'rgb(84, 84, 84)');
});


test('Project dark brand default, no JS', async ({ page }) => {
  // This document use a custom theme file that change the background color of the title banner
  // Same user defined color should be used in both dark and light theme
  await page.goto('./html/dark-brand/project-dark/simple.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-dark');
  await expect(locatr).toHaveCSS('background-color', 'rgb(66, 7, 11)');
});

