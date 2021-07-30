/*
* ojs-runs.ts
*
* puppeteer testing utils
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { Browser } from "puppeteer/mod.ts";
import { withHeadlessBrowser } from "../src/core/puppeteer.ts";

export function localFileURL(path: string) {
  const match = path.match(/^(.+)\.[^.]+$/)!;
  const base = match[1];
  return `file://${join(Deno.cwd(), base)}.html`;
}

// deno-lint-ignore no-explicit-any
export function inPuppeteer(url: string, f: any) {
  // deno-lint-ignore no-explicit-any
  return (async (...params: any[]) => {
    return await withHeadlessBrowser(async (browser: Browser) => {
      const page = await browser.newPage();
      await page.goto(url);
      const clientSideResult = await page.evaluate(f, ...params);
      return clientSideResult;
    });
  });
}
