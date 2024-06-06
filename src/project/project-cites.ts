/*
 * project-cites.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureDirSync, existsSync } from "fs/mod.ts";

import { join } from "../deno_ral/path.ts";
import { PandocOptions } from "../command/render/types.ts";
import { FormatPandoc } from "../config/types.ts";
import { projectIsBook } from "./project-shared.ts";

import { projectScratchPath } from "./project-scratch.ts";

export const kCitesIndexFile = "cites-index-file";

const kCiteIndexDir = "cites";

type CiteIndex = Record<string, string[]>;

export function citeIndexFilterParams(
  options: PandocOptions,
  _defaults?: FormatPandoc,
) {
  if (options.project && projectIsBook(options.project)) {
    return {
      [kCitesIndexFile]: citeIndexFile(options.project.dir),
    };
  } else {
    return {};
  }
}

export function citeIndex(projectDir: string) {
  const mainIndexFile = citeIndexFile(projectDir);
  const mainIndex: CiteIndex = existsSync(mainIndexFile)
    ? JSON.parse(Deno.readTextFileSync(mainIndexFile))
    : {};
  return mainIndex;
}

function citeIndexFile(projectDir: string) {
  // read (or create) main index
  const citesDir = projectScratchPath(projectDir, kCiteIndexDir);
  ensureDirSync(citesDir);
  return join(citesDir, "index.json");
}
