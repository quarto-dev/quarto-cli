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
export function verifyOjsValue(
  url: string,
  valName: string,
  value: any,
): Verify {
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
}
