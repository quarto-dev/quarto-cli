/*
* lines.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { unitTest } from "../test.ts";
import { assert } from "testing/asserts.ts";
import { lines } from "../../src/core/text.ts";

unitTest("text - lines()", () => {
  const texts = ["a", "b", "c"];
  const splits = ["\n", "\r\n"];
  splits.forEach((split) => {
    assert(
      lines(texts.join(split)).length === texts.length,
      "Invalid line count",
    );
  });
});
