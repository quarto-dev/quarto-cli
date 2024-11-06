import { test, expect, Locator } from '@playwright/test';
import { asRGB, checkColor, checkFontSizeIdentical, getCSSProperty } from '../src/utils';

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
  await page.locator('body').press('ArrowRight');
  // Get smaller slide scale factor
  const calloutsFontSize = await getCSSProperty(page.locator('#callouts div.callout'), "font-size", true) as number;
  const mainFontSize = await getRevealMainFontSize(page);
  const scaleFactor = calloutsFontSize / mainFontSize;
  expect(scaleFactor).toBeLessThan(1);
  // Font size in callout for inline code should be scaled smaller than default inline code
  const codeInlineFontSize = await getRevealCodeInlineFontSize(page);
  const computedInlineFontSize = scaleFactor * codeInlineFontSize;
  expect(await getCSSProperty(page.locator('#callouts').getByText('testthat::test_that()'), 'font-size', true)).toBeCloseTo(computedInlineFontSize);
  // Font size in callout for inline code should be same size as text by default
  await checkFontSizeIdentical(
    page.locator('#callouts').getByText('Every test is a call to'), 
    page.locator('#callouts').getByText('testthat::test_that()')
  );
  // Font size for code block in callout should be scaled smaller that default code block
  const codeBlockFontSize = await getRevealCodeBlockFontSize(page)
  const computedBlockFontSize = scaleFactor * codeBlockFontSize;
  expect(await getCSSProperty(page.locator('#callouts .callout pre code'), 'font-size', true)).toBeCloseTo(computedBlockFontSize);
});

test('Code font size in smaller slide is scaled down', async ({ page }) => {
  await page.goto('./revealjs/code-font-size.html#/smaller-slide');
  // Get smaller slide scale factor
  const smallerFontSize = await getCSSProperty(page.locator("#smaller-slide").getByText('And block code:', { exact: true }), "font-size", true) as number;
  const mainFontSize = await getRevealMainFontSize(page);
  const scaleFactor = smallerFontSize / mainFontSize;
  expect(scaleFactor).toBeLessThan(1);
  // Code Font size in smaller slide for inline code should be scaled smaller than default inline code
  const codeInlineFontSize = await getRevealCodeInlineFontSize(page);
  const computedInlineFontSize = scaleFactor * codeInlineFontSize;
  expect(
    await getCSSProperty(
      page.locator('#smaller-slide p').filter({ hasText: 'Some inline code' }).getByRole('code'),
       'font-size', true
    )
  ).toBeCloseTo(computedInlineFontSize);
  // Font size for code block in callout should be scaled smaller that default code block
  const codeBlockFontSize = await getRevealCodeBlockFontSize(page)
  const computedBlockFontSize = scaleFactor * codeBlockFontSize;
  expect(await getCSSProperty(page.locator('#smaller-slide pre').getByRole('code'), 'font-size', true)).toBeCloseTo(computedBlockFontSize);
});

test('Code font size in callouts in smaller slide is scaled down twice', async ({ page }) => {
  await page.goto('./revealjs/code-font-size.html#/smaller-slide2');
  // Get smaller slide scale factor
  const smallerFontSize = await getCSSProperty(page.locator('#smaller-slide2').getByText('And block code:', { exact: true }), "font-size", true) as number;
  const mainFontSize = await getRevealMainFontSize(page);
  const scaleFactor = smallerFontSize / mainFontSize;
  expect(scaleFactor).toBeLessThan(1);
  // Font size in callout for inline code should be scaled smaller than default inline code
  const codeInlineFontSize = await getRevealCodeInlineFontSize(page);
  const computedInlineFontSize = scaleFactor * codeInlineFontSize;
  expect(await getCSSProperty(page.locator('#smaller-slide2').getByText('1 + 1'), 'font-size', true)).toBeCloseTo(computedInlineFontSize);
  // Font size in callout for inline code should be same size as text by default
  await checkFontSizeIdentical(
    page.locator('#smaller-slide2').getByText('Some inline code'), 
    page.locator('#smaller-slide2').getByText('1 + 1')
  );
  // Font size for code block in callout should be scaled smaller that default code block
  const codeBlockFontSize = await getRevealCodeBlockFontSize(page)
  const computedBlockFontSize = scaleFactor * codeBlockFontSize;
  expect(await getCSSProperty(page.locator('#smaller-slide2 .callout pre code'), 'font-size', true)).toBeCloseTo(computedBlockFontSize);
});

test('Code font size is correctly set', async ({ page }) => {
  await page.goto('./revealjs/code-font-size.html');
  await page.locator('body').press('ArrowRight');
  await page.locator('body').press('ArrowRight');
  const codeInlineFontSize = await getRevealCodeInlineFontSize(page);
  expect(
    await getCSSProperty(page.locator('#no-callout-inline').getByText('testthat::test_that()'), 'font-size', true)
  ).toBeCloseTo(codeInlineFontSize);
  expect(
    await getCSSProperty(page.getByText('1+1', { exact: true }), 'font-size', true)
  ).toBeCloseTo(codeInlineFontSize);
  await page.locator('body').press('ArrowRight');
  const codeBlockFontSize = await getRevealCodeBlockFontSize(page);
  expect(
    await getCSSProperty(page.locator("#highlited-cell div.sourceCode pre code"), 'font-size', true)
  ).toBeCloseTo(codeBlockFontSize);
  await page.locator('body').press('ArrowRight');
  expect(
    await getCSSProperty(page.locator("#non-highligted pre code"), 'font-size', true)
  ).toBeCloseTo(codeBlockFontSize);
});

test('Callouts colors can be customized', async ({ page }) => {
  await page.goto('./revealjs/callouts/custom-colors.html');
  await checkColor(page.locator('div.callout-note'), 'border-left-color', asRGB(128, 0, 128));
  await checkColor(page.locator('div.callout-tip'), 'border-left-color', asRGB(255, 255, 0));
  await checkColor(page.locator('div.callout-warning'), 'border-left-color', asRGB(173, 216, 230));
  await checkColor(page.locator('div.callout-important'), 'border-left-color', asRGB(128, 128, 128));
  await checkColor(page.locator('div.callout-caution'), 'border-left-color', asRGB(0, 128, 0));
});