/*
* screenshot.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Browser } from "puppeteer/mod.ts";
import { withHeadlessBrowser } from "../../core/puppeteer.ts";

// The region within the viewport to screenshot
export interface ScreenshotRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The viewport properties to use when launching the browser
export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  isLandscape?: boolean;
  hasTouch?: boolean;
}

// Options configuring this screenshot
export interface ScreenshotOptions {
  viewPort?: Viewport;
  region?: ScreenshotRegion;
  type?: "png" | "jpeg";
  fullPage?: boolean;
  quality?: number;
  omitBackground?: boolean;
}

// The target of a screenshot
export interface ScreenshotTarget {
  url: string;
  outputFile: string;
}

export async function screenshot(
  target: ScreenshotTarget,
  options?: ScreenshotOptions,
) {
  await withHeadlessBrowser<void>(async (browser: Browser) => {
    await browserScreenshot(browser, target, options);
    return Promise.resolve();
  });
}

export async function screenshots(
  targets: ScreenshotTarget[],
  options?: ScreenshotOptions,
) {
  await withHeadlessBrowser<void>(async (browser: Browser) => {
    for (const target of targets) {
      await browserScreenshot(browser, target, options);
    }
    return Promise.resolve();
  });
}

async function browserScreenshot(
  browser: Browser,
  target: ScreenshotTarget,
  options?: ScreenshotOptions,
) {
  // Navigate to the requested page
  const page = await browser.newPage();

  await page.goto(target.url, { waitUntil: "networkidle2" });

  // Take the screenshot
  await page.screenshot({
    path: target.outputFile,
    type: options?.type,
    clip: options?.region,
    fullPage: options?.fullPage,
    quality: options?.quality,
    omitBackground: options?.omitBackground,
  });

  await page.close();
}
