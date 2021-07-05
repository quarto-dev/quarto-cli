/*
* engine-shared.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { restorePreservedHtml } from "../core/jupyter/preserve.ts";
import { PostProcessOptions } from "./types.ts";

export function postProcessRestorePreservedHtml(options: PostProcessOptions) {
  // read the output file
  let output = Deno.readTextFileSync(options.output);

  // substitute
  output = restorePreservedHtml(
    output,
    options.preserve,
  );

  // re-write the output
  Deno.writeTextFileSync(options.output, output);
}
