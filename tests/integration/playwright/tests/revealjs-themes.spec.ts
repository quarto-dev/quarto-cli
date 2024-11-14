import { test, expect, Locator } from '@playwright/test';
import { asRGB, checkColor, checkFontSizeIdentical, checkFontSizeSimilar, getCSSProperty, RGBColor } from '../src/utils';

async function getRevealMainFontSize(page: any): Promise<number> {
  return await getCSSProperty(page.locator('body'), "--r-main-font-size", true) as number;
}

async function getRevealCodeBlockFontSize(page: any): Promise<number> {
  return await getCSSProperty(page.locator('body'), "--r-block-code-font-size", true) as number;
}

async function getRevealCodeInlineFontSize(page: any): Promise<number> {
  return await getCSSProperty(page.locator('body'), "--r-inline-code-font-size", true) as number;
}


test('Code font size in callouts and smaller slide is scaled down', async ({ page }) => {
  await page.goto('./revealjs/code-font-size.html');
  // Get smaller slide scale factor
  const calloutsFontSize = await getCSSProperty(page.locator('#callouts div.callout'), "font-size", true) as number;
  const mainFontSize = await getRevealMainFontSize(page);
  const scaleFactor = calloutsFontSize / mainFontSize;
  expect(scaleFactor).toBeLessThan(1);
  // Get non smaller size
  const codeBlockFontSizeDefault = await getCSSProperty(page.locator('#highlighted-cell pre'), "font-size", true) as number;
  const codeInlineFontSizeDefault = await getCSSProperty(page.locator('#no-callout-inline').getByText('testthat::test_that()'), "font-size", true) as number;
  // Font size in callout for inline code should be scaled smaller than default inline code
  expect(await getCSSProperty(page.locator('#callouts').getByText('testthat::test_that()'), "font-size", true)).toBeCloseTo(codeInlineFontSizeDefault * scaleFactor);
  // Font size for code block in callout should be scaled smaller that default code block
  expect(await getCSSProperty(page.locator('#callouts .callout pre code'), 'font-size', true)).toBeCloseTo(codeBlockFontSizeDefault * scaleFactor);
  // Font size in callout for inline code should be samely size as text than by default
  const codeInlineFontSize = await getRevealCodeInlineFontSize(page);
  await checkFontSizeSimilar( 
    page.locator('#callouts').getByText('testthat::test_that()'),
    page.locator('#callouts').getByText('Every test is a call to'),
    codeInlineFontSize
  );
});

test('Code font size in smaller slide is scaled down', async ({ page }) => {
  await page.goto('./revealjs/code-font-size.html#/smaller-slide');
  // Get smaller slide scale factor
  const smallerFontSize = await getCSSProperty(page.locator("#smaller-slide").getByText('And block code:', { exact: true }), "font-size", true) as number;
  const mainFontSize = await getRevealMainFontSize(page);
  const scaleFactor = smallerFontSize / mainFontSize;
  expect(scaleFactor).toBeLessThan(1);
  // Get non smaller size
  const codeBlockFontSizeDefault = await getCSSProperty(page.locator('#highlighted-cell pre'), "font-size", true) as number;
  const codeInlineFontSizeDefault = await getCSSProperty(page.locator('#no-callout-inline').getByText('testthat::test_that()'), "font-size", true) as number;
  // Font size in callout for inline code should be scaled smaller than default inline code
  expect(await getCSSProperty(page.locator('#smaller-slide p').filter({ hasText: 'Some inline code' }).getByRole('code'), "font-size", true)).toBeCloseTo(codeInlineFontSizeDefault * scaleFactor);
  // Font size for code block in callout should be scaled smaller that default code block
  expect(await getCSSProperty(page.locator('#smaller-slide pre').getByRole('code'), 'font-size', true)).toBeCloseTo(codeBlockFontSizeDefault * scaleFactor);
  // Font size in callout for inline code should be samely size as text than by default
  const codeInlineFontSize = await getRevealCodeInlineFontSize(page);
  await checkFontSizeSimilar( 
    page.locator('#smaller-slide2').getByText('+ 1'),
    page.locator('#smaller-slide2').getByText('Some inline code'),
    codeInlineFontSize
  );
});

test('Callouts can be customized using SCSS variables', async ({ page }) => {
  await page.goto('./revealjs/callouts/custom-colors.html');
  async function checkCustom(loc: Locator, width: string, color: RGBColor) {
    await expect(loc).toHaveCSS('border-left-width', width);
    await checkColor(loc, 'border-left-color', color);
  }
  await checkCustom(page.locator('div.callout-note'), '10px', asRGB(128, 0, 128));
  await checkCustom(page.locator('div.callout-tip'), '10px', asRGB(255, 255, 0));
  await checkCustom(page.locator('div.callout-warning'), '10px', asRGB(173, 216, 230));
  await checkCustom(page.locator('div.callout-important'), '10px', asRGB(128, 128, 128));
  await checkCustom(page.locator('div.callout-caution'), '10px', asRGB(0, 128, 0));
});