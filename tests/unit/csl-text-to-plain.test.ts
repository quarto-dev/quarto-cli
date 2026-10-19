/*
 * csl-text-to-plain.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { cslTextToPlain } from "../../src/core/csl.ts";

const cases: Array<[string, string, string]> = [
  [
    "removes italic, bold, underline, sub and sup tags",
    "A <i>b</i> <b>c</b> <u>d</u> H<sub>2</sub>O x<sup>2</sup>",
    "A b c d H2O x2",
  ],
  [
    "removes small-caps span",
    '<span style="font-variant:small-caps;">sc</span> end',
    "sc end",
  ],
  [
    "leaves entities and bare angle brackets alone",
    "Literal &nbsp; and R&D and a < b",
    "Literal &nbsp; and R&D and a < b",
  ],
  ["leaves math alone", "Math $x^2$", "Math $x^2$"],
  ["handles empty string", "", ""],
];

for (const [name, input, expected] of cases) {
  // deno-lint-ignore require-await
  unitTest(`cslTextToPlain - ${name}`, async () => {
    assertEquals(cslTextToPlain(input), expected);
  });
}
