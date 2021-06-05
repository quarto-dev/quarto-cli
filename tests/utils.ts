/*
* utils.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, extname, join } from "path/mod.ts";

// Gets output that should be created for this input file and target format
export function outputForInput(input: string, to: string) {
  const dir = dirname(input);
  const stem = basename(input, extname(input));

  const outputExt = to || "html";

  const outputPath = join(dir, `${stem}.${outputExt}`);
  const supportPath = join(dir, `${stem}_files`);

  return {
    outputPath,
    supportPath,
  };
}

export function docs(path: string): string {
  return join("docs", path);
}
