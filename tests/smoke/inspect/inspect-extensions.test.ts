/*
* inspect-extensions.test.ts
*
* Copyright (C) 2025 Posit Software, PBC
*
*/
import { assertObjectMatch } from "https://deno.land/std@0.93.0/assert/assert_object_match.ts";
import { FileInclusion } from "../../../src/project/types.ts";
import { testQuartoCmdJson } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";

(() => {
  const input = "docs/inspect/website-with-extensions/extension-test";
  const output = "docs/inspect/website-with-extensions.json";
  testQuartoCmdJson(
    "inspect",
    [input, output],
    output,
    "inspect-extensions",
    (json) => {
      assert(json.extensions.length === 3);
      // 0 is orange-book, 1 is julia-engine (bundled extensions)
      assertEquals(json.extensions[2].title, "Auto Dark Mode");
    },
  );
})();
