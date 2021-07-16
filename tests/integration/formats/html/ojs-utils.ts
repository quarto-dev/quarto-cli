/*
* ojs-test-utils.ts
*
* utilities for testing ojs code
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { ExecuteOutput, Verify } from "../../../test.ts";
import { inPuppeteer } from "../../../puppeteer.ts";
import { assert } from "testing/asserts.ts";

// deno-lint-ignore no-explicit-any
const window = (undefined as any); // appease the TypeScript typechecker
const document = (undefined as any); // appease the TypeScript typechecker

// this works for dynamically-determined values in the DOM
export function verifyDomTextValue(
  url: string,
  elementName: string,
  value: string
): Verify {
  return {
    name: "DOM value is as expected",
    verify: async (_output: ExecuteOutput[]) => {
      const textVal = await inPuppeteer(url, async (name: any) => {
        await window._ojs.runtime.finishInterpreting();
        return document.getElementById(name).innerText;
      })(elementName);
      assert(
        textVal === value,
        `Expected ${value} in document element ${elementName}, got ${textVal} instead`,
      );
    }
  };
}

// deno-lint-ignore no-explicit-any
export function verifyOjsValue(
  url: string,
  valName: string,
  value: any,
): Verify {
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
}
