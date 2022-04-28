/*
* site.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { exists } from "fs/exists.ts";
import { dirname } from "path/mod.ts";
import { testQuartoCmd } from "../../test.ts";
import { siteOutputForInput } from "../../utils.ts";
import { ensureHtmlElements, noErrorsOrWarnings } from "../../verify.ts";

export const testSite = (
  input: string,
  renderTarget: string,
  includeSelectors: string[],
  excludeSelectors: string[],
) => {
  const output = siteOutputForInput(input);

  const verifySel = ensureHtmlElements(
    output.outputPath,
    includeSelectors,
    excludeSelectors,
  );

  // Run the command
  testQuartoCmd(
    "render",
    [renderTarget],
    [noErrorsOrWarnings, verifySel],
    {
      teardown: async () => {
        const siteDir = dirname(output.outputPath);
        if (await exists(siteDir)) {
          await Deno.remove(siteDir, { recursive: true });
        }
      },
    },
  );
};
