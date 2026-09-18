/*
* numbering-schema.test.ts
*
* T8.1: crossref.numbering schema validation -- the `closed: true`
* crossref object rejects unknown keys, so this key only reaches TS/Lua
* once the schema admits it (document-crossref.yml). The enum is the
* discriminator, not mere key-acceptance: assert both that a valid value
* passes and that an invalid value fails naming the allowed values.
*
* Copyright (C) 2026 Posit Software, PBC
*
*/

import { docs } from "../../utils.ts";
import { testQuartoCmd } from "../../test.ts";
import { printsMessage } from "../../verify.ts";

const validInput = docs("crossrefs/numbering-external.qmd");
const bogusInput = docs("crossrefs/numbering-bogus.qmd");

testQuartoCmd(
  "render",
  [validInput, "--to", "docx"],
  [
    printsMessage({
      level: "ERROR",
      regex: "Validation of YAML front matter failed",
      negate: true,
    }),
  ],
  {
    teardown: () => {
      const out = validInput.replace(/\.qmd$/, ".docx");
      try {
        Deno.removeSync(out);
      } catch {
        // ignore if not created
      }
      return Promise.resolve();
    },
  },
  "quarto render crossref.numbering: external passes schema validation",
);

testQuartoCmd(
  "render",
  [bogusInput, "--to", "docx"],
  [
    printsMessage({
      level: "ERROR",
      regex: /must instead be one of: `quarto`, `external`/,
    }),
  ],
  {},
  "quarto render crossref.numbering: bogus fails schema validation naming quarto/external",
);
