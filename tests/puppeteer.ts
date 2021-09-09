/*
* ojs-runs.ts
*
* puppeteer testing utils
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { warning } from "log/mod.ts";

import puppeteer, { Browser } from "https://deno.land/x/puppeteer@9.0.1/mod.ts";

import { which } from "../src/core/path.ts";
import { readRegistryKey } from "../src/core/windows.ts";

export function localFileURL(path: string) {
  const match = path.match(/^(.+)\.[^.]+$/)!;
  const base = match[1];
  return `file://${join(Deno.cwd(), base)}.html`;
}

// deno-lint-ignore no-explicit-any
export function inPuppeteer(url: string, f: any) {
  const allowedErrorMessages = [
    "Navigation failed because browser has disconnected!",
    "Navigation timeout of 30000 ms exceeded",
    "Evaluation failed: undefined"
  ];
    
  // deno-lint-ignore no-explicit-any
  return (async (...params: any[]) => {
    let attempts = 0;
    let maxAttempts = 5;
    while (attempts++ < maxAttempts) {
      try {
        return await withHeadlessBrowser(async (browser: Browser) => {
          const page = await browser.newPage();
          await page.goto(url);
          const clientSideResult = await page.evaluate(f, ...params);
          return clientSideResult;
        });
      } catch (error) {
        if ((allowedErrorMessages.indexOf(error.message) !== -1) &&
          (attempts < maxAttempts)) {
          console.log(`\nEncountered a bad error message from puppeteer: "${error.message}"\n Retrying ${attempts}/${maxAttempts}`);
        } else {
          throw error;
        }
      }
    }
  });
}

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
      "Screenshotting of embedded web content disabled (chromium not installed)",
    );
    return undefined;
  }
}
