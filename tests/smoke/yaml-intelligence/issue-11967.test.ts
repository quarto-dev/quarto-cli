/*
 * issue-11967.test.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 *
 */

import { testQuartoCmd } from "../../test.ts";
import { fileLoader } from "../../utils.ts";
import { printsMessage } from "../../verify.ts";

const yamlDocs = fileLoader("yaml");

const testYamlValidationFails = (file: string) => {
  testQuartoCmd(
    "render",
    [yamlDocs(file, "html").input, "--to", "html", "--quiet"],
    [printsMessage({level: "ERROR", regex: /\!expr tags are not allowed in Quarto outside of knitr code cells/})],
  );
};

const files = [
  "issue-11967.qmd",
];

files.forEach(testYamlValidationFails);

