import { test, expect } from '@playwright/test';

for (const format of ['html', 'revealjs']) {
  test.describe('diagram fig-alt (' + format + ')', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('./diagram-alt/' + format + '.html');
      // Mermaid renders asynchronously, in document order.
      await expect(page.locator('pre.mermaid-js')).toHaveCount(0);
      await expect(page.locator('#fig-js svg')).toBeAttached();
      if (format === 'revealjs') {
        await expect(page.locator('.reveal.ready')).toBeAttached();
        await page.evaluate(() => {
          const reveal = (window as any).Reveal;
          const indices = reveal.getIndices(document.getElementById('diagrams'));
          reveal.slide(indices.h, indices.v);
        });
        await expect(page.locator('section.slide.present')).toHaveId('diagrams');
      }
    });

    test('names the JS-rendered SVG without changing its caption', async ({ page }) => {
      const svg = page.locator('#fig-js svg');
      await expect(svg).toHaveAttribute('role', 'img');
      await expect(svg).toHaveAccessibleName('A "quoted" label & <tag> with café and 한글');
      await expect(page.locator('#fig-js figcaption')).toContainText('Visible JS caption');
    });

    test('preserves native accessibility when fig-alt is absent', async ({ page }) => {
      const svg = page.locator('#fig-native svg');
      await expect(svg).toHaveAccessibleName('Native title');
      await expect(svg).toHaveAccessibleDescription('Native description');
    });

    test('explicit alt overrides the title but preserves the description', async ({ page }) => {
      const svg = page.locator('#fig-override svg');
      await expect(svg).toHaveAttribute('role', 'img');
      await expect(svg).toHaveAccessibleName('Explicit alternative');
      await expect(svg).toHaveAccessibleDescription('Longer native description');
    });

    test('names prerendered SVG and PNG images', async ({ page }) => {
      const svg = page.locator('#fig-svg svg');
      await expect(svg).toHaveAccessibleName('Static SVG alternative');
      await expect(svg).toHaveAccessibleDescription('Static description');
      await expect(page.locator('#fig-png img')).toHaveAttribute('alt', 'PNG alternative');
      await expect(page.locator('#fig-png figcaption')).toContainText('Visible PNG caption');
    });

    test('names DOT SVGs and uncaptioned diagrams', async ({ page }) => {
      await expect(page.locator('#fig-dot svg')).toHaveAccessibleName('DOT "quoted" & <tag> alternative');
      await expect(page.locator('svg[aria-label="Multiline alternative without a caption"]')).toHaveCount(1);
      await expect(page.locator('svg[aria-label="DOT without a caption"]')).toHaveCount(1);
    });

    test('treats an explicitly empty alt as decorative', async ({ page }) => {
      for (const id of ['fig-empty', 'fig-dot-empty']) {
        await expect(page.locator('#' + id + ' svg')).toHaveAttribute('aria-hidden', 'true');
      }
    });
  });
}
