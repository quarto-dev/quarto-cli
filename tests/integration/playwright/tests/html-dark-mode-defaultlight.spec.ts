import { test, expect } from '@playwright/test';

async function check_backgrounds(page, class_, primary, secondary) {
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass(`fullcontent ${class_}`);
  await expect(locatr).toHaveCSS('background-color', primary);
  await page.locator("a.quarto-color-scheme-toggle").click();
  const locatr2 = await page.locator('body').first();
  await expect(locatr2).toHaveCSS('background-color', secondary);
}


async function check_toggle(page, alternate) {
  const locatr = await page.locator("a.quarto-color-scheme-toggle");
  await expect(locatr).toHaveClass(`top-right quarto-color-scheme-toggle${alternate?" alternate":""}`)
}

test.use({
  colorScheme: 'light'
});

const blue = 'rgb(204, 221, 255)';
const red = 'rgb(66, 7, 11)';

// brands used in these documents have background colors

test('Dark and light brand after user themes', async ({ page }) => {
  // brand overrides theme background color
  await page.goto('./html/dark-brand/brand-after-theme.html');
  await check_toggle(page, true);
  await check_backgrounds(page, 'quarto-dark', red, blue);
  await check_toggle(page, false);
});

// project tests

test('Project specifies light and dark brands', async ({ page }) => {
  await page.goto('./html/dark-brand/project-light/simple.html');
  await check_toggle(page, false);
  await check_backgrounds(page, 'quarto-light', blue, red);
  await check_toggle(page, true);
});


test('Project specifies dark and light brands', async ({ page }) => {
  await page.goto('./html/dark-brand/project-dark/simple.html');
  await check_toggle(page, true);
  await check_backgrounds(page, 'quarto-dark', red, blue);
  await check_toggle(page, false);
});


test('Project specifies light and dark brands and respect-user-color-scheme', async ({ page }) => {
  await page.goto('./html/dark-brand/project-light/simple-respect-color-scheme.html');
  await check_toggle(page, false);
  await check_backgrounds(page, 'quarto-light', blue, red);
  await check_toggle(page, true);
});

test('Project specifies dark and light brands and respect-user-color-scheme', async ({ page }) => {
  await page.goto('./html/dark-brand/project-dark/simple-respect-color-scheme.html');
  await check_toggle(page, false);
  await check_backgrounds(page, 'quarto-light', blue, red);
  await check_toggle(page, true);
});


test('Project specifies light and dark brands, dynamic respect-user-color-scheme', async ({ page }) => {
  await page.goto('./html/dark-brand/project-light/simple-respect-color-scheme.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass(`fullcontent quarto-light`);
  await expect(locatr).toHaveCSS('background-color', blue);
  await check_toggle(page, false);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(locatr).toHaveClass(`fullcontent quarto-dark`);
  await expect(locatr).toHaveCSS('background-color', red);
  await check_toggle(page, true);
});

test('Project specifies dark and light brands, dynamic respect-user-color-scheme', async ({ page }) => {
  await page.goto('./html/dark-brand/project-dark/simple-respect-color-scheme.html');
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass(`fullcontent quarto-light`);
  await expect(locatr).toHaveCSS('background-color', blue);
  await check_toggle(page, false);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(locatr).toHaveClass(`fullcontent quarto-dark`);
  await expect(locatr).toHaveCSS('background-color', red);
  await check_toggle(page, true);
});
