import { test, expect } from '@playwright/test';

async function check_red_blue(page) {
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-dark');
  await expect(locatr).toHaveCSS('background-color', 'rgb(66, 7, 11)');
  await page.locator("a.quarto-color-scheme-toggle").click();
  const locatr2 = await page.locator('body').first();
  await expect(locatr2).toHaveCSS('background-color', 'rgb(204, 221, 255)');
}

async function check_theme_overrides(page) {
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-light');
  await expect(locatr).toHaveCSS('background-color', 'rgb(252, 252, 252)');
  await page.locator("a.quarto-color-scheme-toggle").click();
  const locatr2 = await page.locator('body').first();
  await expect(locatr2).toHaveCSS('background-color', 'rgb(6, 6, 6)');
}
// themes used in these documents have background colors

test('Dark and light brand after user themes', async ({ page }) => {
  // brand overrides theme background color
  await page.goto('./html/dark-brand/brand-after-theme.html');
  await check_red_blue(page);
});

test('Dark and light brand before user themes', async ({ page }) => {
  // theme will override brand
  await page.goto('./html/dark-brand/brand-before-theme.html');
  await check_theme_overrides(page);
});

// project tests

test('Project specifies dark and light brands', async ({ page }) => {
  await page.goto('./html/dark-brand/project-light-dark/simple.html');
  await check_red_blue(page);
});

test('Project brand before user themes', async ({ page }) => {
  // theme will override brand
  await page.goto('./html/dark-brand/project-light-dark/brand-under-theme.html');
  await check_theme_overrides(page);
});

test('Brand false remove project brand', async ({ page }) => {
  // theme will override brand
  await page.goto('./html/dark-brand/project-light-dark/brand-false.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass('fullcontent quarto-light');
  await expect(locatr).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  // no toggle
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(0);
});