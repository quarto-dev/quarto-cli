import { expect, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// The fixed navbar hides on scroll down, but the body keeps a top padding as
// tall as the header. If the header hides before the page has scrolled past
// that padding, an empty band shows at the top of the page. The header must
// stay pinned until the scroll position passes the header height.

const url = "website/navbar-scroll-offset/_site/index.html";

async function scrollAndSettle(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  // Headroom handles scroll events on the next animation frame.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      ),
  );
}

test.describe("fixed navbar on scroll", () => {
  test.use({ viewport: { width: 1200, height: 800 } });

  test("header stays pinned while the page is within the header height", async ({ page }) => {
    await page.goto(getUrl(url), { waitUntil: "load" });
    const header = page.locator("#quarto-header");
    // Headroom starts its scroll tracker after a delay; it sets this class then.
    await expect(header).toHaveClass(/headroom--top/);

    const headerHeight = await header.evaluate((el) => el.clientHeight);
    expect(headerHeight).toBeGreaterThan(20);

    await scrollAndSettle(page, Math.floor(headerHeight / 2));
    await expect(header).not.toHaveClass(/headroom--unpinned/);

    await scrollAndSettle(page, headerHeight * 3);
    await expect(header).toHaveClass(/headroom--unpinned/);

    await scrollAndSettle(page, headerHeight * 2);
    await expect(header).toHaveClass(/headroom--pinned/);
  });
});
