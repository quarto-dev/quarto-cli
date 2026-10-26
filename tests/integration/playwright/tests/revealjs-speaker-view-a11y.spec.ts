import { expect, Page, test } from '@playwright/test';

const openSpeaker = async (page: Page) => {
  await page.goto('./revealjs/speaker-view-a11y.html#/first-slide');
  await expect(page.locator('.reveal.ready')).toBeAttached();
  const popup = page.waitForEvent('popup');
  await page.keyboard.press('s');
  const speaker = await popup;
  await expect(speaker.locator('.speaker-controls-notes .value')).toHaveText('First slide notes.');
  return speaker;
};

const panels = ['Current slide', 'Upcoming slide', 'Time', 'Speaker notes'];

test.describe('revealjs speaker view accessibility (#15159, #15160)', () => {
  test('Layout has a stable accessible name, a selected value, and visible focus', async ({ page }) => {
    const speaker = await openSpeaker(page);
    const select = speaker.getByRole('combobox', { name: 'Layout', exact: true });
    await expect(select).toHaveAccessibleName('Layout');
    await expect(select).toHaveValue('default');
    const indices = await page.evaluate(() => (window as any).Reveal.getIndices());
    await select.focus();
    await expect(speaker.locator('#speaker-layout')).toHaveCSS('outline-style', 'solid');
    await select.press('ArrowDown');
    await expect(select).toHaveValue('wide');
    await expect(speaker.locator('.speaker-layout-value')).toHaveText(': Wide');
    await expect(select).toHaveAccessibleName('Layout');
    // Speaker-to-deck state forwarding is debounced by 500 ms. Check after
    // that window so a select arrow key cannot silently advance the deck. The
    // first slide has a fragment, so compare the fragment index too.
    await page.waitForTimeout(750);
    expect(await page.evaluate(() => (window as any).Reveal.getIndices())).toEqual(indices);
  });

  for (const layout of ['default', 'wide', 'tall', 'notes-only']) {
    test(`named regions follow the ${layout} layout`, async ({ page }) => {
      const speaker = await openSpeaker(page);
      await speaker.getByRole('combobox', { name: 'Layout', exact: true }).selectOption(layout);
      await expect(speaker.locator('body')).toHaveAttribute('data-speaker-layout', layout);
      for (const name of panels) {
        const visible = layout !== 'notes-only' || name === 'Time' || name === 'Speaker notes';
        await expect(speaker.getByRole('region', { name, exact: true })).toHaveCount(visible ? 1 : 0);
      }
    });
  }

  test('preview frames are named and controls retain buttons without a landmark', async ({ page }) => {
    const speaker = await openSpeaker(page);
    await expect(speaker.locator('#current-slide iframe')).toHaveAttribute('title', 'Current slide preview');
    await expect(speaker.locator('#upcoming-slide iframe')).toHaveAttribute('title', 'Upcoming slide preview');
    const preview = speaker.frameLocator('#current-slide iframe');
    for (const scope of [page, preview]) {
      await expect(scope.locator('.controls')).toHaveJSProperty('tagName', 'DIV');
      await expect(scope.locator('.controls button')).toHaveCount(4);
      await expect(scope.getByRole('complementary')).toHaveCount(0);
      await expect(scope.getByRole('button', { name: 'next slide', exact: true })).toBeEnabled();
    }
    // The controls still work in the main deck and the speaker preview.
    await page.getByRole('button', { name: 'next slide', exact: true }).press('Enter');
    // The first activation reveals the fragment; the second moves to slide 2.
    await page.getByRole('button', { name: 'next slide', exact: true }).press('Enter');
    await expect(page.locator('section.present')).toHaveId('slide-without-notes');
    await expect(preview.locator('section.present')).toHaveId('slide-without-notes');
    await expect(speaker.locator('.speaker-controls-notes')).not.toBeVisible();
    await preview.getByRole('button', { name: 'previous slide', exact: true }).click();
    await expect(page.locator('section.present')).toHaveId('first-slide');
  });

  test('notes stay available across fragments, disappear when empty, and return', async ({ page }) => {
    const speaker = await openSpeaker(page);
    await page.evaluate(() => (window as any).Reveal.nextFragment());
    await expect(speaker.getByRole('region', { name: 'Speaker notes', exact: true })).toContainText('First slide notes.');
    await page.evaluate(() => (window as any).Reveal.slide(1));
    await expect(speaker.getByRole('region', { name: 'Speaker notes', exact: true })).toHaveCount(0);
    await page.evaluate(() => (window as any).Reveal.slide(2));
    await expect(speaker.getByRole('region', { name: 'Speaker notes', exact: true })).toContainText('Last slide notes.');
  });
});
