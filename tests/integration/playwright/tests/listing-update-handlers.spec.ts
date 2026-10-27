import { expect, Page, test } from "@playwright/test";

const fixture = "./listings/interactions/_site/index.html";
const listingIds = ["first-listing", "second-listing"];

async function changeHash(page: Page, hash: string) {
  await page.evaluate((hash) =>
    new Promise<void>((resolve) => {
      window.addEventListener("hashchange", () => resolve(), { once: true });
      window.location.hash = hash;
    }), hash);
}

// The update handler calls window.quartoDecorateExternalLinks with the
// listing's list element; counting those calls per listing counts the runs.
async function countUpdateHandlerRuns(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    const decorate = w.quartoDecorateExternalLinks;
    w.updateRuns = {};
    w.quartoDecorateExternalLinks = (root: Element) => {
      const id = root?.closest?.(".quarto-listing")?.id;
      if (id) w.updateRuns[id] = (w.updateRuns[id] ?? 0) + 1;
      return decorate(root);
    };
  });
}

// A pagination click updates the list twice (list.js and Quarto both handle
// it), so trigger exactly one update through the List.js API instead.
async function updateRunsForOneUpdate(page: Page, listingId: string) {
  return page.evaluate((id) => {
    const w = window as any;
    w.updateRuns = {};
    w["quarto-listings"][id].update();
    return w.updateRuns[id];
  }, `listing-${listingId}`);
}

test.describe("Listing update handlers", () => {
  for (const listingId of listingIds) {
    test(`${listingId} runs its update handler once per update`, async ({ page }) => {
      await page.goto(fixture);
      await countUpdateHandlerRuns(page);

      expect(await updateRunsForOneUpdate(page, listingId)).toBe(1);
    });

    test(`${listingId} keeps one update handler across hash changes`, async ({ page }) => {
      await page.goto(fixture);
      await countUpdateHandlerRuns(page);

      for (const hash of ["one", "two", "three"]) {
        await changeHash(page, hash);
      }

      expect(await updateRunsForOneUpdate(page, listingId)).toBe(1);
    });
  }
});
