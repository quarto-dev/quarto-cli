/*
* utils.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, extname, join } from "path/mod.ts";

// Gets output that should be created for this input file and target format
export function outputForInput(input: string, to: string) {
  // TODO: Consider improving this (e.g. for cases like Beamer)
  const dir = dirname(input);
  const stem = basename(input, extname(input));

  let outputExt = to || "html";
  if (to === "latex") {
    outputExt = "tex";
  }

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

export function fileLoader(...path: string[]) {
  return (file: string, to: string) => {
    const input = docs(join(...path, file));
    const output = outputForInput(input, to);
    return {
      input,
      output
    };
  }
}
