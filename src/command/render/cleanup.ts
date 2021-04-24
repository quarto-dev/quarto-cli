/*
* renderCleanup.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";

import { removeIfExists } from "../../core/path.ts";

import { Format } from "../../config/format.ts";
import { kKeepMd, kKeepTex } from "../../config/constants.ts";

import { filesDirLibDir } from "./render.ts";

export function renderCleanup(
  input: string,
  output: string,
  format: Format,
  supporting?: string[],
  keepMd?: string,
) {
  // cleanup md if necessary
  if (keepMd && !format.render[kKeepMd] && keepMd !== output) {
    removeIfExists(keepMd);
  }

  // if we aren't keeping the markdown or text and we are instructed to
  // clean supporting files then do it
  if (
    !format.render[kKeepMd] && !format.render[kKeepTex] && supporting
  ) {
    // ammend supporting with lib dir (if it exists)
    const libDir = join(
      dirname(input),
      filesDirLibDir(input),
    );
    if (existsSync(libDir)) {
      supporting.push(Deno.realPathSync(libDir));
    }

    // clean supporting
    supporting.forEach((path) => {
      if (existsSync(path)) {
        Deno.removeSync(path, { recursive: true });
      }
    });
  }
}
