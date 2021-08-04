/*
* engine-shared.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";

import { restorePreservedHtml } from "../core/jupyter/preserve.ts";
import { PostProcessOptions } from "./types.ts";

export function postProcessRestorePreservedHtml(options: PostProcessOptions) {
  // read the output file
  const outputPath = join(dirname(options.target.input), options.output);
  let output = Deno.readTextFileSync(outputPath);

  // substitute
  output = restorePreservedHtml(
    output,
    options.preserve,
  );

  // re-write the output
  Deno.writeTextFileSync(outputPath, output);
}
