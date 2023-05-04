/*
 * site.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "fs/mod.ts";
import { dirname } from "path/mod.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { siteOutputForInput } from "../../utils.ts";
import { ensureHtmlElements, noErrorsOrWarnings } from "../../verify.ts";

export const testSite = (
  input: string,
  renderTarget: string,
  includeSelectors: string[],
  excludeSelectors: string[],
  ...verify: Verify[]
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
    [noErrorsOrWarnings, verifySel, ...verify],
    {
      teardown: async () => {
        const siteDir = dirname(output.outputPath);
        if (existsSync(siteDir)) {
          await Deno.remove(siteDir, { recursive: true });
        }
      },
    },
  );
};
