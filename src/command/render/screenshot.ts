import { warning } from "log/mod.ts";
import puppeteer from "puppeteer/mod.ts";
import { installed } from "../install/tools/puppeteer.ts";

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

export async function screenshot(
  url: string,
  outputFile: string,
  options?: ScreenshotOptions,
) {
  const isChromiumInstalled = await installed();
  if (isChromiumInstalled) {
    // Launch the browser
    const browser = await puppeteer.launch({
      defaultViewport: options?.viewPort,
    });

    // Navigate to the requested page
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    // Take the screenshot
    await page.screenshot({
      path: outputFile,
      type: options?.type,
      clip: options?.region,
      fullPage: options?.fullPage,
      quality: options?.quality,
      omitBackground: options?.omitBackground,
    });

    // Close the page
    page.close();

    // Close the browser
    await browser.close();
  } else {
    warning(
      "Chromium is not installed so a screenshot can't be taken. Please use `quarto install chromium` to install the required version of Chromium",
    );
  }
}
