/*
* puppeteer.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { warning } from "log/mod.ts";
import puppeteer, { Browser } from "puppeteer/mod.ts";

import { which } from "./path.ts";
import { readRegistryKey } from "./windows.ts";

export async function withHeadlessBrowser<T>(
  fn: (browser: Browser) => Promise<T>,
) {
  const browser = await fetchBrowser();
  if (browser !== undefined) {
    try {
      return await fn(browser);
    } finally {
      await browser.close();
    }
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

async function fetchBrowser() {
  // Cook up a new instance
  const options = {};
  const fetcher = puppeteer.createBrowserFetcher(options);
  const availableRevisions = await fetcher.localRevisions();
  const isChromiumInstalled = availableRevisions.length > 0;
  const executablePath = !isChromiumInstalled ? await findChrome() : undefined;
  if (isChromiumInstalled || executablePath) {
    return await puppeteer.launch({
      product: "chrome",
      executablePath,
    });
  } else {
    warning(
      "Screenshotting of embedded web content disabled. Please use `quarto install chromium` to install the required version of Chromium",
    );
    return undefined;
  }
}
