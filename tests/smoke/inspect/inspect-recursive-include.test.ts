/*
* inspect-recursive-include.test.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/
import { assertObjectMatch } from "https://deno.land/std@0.93.0/assert/assert_object_match.ts";
import { FileInclusion } from "../../../src/project/types.ts";
import { testQuartoCmdJson } from "../../test.ts";

(() => {
  const input = "docs/websites/issue-9253/index.qmd";
  const output = "docs/websites/issue-9253/index.json";
  testQuartoCmdJson(
    "inspect",
    [input, output],
    output,
    "inspect-include",
    (json) => {
      const info = json.fileInformation["docs/websites/issue-9253/index.qmd"];
      const includeMap: FileInclusion[] = info.includeMap;
      assertObjectMatch(info.includeMap[0], { target: "_include.qmd" });
      assertObjectMatch(info.includeMap[1], { source: "_include.qmd", target: "_include2.qmd" });
    },
  );
})();
