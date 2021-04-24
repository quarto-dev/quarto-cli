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
  selfContained: boolean,
  supporting: string[],
  keepMd?: string,
) {
  // ammend supporting with lib dir (if it existss
  const libDir = join(
    dirname(input),
    filesDirLibDir(input),
  );
  if (existsSync(libDir)) {
    supporting.push(Deno.realPathSync(libDir));
  }

  // cleanup md if necessary
  if (keepMd && !format.render[kKeepMd] && keepMd !== output) {
    removeIfExists(keepMd);
  }

  // if we aren't keeping the markdown and we are self-contained, then
  // delete the supporting files
  if (
    !format.render[kKeepMd] && !format.render[kKeepTex] && selfContained
  ) {
    if (supporting) {
      supporting.forEach((path) => {
        if (existsSync(path)) {
          Deno.removeSync(path, { recursive: true });
        }
      });
    }
  }
}
