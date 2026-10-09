import { test, expect, Page } from '@playwright/test';

test('logo and footer are correctly shown in default mode', async ({ page }) => {
  await page.goto('./revealjs/logo-footer.html#/slide-1');
  await expect(page.locator('.reveal > .footer.footer-default')).toContainText('Footer text');
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
  await page.keyboard.press('ArrowRight'); // Next slide
  await expect(page.locator('.reveal > .footer.footer-default')).toContainText('Footer text');
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
  await page.keyboard.press('ArrowRight'); // Next slide
  await expect(page.locator('.reveal > .footer')).toBeHidden();
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
  await page.keyboard.press('ArrowRight'); // Next slide
  await expect(page.locator('.reveal > .footer.footer-default')).toBeHidden();
  await expect(page.locator('.reveal > .footer:not(.footer-default)')).toContainText('A different footer');
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
});

test('logo and footer are correctly shown in scroll mode', async ({ page }) => {
  // check scroll mode too
  await page.goto('revealjs/logo-footer.html?view=scroll');
  await expect(page.locator('.reveal > .footer.footer-default')).toContainText('Footer text');
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
  await page.keyboard.press('ArrowRight'); // Next slide
  await expect(page.locator('.reveal > .footer.footer-default')).toContainText('Footer text');
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
  await page.keyboard.press('ArrowRight'); // Next slide
  await expect(page.locator('.reveal > .footer')).toBeHidden();
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
  await page.keyboard.press('ArrowRight'); // Next slide
  await expect(page.locator('.reveal > .footer.footer-default')).toBeHidden();
  await expect(page.locator('.reveal > .footer:not(.footer-default)')).toContainText('A different footer');
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
});

async function expectScrollViewMode(page: Page, isActive: boolean) {
  expect(await page.evaluate(() => (window as any).Reveal.isScrollView())).toBe(isActive);
  if (isActive) {
    await expect(page.locator('.scrollbar-playhead')).toBeVisible();
  } else {
    await expect(page.locator('.scrollbar-playhead')).toBeHidden();
  }
}

async function clickScrollViewMenuButton(page: Page) {
  await page.locator('div.slide-menu-button').click();
  await page.locator('li').filter({ hasText: 'Tools' }).click();
  expect(page.locator('li').filter({ hasText: 'Scroll View Mode' })).toBeVisible();
  await page.getByRole('link', { name: 'r Scroll View Mode' }).click();
}

test('scroll view mode is correctly activated with menu and shortcut', async ({ page }) => {
  await page.goto('revealjs/scroll-view-activate.html');
  // should be activated by default
  await expectScrollViewMode(page, true);
  // deactivate
  await clickScrollViewMenuButton(page);
  await expectScrollViewMode(page, false);
  // activate
  await clickScrollViewMenuButton(page);
  await expectScrollViewMode(page, true);
  // keyboard shortcuts works too
  // -- deactivate
  await page.keyboard.press('R');
  await expectScrollViewMode(page, false);
  // -- activate
  await page.keyboard.press('R');
  await expectScrollViewMode(page, true);
});

test('internal id for links between slides are working', async ({ page }) => {
  await page.goto('./revealjs/links-id.html#/link-to-the-figure');
  await page.getByRole('link', { name: 'Figure Element' }).click();
  await page.waitForURL(/quarto-figure$/);
  await page.goto('./revealjs/links-id.html#/link-to-the-image');
  await page.getByRole('link', { name: 'Figure Element' }).click();
  await page.waitForURL(/image$/);
  await page.goto('./revealjs/links-id.html#/link-to-equation');
  await page.getByRole('link', { name: 'Equation' }).click();
  await page.waitForURL(/equation$/);
  await page.goto('./revealjs/links-id.html#/link-to-theorem');
  await page.getByRole('link', { name: 'Theorem' }).click();
  await page.waitForURL(/theorem$/);
});

test('Home and End on a focused tabset tab do not change slide', async ({ page }) => {
  await page.goto('./revealjs/tabset-focus-order.html#/slide-3');
  // Located by attribute rather than role: if reveal leaves the slide, it marks
  // the slide aria-hidden and a role query would fail before the slide check.
  const tab = (name: string) => page.locator('[role="tab"]', { hasText: name });
  await expect(tab('Tab A')).toBeAttached();
  await tab('Tab A').focus();
  await page.keyboard.press('End');
  await expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('section.slide.present')).toHaveId('slide-3');
  await page.keyboard.press('Home');
  await expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('section.slide.present')).toHaveId('slide-3');
});

test.describe('off-screen slides are not focusable (#14795)', () => {
  // Not getByRole: non-present slides carry aria-hidden, which getByRole skips.
  const slideButton = (page: Page, id: string) =>
    page.locator('button', { hasText: `Button on ${id}` });
  const focusOutsideCurrentSlide = (page: Page) =>
    page.locator('.reveal .slides section:not(.present) :focus');
  const gotoSlide = async (page: Page, hash: string, query = '') => {
    await page.goto(`./revealjs/offscreen-slides-focus.html${query}${hash}`);
    await expect(page.locator('.reveal.ready')).toBeAttached();
  };
  const isScrollView = (page: Page) => page.evaluate(() => (window as any).Reveal.isScrollView());
  const currentSlideId = (page: Page) =>
    page.evaluate(() => (window as any).Reveal.getCurrentSlide().id);

  test('Tab on a slide reaches only that slide (#14795)', async ({ page }) => {
    await gotoSlide(page, '#/slide-3');
    await page.keyboard.press('Tab');
    await expect(slideButton(page, 'slide-3')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.reveal .slides section :focus')).toHaveCount(0);
  });

  test('Tab after keyboard navigation stays on the new slide', async ({ page }) => {
    await gotoSlide(page, '#/slide-2');
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/#\/slide-3$/);
    await page.keyboard.press('Tab');
    await expect(slideButton(page, 'slide-3')).toBeFocused();
  });

  test('Tab in a vertical stack reaches only the current child', async ({ page }) => {
    await gotoSlide(page, '#/stack-b');
    await page.keyboard.press('Tab');
    await expect(slideButton(page, 'stack-b')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(focusOutsideCurrentSlide(page)).toHaveCount(0);
  });

  test("slidechanged handler registered before Quarto's can focus the new slide", async ({ page }) => {
    await gotoSlide(page, '#/slide-5');
    await page.keyboard.press('ArrowRight');
    await expect(slideButton(page, 'slide-6')).toBeFocused();
  });

  test('overview: slides are clickable, inert returns on exit', async ({ page }) => {
    await gotoSlide(page, '#/slide-3');
    await page.keyboard.press('o');
    await expect(page.locator('.reveal.overview')).toBeAttached();
    // Corner click: a centre click focuses the button on mousedown, so the next Tab would skip it.
    await page.locator('section#slide-5').click({ position: { x: 5, y: 5 } });
    await expect(page).toHaveURL(/#\/slide-5$/);
    await expect(page.locator('.reveal.overview')).toHaveCount(0);
    await page.keyboard.press('Tab');
    await expect(slideButton(page, 'slide-5')).toBeFocused();
  });

  test('scroll view from config: every slide is focusable', async ({ page }) => {
    await gotoSlide(page, '', '?view=scroll');
    await expect.poll(() => isScrollView(page)).toBe(true);
    await slideButton(page, 'slide-4').focus();
    await expect(slideButton(page, 'slide-4')).toBeFocused();
  });

  test('scroll view toggle with R: focusable inside, current slide reachable after leaving', async ({ page }) => {
    await gotoSlide(page, '#/slide-2');
    await page.keyboard.press('R');
    await expect.poll(() => isScrollView(page)).toBe(true);
    await slideButton(page, 'slide-4').focus();
    await expect(slideButton(page, 'slide-4')).toBeFocused();
    // Explicit v index: in scroll view Reveal.slide(3) is a no-op.
    await page.evaluate(() => (window as any).Reveal.slide(3, 0));
    await expect.poll(() => currentSlideId(page)).toBe('slide-4');
    await page.keyboard.press('R');
    await expect.poll(() => isScrollView(page)).toBe(false);
    await page.keyboard.press('Tab');
    await expect(slideButton(page, 'slide-4')).toBeFocused();
  });

  test('responsive scroll view below scrollActivationWidth', async ({ page }) => {
    await gotoSlide(page, '#/slide-2');
    await page.setViewportSize({ width: 400, height: 700 });
    await expect.poll(() => isScrollView(page)).toBe(true);
    await slideButton(page, 'slide-4').focus();
    await expect(slideButton(page, 'slide-4')).toBeFocused();
    await page.evaluate(() => (window as any).Reveal.slide(3, 0));
    await expect.poll(() => currentSlideId(page)).toBe('slide-4');
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(() => isScrollView(page)).toBe(false);
    await page.keyboard.press('Tab');
    await expect(slideButton(page, 'slide-4')).toBeFocused();
  });

  test('print view: no slide is inert', async ({ page }) => {
    await page.goto('./revealjs/offscreen-slides-focus.html?print-pdf');
    await expect(page.locator('.pdf-page').first()).toBeAttached();
    await expect(page.locator('.reveal .slides section[inert]')).toHaveCount(0);
  });
});

// https://github.com/quarto-dev/quarto-cli/issues/15011
test.describe('the closed slide menu is out of the tab order', () => {
  const deck = './revealjs/menu-focus-order.html';

  // WebKit only tabs to links when the Alt modifier is held, which matches
  // Safari's default "Press Tab to highlight each item on a webpage" setting
  const tabKeyFor = (browserName: string) =>
    browserName === 'webkit' ? 'Alt+Tab' : 'Tab';

  const menu = (page: Page) => page.locator('nav.slide-menu');

  test('Tab does not stop in the closed menu', async ({ page, browserName }) => {
    await page.goto(deck);
    // Chrome and Firefox make the slide list a Tab stop only while it
    // scrolls, which is why the deck has more slides than the list shows
    const slideList = menu(page).locator('.slide-menu-panel.active-menu-panel');
    expect(
      await slideList.evaluate((list) => list.scrollHeight > list.clientHeight),
      'the slide list should scroll',
    ).toBe(true);

    // The closed menu comes right after its button in the document
    await page.locator('.slide-menu-button a').focus();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press(tabKeyFor(browserName));
      await expect(page.locator('nav.slide-menu:focus-within')).toHaveCount(0);
    }
  });

  test('the menu works while open and is inert again once closed', async ({ page }) => {
    await page.goto(deck);
    const currentSlide = page.locator('section.slide.present');
    await expect(menu(page)).toHaveAttribute('inert');

    // Opened with M, and the last slide chosen with End and Enter
    await page.keyboard.press('m');
    await expect(menu(page)).not.toHaveAttribute('inert');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(currentSlide).toHaveId('slide-25');
    await expect(menu(page)).toHaveAttribute('inert');

    // Opened with the button, and a slide chosen with the mouse, which an
    // inert menu would not let through
    await page.locator('div.slide-menu-button').click();
    await expect(menu(page)).not.toHaveAttribute('inert');
    await menu(page).getByText('Slide 5', { exact: true }).click();
    await expect(currentSlide).toHaveId('slide-5');
    await expect(menu(page)).toHaveAttribute('inert');
  });

  test('a menu built after the presentation loads is inert while closed', async ({ page }) => {
    await page.goto('./revealjs/menu-delay-init.html');
    await expect(page.locator('.reveal')).toHaveClass(/\bready\b/);
    // `delay-init` leaves building the menu to the presentation
    await expect(menu(page)).toHaveCount(0);
    await page.evaluate(() => (window as any).Reveal.getPlugin('menu').initialiseMenu());

    await expect(menu(page)).toHaveAttribute('inert');
    await page.locator('div.slide-menu-button').click();
    await expect(menu(page)).not.toHaveAttribute('inert');
  });
});
