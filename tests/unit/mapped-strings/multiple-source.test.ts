/*
* multiple-source.test.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";
import {
  asMappedString,
  mappedConcat,
} from "../../../src/core/lib/mapped-text.ts";

// deno-lint-ignore require-await
unitTest("multiple-mapped-string-sources", async () => {
  const ms1 = asMappedString("This is from file 1.\n", "file1");
  const ms2 = asMappedString("This is from file 2.\n", "file2");
  const c = mappedConcat([ms1, ms2]);
  assert(c.map(0)?.originalString.fileName === "file1");
  assert(c.map(21)?.originalString.fileName === "file2");
});
