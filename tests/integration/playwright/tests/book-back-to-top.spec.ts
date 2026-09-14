import { expect, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression test for #14879. `back-to-top-navigation` set under the `book`
// key (rather than `website`) used to be silently dropped, so the
// #quarto-back-to-top control never appeared in book output. This exercises
// the control's full show/hide/click-to-top behavior once the control is
// present, not just its injection into the HTML.

// Disable the reduced-motion-gated `scroll-behavior: smooth` CSS so
// window.scrollTo takes effect synchronously, and pass an explicit
// "instant" behavior on every scroll to avoid animated-scroll flake.
test.use({ reducedMotion: "reduce" });

test("book-level back-to-top control shows/hides on scroll and returns to top on click", async ({
  page,
}) => {
  await page.goto(getUrl("book/back-to-top/_book/index.html"), {
    waitUntil: "load",
  });

  const backToTop = page.locator("#quarto-back-to-top");

  // 1. At the top of the page: control is attached but hidden.
  await expect(backToTop).toBeAttached();
  await expect(backToTop).toBeHidden();

  // 2. Scroll down one viewport: still hidden (downward scroll hides it).
  const viewportHeight = page.viewportSize()?.height ?? 720;
  await page.evaluate(
    (top) => window.scrollTo({ top, behavior: "instant" }),
    viewportHeight,
  );
  // Wait for the scroll event to be processed so the nav script's internal
  // scroll-position tracking is up to date before we reverse direction below
  // (otherwise the next scroll-up can race the down-scroll's own handler).
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(viewportHeight);
  await expect(backToTop).toBeHidden();

  // 3. Scroll up (past the up-buffer threshold): control becomes visible.
  await page.evaluate(
    (top) => window.scrollTo({ top, behavior: "instant" }),
    Math.floor(viewportHeight / 4),
  );
  await expect(backToTop).toBeVisible();

  // 4. Jump to the bottom of the page: visible via the bottom-of-page branch.
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" })
  );
  await expect(backToTop).toBeVisible();

  // 5. Click the control: it scrolls to the top and hides itself again.
  await backToTop.click();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(0);
  await expect(backToTop).toBeHidden();
});
