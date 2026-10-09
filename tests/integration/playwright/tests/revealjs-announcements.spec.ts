import { expect, Page, test } from '@playwright/test';

const normalizedAnnouncements = (page: Page) =>
  page.evaluate(() => (window as any).__revealAnnouncements as string[]);

async function installAnnouncementObserver(page: Page) {
  await page.addInitScript(() => {
    const announcements: string[] = [];
    (window as any).__revealAnnouncements = announcements;

    new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.target instanceof Element &&
          record.target.matches('.reveal .aria-status')
        ) {
          for (const node of record.addedNodes) {
            const text = node.textContent?.replace(/\s+/g, ' ').trim();
            if (text) announcements.push(text);
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

async function expectAnnouncements(page: Page, expected: string[]) {
  await expect.poll(async () => (await normalizedAnnouncements(page)).length)
    .toBe(expected.length);
  // A history-driven hashchange arrives after the live region mutation. Give it
  // a turn so a repeated announcement cannot pass as a transient match.
  await page.waitForTimeout(100);
  expect(await normalizedAnnouncements(page)).toEqual(expected);
}

const fixtures = [
  {
    name: 'fragment-in-url off',
    url: './revealjs/announcements.html',
    fragmentHash: '#/steps',
  },
  {
    name: 'fragment-in-url on',
    url: './revealjs/announcements-fragment-in-url.html',
    fragmentHash: '#/steps/0',
  },
];

for (const fixture of fixtures) {
  test(`${fixture.name}: announces only visible content once`, async ({ page }) => {
    await installAnnouncementObserver(page);
    await page.goto(fixture.url);
    await expect(page.locator('.reveal.ready')).toBeAttached();
    await expect(page).toHaveURL(/#\/intro$/);

    const expected = ['Intro'];
    await expectAnnouncements(page, expected);

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('section.present')).toHaveId('steps');
    await expect(page).toHaveURL(/#\/steps$/);
    expected.push(
      'Steps Visible lead Grow starts visible Fade out starts visible Before pause',
    );
    await expectAnnouncements(page, expected);

    const steps = [
      ['Grow starts visible', 0],
      ['Fade out starts visible', 1],
      ['Outer step', 2],
      ['Nested step', 3],
      ['After pause', 4],
    ] as const;

    for (const [announcement, index] of steps) {
      await page.keyboard.press('Space');
      const hash = fixture.fragmentHash.replace('/0', `/${index}`);
      await expect(page).toHaveURL(new RegExp(`${hash.replace('/', '\\/')}$`));
      expected.push(announcement);
      await expectAnnouncements(page, expected);
    }
  });
}

test('fragment URL history distinguishes explicit indices from its boundary', async ({ page }) => {
  await installAnnouncementObserver(page);
  await page.goto('./revealjs/announcements-fragment-in-url.html');
  await expect(page.locator('.reveal.ready')).toBeAttached();

  const expected = ['Intro'];
  await expectAnnouncements(page, expected);

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#\/steps$/);
  expected.push(
    'Steps Visible lead Grow starts visible Fade out starts visible Before pause',
  );
  await expectAnnouncements(page, expected);

  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/#\/steps\/0$/);
  expected.push('Grow starts visible');
  await expectAnnouncements(page, expected);

  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/#\/steps\/1$/);
  expected.push('Fade out starts visible');
  await expectAnnouncements(page, expected);

  await page.goBack();
  await expect(page).toHaveURL(/#\/steps\/0$/);
  await expect.poll(() =>
    page.evaluate(() => (window as any).Reveal.getIndices().f)
  ).toBe(0);
  // With fragment URLs enabled, the history entry before the first fragment
  // is the explicit boundary state: no fragment is visible.
  await page.goBack();
  await expect(page).toHaveURL(/#\/steps$/);
  await expect.poll(() =>
    page.evaluate(() => (window as any).Reveal.getIndices().f)
  ).toBe(-1);
  await expect(page.locator('#steps .fragment.visible')).toHaveCount(0);

  await page.goForward();
  await expect(page).toHaveURL(/#\/steps\/0$/);
  await expect.poll(() =>
    page.evaluate(() => (window as any).Reveal.getIndices().f)
  ).toBe(0);
  await expect(page.locator('#steps .fragment.visible')).toHaveCount(1);

  // A hashchange for the current explicit fragment is a no-op and must not
  // add another live-region announcement.
  await page.waitForTimeout(100);
  const atFirstFragment = await normalizedAnnouncements(page);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  await expectAnnouncements(page, atFirstFragment);

  await page.goForward();
  await expect(page).toHaveURL(/#\/steps\/1$/);
  await expect.poll(() =>
    page.evaluate(() => (window as any).Reveal.getIndices().f)
  ).toBe(1);
});

test('real hash navigation and browser history still change slides', async ({ page }) => {
  await installAnnouncementObserver(page);
  await page.goto('./revealjs/announcements.html');
  await expect(page.locator('.reveal.ready')).toBeAttached();
  await expectAnnouncements(page, ['Intro']);

  await page.evaluate(() => { window.location.hash = '#/history-target'; });
  await expect(page.locator('section.present')).toHaveId('history-target');
  await expectAnnouncements(page, ['Intro', 'History target']);

  await page.evaluate(() => { window.location.hash = '#/intro'; });
  await expect(page.locator('section.present')).toHaveId('intro');
  await expectAnnouncements(page, ['Intro', 'History target', 'Intro']);

  await page.goBack();
  await expect(page.locator('section.present')).toHaveId('history-target');
  await expectAnnouncements(page, [
    'Intro',
    'History target',
    'Intro',
    'History target',
  ]);

  await page.goForward();
  await expect(page.locator('section.present')).toHaveId('intro');
  await expectAnnouncements(page, [
    'Intro',
    'History target',
    'Intro',
    'History target',
    'Intro',
  ]);
});
