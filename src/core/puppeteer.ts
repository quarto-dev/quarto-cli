/*
* puppeteer.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { readRegistryKey } from "./windows.ts";
import { which } from "./path.ts";
import { error, info } from "log/mod.ts";
import { fetcher } from "../tools/impl/chromium.ts";
import { existsSync } from "fs/mod.ts";

// deno-lint-ignore no-explicit-any
let puppeteerImport: any = undefined;
// deno-lint-ignore prefer-const
let puppeteerUrl = "puppeteer/mod.ts";
export async function getPuppeteer() {
  if (puppeteerImport !== undefined) {
    return puppeteerImport;
  }
  puppeteerImport = (await import(puppeteerUrl)).default;
  return puppeteerImport;
}

interface PageOptions {
  url: string;
  viewport?: {
    // https://github.com/puppeteer/puppeteer/blob/v0.12.0/docs/api.md#pagesetviewportviewport
    width: number;
    height: number;
    deviceScaleFactor?: number;
    isMobile?: boolean;
    hasTouch?: boolean;
    isLandscape?: boolean;
  };
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
    const programs = ["chrome.exe", "msedge.exe"];
    for (let i = 0; i < programs.length; i++) {
      path = await readRegistryKey(
        "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\" +
          programs[i],
        "(Default)",
      );
      if (path && existsSync(path)) break;
    }

    // Try the HKCR key
    if (!path) {
      const regKeys = ["ChromeHTML", "MSEdgeHTM"];
      for (let i = 0; i < regKeys.length; i++) {
        path = await readRegistryKey(
          `HKCR\\${regKeys[i]}\\shell\\open\\command`,
          "(Default)",
        );
        path = path?.match(/"(.*)"/);
        path = path ? path[1] : undefined;
        if (path && existsSync(path)) break;
      }
    }
  }
  return path;
}

export async function getBrowserExecutablePath() {
  // Cook up a new instance
  const browserFetcher = await fetcher();
  const availableRevisions = await browserFetcher.localRevisions();

  let executablePath: string | undefined = undefined;

  if (availableRevisions.length > 0) {
    // get the latest available revision
    availableRevisions.sort((a: string, b: string) => Number(b) - Number(a));
    const revision = availableRevisions[0];
    const revisionInfo = browserFetcher.revisionInfo(revision);
    executablePath = revisionInfo.executablePath;
  }

  if (executablePath === undefined) {
    executablePath = await findChrome();
  }

  if (executablePath === undefined) {
    error("Chrome not found");
    info(
      "\nNo Chrome or Chromium installation was detected.\n\nPlease run 'quarto tools install chromium' to install Chromium.\n",
    );
    throw new Error();
  }

  return executablePath;
}
