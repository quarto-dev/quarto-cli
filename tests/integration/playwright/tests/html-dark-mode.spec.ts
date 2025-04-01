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