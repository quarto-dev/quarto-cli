import { test, expect } from '@playwright/test';
import { getCSSProperty } from '../src/utils';

test('Dark and light theme respect user themes', async ({ page }) => {
  // This document use a custom theme file that change the background color of the title banner
  // Same user defined color should be used in both dark and light theme
  await page.goto('./html/dark-light-theme-custom/');
  const locatr = await page.locator('div').filter({ hasText: 'Quarto Playground' }).first()
  await expect(locatr).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  await page.locator("a.quarto-color-scheme-toggle").click();
  const locatr2 = await page.locator('div').filter({ hasText: 'Quarto Playground' }).first()
  await expect(locatr2).toHaveCSS('background-color', 'rgb(255, 0, 0)');
});

test('Dark theming toggle change to dark background ', async ({ page }) => {
  await page.goto('./html/dark-light-theme-custom/');
  const locatr = page.getByText('Quarto Playground This is a');
  await expect(locatr).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  // switching to dark theme using toggle
  await page.locator("a.quarto-color-scheme-toggle").click();
  const locatr2 = await page.locator('div').filter({ hasText: 'Quarto Playground' }).first()
  await expect(locatr2).toHaveCSS('background-color', 'rgb(255, 0, 0)');
});

test('Code block font size did not change and still equals to pre size', async ({ page }) => {
  await page.goto('./html/code-font-size.html');
  const code = page.getByRole('code')
  const pre = page.locator('pre')
  const preFontSize = await getCSSProperty(pre, 'font-size', false) as string;
  await expect(code).toHaveCSS('font-size', preFontSize);
});

test('Mainfont can be set to multiple mainfont families', async ({ page }) => {
  await page.goto('./html/mainfont/mainfont-1.html');
  expect(await getCSSProperty(page.locator('body'), '--bs-body-font-family', false)).toEqual('Creepster, "Cascadia Code", Inter');
  await page.goto('./html/mainfont/mainfont-2.html');
  expect(await getCSSProperty(page.locator('body'), '--bs-body-font-family', false)).toEqual('Creepster, "Cascadia Code", Inter');
  await page.goto('./html/mainfont/mainfont-3.html');
  expect(await getCSSProperty(page.locator('body'), '--bs-body-font-family', false)).toEqual('Creepster, "Cascadia Code", Inter');
})