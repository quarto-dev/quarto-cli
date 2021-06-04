/*
* project-render.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { testQuartoCmd } from "../test.ts";
import { fileExists } from "../verify.ts";

const expectedFiles = ["plain.qmd", "plain2.qmd"];
const verify = expectedFiles.map((filename) => {
  return fileExists(join("docs/project/plain", filename));
});
testQuartoCmd(
  "render",
  ["docs/project/plain", "--to", "html"],
  verify,
);
