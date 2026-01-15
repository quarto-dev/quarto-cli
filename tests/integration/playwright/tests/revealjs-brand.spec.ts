import { test, expect, Locator } from '@playwright/test';
import { asRGB, checkBackgroundColorProperty, checkColor, checkColorIdentical, checkFontSizeSimilar, getCSSProperty, hexToRgb, RGBColor } from '../src/utils';

async function getRevealBrandColorVar(page: any, suffix: string): Promise<string> {
  return await getCSSProperty(page.locator('body'), `--quarto-scss-export-brand-${suffix}`, false) as string;
}

// specific function to check the branded background color for revealjs/brand/ tests
// They use `color.palette.dark-teal` as brand color
async function checkBrandedBackgroundColor(page: any) {
  const brandColor = await getRevealBrandColorVar(page, 'dark-teal');
  await checkBackgroundColorProperty(page.locator('body'), hexToRgb(brandColor));
}

// Define test cases with their URLs to reduce duplication
const brandTestCases = [
  { 
    name: 'project file using _brand.yml configuration', 
    url: './revealjs/brand/project/index.html',
    description: 'Tests a file within a project that uses _brand.yml for branding'
  },
  { 
    name: 'nested file within project inheriting project branding', 
    url: './revealjs/brand/project/subdir/index.html',
    description: 'Tests a file in a subdirectory that inherits project branding from _brand.yml' 
  },
  { 
    name: 'standalone file with inline brand configuration', 
    url: './revealjs/brand/single.html',
    description: 'Tests a standalone file with inline brand configuration in YAML frontmatter'
  },
  { 
    name: 'file in subdirectory with inline brand configuration', 
    url: './revealjs/brand/subdir/index.html',
    description: 'Tests a file in subdirectory with its own inline brand configuration' 
  }
];

// Run all test cases with the same pattern
for (const testCase of brandTestCases) {
  test(testCase.name, async ({ page }, testInfo) => {
    // Add the description as an annotation to the test report
    testInfo.annotations.push({
      type: 'description',
      description: testCase.description
    });

    await page.goto(testCase.url);
    await checkBrandedBackgroundColor(page);
  });
}