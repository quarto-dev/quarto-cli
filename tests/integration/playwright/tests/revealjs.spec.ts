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

// https://github.com/quarto-dev/quarto-cli/issues/14795
test.describe('slides that are not on screen are out of the tab order', () => {
  const deck = './revealjs/tab-order.html';

  // WebKit only tabs to links when the Alt modifier is held, which matches
  // Safari's default "Press Tab to highlight each item on a webpage" setting
  const tabKeyFor = (browserName: string) =>
    browserName === 'webkit' ? 'Alt+Tab' : 'Tab';

  const inertSlides = (page: Page) =>
    page.locator('.reveal .slides section[inert]');

  const isScrollView = (page: Page) =>
    page.evaluate(() => (window as any).Reveal.isScrollView());

  const currentSlideId = (page: Page) =>
    page.evaluate(() => (window as any).Reveal.getCurrentSlide().id);

  async function gotoSlide(page: Page, id: string) {
    await page.goto(`${deck}#/${id}`);
    await expect(page.locator('.reveal')).toHaveClass(/\bready\b/);
  }

  test('Tab reaches the current slide content first', async ({ page, browserName }) => {
    // reveal.js keeps the slides within viewDistance displayed, so the links
    // on slide 2 and slide 3 would otherwise come first
    await gotoSlide(page, 'slide-4');
    await page.keyboard.press(tabKeyFor(browserName));
    await expect(page.getByRole('link', { name: 'Link on slide 4' })).toBeFocused();
  });

  test('Tab reaches the new slide content after navigating', async ({ page, browserName }) => {
    await gotoSlide(page, 'slide-4');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press(tabKeyFor(browserName));
    await expect(page.getByRole('link', { name: 'Link on slide 5' })).toBeFocused();
  });

  test('Tab reaches the current slide content in a vertical stack', async ({ page, browserName }) => {
    await gotoSlide(page, 'stacked-slide-2');
    // the stack holding the current slide stays reachable
    await expect(page.locator('section.stack')).not.toHaveAttribute('inert');
    await page.keyboard.press(tabKeyFor(browserName));
    await expect(page.getByRole('link', { name: 'Link on stacked slide 2' })).toBeFocused();
  });

  test('a slidechanged listener of an earlier plugin can focus the new slide', async ({ page }) => {
    // Plugins listed before quarto-support, such as user plugins, add their
    // listeners first. Adding this one as soon as reveal.js loads puts it
    // ahead of quarto-support's own.
    await page.addInitScript(() => {
      let reveal: any;
      Object.defineProperty(window, 'Reveal', {
        configurable: true,
        get: () => reveal,
        set: (value) => {
          reveal = value;
          value.on('slidechanged', (event: any) =>
            event.currentSlide.querySelector('a')?.focus());
        },
      });
    });
    await gotoSlide(page, 'slide-4');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('link', { name: 'Link on slide 5' })).toBeFocused();
  });

  test('overview leaves every slide reachable', async ({ page }) => {
    await gotoSlide(page, 'slide-4');
    await expect(page.locator('#slide-3')).toHaveAttribute('inert');
    await page.keyboard.press('o');
    await expect(page.locator('.reveal')).toHaveClass(/\boverview\b/);
    await expect(inertSlides(page)).toHaveCount(0);
    await page.keyboard.press('o');
    await expect(page.locator('.reveal')).not.toHaveClass(/\boverview\b/);
    await expect(page.locator('#slide-3')).toHaveAttribute('inert');
    await expect(page.locator('#slide-4')).not.toHaveAttribute('inert');
  });

  // Leaving the scroll view, reveal.js restores the slides as they were when
  // it was entered and dispatches no event. Moving to another slide in
  // between checks that the restored slides are updated.
  test('scroll view leaves every slide reachable', async ({ page }) => {
    await gotoSlide(page, 'slide-4');
    await expect(page.locator('#slide-5')).toHaveAttribute('inert');
    await page.keyboard.press('R');
    expect(await isScrollView(page)).toBe(true);
    await expect(inertSlides(page)).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => currentSlideId(page)).toBe('slide-5');
    await page.keyboard.press('R');
    expect(await isScrollView(page)).toBe(false);
    await expect(page.locator('#slide-4')).toHaveAttribute('inert');
    await expect(page.locator('#slide-5')).not.toHaveAttribute('inert');
  });

  test('scroll view on a narrow window leaves every slide reachable', async ({ page }) => {
    await gotoSlide(page, 'slide-4');
    await expect(page.locator('#slide-5')).toHaveAttribute('inert');
    // reveal.js switches to and from the scroll view on its own across
    // scrollActivationWidth (435px by default)
    await page.setViewportSize({ width: 400, height: 720 });
    await expect.poll(() => isScrollView(page)).toBe(true);
    await expect(inertSlides(page)).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => currentSlideId(page)).toBe('slide-5');
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(() => isScrollView(page)).toBe(false);
    await expect(page.locator('#slide-4')).toHaveAttribute('inert');
    await expect(page.locator('#slide-5')).not.toHaveAttribute('inert');
  });

  test('print view leaves every slide reachable', async ({ page }) => {
    await page.goto(`${deck}?print-pdf`);
    await expect(page.locator('.pdf-page').first()).toBeAttached();
    await expect(inertSlides(page)).toHaveCount(0);
  });
});
