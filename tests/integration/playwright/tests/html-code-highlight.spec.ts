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
  'zenburn',
  // specific alias for light-dark test
  'light-dark'
];

const colorSchemes: Array<'light' | 'dark'> = ['light', 'dark'];


// This is a special case for light-dark theme
// We test pygments and kate themes so we retrieve the colors from the themeConfig
// in src\resources\pandoc\highlight-styles\*.theme
const themeConfigLightDark = {
  light: {
    name: 'pygments',
    colors: {
      kw: '#007020',
      fu: '#06287e'
    }
  },
  dark: {
    name: 'kate',
    colors: {
      kw: '#1f1c1b',
      fu: '#644a9b'
    }
  }
};

for (const style of highlightStyles) {
  test.describe(`Code highlighting for '${style}' theme`, () => {
    
    for (const colorScheme of colorSchemes) {
      test.describe(`in ${colorScheme} mode`, () => {
        test.use({ ...useDarkLightMode(colorScheme) });
        
        test.beforeEach(async ({ page }) => {
          await page.goto(`./html/code-highlight/_docs/code-highlight-${style}.html`);
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
        if (style === 'light-dark') {
          const themeUsed = themeConfigLightDark[colorScheme].name;
          const colorUsed = themeConfigLightDark[colorScheme].colors;
          test(`[${style}] Code highlighting for Inline and CodeBlock are using '${themeUsed}' theme`, async ({ page }) => {
            const funName = page.locator('div pre.sourceCode code.julia span').getByText('function');
            const divideFloats = page.locator('div pre.sourceCode code.julia span').getByText('divide_floats');
            // Get specific syntax elements to test for color
            // get the class on the span
            const classNameFun = await funName.getAttribute('class') as string;
            const classNameDivide = await divideFloats.getAttribute('class') as string;
            // error if not found
            if (!classNameFun || !classNameDivide) {
              test.fail(true, 'Class name not found for code highlighting elements');
            }
            const funColor = colorUsed[classNameFun];
            const divideColor = colorUsed[classNameDivide];
            await checkColor(funName, 'color', hexToRgb(funColor));
            await checkColor(divideFloats, 'color', hexToRgb(divideColor));
            // check also root variable
            await checkColor(page.locator('body'), `--quarto-hl-${classNameFun}-color`, funColor);
            await checkColor(page.locator('body'), `--quarto-hl-${classNameDivide}-color`, divideColor);
          });
        }
        
      });
    }
  });
};
