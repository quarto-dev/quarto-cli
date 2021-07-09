/*
* ojs-runs.ts
*
* test that ojs initializes and produces output
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { ExecuteOutput, Verify } from "../../../test.ts";
import { testRender } from "../../../smoke/render/render.ts";
import { assert } from "testing/asserts.ts";
import puppeteer from "puppeteer/mod.ts";
import { join } from "path/mod.ts";

// deno-lint-ignore no-explicit-any
const inPuppeteer = (url: string, f: any) => {
  // deno-lint-ignore no-explicit-any
  return (async (...params: any[]) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    const clientSideResult = await page.evaluate(f, ...params);
    await browser.close();
    return clientSideResult;
  });
};

// deno-lint-ignore no-explicit-any
const verifyOjsValue = (url: string, valName: string, value: any): Verify => {
  // deno-lint-ignore no-explicit-any
  const window = (undefined as any); // appease the TypeScript typechecker
  return {
    name: "ojs variable value is as expected",
    verify: async (_output: ExecuteOutput[]) => {
      // deno-lint-ignore no-explicit-any
      const ojsVal = await inPuppeteer(url, async (name: any) => {
        const val = await window._ojs.runtime.value(name);
        return val;
      })(valName);
      assert(
        ojsVal === value,
        `Expected ${value} in ojs variable ${valName}, got ${ojsVal} instead`,
      );
    },
  };
};

function localFileURL(path: string) {
  const match = path.match(/^(.+)\.[^.]+$/)!;
  const base = match[1];
  return `file://${join(Deno.cwd(), base)}.html`;
}

const computes = "docs/test-ojs-computes.md";
testRender(computes, "html", false, [
  verifyOjsValue(localFileURL(computes), "y", 25),
]);
