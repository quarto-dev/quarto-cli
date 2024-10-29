import { test, expect, Locator } from '@playwright/test';

async function getCSSProperty(loc: Locator, variable: string) {
  return await loc.evaluate((element) =>
    window.getComputedStyle(element).getPropertyValue(variable)
  );
}

async function checkFontSizeIdentical(loc1: Locator, loc2: Locator) {
  const loc1FontSize = await getCSSProperty(loc1, 'font-size');
  await expect(loc2).toHaveCSS('font-size', loc1FontSize);
}

test('Code block font size did not change and still equals to pre size', async ({ page }) => {
  await page.goto('./revealjs/code-font-size.html');
  await page.locator('body').press('ArrowRight');
  // Font size in callout for inline code should be same size as text by default
  await checkFontSizeIdentical(
    page.locator('#callouts').getByText('Every test is a call to'), 
    page.locator('#callouts').getByText('testthat::test_that()')
  );
  // Font size for code block in callout should be scaled smaller that default code block
  const calloutsFontSize = parseFloat(await getCSSProperty(page.locator('#callouts'), "font-size"));
  const bodyFontSize = parseFloat(await getCSSProperty(page.locator('body'), "font-size"));
  const scaleFactor = calloutsFontSize / bodyFontSize;
  const codeBlockFontSize = await getCSSProperty(page.locator('body'), "--r-block-code-font-size");
  const computedCodeFont = `${scaleFactor * parseFloat(codeBlockFontSize)}px`;
  await expect(page.locator('#callout pre code')).toHaveCSS('font-size', computedCodeFont);
});