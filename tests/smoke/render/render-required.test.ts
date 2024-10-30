/*
* render-callout.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import { printsMessage } from "../../verify.ts";

const input = docs("quarto-required.qmd");

testQuartoCmd(
  "render",
  [input],
  [printsMessage("ERROR", /does not satisfy version/)]
);

let oldVersionRequirement: string | undefined;
let originalDenoExit: typeof Deno.exit;

testQuartoCmd(
  "render",
  [input, "--to", "html+norequire"],
  [printsMessage("ERROR", /does not meet semver requirement/)],
  {
    setup: async () => {
      // Save current version of QUARTO_VERSION_REQUIREMENT env var and set it to a value that will not be satisfied
      oldVersionRequirement = Deno.env.get("QUARTO_VERSION_REQUIREMENT");
      Deno.env.set("QUARTO_VERSION_REQUIREMENT", "< 0.0.0");
      // Mock Deno.exit to throw an error instead of exiting
      // Otherwise we would not check the error assertion
      originalDenoExit = Deno.exit;
      Deno.exit = (code?: number) => {
        throw new Error(`Deno.exit called with code: ${code}`);
      };
    },
    teardown: async () => {
      // Restore QUARTO_VERSION_REQUIREMENT
      if (oldVersionRequirement) {
        Deno.env.set("QUARTO_VERSION_REQUIREMENT", oldVersionRequirement);
      } else {
        Deno.env.delete("QUARTO_VERSION_REQUIREMENT");
      }
      // Restore Deno.exit
      Deno.exit = originalDenoExit;
    },
  }
);
