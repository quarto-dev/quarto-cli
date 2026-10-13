/*
* inspect-include.test.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/
import { assertObjectMatch } from "https://deno.land/std@0.93.0/assert/assert_object_match.ts";
import { testQuartoCmdJson } from "../../test.ts";

(() => {
  const input = "docs/inspect/foo.qmd";
  const output = "docs/inspect/foo.json";
  testQuartoCmdJson(
    "inspect",
    [input, output],
    output,
    "inspect-include",
    (json) => {
      assertObjectMatch(json.fileInformation["docs/inspect/foo.qmd"].includeMap[0],
      {
        source: input,
        target: "_bar.qmd"
      });
    },
  );
})();
