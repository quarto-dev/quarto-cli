import { test, expect } from '@playwright/test';

const expectedColors = {
  'quarto-light': {
    'background-color': 'rgb(238, 255, 238)',
    'color': 'rgb(13, 110, 253)'
  },
  'quarto-dark': {
    'background-color': 'rgb(68, 34, 17)',
    'color': 'rgb(204, 51, 170)'
  }
}
const otherClass = s => s === 'quarto-light' ? 'quarto-dark' : s === 'quarto-dark' ? 'quarto-light': undefined;
async function check_link_colors(page, class_) {
  const locatr = await page.locator('body').first();
  await expect(locatr).toHaveClass(`fullcontent ${class_}`);
  const linkLocatr = await page.locator('a[href*="example.com"]');
  await expect(linkLocatr).toHaveCSS('background-color', expectedColors[class_]['background-color']);
  await expect(linkLocatr).toHaveCSS('color', expectedColors[class_].color);

  await page.locator("a.quarto-color-scheme-toggle").click();
  const otherClass_ = otherClass(class_);
  console.assert(otherClass_ && typeof otherClass_ === 'string');
  await expect(linkLocatr).toHaveCSS('background-color', expectedColors[otherClass_!]['background-color']);
  await expect(linkLocatr).toHaveCSS('color', expectedColors[otherClass_!].color);
}

test('Light brand in file', async ({ page }) => {
  await page.goto('./html/unified-brand/light-brand-only-file.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(0);
});

test('Light brand inline', async ({ page }) => {
  await page.goto('./html/unified-brand/light-brand-only.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(0);
});

test('Light brand with unified entries only light', async ({ page }) => {
  await page.goto('./html/unified-brand/unified-light-only.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(0);
});

test('Dark brand in file', async ({ page }) => {
  await page.goto('./html/unified-brand/dark-brand-only-file.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(1);
});

test('Dark brand inline', async ({ page }) => {
  await page.goto('./html/unified-brand/dark-brand-only.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(1);
});

test('Light and dark brand files', async ({ page }) => {
  await page.goto('./html/unified-brand/light-dark-brand-file.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(1);

  await check_link_colors(page, 'quarto-light');
});

test('Light and dark brands inline', async ({ page }) => {
  await page.goto('./html/unified-brand/light-dark-brand.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(1);

  await check_link_colors(page, 'quarto-light');
});

test('Dark and light brand files', async ({ page }) => {
  await page.goto('./html/unified-brand/dark-light-brand-file.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(1);

  await check_link_colors(page, 'quarto-dark');
});

test('Dark and light brands inline', async ({ page }) => {
  await page.goto('./html/unified-brand/dark-light-brand.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(1);

  await check_link_colors(page, 'quarto-dark');
});


test('Unified light and dark brand file', async ({ page }) => {
  await page.goto('./html/unified-brand/unified-colors-file.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(1);

  await check_link_colors(page, 'quarto-light');
});

test('Unified light and dark brand inline', async ({ page }) => {
  await page.goto('./html/unified-brand/unified-colors.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(1);

  await check_link_colors(page, 'quarto-light');
});

test('Unified light and dark typography inline', async ({ page }) => {
  await page.goto('./html/unified-brand/unified-typography.html');
  expect(await page.locator('a.quarto-color-scheme-toggle').count()).toEqual(1);

  await check_link_colors(page, 'quarto-light');
});
