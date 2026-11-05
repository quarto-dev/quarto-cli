import { expect, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression tests for #14973. On a page with a light and a dark theme, the
// color scheme script runs at the start of <body> and again on every toggle.
// Neither run may move the page: a URL fragment must still land on its target,
// and toggling must leave the reader where they were. The Safari scrollbar
// workaround (#1455) only runs for a Safari user agent, so WebKit is the
// project where these fail when the scroll position is not preserved.

const url = getUrl("html/color-scheme-scroll-position.html");

// The color scheme script disables body transitions while it works and
// enables them again when it is done, so this is its completion signal.
const colorSchemeScriptDone = (page: Page) =>
  expect(page.locator("body")).not.toHaveClass(/notransition/);

const targetIsInView = (page: Page) =>
  page.evaluate(() => {
    const top = document.getElementById("target")!.getBoundingClientRect().top;
    return top >= -1 && top < window.innerHeight;
  });

test("opening a URL fragment lands on the target and stays there", async ({
  page,
  browserName,
}) => {
  // WebKit scrolls to the fragment while parsing, so the target is in view
  // when load fires unless something scrolls the page away. Chromium and
  // Firefox may scroll to the fragment after load, so the load sample says
  // nothing there, and they never run the Safari workaround anyway.
  test.skip(browserName !== "webkit", "load-time position is WebKit specific");

  await page.addInitScript(() => {
    window.addEventListener("load", () => {
      const top = document.getElementById("target")!.getBoundingClientRect().top;
      (window as any).__targetInViewAtLoad = top >= -1 && top < window.innerHeight;
    });
  });

  await page.goto(`${url}#target`, { waitUntil: "load" });
  await colorSchemeScriptDone(page);

  expect(await page.evaluate(() => (window as any).__targetInViewAtLoad)).toBe(
    true,
  );
  expect(await targetIsInView(page)).toBe(true);
});

test("toggling the color scheme keeps the scroll position", async ({
  page,
}) => {
  await page.goto(url, { waitUntil: "load" });
  await colorSchemeScriptDone(page);

  await page.locator("#target").scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);

  // dispatchEvent rather than click(): click() first scrolls the toggle,
  // which floats at the top of the page, into view.
  await page.locator("button.quarto-color-scheme-toggle").dispatchEvent(
    "click",
  );
  // While the Safari workaround runs, the page may be nudged by one pixel.
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - before),
  ).toBeLessThanOrEqual(1);

  await colorSchemeScriptDone(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});
