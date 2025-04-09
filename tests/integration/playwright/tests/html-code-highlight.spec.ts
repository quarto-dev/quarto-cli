import { test } from '@playwright/test';
import { hexToRgb, checkColor, checkColorIdentical, getCSSProperty, useDarkLightMode } from '../src/utils';

// List of all highlight styles
const highlightStyles = [
  'a11y',
  'arrow',
  'atom-one',
  'ayu',
  'ayu-mirage',
  'breeze',
  'breezedark',
  'dracula',
  'espresso',
  'github',
  'gruvbox',
  'haddock',
  'kate',
  'monochrome',
  'monokai',
  'nord',
  'oblivion',
  'printing',
  'pygments',
  'radical',
  'solarized',
  'tango',
  'vim-dark',
  'zenburn'
];

const colorSchemes: Array<'light' | 'dark'> = ['light', 'dark'];

for (const style of highlightStyles) {
  test.describe(`Code highlighting for ${style} theme`, () => {
    
    for (const colorScheme of colorSchemes) {
      test.describe(`in ${colorScheme} mode`, () => {
        test.use({ ...useDarkLightMode(colorScheme) });
        
        test.beforeEach(async ({ page }) => {
          await page.goto(`./html/code-highlight/code-highlight-${style}.html`);
        });

        test(`[${style}] Code highlighting for Inline and CodeBlock are the same`, async ({ page }) => {
                   
          // Get specific syntax elements to test for color
          const codeBlock = page.locator('div pre.sourceCode code.julia span').getByText('function');
          const codeInline = page.locator('p code.sourceCode.julia span').getByText('function');
          
          await checkColorIdentical(codeBlock, codeInline, 'color');
        });

        test(`[${style}] Code highlighting is done with the expected color`, async ({ page }) => {
          
          // Get specific syntax elements to test for color
          const codeBlock = page.locator('div pre.sourceCode code.julia span').getByText('function');
          
          // get the class on the span
          const classNameBlock = await codeBlock.getAttribute('class');
          const keywordColor = await getCSSProperty(page.locator('body'), `--quarto-hl-${classNameBlock}-color`, false) as string;

          await checkColor(codeBlock, 'color', hexToRgb(keywordColor));
        });
      });
    }
  });
};
