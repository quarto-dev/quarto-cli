/*
* screenshot.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { warning } from "log/mod.ts";

import { which } from "../../core/path.ts";
import { readRegistryKey } from "../../core/windows.ts";
import { installed } from "../install/tools/chromium.ts";

import puppeteer, { Browser } from "puppeteer/mod.ts";

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

export async function initScreenshot() {
}

export async function cleanupScreenshot() {
  if (browser) {
    (await connectedBrowser()).close();
  }
}

async function findChrome(): Promise<string | undefined> {
  let path;
  if (Deno.build.os === "darwin") {
    path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  } else if (Deno.build.os === "linux") {
    path = await which("google-chrome");
    if (!path) {
      path = await which("chromium-browser");
    }
  } else if (Deno.build.os === "windows") {
    // Try the HKLM key
    path = await readRegistryKey(
      "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
      "(Default)",
    );

    // Try the HKCR key
    if (!path) {
      path = await readRegistryKey(
        "HKCR\\ChromeHTML\\shell\\open\\command",
        "(Default)",
      );
    }
  }
  return path;
}

let browser: Browser;
async function connectedBrowser() {
  if (!browser) {
    // Cook up a new instance
    const isChromiumInstalled = await installed();
    const executablePath = !isChromiumInstalled
      ? await findChrome()
      : undefined;
    if (isChromiumInstalled || executablePath) {
      browser = await puppeteer.launch({
        product: "chrome",
        executablePath,
      });
    } else {
      warning(
        "Chromium is not installed so a screenshot can't be taken. Please use `quarto install chromium` to install the required version of Chromium",
      );
    }
  }
  return browser;
}

export async function screenshot(
  url: string,
  outputFile: string,
  options?: ScreenshotOptions,
) {
  // Launch the browser
  const browser = await connectedBrowser();

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

  await page.close();
}
