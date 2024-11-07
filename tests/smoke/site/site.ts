/*
 * site.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { dirname } from "../../../src/deno_ral/path.ts";
import { testQuartoCmd, Verify, TestContext, mergeTestContexts } from "../../test.ts";
import { projectOutputForInput, restoreEnvVar, setEnvVar } from "../../utils.ts";
import { ensureHtmlElements, noErrorsOrWarnings } from "../../verify.ts";

export const testSite = (
  input: string,
  renderTarget: string,
  includeSelectors: string[],
  excludeSelectors: string[],
  additionalContext?: TestContext,
  ...verify: Verify[]
) => {
  const output = projectOutputForInput(input);

  const verifySel = ensureHtmlElements(
    output.outputPath,
    includeSelectors,
    excludeSelectors,
  );

  const baseContext: TestContext = {
    teardown: async () => {
      const siteDir = dirname(output.outputPath);
      if (existsSync(siteDir)) {
        await Deno.remove(siteDir, { recursive: true });
      }
    },
  };

  // Run the command
  testQuartoCmd(
    "render",
    [renderTarget],
    [noErrorsOrWarnings, verifySel, ...verify],
    mergeTestContexts(baseContext, additionalContext),
  );
};

export function testSiteWithProfile(profile: string) {
  return (
    input: string,
    renderTarget: string,
    includeSelectors: string[],
    excludeSelectors: string[],
    ...verify: Verify[]
  ) => {
    let profileEnv: string | undefined;
    const additionalContext: TestContext = {
      name: `with profile: ${profile}`,
      setup: async () => {
        profileEnv = setEnvVar("QUARTO_PROFILE", profile);
      },
      teardown: async () => {
        restoreEnvVar("QUARTO_PROFILE", profileEnv);
      }
    }
      testSite(input, renderTarget, includeSelectors, excludeSelectors, additionalContext, ...verify);
  };
}