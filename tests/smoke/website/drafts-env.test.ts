/*
* drafts.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";

import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "fs/mod.ts";
import { testQuartoCmd } from "../../test.ts";
import { noErrorsOrWarnings } from "../../verify.ts";
import { doesntHaveContentLinksToDrafts,doesntHaveEnvelopeLinksToDrafts,draftPostIsEmpty, searchDoesntHaveDraft, siteMapDoesntHaveDraft } from "./draft-utils.ts";

const renderDir = docs("websites/drafts/drafts-env");
const dir = join(Deno.cwd(), renderDir);
const outDir = join(dir, "_site");

Deno.env.set("QUARTO_PROFILE", "drafts");

testQuartoCmd(
  "render",
  [renderDir],
  [noErrorsOrWarnings, ...[doesntHaveContentLinksToDrafts, doesntHaveEnvelopeLinksToDrafts, draftPostIsEmpty, searchDoesntHaveDraft, siteMapDoesntHaveDraft].map((ver) => { return ver(outDir)})],
  {
    teardown: async () => {
      if (existsSync(outDir)) {
        await Deno.remove(outDir, { recursive: true });
      }
    },
  },
);


