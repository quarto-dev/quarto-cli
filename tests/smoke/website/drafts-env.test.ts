/*
* drafts.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { docs } from "../../utils.ts";

import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { noErrorsOrWarnings } from "../../verify.ts";
import { doesntHaveContentLinksToDrafts,doesntHaveEnvelopeLinksToDrafts,draftPostIsEmpty, searchDoesntHaveDraft, siteMapDoesntHaveDraft } from "./draft-utils.ts";

const renderDir = docs("websites/drafts/drafts-env");
const dir = join(Deno.cwd(), renderDir);
const outDir = join(dir, "_site");

// The process-global set is required in dev (in-process) mode:
// src/project/project-profile.ts caches the base profile from the env on the
// FIRST render in the process (`baseQuartoProfile`), so a per-render env
// override is ignored whenever another test rendered first. Setting it at
// module load (before any test runs) preserves the pre-existing behavior.
// The context.env below is what reaches the spawned binary in binary mode
// (a fresh process per render, so the cache concern doesn't apply there).
Deno.env.set("QUARTO_PROFILE", "drafts");

testQuartoCmd(
  "render",
  [renderDir],
  [noErrorsOrWarnings, ...[doesntHaveContentLinksToDrafts, doesntHaveEnvelopeLinksToDrafts, draftPostIsEmpty, searchDoesntHaveDraft, siteMapDoesntHaveDraft].map((ver) => { return ver(outDir)})],
  {
    env: { QUARTO_PROFILE: "drafts" },
    teardown: async () => {
      if (existsSync(outDir)) {
        await Deno.remove(outDir, { recursive: true });
      }
    },
  },
);


