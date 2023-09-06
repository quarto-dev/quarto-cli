/*
* render-callout.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import { printsMessage } from "../../verify.ts";

const input = docs("quarto-required.qmd");

testQuartoCmd(
  "render",
  [input],
  [printsMessage("ERROR", /does not satisfy version/)]
);
