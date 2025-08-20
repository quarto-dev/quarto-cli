import { test, expect } from '@playwright/test';
import { asRGB, checkBorderProperties, getCSSProperty } from '../src/utils';

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

test('border color from default theme does not change (like disappearing)', async ({ page }) => {
  await page.goto('./html/default-border-color.html');

  // callout border
  const calloutNote = page.locator('div.callout-note');
  const calloutBorderColor = asRGB(0, 0, 0, 0.1);
  await checkBorderProperties(calloutNote, 'bottom', calloutBorderColor, '1px');
  await checkBorderProperties(calloutNote, 'right', calloutBorderColor, '1px');
  await checkBorderProperties(calloutNote, 'top', calloutBorderColor, '1px');
  
  // tabset border
  const tabContent = page.locator('div.tab-content');
  const tabBorderColor = asRGB(225, 225, 226);
  await checkBorderProperties(tabContent, 'bottom', tabBorderColor, '1px');
  await checkBorderProperties(tabContent, 'right', tabBorderColor, '1px');
  await checkBorderProperties(tabContent, 'left', tabBorderColor, '1px');

  const activeNavLink = page.locator('li.nav-item > a.nav-link.active');
  await checkBorderProperties(activeNavLink, 'top', tabBorderColor, '1px');
  await checkBorderProperties(activeNavLink, 'right', tabBorderColor, '1px');
  await checkBorderProperties(activeNavLink, 'left', tabBorderColor, '1px');
  await checkBorderProperties(activeNavLink, 'bottom', asRGB(255, 255, 255), '1px');

  // table borders
  const table = page.locator('table');
  const headerColor = asRGB(154, 157, 160);
  const borderColor = asRGB(214, 216, 217);
  // table defines top and bottom borders
  await checkBorderProperties(table, 'top', borderColor, '1px');
  await checkBorderProperties(table, 'bottom', borderColor, '1px');
    
  // table header row have a specific bottom row, other are colorized but hidden (width 0)
  const thead = table.locator('> thead');
  await checkBorderProperties(thead, 'bottom', headerColor, '1px');
  await checkBorderProperties(thead, 'top', borderColor, '0px');
  await checkBorderProperties(thead, 'left', asRGB(0, 0, 0, 0.1), '0px');
  await checkBorderProperties(thead, 'right', asRGB(0, 0, 0, 0.1), '0px');

});