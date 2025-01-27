/*
* config-yaml-validation.test.ts
*
* Copyright (C) 2024 Posit Software, PBC
*
*/

import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import { printsMessage } from "../../verify.ts";

const input = docs("yaml/bad-config-yaml/subfolder/bad-config-yaml.qmd");

testQuartoCmd(
  "render",
  [input],
  [printsMessage("ERROR", /bad-config-yaml[\/\\]+_quarto[.]yml validation failed/)]
);
