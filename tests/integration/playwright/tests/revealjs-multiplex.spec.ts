import { test, expect, Page, Browser, BrowserContext } from '@playwright/test';

async function getRevealState(page: Page) {
  return await page.evaluate(() => {
    const reveal = (window as any).Reveal;
    return reveal ? reveal.getState() : null;
  });
}

const SOCKET_PROPAGATION_DELAY = 500;

async function createMultiplexPage(browser: Browser, url: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  return { context, page };
}

/**
 * Helper to create both master and client pages for multiplex testing
 */
async function createMultiplexPages(browser: Browser) {
  const master = await createMultiplexPage(browser, './revealjs/multiplex-speaker.html');
  const client = await createMultiplexPage(browser, './revealjs/multiplex.html');
  return { master, client };
}

async function expectSlidePositions(
  master: Page,
  client: Page,
  expectedMasterH: number,
  expectedClientH: number,
  expectedMasterV?: number,
  expectedClientV?: number
) {
  const masterState = await getRevealState(master);
  const clientState = await getRevealState(client);

  expect(masterState.indexh).toBe(expectedMasterH);
  expect(clientState.indexh).toBe(expectedClientH);

  if (expectedMasterV !== undefined) {
    expect(masterState.indexv).toBe(expectedMasterV);
  }
  if (expectedClientV !== undefined) {
    expect(clientState.indexv).toBe(expectedClientV);
  }
}

async function expectFragmentPositions(
  master: Page,
  client: Page,
  expectedMasterF: number,
  expectedClientF: number
) {
  const masterState = await getRevealState(master);
  const clientState = await getRevealState(client);

  expect(masterState.indexf).toBe(expectedMasterF);
  expect(clientState.indexf).toBe(expectedClientF);
}

/**
 * Test the multiplex feature where a master presentation controls client presentations.
 * Tests: slide synchronization, fragment synchronization, and unidirectional control.
 */
test('multiplex: master controls client, fragments sync, and client cannot control master', async ({ browser }) => {
  const { master, client } = await createMultiplexPages(browser);

  try {
    // Both should start on title slide
    await expectSlidePositions(master.page, client.page, 0, 0, 0, 0);

    // Test 1: Basic slide synchronization
    await master.page.keyboard.press('ArrowRight');
    await master.page.waitForTimeout(SOCKET_PROPAGATION_DELAY);
    await expectSlidePositions(master.page, client.page, 1, 1);

    await master.page.keyboard.press('ArrowRight');
    await master.page.waitForTimeout(SOCKET_PROPAGATION_DELAY);
    await expectSlidePositions(master.page, client.page, 2, 2);

    // Test 2: Fragment synchronization on slide 3
    await master.page.keyboard.press('ArrowRight'); // slide 2 -> slide 3
    await master.page.waitForTimeout(SOCKET_PROPAGATION_DELAY);
    await expectSlidePositions(master.page, client.page, 3, 3);

    // Show first fragment
    await master.page.keyboard.press('ArrowRight');
    await master.page.waitForTimeout(SOCKET_PROPAGATION_DELAY);
    await expectFragmentPositions(master.page, client.page, 0, 0);

    // Show second fragment
    await master.page.keyboard.press('ArrowRight');
    await master.page.waitForTimeout(SOCKET_PROPAGATION_DELAY);
    await expectFragmentPositions(master.page, client.page, 1, 1);

    // Test 3: Client cannot control master
    // Navigate back to title slide
    await master.page.goto('./revealjs/multiplex-speaker.html#/');
    await master.page.waitForTimeout(SOCKET_PROPAGATION_DELAY);
    await expectSlidePositions(master.page, client.page, 0, 0);

    // Client tries to navigate (should not affect master)
    await client.page.keyboard.press('ArrowRight');
    await client.page.waitForTimeout(SOCKET_PROPAGATION_DELAY);
    await expectSlidePositions(master.page, client.page, 0, 1);

    // Master overrides client's position
    await master.page.keyboard.press('ArrowRight');
    await master.page.keyboard.press('ArrowRight');
    await master.page.waitForTimeout(SOCKET_PROPAGATION_DELAY);
    await expectSlidePositions(master.page, client.page, 2, 2);

  } finally {
    await master.context.close();
    await client.context.close();
  }
});
