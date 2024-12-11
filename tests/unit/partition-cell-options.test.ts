/*
* partition-cell-options.test.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { assertEquals } from "testing/asserts";
import { breakQuartoMd } from "../../src/core/lib/break-quarto-md.ts";
import { partitionCellOptions } from "../../src/core/lib/partition-cell-options.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";
import { unitTest } from "../test.ts";
import { docs } from "../utils.ts";

unitTest("partitionCellOptions with two-sided comments", async () => {
  await initYamlIntelligenceResourcesFromFilesystem();
  const qmd = Deno.readTextFileSync(
    docs("partition-cell-options/issue-3901.qmd"),
  );

  await breakQuartoMd(qmd);
  assertEquals(
    partitionCellOptions("c", [
      "/*| echo: true */",
      "/*| eval: false */",
    ]).yaml!.echo,
    true,
  );
});
