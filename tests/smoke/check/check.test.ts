/*
* check.test.ts
*
* Copyright (C) 2020-2025 Posit Software, PBC
*
*/

import { testQuartoCmdJson } from "../../test.ts";

(() => {
  const output = "docs/check.json";
  testQuartoCmdJson(
    "check",
    ["--output", output],
    output,
    "check-json",
    (_json) => {},
  );
})();
