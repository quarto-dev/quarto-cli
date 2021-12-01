import { unitTest } from "../../test.ts";
import { asMappedString } from "../../../src/core/mapped-text.ts";
import { getFormatAliases, expandFormatAliases, getExpandedFormatAliases } from "../../../src/core/schema/format-aliases.ts";
import { assert } from "testing/asserts.ts";

unitTest("format-alias-expansion", () => {
  const expandedAliases = getExpandedFormatAliases();
  for (const [key, value] of Object.entries(expandedAliases)) {
    for (const entry of value) {
      assert(!entry.startsWith("$"));
    }
  }
});
