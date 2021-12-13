/*
* ojs-test-utils.ts
*
* utilities for testing ojs code
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { ExecuteOutput, Verify } from "../../../test.ts";
import { Browser } from "https://deno.land/x/puppeteer@9.0.2/mod.ts";
import { inPuppeteer, withHeadlessBrowser } from "../../../puppeteer.ts";
import { assert } from "testing/asserts.ts";

// deno-lint-ignore no-explicit-any
const window = (undefined as any); // appease the TypeScript typechecker
// deno-lint-ignore no-explicit-any
const document = (undefined as any); // appease the TypeScript typechecker

// this works for dynamically-determined values in the DOM
export function verifyDomTextValue(
  url: string,
  elementName: string,
  value: string,
): Verify {
  return {
    name: "DOM value is as expected",
    verify: async (_output: ExecuteOutput[]) => {
      // deno-lint-ignore no-explicit-any
      const textVal = await inPuppeteer(url, async (name: any) => {
        // NB: we need to copy this defn instead of referring to it
        // because the function is evaluated in a browser context, and
        // we need the definitions to be there (same in the
        // fieldsExist reference below). We should consider including
        // a library of puppeteer utilities in ojs-bundle.js
        function fieldsExist(obj: any, names: string[], timeout = 1000) {
          names = names.slice();
          // deno-lint-ignore no-explicit-any
          let accept: any, reject: any;
          const promise = new Promise((a, r) => {
            accept = a;
            reject = r;
          });
          const delay = 100;
          if (names.length === 0) {
            accept(obj);
            return promise;
          }
          let name = names[0];
          function tick() {
            if (obj.hasOwnProperty(name)) {
              names = names.slice(1);
              if (names.length === 0) {
                accept(obj);
              } else {
                obj = obj[name];
                name = names[0];
                window.setTimeout(tick, delay);
              }
            } else {
              timeout -= delay;
              if (timeout < 0) {
                reject();
              } else {
                window.setTimeout(tick, delay);
              }
            }
          }
          tick();
          return promise;
        }
        await fieldsExist(window, ["_ojs", "runtime"]);
        await window._ojs.runtime.finishInterpreting();
        // ojs hasn't updated the inspector yet.
        // FIXME this doesn't seem robust in the long run
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return document.getElementById(name).innerText;
      })(elementName);
      assert(
        textVal === value,
        `Expected ${value} in document element ${elementName}, got ${textVal} instead`,
      );
    },
  };
}

export function verifyOjsValue(
  url: string,
  valName: string,
  // deno-lint-ignore no-explicit-any
  value: any,
): Verify {
  return {
    name: "ojs variable value is as expected",
    verify: async (_output: ExecuteOutput[]) => {
      // deno-lint-ignore no-explicit-any
      const ojsVal = await inPuppeteer(url, async (name: any) => {
        function fieldsExist(obj: any, names: string[], timeout = 1000) {
          names = names.slice();
          // deno-lint-ignore no-explicit-any
          let accept: any, reject: any;
          const promise = new Promise((a, r) => {
            accept = a;
            reject = r;
          });
          const delay = 100;
          if (names.length === 0) {
            accept(obj);
            return promise;
          }
          let name = names[0];
          function tick() {
            if (obj.hasOwnProperty(name)) {
              names = names.slice(1);
              if (names.length === 0) {
                accept(obj);
              } else {
                obj = obj[name];
                name = names[0];
                window.setTimeout(tick, delay);
              }
            } else {
              timeout -= delay;
              if (timeout < 0) {
                reject();
              } else {
                window.setTimeout(tick, delay);
              }
            }
          }
          tick();
          return promise;
        }
        await fieldsExist(window, ["_ojs", "runtime"]);
        // await new Promise((resolve) => setTimeout(resolve, 3000));
        await window._ojs.runtime.finishInterpreting();
        const val = await window._ojs.runtime.value(name);
        return val;
      })(valName);
      assert(
        ojsVal === value,
        `Expected ${value} in ojs variable ${valName}, got ${ojsVal} instead`,
      );
    },
  };
}

export function verifyClickingDoesNotThrow(
  url: string,
  selector: string,
): Verify {
  return {
    name: "page does not throw when selected element is clicked",
    // deno-lint-ignore no-explicit-any
    verify: (async (..._params: any[]) => {
      return await withHeadlessBrowser<void>(async (browser: Browser) => {
        const page = await browser.newPage();
        try {
          await page.goto(url);
        } catch (e) {
          console.log(`(Test error) page not found: ${url}`);
          console.log(e);
          assert(false);
        }
        let threwError = false;
        page.on("pageerror", function (err) {
          const theTempValue = err.toString();
          console.log("Page error: " + theTempValue);
          threwError = true;
        });
        page.on("error", (err) => {
          const theTempValue = err.toString();
          console.log("Error: " + theTempValue);
          threwError = true;
        });
        try {
          await page.click(selector);
          console.log("close");
        } catch (e) {
          console.log("Test error: puppeteer threw exception");
          console.log(e);
          assert(false);
        }
        assert(!threwError);
      });
    }),
  };
}
