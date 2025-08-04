import { test, expect } from '@playwright/test';

async function check_theme_overrides(page) {
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-light');
  await expect(locatr).toHaveCSS('background-color', 'rgb(252, 252, 252)');
  await page.locator("a.quarto-color-scheme-toggle").click();
  const locatr2 = await page.locator('body').first();
  await expect(locatr2).toHaveCSS('background-color', 'rgb(6, 6, 6)');
}
// themes used in these documents have background colors

test('Dark and light brand before user themes', async ({ page }) => {
  // theme will override brand
  await page.goto('./html/dark-brand/brand-before-theme.html');
  await check_theme_overrides(page);
});

// project tests

test('Project brand before user themes', async ({ page }) => {
  // theme will override brand
  await page.goto('./html/dark-brand/project-dark/brand-under-theme.html');
  await check_theme_overrides(page);
});

test('Brand false remove project brand', async ({ page }) => {
  // theme will override brand
  await page.goto('./html/dark-brand/project-dark/brand-false.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-light');
  await expect(locatr).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  // no toggle
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(0);
});


test('Syntax highlighting, a11y, with JS', async ({ page }) => {
  // This document use a custom theme file that change the background color of the title banner
  // Same user defined color should be used in both dark and light theme
  await page.goto('./html/dark-brand/syntax-highlighting/a11y-syntax-highlighting.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-light');
  await expect(locatr).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const importKeyword = await page.locator('span.im').first();
  // light inline code
  const pythonCode = await page.locator('li code.sourceCode.r');
  await expect(pythonCode).toHaveCSS('background-color', 'rgba(233, 236, 239, 0.65)');
  await expect(pythonCode).toHaveCSS('color', 'rgb(125, 18, 186)');
  // light highlight stylesheet 
  await expect(importKeyword).toHaveCSS('color', 'rgb(84, 84, 84)');

  await page.locator("a.quarto-color-scheme-toggle").click();

  // dark inline code
  await expect(pythonCode).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(pythonCode).toHaveCSS('color', 'rgb(192, 128, 216)');
  // dark highlight stylesheet
  await expect(importKeyword).toHaveCSS('color', 'rgb(248, 248, 242)');
});


test('Syntax highlighting, arrow, with JS', async ({ page }) => {
  // This document use a custom theme file that change the background color of the title banner
  // Same user defined color should be used in both dark and light theme
  await page.goto('./html/dark-brand/syntax-highlighting/arrow-syntax-highlighting.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-light');
  await expect(locatr).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  // light inline code
  const pythonCode = await page.locator('li code.sourceCode.python');
  await expect(pythonCode).toHaveCSS('background-color', 'rgba(233, 236, 239, 0.65)');
  await expect(pythonCode).toHaveCSS('color', 'rgb(125, 18, 186)');
  // alert
  const link = await page.locator('span.al').first();
  await expect(link).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); // transparent

  await page.locator("a.quarto-color-scheme-toggle").click();
  // dark inline code
  await expect(pythonCode).toHaveCSS('background-color', 'rgba(37, 41, 46, 0.65)');
  await expect(pythonCode).toHaveCSS('color', 'rgb(122, 130, 136)');
});
