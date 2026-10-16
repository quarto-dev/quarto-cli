import { test, expect } from '@playwright/test';

test.describe('revealjs image announcements (#15033)', () => {
  const cases = [
    { slide: 'mermaid', expected: 'Mermaid Start Middle End' },
    { slide: 'image', expected: 'Image A grey rectangle A caption' },
    { slide: 'rating', expected: 'Rating Rated 4 out of 5 stars' },
    { slide: 'labelled-chart', expected: 'Labelled chart Sales grew every year' },
    { slide: 'titled-chart', expected: 'Titled chart Sales increased' },
    { slide: 'styled-diagram', expected: 'Styled diagram Start End' },
    { slide: 'decorative-images', expected: 'Decorative images' },
    { slide: 'svg-titles', expected: 'SVG titles Graph Start to End Start End' },
    { slide: 'label-fallback', expected: 'Label fallback Fallback label Empty-reference fallback Quarto logo' },
  ];

  for (const { slide, expected } of cases) {
    test(slide, async ({ page, browserName }) => {
      await page.goto('./revealjs/image-announcements.html');
      await expect(page.locator('.reveal.ready')).toBeAttached();
      // Mermaid is rendered asynchronously. Enter its slide only after the SVG
      // exists, so the test measures the diagram rather than its loading state.
      await expect(page.locator('#mermaid svg')).toBeAttached();
      await page.evaluate((id) => {
        const reveal = (window as any).Reveal;
        const indices = reveal.getIndices(document.getElementById(id));
        reveal.slide(indices.h, indices.v);
      }, slide);
      await expect(page.locator('section.slide.present')).toHaveId(slide);
      // WebKit hides SVG title elements by default; keep the existing
      // computed-display filtering rather than changing that browser's output.
      const expectedText = browserName === 'webkit' && slide === 'svg-titles'
        ? 'SVG titles Start End'
        : expected;
      await expect(page.locator('.aria-status')).toHaveText(expectedText);
    });
  }
});

// Exercise both backports together: image names must follow fragment state,
// including when a nested fade-out fragment becomes visible again on rewind.
test('image names respect nested fragment visibility', async ({ page }) => {
  await page.goto('./revealjs/image-announcements.html#/fragment-images');
  await expect(page.locator('.reveal.ready')).toBeAttached();
  await expect(page.locator('section.slide.present')).toHaveId('fragment-images');
  const status = page.locator('.aria-status');
  await expect(status).toHaveText('Fragment images');

  await page.keyboard.press('Space');
  await expect(status).toHaveText('Parent image Initially visible rating');
  await page.keyboard.press('Space');
  await expect(status).toHaveText('Nested logo');
  await page.keyboard.press('Space');
  await expect(status).toHaveText('Initially visible rating');

  await page.keyboard.press('ArrowLeft');
  await expect(status).toHaveText('Nested logo');
  await page.keyboard.press('ArrowLeft');
  await expect(status).toHaveText('Parent image Initially visible rating');
});
