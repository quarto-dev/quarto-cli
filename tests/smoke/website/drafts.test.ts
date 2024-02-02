/*
* drafts.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";

import { join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import { testQuartoCmd } from "../../test.ts";
import { noErrorsOrWarnings } from "../../verify.ts";
import { hasContentLinksToDrafts,hasEnvelopeLinksToDrafts,draftPostHasContent,doesntHaveContentLinksToDrafts,doesntHaveEnvelopeLinksToDrafts,draftPostIsEmpty, searchDoesntHaveDraft, searchHasDraft, siteMapDoesntHaveDraft, siteMapHasDraft } from "./draft-utils.ts";

// The test cases for default
const testCases =  [
    {
      name: "No Drafts",
      verify: [hasContentLinksToDrafts, hasEnvelopeLinksToDrafts, draftPostHasContent, searchHasDraft, siteMapHasDraft],
      dir: docs("websites/drafts/no-drafts")
    },
    {
      name: "Default Draft",
      verify: [doesntHaveContentLinksToDrafts, doesntHaveEnvelopeLinksToDrafts, draftPostHasContent, searchDoesntHaveDraft, siteMapDoesntHaveDraft],
      dir: docs("websites/drafts/drafts-default")
    },
    {
      name: "Visible Draft",
      verify: [hasContentLinksToDrafts, hasEnvelopeLinksToDrafts, draftPostHasContent, searchHasDraft, siteMapHasDraft],
      dir: docs("websites/drafts/drafts-visible")
    },
    {
      name: "Gone Draft",
      verify: [doesntHaveContentLinksToDrafts, doesntHaveEnvelopeLinksToDrafts, draftPostIsEmpty, searchDoesntHaveDraft, siteMapDoesntHaveDraft],
      dir: docs("websites/drafts/drafts-gone")
    },
    {
      name: "Preprocessor Draft List",
      verify: [doesntHaveContentLinksToDrafts, doesntHaveEnvelopeLinksToDrafts, draftPostIsEmpty, searchDoesntHaveDraft, siteMapDoesntHaveDraft],
      dir: docs("websites/drafts/drafts-preprocessor")
    }

  ];
  
// Run the command
for (const testCase of testCases) {
  // Move to a working directory

  const dir = join(Deno.cwd(), testCase.dir);
  const outDir = join(dir, "_site");

  testQuartoCmd(
    "render",
    [testCase.dir],
    [noErrorsOrWarnings, ...testCase.verify.map((ver) => { return ver(outDir)})],
    {
      teardown: async () => {
        if (existsSync(outDir)) {
          await Deno.remove(outDir, { recursive: true });
        }
      },
    },
  );
}

