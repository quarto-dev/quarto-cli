import { expect, test, type Locator, type Page } from "@playwright/test";

// True when the element at the center of `locator` belongs to it, i.e. no
// other element (such as a fixed navbar) is painted on top of it.
async function isTopmostAtCenter(locator: Locator): Promise<boolean> {
  return await locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    return hit !== null && el.contains(hit);
  });
}

function embedHeaderControls(page: Page) {
  const embedHeader = page.locator("#quarto-embed-header");
  return {
    "back link": embedHeader.locator(".quarto-back-link"),
    title: embedHeader.locator("h6"),
    "download link": embedHeader.getByRole("link", { name: "Download Notebook" }),
  };
}

// The notebook preview page has its own fixed header bar. On a website with
// a site header (navbar, sidebar toggle, announcement), both bars sit at the
// top of the page, and the site header must not cover the preview controls
// (#14972).
const testCases = [
  {
    name: "website navbar",
    url: "./website/notebook-preview-navbar/_site/notebook-preview.html",
    siteHeader: true,
  },
  {
    name: "website announcement only",
    url: "./website/notebook-preview-announcement/_site/notebook-preview.html",
    siteHeader: true,
  },
  {
    name: "website sidebar only, narrow viewport",
    url: "./website/notebook-preview-sidebar/_site/notebook-preview.html",
    siteHeader: true,
    viewport: { width: 400, height: 800 },
  },
  {
    name: "standalone document, no site header",
    url: "./html/notebook-preview-standalone/notebook-preview.html",
    siteHeader: false,
  },
];

test.describe("Notebook preview header", () => {
  for (const { name, url, siteHeader, viewport } of testCases) {
    test.describe(name, () => {
      if (viewport) {
        test.use({ viewport });
      }

      test.beforeEach(async ({ page }) => {
        await page.goto(url);
      });

      test("controls are not covered by another element", async ({ page }) => {
        await expect(page.locator("#quarto-header")).toHaveCount(siteHeader ? 1 : 0);
        for (const [label, control] of Object.entries(embedHeaderControls(page))) {
          await expect(control).toBeVisible();
          expect(await isTopmostAtCenter(control), `${label} is covered by another element`).toBe(true);
        }
      });

      test("first notebook cell starts below the header", async ({ page }) => {
        const header = page.locator("#quarto-embed-header");
        // div.cell matches every notebook cell; the first is the top of the content
        const cell = page.locator("div.cell").first();
        await expect(cell).toBeVisible();
        await expect.poll(async () => {
          const headerBox = await header.boundingBox();
          const cellBox = await cell.boundingBox();
          return cellBox!.y - (headerBox!.y + headerBox!.height);
        }).toBeGreaterThanOrEqual(0);
      });
    });
  }
});
