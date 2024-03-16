/*
* project-render.test.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import { noErrorsOrWarnings } from "../../verify.ts";

const input = docs("minimal.qmd");

testQuartoCmd(
  "render",
  [input, "-o", "-"],
  [noErrorsOrWarnings],
  {},
);