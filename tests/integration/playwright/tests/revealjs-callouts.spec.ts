import { test, expect } from '@playwright/test';
import { expectCloseTo } from '../src/utils';

// Space below the last block of a callout, in CSS px, for callouts whose last
// block is a code block (wrapped in the code-copy scaffold) or a paragraph.
// Reveal scales the slide, so the measured gap is divided by Reveal.getScale()
// and the callout's own bottom border is subtracted.
// https://github.com/quarto-dev/quarto-cli/issues/15014
type ExpectedGap = '--r-block-margin' | '1rem' | 0;

interface CalloutCase {
  name: string;
  slide: string;
  callout: string;
  lastBlock: string;
  expectedGap: ExpectedGap;
}

const testCases: CalloutCase[] = [
  {
    name: 'default titled callout ending with code',
    slide: 'default-titled-ends-with-code',
    callout: 'default-titled-code',
    lastBlock: 'div.sourceCode',
    expectedGap: '--r-block-margin',
  },
  {
    name: 'simple untitled callout ending with code',
    slide: 'simple-untitled-ends-with-code',
    callout: 'simple-untitled-code',
    lastBlock: 'div.sourceCode',
    expectedGap: '1rem',
  },
  {
    name: 'simple titled callout ending with code',
    slide: 'simple-titled-ends-with-code',
    callout: 'simple-titled-code',
    lastBlock: 'div.sourceCode',
    expectedGap: '--r-block-margin',
  },
  {
    name: 'default titled callout ending with paragraph',
    slide: 'default-titled-ends-with-paragraph',
    callout: 'default-titled-paragraph',
    lastBlock: '.callout-content > p:last-child',
    expectedGap: 0,
  },
  {
    name: 'simple untitled callout ending with paragraph',
    slide: 'simple-untitled-ends-with-paragraph',
    callout: 'simple-untitled-paragraph',
    lastBlock: '.callout-content > p:last-child',
    expectedGap: '--r-block-margin',
  },
];

test.describe('Revealjs callout bottom spacing', () => {
  for (const { name, slide, callout, lastBlock, expectedGap } of testCases) {
    test(`${name} has the expected space below the last block`, async ({ page }) => {
      await page.goto(`./revealjs/callouts/callout-code-last.html#/${slide}`);
      // Quarto puts the id on a wrapper div and on div.callout; target the one with the border.
      const calloutBox = page.locator(`div.callout#${callout}`);
      await expect(calloutBox).toBeVisible();
      // Reveal adds .ready once layout and scaling are done.
      await expect(page.locator('.reveal.ready')).toBeAttached();

      const { gap, expected } = await calloutBox.evaluate((el, { lastBlock, expectedGap }) => {
        // Resolve a CSS length to px in the page.
        const resolve = (value: string) => {
          const probe = document.createElement('div');
          probe.style.cssText = `position:absolute;visibility:hidden;margin-bottom:${value}`;
          document.body.appendChild(probe);
          const px = parseFloat(getComputedStyle(probe).marginBottom);
          probe.remove();
          return px;
        };
        const block = el.querySelector(lastBlock) as HTMLElement;
        const scale = (window as any).Reveal.getScale();
        const borderBottom = parseFloat(getComputedStyle(el).borderBottomWidth);
        const rawGap = el.getBoundingClientRect().bottom - block.getBoundingClientRect().bottom;
        const expected = expectedGap === 0
          ? 0
          : resolve(expectedGap === '1rem' ? '1rem' : `var(${expectedGap})`);
        return { gap: rawGap / scale - borderBottom, expected };
      }, { lastBlock, expectedGap });

      expectCloseTo(gap, expected, 1);
    });
  }
});
